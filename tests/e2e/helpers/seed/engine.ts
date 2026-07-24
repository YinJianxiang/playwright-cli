/**
 * 通用造数引擎：resolve / hit·miss / copy-then-patch / seed-spec / 动态 INSERT / verify。
 * 业务表名与指标列来自 domains/<biz>/db/seed-capability.json，禁止臆造。
 */
import fs from 'fs';
import path from 'path';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { execute, query } from '../db';

export type MetricKind = 'sum' | 'ratio' | 'count';
export type SeedMode = 'hit' | 'miss';
export type RowStrategy = 'synthetic' | 'copy-then-patch';
export type SeedScenario = 'rule_trigger';

export type SeedCapability = {
  key: string;
  plineForm: string;
  dataType: string;
  timeType: string;
  column: string;
  table: string;
  metricKind: MetricKind;
  writeColumns: string[];
  timeGrain: 'hour' | 'day';
  statusDefaults?: Record<string, string>;
  fixedDefaults?: Record<string, string | number>;
  /** 默认 synthetic；copy-then-patch=复制真行骨架再覆盖指标 */
  rowStrategy?: RowStrategy;
  sourceFilter?: { minConsume?: number };
  /** copy 时只合并这些列（缺省=fixedDefaults 的 key + 常见展示列） */
  skeletonColumns?: string[];
  numeratorColumn?: string;
  denominatorColumn?: string;
  implemented: boolean;
  notes?: string;
};

export type SeedCapabilityFile = {
  biz: string;
  ruleTable: string;
  entityIdColumn: string;
  markerPrefix: string;
  capabilities: SeedCapability[];
};

/** 批次契约：本批要造什么（capability 管能不能造） */
export type SeedSpec = {
  scenario: SeedScenario;
  biz: string;
  ruleId: string;
  mode: SeedMode;
  recipeKey?: string;
  rowStrategy?: RowStrategy;
  pairId?: string;
  role?: 'trigger' | 'non_trigger';
  expected?: {
    column: string;
    compareType: string;
    val1: number;
    val2?: number;
  };
  /** 矩阵未覆盖时填写，禁止 apply */
  blocked?: string;
  notes?: string;
};

export type SeedOpts = {
  mode?: SeedMode;
  confirmed?: boolean;
  plan?: SeedPlan;
  /** 已有 seed-spec：覆盖 mode / pair / strategy */
  spec?: SeedSpec;
  pairId?: string;
  role?: 'trigger' | 'non_trigger';
  rowStrategy?: RowStrategy;
  /** 写出 seed-spec / seed-log 的目录（如批次 explore/） */
  specOutDir?: string;
};

export type SeedPlanRow = Record<string, string | number>;

export type SeedPlan = {
  biz: string;
  scenario: SeedScenario;
  recipeKey: string;
  recipe?: string;
  mode: SeedMode;
  ruleId: string;
  table: string;
  plineForm: string;
  compareType: string;
  threshold: number;
  hitHint: string;
  conditionCount: number;
  rowStrategy: RowStrategy;
  sourceRowId?: number | string;
  pairId?: string;
  role?: 'trigger' | 'non_trigger';
  rows: SeedPlanRow[];
};

export type SeedVerify = {
  ok: boolean;
  aggregate?: number | null;
  detail: string;
};

export type SeedResult = SeedPlan & {
  insertId: number;
  promotionId: string;
  cdate: string;
  hour?: string;
  metricValues: Record<string, number>;
  verify?: SeedVerify;
};

export class SeedGapError extends Error {
  readonly kind = 'seed-gap' as const;
  constructor(
    message: string,
    readonly gapKey?: string,
  ) {
    super(message);
    this.name = 'SeedGapError';
  }
}

const TABLE_NAME_RE = /^[a-zA-Z0-9_]+$/;
const SKIP_COPY_COLS = new Set([
  'id',
  'ctime',
  'mtime',
  'create_time',
  'update_time',
  'created_at',
  'updated_at',
]);

export function capabilityPath(biz: string, cwd = process.cwd()): string {
  return path.join(cwd, '.cursor', 'skills', 'domains', biz, 'db', 'seed-capability.json');
}

export function loadCapabilityFile(biz: string, cwd = process.cwd()): SeedCapabilityFile {
  const file = capabilityPath(biz, cwd);
  if (!fs.existsSync(file)) {
    throw new SeedGapError(`缺少 capability 文件: ${file}`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as SeedCapabilityFile;
  if (raw.biz !== biz) {
    throw new Error(`capability.biz=${raw.biz} 与请求 biz=${biz} 不一致`);
  }
  return raw;
}

export function buildRecipeKey(
  plineForm: string,
  dataType: string,
  timeType: string,
  column: string,
): string {
  return `${plineForm}|${dataType}|${timeType}|${column}`;
}

export function resolveCapability(
  registry: SeedCapabilityFile,
  plineForm: string,
  dataType: string,
  timeType: string,
  column: string,
): SeedCapability {
  const key = buildRecipeKey(plineForm, dataType, timeType, column);
  const hit = registry.capabilities.find(
    (c) =>
      c.key === key ||
      (c.plineForm === plineForm &&
        c.dataType === dataType &&
        c.timeType === timeType &&
        c.column === column),
  );
  if (!hit) {
    const known = registry.capabilities
      .filter((c) => c.implemented)
      .map((c) => c.key)
      .join(', ');
    throw new SeedGapError(
      `矩阵未覆盖: key=${key}。已实现: [${known || '无'}]。` +
        `请先在 domains/${registry.biz}/db/seed-capability.json 增行，禁止臆造 INSERT。`,
      key,
    );
  }
  if (!hit.implemented) {
    throw new SeedGapError(
      `capability 已登记但未实现: key=${hit.key}${hit.notes ? `（${hit.notes}）` : ''}`,
      hit.key,
    );
  }
  return hit;
}

export function resolveRowStrategy(
  cap: SeedCapability,
  opts?: Pick<SeedOpts, 'rowStrategy' | 'spec'>,
): RowStrategy {
  return opts?.rowStrategy ?? opts?.spec?.rowStrategy ?? cap.rowStrategy ?? 'synthetic';
}

/** 使聚合指标落在比较式真侧 */
export function computeHitScalar(compareType: string, val1: number, val2?: number): number {
  switch (compareType) {
    case 'le':
      if (val1 <= 0) return val1;
      return Math.min(1, val1);
    case 'lt':
      if (val1 <= 0) {
        throw new Error(`computeHitScalar: compareType=lt 且 val1=${val1} 无法造正值命中`);
      }
      return Math.min(1, val1 / 2);
    case 'ge':
      return val1;
    case 'gt':
      return val1 + 1;
    case 'between': {
      if (val2 == null) throw new Error('computeHitScalar: between 缺少 val2');
      return Number(((val1 + val2) / 2).toFixed(2));
    }
    default:
      throw new Error(`computeHitScalar: 未支持的 compareType=${compareType}`);
  }
}

/** 使聚合指标落在比较式假侧 */
export function computeMissScalar(compareType: string, val1: number, val2?: number): number {
  switch (compareType) {
    case 'le':
      return val1 + 1;
    case 'lt':
      return val1;
    case 'ge':
      if (val1 <= 0) return -1;
      return Math.max(0, val1 - 1);
    case 'gt':
      return val1;
    case 'between': {
      if (val2 == null) throw new Error('computeMissScalar: between 缺少 val2');
      return val2 + 1;
    }
    default:
      throw new Error(`computeMissScalar: 未支持的 compareType=${compareType}`);
  }
}

export function computeMetricValues(
  cap: SeedCapability,
  mode: SeedMode,
  compareType: string,
  val1: number,
  val2?: number,
): Record<string, number> {
  const scalar = mode === 'hit' ? computeHitScalar : computeMissScalar;
  if (cap.metricKind === 'sum' || cap.metricKind === 'count') {
    const col = cap.writeColumns[0];
    if (!col) throw new Error(`capability ${cap.key}: writeColumns 为空`);
    return { [col]: scalar(compareType, val1, val2) };
  }
  if (cap.metricKind === 'ratio') {
    const numCol = cap.numeratorColumn ?? cap.writeColumns[0];
    const denCol = cap.denominatorColumn ?? 'consume';
    if (!numCol) throw new Error(`capability ${cap.key}: 缺少分子列`);
    const consume = 100;
    const targetRatio = scalar(compareType, val1, val2);
    const numerator = Number((targetRatio * consume).toFixed(4));
    return { [numCol]: numerator, [denCol]: consume };
  }
  throw new Error(`未知 metricKind=${(cap as SeedCapability).metricKind}`);
}

export function buildSeedSpecFromPlan(plan: SeedPlan, extra?: Partial<SeedSpec>): SeedSpec {
  return {
    scenario: plan.scenario,
    biz: plan.biz,
    ruleId: plan.ruleId,
    mode: plan.mode,
    recipeKey: plan.recipeKey,
    rowStrategy: plan.rowStrategy,
    pairId: plan.pairId,
    role: plan.role,
    expected: {
      column: plan.recipeKey.split('|')[3] || '',
      compareType: plan.compareType,
      val1: plan.threshold,
    },
    notes: plan.hitHint,
    ...extra,
  };
}

export function writeSeedSpec(dir: string, spec: SeedSpec): string {
  fs.mkdirSync(dir, { recursive: true });
  const name = `seed-spec-${spec.ruleId}-${spec.mode}${spec.pairId ? `-${spec.pairId}` : ''}.json`;
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(spec, null, 2), 'utf8');
  return file;
}

export function loadSeedSpec(filePath: string): SeedSpec {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as SeedSpec;
}

export function writeSeedLog(dir: string, result: SeedResult): string {
  fs.mkdirSync(dir, { recursive: true });
  const name = `seed-log-${result.ruleId}-${result.mode}-${result.insertId}.json`;
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(result, null, 2), 'utf8');
  return file;
}

function toPlanCell(v: unknown): string | number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Buffer.isBuffer(v)) return v.toString('utf8');
  return String(v);
}

/** 从同源表复制 1 条骨架行（不含 id 等） */
export async function fetchSourceSkeleton(opts: {
  table: string;
  plineForm: string;
  minConsume?: number;
  registry: SeedCapabilityFile;
}): Promise<{ sourceRowId?: number | string; skeleton: SeedPlanRow } | null> {
  assertTableAllowed(opts.table, opts.registry);
  const min = opts.minConsume ?? 0;
  const rows = await query<RowDataPacket[]>(
    `SELECT * FROM ${opts.table}
     WHERE pline_form = ? AND consume > ?
     ORDER BY id DESC LIMIT 1`,
    [opts.plineForm, min],
  );
  if (!rows.length) return null;
  const src = rows[0];
  const skeleton: SeedPlanRow = {};
  for (const [k, v] of Object.entries(src)) {
    if (SKIP_COPY_COLS.has(k)) continue;
    const cell = toPlanCell(v);
    if (cell === undefined) continue;
    if (!TABLE_NAME_RE.test(k)) continue;
    skeleton[k] = cell;
  }
  return { sourceRowId: src.id as number | string, skeleton };
}

const DEFAULT_SKELETON_COLS = [
  'account',
  'video_type',
  'media',
  'app_name',
  'book_id',
  'book_name',
  'promotion_name',
];

export async function buildPlanRow(opts: {
  cap: SeedCapability;
  registry: SeedCapabilityFile;
  strategy: RowStrategy;
  entityId: string;
  entityName: string;
  cdate: string;
  hour?: string;
  metricValues: Record<string, number>;
}): Promise<{ row: SeedPlanRow; sourceRowId?: number | string; strategyUsed: RowStrategy }> {
  const { cap, registry, entityId, entityName, cdate, hour, metricValues } = opts;
  let strategyUsed = opts.strategy;
  let sourceRowId: number | string | undefined;
  let row: SeedPlanRow = {
    ...(cap.fixedDefaults ?? {}),
  };

  if (opts.strategy === 'copy-then-patch') {
    const copied = await fetchSourceSkeleton({
      table: cap.table,
      plineForm: cap.plineForm,
      minConsume: cap.sourceFilter?.minConsume ?? 0,
      registry,
    });
    if (copied) {
      const allow = new Set([
        ...(cap.skeletonColumns ?? []),
        ...Object.keys(cap.fixedDefaults ?? {}),
        ...DEFAULT_SKELETON_COLS,
      ]);
      for (const [k, v] of Object.entries(copied.skeleton)) {
        if (!allow.has(k)) continue;
        if (cap.writeColumns.includes(k)) continue;
        row[k] = v;
      }
      sourceRowId = copied.sourceRowId;
    } else {
      strategyUsed = 'synthetic';
    }
  }

  row = {
    ...row,
    cdate,
    pline_form: cap.plineForm,
    [registry.entityIdColumn]: entityId,
    promotion_name: entityName,
    ...(cap.statusDefaults ?? {}),
    ...metricValues,
  };
  if (cap.timeGrain === 'hour' && hour != null) {
    row.hour = hour;
  }

  return { row, sourceRowId, strategyUsed };
}

export function formatSeedPlanForm(plan: SeedPlan): string {
  const lines: string[] = [
    `### 造数预览（${plan.biz} · ${plan.scenario} · ${plan.mode}）`,
    '',
    `| 项 | 值 |`,
    `|----|----|`,
    `| 规则 ID | ${plan.ruleId} |`,
    `| recipeKey | \`${plan.recipeKey}\` |`,
    `| mode | ${plan.mode}${plan.role ? `（${plan.role}）` : ''} |`,
    `| pairId | ${plan.pairId ?? '-'} |`,
    `| rowStrategy | ${plan.rowStrategy}${plan.sourceRowId != null ? ` ← source id=${plan.sourceRowId}` : ''} |`,
    `| 目标表 | \`${plan.table}\` |`,
    `| pline_form | ${plan.plineForm} |`,
    `| 命中说明 | ${plan.hitHint} |`,
    `| 比较 | ${plan.compareType} ${plan.threshold} |`,
    `| 条件条数 | ${plan.conditionCount}（首版按第 1 条造数） |`,
    `| 拟插入行数 | ${plan.rows.length} |`,
    '',
    `#### 拟 INSERT 字段`,
    '',
  ];

  for (let i = 0; i < plan.rows.length; i++) {
    const row = plan.rows[i];
    lines.push(`**行 ${i + 1}**`, '', `| 字段 | 值 |`, `|------|----|`);
    for (const [k, v] of Object.entries(row)) {
      lines.push(`| ${k} | ${typeof v === 'string' ? v : String(v)} |`);
    }
    lines.push('');
  }

  lines.push('请确认是否写入测试库？回复 **确认造数** / **取消**。');
  return lines.join('\n');
}

export function assertTableAllowed(table: string, registry: SeedCapabilityFile): void {
  if (!TABLE_NAME_RE.test(table)) {
    throw new Error(`非法表名: ${table}`);
  }
  const ok = registry.capabilities.some((c) => c.table === table);
  if (!ok) {
    throw new SeedGapError(`表 ${table} 不在 capability 白名单，拒绝 INSERT`);
  }
}

export async function insertPlanRow(
  table: string,
  row: SeedPlanRow,
  registry: SeedCapabilityFile,
): Promise<number> {
  assertTableAllowed(table, registry);
  const columns = Object.keys(row);
  if (!columns.length) throw new Error('insertPlanRow: 空行');
  for (const col of columns) {
    if (!TABLE_NAME_RE.test(col)) throw new Error(`非法列名: ${col}`);
  }
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  const values = columns.map((c) => row[c]);
  const result = await execute(sql, values);
  return Number((result as ResultSetHeader).insertId);
}

export async function deleteSeedRows(opts: {
  table: string;
  plineForm: string;
  entityIdColumn: string;
  entityId: string;
  cdate: string;
  registry: SeedCapabilityFile;
}): Promise<number> {
  assertTableAllowed(opts.table, opts.registry);
  if (!TABLE_NAME_RE.test(opts.entityIdColumn)) {
    throw new Error(`非法实体列: ${opts.entityIdColumn}`);
  }
  const result = await execute(
    `DELETE FROM ${opts.table}
     WHERE pline_form = ? AND ${opts.entityIdColumn} = ? AND cdate = ?`,
    [opts.plineForm, opts.entityId, opts.cdate],
  );
  return Number((result as ResultSetHeader).affectedRows);
}

function compareHolds(
  actual: number,
  compareType: string,
  val1: number,
  val2: number | undefined,
  mode: SeedMode,
): boolean {
  let holds: boolean;
  switch (compareType) {
    case 'le':
      holds = actual <= val1;
      break;
    case 'lt':
      holds = actual < val1;
      break;
    case 'ge':
      holds = actual >= val1;
      break;
    case 'gt':
      holds = actual > val1;
      break;
    case 'between':
      holds = val2 != null && actual >= val1 && actual <= val2;
      break;
    default:
      return false;
  }
  return mode === 'hit' ? holds : !holds;
}

/** 写库后校验 sum(主指标列) 是否落在 mode 期望侧 */
export async function verifySeedAggregate(opts: {
  plan: SeedPlan;
  registry: SeedCapabilityFile;
  metricColumn: string;
}): Promise<SeedVerify> {
  const { plan, registry, metricColumn } = opts;
  if (!TABLE_NAME_RE.test(metricColumn)) {
    return { ok: false, detail: `非法指标列 ${metricColumn}` };
  }
  assertTableAllowed(plan.table, registry);
  const entityId = String(plan.rows[0]?.[registry.entityIdColumn] ?? '');
  const rows = await query<RowDataPacket[]>(
    `SELECT SUM(${metricColumn}) AS agg
     FROM ${plan.table}
     WHERE pline_form = ? AND ${registry.entityIdColumn} = ? AND cdate = ?`,
    [plan.plineForm, entityId, plan.rows[0]?.cdate],
  );
  const agg = rows[0]?.agg == null ? null : Number(rows[0].agg);
  if (agg == null || Number.isNaN(agg)) {
    return { ok: false, aggregate: agg, detail: '聚合为空，未找到造数行' };
  }
  const ok = compareHolds(agg, plan.compareType, plan.threshold, undefined, plan.mode);
  return {
    ok,
    aggregate: agg,
    detail: ok
      ? `verify OK: sum(${metricColumn})=${agg} 符合 mode=${plan.mode} ${plan.compareType} ${plan.threshold}`
      : `verify FAIL: sum(${metricColumn})=${agg} 不符合 mode=${plan.mode} ${plan.compareType} ${plan.threshold}`,
  };
}
