/**
 * ad-control 造数适配：读规则 → capability resolve → seed-spec / copy-then-patch / hit·miss。
 * 可造范围以 `.cursor/skills/domains/ad-control/db/seed-capability.json` 为准。
 */
import type { RowDataPacket } from 'mysql2';
import { pingDb, query } from '../db';
import {
  type SeedCapabilityFile,
  type SeedMode,
  type SeedOpts,
  type SeedPlan,
  type SeedResult,
  type SeedSpec,
  SeedGapError,
  buildPlanRow,
  buildSeedSpecFromPlan,
  computeMetricValues,
  deleteSeedRows,
  formatSeedPlanForm,
  insertPlanRow,
  loadCapabilityFile,
  loadSeedSpec,
  resolveCapability,
  resolveRowStrategy,
  verifySeedAggregate,
  writeSeedLog,
  writeSeedSpec,
} from './engine';

export type { SeedOpts, SeedPlan, SeedResult, SeedMode, SeedSpec };
export { formatSeedPlanForm, SeedGapError, loadSeedSpec, writeSeedSpec };

const BIZ = 'ad-control';

type RuleRow = RowDataPacket & {
  id: number;
  pline_form: string;
  data_type: string;
  conditions: string;
  opt_status: number | null;
  project_status: number | null;
};

type Condition = {
  timeType?: string;
  column?: string;
  reduceType?: string;
  compareType?: string;
  val1?: number;
  val2?: number;
};

function registry(): SeedCapabilityFile {
  return loadCapabilityFile(BIZ);
}

function parseConditions(conditionsJson: string): Condition[] {
  let list: Condition[];
  try {
    list = JSON.parse(conditionsJson) as Condition[];
  } catch {
    throw new Error(`planSeedViaDb: conditions JSON 解析失败: ${conditionsJson}`);
  }
  if (!Array.isArray(list) || !list.length) {
    throw new Error('planSeedViaDb: conditions 为空');
  }
  return list;
}

function parsePrimaryCondition(conditionsJson: string): {
  cond: {
    timeType: string;
    column: string;
    compareType: string;
    val1: number;
    val2?: number;
  };
  conditionCount: number;
} {
  const list = parseConditions(conditionsJson);
  const raw = list[0];
  if (!raw.column) {
    throw new Error(`planSeedViaDb: conditions[0] 缺少 column: ${conditionsJson}`);
  }
  if (raw.timeType == null || raw.timeType === '') {
    throw new Error(`planSeedViaDb: conditions[0] 缺少 timeType: ${conditionsJson}`);
  }
  if (raw.val1 == null || Number.isNaN(Number(raw.val1))) {
    throw new Error(`planSeedViaDb: 缺少有效阈值 val1: ${conditionsJson}`);
  }
  return {
    conditionCount: list.length,
    cond: {
      timeType: String(raw.timeType),
      column: String(raw.column),
      compareType: raw.compareType || 'le',
      val1: Number(raw.val1),
      val2: raw.val2 == null ? undefined : Number(raw.val2),
    },
  };
}

/**
 * 只规划、不写库。可传入 seed-spec / mode=miss / rowStrategy。
 * 若 opts.specOutDir 有值，写出 seed-spec-*.json。
 */
export async function planSeedViaDb(ruleId: string, opts?: SeedOpts): Promise<SeedPlan> {
  const spec = opts?.spec;
  if (spec?.blocked) {
    throw new SeedGapError(`seed-spec 已标记 blocked: ${spec.blocked}`, spec.recipeKey);
  }
  if (spec && spec.ruleId !== String(ruleId)) {
    throw new Error(`planSeedViaDb: spec.ruleId=${spec.ruleId} 与 ruleId=${ruleId} 不一致`);
  }

  const mode: SeedMode = opts?.mode ?? spec?.mode ?? 'hit';
  const pairId = opts?.pairId ?? spec?.pairId;
  const role =
    opts?.role ??
    spec?.role ??
    (mode === 'hit' ? 'trigger' : mode === 'miss' ? 'non_trigger' : undefined);
  const capFile = registry();

  const ping = await pingDb();
  // eslint-disable-next-line no-console
  console.log(`DB_PING ok=${ping.ok} db=${ping.db} ruleId=${ruleId} mode=${mode}`);

  const rules = await query<RuleRow[]>(
    `SELECT id, pline_form, data_type, conditions, opt_status, project_status
     FROM ${capFile.ruleTable} WHERE id = ?`,
    [ruleId],
  );
  if (!rules.length) {
    throw new Error(`planSeedViaDb: rule id=${ruleId} not found in ${capFile.ruleTable}`);
  }
  const rule = rules[0];
  const { cond, conditionCount } = parsePrimaryCondition(rule.conditions);

  const cap = resolveCapability(
    capFile,
    rule.pline_form,
    rule.data_type,
    cond.timeType,
    cond.column,
  );

  if (spec?.recipeKey && spec.recipeKey !== cap.key) {
    throw new SeedGapError(
      `seed-spec.recipeKey=${spec.recipeKey} 与规则解析 key=${cap.key} 不一致`,
      cap.key,
    );
  }

  const strategy = resolveRowStrategy(cap, opts);
  const metricValues = computeMetricValues(cap, mode, cond.compareType, cond.val1, cond.val2);

  const clock = await query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS cdate, LPAD(HOUR(NOW()), 2, '0') AS hour`,
  );
  const cdate = String(clock[0].cdate);
  const hour = String(clock[0].hour);

  const entityId = `${capFile.markerPrefix}${ruleId}_${mode}_${Date.now()}`;
  const entityName = `${capFile.markerPrefix}${ruleId}_${mode}`;

  const built = await buildPlanRow({
    cap,
    registry: capFile,
    strategy,
    entityId,
    entityName,
    cdate,
    hour,
    metricValues,
  });

  const metricHint = Object.entries(metricValues)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  const multiNote =
    conditionCount > 1
      ? `；注意：规则共 ${conditionCount} 条条件，首版仅按第 1 条造数`
      : '';
  const strategyNote =
    built.strategyUsed !== strategy
      ? `；copy 无源行，已回退 synthetic`
      : built.sourceRowId != null
        ? `；骨架源 id=${built.sourceRowId}`
        : '';

  const plan: SeedPlan = {
    biz: BIZ,
    scenario: 'rule_trigger',
    recipeKey: cap.key,
    recipe: cap.key,
    mode,
    ruleId: String(ruleId),
    table: cap.table,
    plineForm: cap.plineForm,
    compareType: cond.compareType,
    threshold: cond.val1,
    hitHint: `mode=${mode} 规则 ${cond.column} ${cond.compareType} ${cond.val1} → 拟写 ${metricHint}${multiNote}${strategyNote}`,
    conditionCount,
    rowStrategy: built.strategyUsed,
    sourceRowId: built.sourceRowId,
    pairId,
    role,
    rows: [built.row],
  };

  if (opts?.specOutDir) {
    const specPath = writeSeedSpec(opts.specOutDir, buildSeedSpecFromPlan(plan));
    // eslint-disable-next-line no-console
    console.log(`SEED_SPEC_WRITTEN ${specPath}`);
  }

  return plan;
}

/**
 * 将已确认的 plan 写入库；写后 verify 聚合是否落在 mode 期望侧。
 */
export async function applySeedViaDb(
  plan: SeedPlan,
  opts?: Pick<SeedOpts, 'specOutDir'>,
): Promise<SeedResult> {
  if (plan.biz !== BIZ) {
    throw new Error(`applySeedViaDb: biz=${plan.biz} 与适配器 ${BIZ} 不一致`);
  }
  if (plan.rows.length !== 1) {
    throw new Error('applySeedViaDb: 首版仅支持单行');
  }
  const capFile = registry();
  const row = plan.rows[0];
  const insertId = await insertPlanRow(plan.table, row, capFile);

  const promotionId = String(row[capFile.entityIdColumn] ?? '');
  const cdate = String(row.cdate ?? '');
  const hour = row.hour != null ? String(row.hour) : undefined;
  const metricValues: Record<string, number> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'number') metricValues[k] = v;
  }

  const metricColumn = plan.recipeKey.split('|')[3] || Object.keys(metricValues)[0] || 'consume';
  const verify = await verifySeedAggregate({
    plan,
    registry: capFile,
    metricColumn,
  });

  const seed: SeedResult = {
    ...plan,
    insertId,
    promotionId,
    cdate,
    hour,
    metricValues,
    verify,
  };

  // eslint-disable-next-line no-console
  console.log(
    `SEED_OK biz=${BIZ} key=${seed.recipeKey} mode=${seed.mode} table=${seed.table} ` +
      `promotionId=${seed.promotionId} cdate=${seed.cdate} hour=${seed.hour ?? '-'} ` +
      `metrics=${JSON.stringify(metricValues)} verify=${verify.ok} insertId=${seed.insertId}`,
  );
  // eslint-disable-next-line no-console
  console.log(`SEED_VERIFY ${verify.detail}`);

  if (opts?.specOutDir) {
    const logPath = writeSeedLog(opts.specOutDir, seed);
    // eslint-disable-next-line no-console
    console.log(`SEED_LOG_WRITTEN ${logPath}`);
  }

  if (!verify.ok) {
    throw new Error(`applySeedViaDb: ${verify.detail}`);
  }

  return seed;
}

/**
 * 造数入口。
 * - 交互：plan → format → 确认 → seedViaDb(..., { confirmed: true, plan })
 * - 自动化：confirmed: true 或 E2E_SEED_AUTO_CONFIRM=1
 * - 成对 miss：seedViaDb(id, { mode: 'miss', pairId: 'case-1', confirmed: true })
 */
export async function seedViaDb(ruleId: string, opts?: SeedOpts): Promise<SeedResult> {
  const auto = process.env.E2E_SEED_AUTO_CONFIRM === '1' || process.env.E2E_SEED_AUTO_CONFIRM === 'true';
  const confirmed = opts?.confirmed === true || auto;
  if (!confirmed) {
    throw new Error(
      'seedViaDb: 未确认造数。请先 planSeedViaDb + formatSeedPlanForm 展示表单，' +
        '用户确认后调用 seedViaDb(ruleId, { confirmed: true, plan })；' +
        '或 Playwright 设 E2E_SEED_AUTO_CONFIRM=1 / opts.confirmed=true',
    );
  }

  const plan = opts?.plan ?? (await planSeedViaDb(ruleId, opts));
  if (plan.ruleId !== String(ruleId)) {
    throw new Error(`seedViaDb: plan.ruleId=${plan.ruleId} 与入参 ruleId=${ruleId} 不一致`);
  }
  return applySeedViaDb(plan, opts);
}

/** 按造数结果清理本批事实行（06-cleanup） */
export async function cleanupSeedViaDb(
  seed: Pick<SeedResult, 'table' | 'promotionId' | 'cdate' | 'plineForm'> & {
    plineForm?: string;
  },
): Promise<number> {
  const capFile = registry();
  const plineForm = seed.plineForm ?? 'cpsvideomf';
  const n = await deleteSeedRows({
    table: seed.table,
    plineForm,
    entityIdColumn: capFile.entityIdColumn,
    entityId: seed.promotionId,
    cdate: seed.cdate,
    registry: capFile,
  });
  // eslint-disable-next-line no-console
  console.log(`SEED_CLEANUP deleted=${n} promotionId=${seed.promotionId} cdate=${seed.cdate}`);
  return n;
}

/** 列出已实现 key（供 Agent / 缺口报告） */
export function listImplementedKeys(): string[] {
  return registry()
    .capabilities.filter((c) => c.implemented)
    .map((c) => c.key);
}

/** 从文件加载 seed-spec 再 plan（编排便捷入口） */
export async function planFromSeedSpecFile(
  specPath: string,
  opts?: Omit<SeedOpts, 'spec'>,
): Promise<SeedPlan> {
  const spec = loadSeedSpec(specPath);
  return planSeedViaDb(spec.ruleId, { ...opts, spec });
}
