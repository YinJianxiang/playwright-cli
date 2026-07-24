/**
 * 通用造数 CLI（rule_trigger 冒烟）
 *
 * 用法：
 *   node scripts/seed-run.mjs --ruleId=12283              # 读库规则 plan（不写库）
 *   node scripts/seed-run.mjs --ruleId=12283 --apply      # 确认后写库
 *   node scripts/seed-run.mjs --compare=ge --val1=10      # 无规则：按 capability 默认 key + 显式比较造数
 *   node scripts/seed-run.mjs --compare=ge --val1=10 --mode=miss --apply
 *   node scripts/seed-run.mjs --cleanup --promotionId=... --cdate=YYYY-MM-DD
 */
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function loadEnv() {
  for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function loadCapability() {
  const file = path.resolve(
    '.cursor/skills/domains/ad-control/db/seed-capability.json',
  );
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function computeHitScalar(compareType, val1, val2) {
  switch (compareType) {
    case 'le':
      return val1 <= 0 ? val1 : Math.min(1, val1);
    case 'lt':
      if (val1 <= 0) throw new Error(`lt 且 val1=${val1} 无法造正值命中`);
      return Math.min(1, val1 / 2);
    case 'ge':
      return val1;
    case 'gt':
      return val1 + 1;
    case 'between':
      if (val2 == null) throw new Error('between 缺 val2');
      return Number(((val1 + val2) / 2).toFixed(2));
    default:
      throw new Error(`未支持 compareType=${compareType}`);
  }
}

function computeMissScalar(compareType, val1, val2) {
  switch (compareType) {
    case 'le':
      return val1 + 1;
    case 'lt':
      return val1;
    case 'ge':
      return val1 <= 0 ? -1 : Math.max(0, val1 - 1);
    case 'gt':
      return val1;
    case 'between':
      if (val2 == null) throw new Error('between 缺 val2');
      return val2 + 1;
    default:
      throw new Error(`未支持 compareType=${compareType}`);
  }
}

function formatPlan(plan) {
  const lines = [
    `### 造数预览（${plan.biz} · ${plan.scenario} · ${plan.mode}）`,
    '',
    `| 项 | 值 |`,
    `|----|----|`,
    `| 规则 ID | ${plan.ruleId} |`,
    `| recipeKey | \`${plan.recipeKey}\` |`,
    `| mode | ${plan.mode} |`,
    `| rowStrategy | ${plan.rowStrategy}${plan.sourceRowId != null ? ` ← source id=${plan.sourceRowId}` : ''} |`,
    `| 目标表 | \`${plan.table}\` |`,
    `| 命中说明 | ${plan.hitHint} |`,
    `| 比较 | ${plan.compareType} ${plan.threshold} |`,
    `| 拟插入行数 | ${plan.rows.length} |`,
    '',
    `#### 拟 INSERT 字段`,
    '',
  ];
  for (const [i, row] of plan.rows.entries()) {
    lines.push(`**行 ${i + 1}**`, '', `| 字段 | 值 |`, `|------|----|`);
    for (const [k, v] of Object.entries(row)) {
      lines.push(`| ${k} | ${v} |`);
    }
    lines.push('');
  }
  lines.push('确认写库：加上 `--apply` 再跑同一命令。');
  return lines.join('\n');
}

loadEnv();

const DO_APPLY = hasFlag('apply');
const DO_CLEANUP = hasFlag('cleanup');
const mode = arg('mode', 'hit');
const ruleId = arg('ruleId', 'manual');
const compareOverride = arg('compare', null);
const val1Override = arg('val1', null);
const val2Override = arg('val2', null);
const outDir = arg(
  'out',
  path.resolve('tests/e2e/generated/_seed-smoke/explore'),
);

const capFile = loadCapability();
const cap = capFile.capabilities.find((c) => c.implemented) || capFile.capabilities[0];
if (!cap) throw new Error('seed-capability 无可用行');

const pool = await mysql.createPool({
  host: process.env.E2E_DB_HOST,
  port: Number(process.env.E2E_DB_PORT || 3306),
  user: process.env.E2E_DB_USER,
  password: process.env.E2E_DB_PASSWORD,
  database: process.env.E2E_DB_NAME,
});

if (DO_CLEANUP) {
  const promotionId = arg('promotionId', null);
  const cdate = arg('cdate', null);
  if (!promotionId || !cdate) {
    throw new Error('cleanup 需要 --promotionId= --cdate=');
  }
  const [r] = await pool.execute(
    `DELETE FROM ${cap.table}
     WHERE pline_form = ? AND ${capFile.entityIdColumn} = ? AND cdate = ?`,
    [cap.plineForm, promotionId, cdate],
  );
  console.log(`SEED_CLEANUP deleted=${r.affectedRows} promotionId=${promotionId}`);
  await pool.end();
  process.exit(0);
}

let compareType = compareOverride || 'ge';
let val1 = val1Override != null ? Number(val1Override) : 10;
let val2 = val2Override != null ? Number(val2Override) : undefined;
let resolvedRuleId = ruleId;

if (ruleId !== 'manual' && !compareOverride) {
  const [rules] = await pool.query(
    `SELECT id, pline_form, data_type, conditions FROM ${capFile.ruleTable} WHERE id = ?`,
    [ruleId],
  );
  if (!rules.length) throw new Error(`rule ${ruleId} not found`);
  const rule = rules[0];
  if (rule.pline_form !== cap.plineForm || rule.data_type !== cap.dataType) {
    throw new Error(
      `规则 ${ruleId} 为 ${rule.pline_form}/${rule.data_type}，当前 capability 仅 ${cap.plineForm}/${cap.dataType}`,
    );
  }
  const list = JSON.parse(rule.conditions);
  const cond = list[0];
  if (String(cond.timeType) !== cap.timeType || cond.column !== cap.column) {
    throw new Error(
      `规则条件 ${cond.timeType}/${cond.column} 与 capability ${cap.timeType}/${cap.column} 不一致`,
    );
  }
  compareType = cond.compareType || 'le';
  val1 = Number(cond.val1);
  val2 = cond.val2 == null ? undefined : Number(cond.val2);
  resolvedRuleId = String(rule.id);
}

const scalar = mode === 'hit' ? computeHitScalar : computeMissScalar;
const consume = scalar(compareType, val1, val2);

const [clock] = await pool.query(
  `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS cdate, LPAD(HOUR(NOW()), 2, '0') AS hour`,
);
const cdate = String(clock[0].cdate);
const hour = String(clock[0].hour);
const entityId = `${capFile.markerPrefix}${resolvedRuleId}_${mode}_${Date.now()}`;

let rowStrategy = cap.rowStrategy || 'synthetic';
let sourceRowId;
const row = {
  ...(cap.fixedDefaults || {}),
  cdate,
  hour,
  pline_form: cap.plineForm,
  [capFile.entityIdColumn]: entityId,
  promotion_name: `${capFile.markerPrefix}${resolvedRuleId}_${mode}`,
  ...(cap.statusDefaults || {}),
  consume,
};

if (rowStrategy === 'copy-then-patch') {
  const min = cap.sourceFilter?.minConsume ?? 0;
  const [srcRows] = await pool.query(
    `SELECT * FROM ${cap.table}
     WHERE pline_form = ? AND consume > ?
     ORDER BY id DESC LIMIT 1`,
    [cap.plineForm, min],
  );
  if (srcRows[0]) {
    sourceRowId = srcRows[0].id;
    const allow = new Set([
      ...(cap.skeletonColumns || []),
      ...Object.keys(cap.fixedDefaults || {}),
      'account',
      'video_type',
      'media',
      'app_name',
      'book_id',
      'book_name',
    ]);
    for (const [k, v] of Object.entries(srcRows[0])) {
      if (!allow.has(k) || v == null || k === 'consume') continue;
      if (typeof v === 'object') continue;
      row[k] = v;
    }
    Object.assign(row, cap.statusDefaults || {}, {
      cdate,
      hour,
      pline_form: cap.plineForm,
      [capFile.entityIdColumn]: entityId,
      promotion_name: `${capFile.markerPrefix}${resolvedRuleId}_${mode}`,
      consume,
    });
  } else {
    rowStrategy = 'synthetic';
  }
}

const plan = {
  biz: 'ad-control',
  scenario: 'rule_trigger',
  recipeKey: cap.key,
  mode,
  ruleId: resolvedRuleId,
  table: cap.table,
  plineForm: cap.plineForm,
  compareType,
  threshold: val1,
  hitHint: `mode=${mode} 消耗 ${compareType} ${val1} → consume=${consume}`,
  rowStrategy,
  sourceRowId,
  rows: [row],
};

fs.mkdirSync(outDir, { recursive: true });
const specPath = path.join(outDir, `seed-spec-${resolvedRuleId}-${mode}.json`);
fs.writeFileSync(
  specPath,
  JSON.stringify(
    {
      scenario: 'rule_trigger',
      biz: 'ad-control',
      ruleId: resolvedRuleId,
      mode,
      recipeKey: cap.key,
      rowStrategy,
      expected: { column: 'consume', compareType, val1, val2 },
      notes: plan.hitHint,
    },
    null,
    2,
  ),
  'utf8',
);

console.log(formatPlan(plan));
console.log(`\nSEED_SPEC_WRITTEN ${specPath}`);

if (!DO_APPLY) {
  console.log('\n未写库。确认后执行同命令并加 --apply');
  await pool.end();
  process.exit(0);
}

const cols = Object.keys(row);
const placeholders = cols.map(() => '?').join(', ');
const [ins] = await pool.execute(
  `INSERT INTO ${plan.table} (${cols.join(', ')}) VALUES (${placeholders})`,
  cols.map((c) => row[c]),
);

const [chk] = await pool.query(
  `SELECT SUM(consume) AS agg FROM ${plan.table}
   WHERE pline_form = ? AND ${capFile.entityIdColumn} = ? AND cdate = ?`,
  [cap.plineForm, entityId, cdate],
);
const agg = Number(chk[0].agg);
let holds = false;
if (compareType === 'ge') holds = agg >= val1;
else if (compareType === 'gt') holds = agg > val1;
else if (compareType === 'le') holds = agg <= val1;
else if (compareType === 'lt') holds = agg < val1;
else if (compareType === 'between') holds = agg >= val1 && agg <= val2;
const ok = mode === 'hit' ? holds : !holds;

const result = {
  ...plan,
  insertId: ins.insertId,
  promotionId: entityId,
  cdate,
  hour,
  consume,
  verify: { ok, aggregate: agg },
};
const logPath = path.join(outDir, `seed-log-${resolvedRuleId}-${mode}-${ins.insertId}.json`);
fs.writeFileSync(logPath, JSON.stringify(result, null, 2), 'utf8');

console.log(
  `SEED_OK insertId=${ins.insertId} promotionId=${entityId} consume=${consume} verify=${ok} agg=${agg}`,
);
console.log(`SEED_LOG_WRITTEN ${logPath}`);
if (!ok) {
  await pool.end();
  throw new Error(`verify FAIL: sum(consume)=${agg} mode=${mode} ${compareType} ${val1}`);
}

await pool.end();
