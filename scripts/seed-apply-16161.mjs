/**
 * 规则 16161 造数：渠道 × syhplay
 * 条件：当天累计整体ROI ≤10；近3日(不含当天)连续 CPA ≥10
 * 表：ad_advertiser_hm_channel_day
 * 公式（DataControlMapper）：
 *   all_roi = (n_predict_income/1000 + n_cz_money) / consume
 *   cpa     = consume / n_uv_hour
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
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

loadEnv();

const RULE_ID = process.argv.find((a) => /^\d+$/.test(a)) || '16161';
const DO_APPLY = process.argv.includes('--apply');
const PLAN_JSON = path.resolve(
  'tests/e2e/generated/20260723-181053/explore/seed-plan-16161.json',
);

const pool = await mysql.createPool({
  host: process.env.E2E_DB_HOST,
  port: Number(process.env.E2E_DB_PORT || 3306),
  user: process.env.E2E_DB_USER,
  password: process.env.E2E_DB_PASSWORD,
  database: process.env.E2E_DB_NAME,
  multipleStatements: false,
});

const [rules] = await pool.query(
  `SELECT id, pline_form, data_type, conditions, opt_status, project_status, status
   FROM ad_data_control_rule WHERE id = ?`,
  [RULE_ID],
);
if (!rules.length) throw new Error(`rule ${RULE_ID} not found`);
const rule = rules[0];
if (rule.pline_form !== 'syhplay' || rule.data_type !== 'channel') {
  throw new Error(`unexpected rule shape: ${rule.pline_form}/${rule.data_type}`);
}

let channelCode;
let account;
let rows;

if (DO_APPLY && fs.existsSync(PLAN_JSON)) {
  const plan = JSON.parse(fs.readFileSync(PLAN_JSON, 'utf8'));
  channelCode = plan.channelCode;
  account = plan.account;
  rows = plan.rows;
  console.log(`APPLY from plan json channelCode=${channelCode}`);
} else {
  const [dates] = await pool.query(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d0,
            DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d') AS d1,
            DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '%Y-%m-%d') AS d2,
            DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '%Y-%m-%d') AS d3`,
  );
  const { d0, d1, d2, d3 } = dates[0];
  channelCode = `e2e_dc_${RULE_ID}_${Date.now()}`;
  account = `e2e_dc_${RULE_ID}`;

  /** 当天 ROI≈5 ≤10：consume=100, n_cz_money=500, n_predict_income=0 */
  const today = {
    cdate: d0,
    consume: 100,
    n_uv_hour: 20,
    n_predict_income: 0,
    n_cz_money: 500,
    hit: 'all_roi=(0/1000+500)/100=5 ≤10',
  };

  /** 近3日连续 CPA=10 ≥10：每天 consume=100, n_uv_hour=10 */
  const pastDays = [d1, d2, d3].map((cdate) => ({
    cdate,
    consume: 100,
    n_uv_hour: 10,
    n_predict_income: 0,
    n_cz_money: 0,
    hit: 'cpa=100/10=10 ≥10',
  }));

  rows = [today, ...pastDays];
}

const insertSql = `INSERT INTO ad_advertiser_hm_channel_day
  (pline_form, channel_code, account, cdate, consume, real_consume,
   n_uv_hour, n_predict_income, n_cz_money, media, app_name)
VALUES
  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const sqlPreview = rows
  .map((r) => {
    const params = [
      'syhplay',
      channelCode,
      account,
      r.cdate,
      r.consume,
      r.consume,
      r.n_uv_hour,
      r.n_predict_income,
      r.n_cz_money,
      '2',
      'e2e_河马剧场',
    ];
    const lit = params.map((p) => (typeof p === 'number' ? String(p) : `'${String(p).replace(/'/g, "''")}'`));
    return `${insertSql.replace(/\s+/g, ' ')}\n-- values: (${lit.join(', ')})\n-- ${r.hit}`;
  })
  .join('\n\n');

const verifySql = `-- 校验命中口径（与 Job day 表公式对齐）
SELECT cdate,
       channel_code,
       consume,
       n_uv_hour,
       n_predict_income,
       n_cz_money,
       ROUND(consume / NULLIF(n_uv_hour, 0), 2) AS cpa,
       ROUND(((n_predict_income / 1000) + n_cz_money) / NULLIF(consume, 0), 4) AS all_roi
FROM ad_advertiser_hm_channel_day
WHERE pline_form = 'syhplay' AND channel_code = '${channelCode}'
ORDER BY cdate DESC;`;

console.log('### 造数预览（Recipe C · syhplay channel · hit）\n');
console.log(`| 项 | 值 |`);
console.log(`|----|----|`);
console.log(`| 规则 ID | ${RULE_ID} |`);
console.log(`| pline_form / data_type | ${rule.pline_form} / ${rule.data_type} |`);
console.log(`| 目标表 | ad_advertiser_hm_channel_day |`);
console.log(`| channel_code | ${channelCode} |`);
console.log(`| 规则 status | ${rule.status}（1=开） |`);
console.log(`| 条件 | 当天 all_roi≤10；近3日(d1..d3) 连续 cpa≥10 |`);
console.log(`| 拟插入行数 | ${rows.length} |`);
console.log('');
console.log('#### 拟 INSERT 行');
console.log('');
for (const r of rows) {
  console.log(
    `| ${r.cdate} | consume=${r.consume} n_uv=${r.n_uv_hour} predict=${r.n_predict_income} cz=${r.n_cz_money} | ${r.hit} |`,
  );
}
console.log('\n#### SQL\n');
console.log(sqlPreview);
console.log('\n');
console.log(verifySql);
console.log('');

if (!DO_APPLY) {
  console.log('未写库。确认后执行: node scripts/seed-apply-16161.mjs --apply');
  // also write plan file for batch
  const outDir = path.resolve('tests/e2e/generated/20260723-181053/explore');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'seed-plan-16161.md'),
    [
      '### 造数预览（Recipe C · syhplay channel · hit）',
      '',
      `| 项 | 值 |`,
      `|----|----|`,
      `| 规则 ID | ${RULE_ID} |`,
      `| 表 | ad_advertiser_hm_channel_day |`,
      `| channel_code | ${channelCode} |`,
      '',
      '#### SQL',
      '',
      '```sql',
      sqlPreview,
      '',
      verifySql,
      '```',
      '',
      '回复 **确认造数** 后执行 `--apply`。',
      '',
    ].join('\n'),
    'utf8',
  );
  // persist channel for apply
  fs.writeFileSync(
    path.join(outDir, 'seed-plan-16161.json'),
    JSON.stringify({ ruleId: RULE_ID, channelCode, account, rows, d0, d1, d2, d3 }, null, 2),
    'utf8',
  );
  await pool.end();
  process.exit(0);
}

// apply
const insertIds = [];
for (const r of rows) {
  const [result] = await pool.execute(insertSql, [
    'syhplay',
    channelCode,
    account,
    r.cdate,
    r.consume,
    r.consume,
    r.n_uv_hour,
    r.n_predict_income,
    r.n_cz_money,
    '2',
    'e2e_河马剧场',
  ]);
  insertIds.push(result.insertId);
  console.log(`INSERTED id=${result.insertId} cdate=${r.cdate}`);
}

const [check] = await pool.query(
  `SELECT cdate, channel_code, consume, n_uv_hour, n_predict_income, n_cz_money,
          ROUND(consume / NULLIF(n_uv_hour, 0), 2) AS cpa,
          ROUND(((n_predict_income / 1000) + n_cz_money) / NULLIF(consume, 0), 4) AS all_roi
   FROM ad_advertiser_hm_channel_day
   WHERE pline_form = 'syhplay' AND channel_code = ?
   ORDER BY cdate DESC`,
  [channelCode],
);
console.log('VERIFY', JSON.stringify(check, null, 2));
console.log(`SEED_OK ruleId=${RULE_ID} channelCode=${channelCode} insertIds=${insertIds.join(',')}`);

await pool.end();
