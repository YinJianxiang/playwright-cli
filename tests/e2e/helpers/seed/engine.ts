/**
 * 通用造数引擎：table-map + metric-map + 白名单 resolve / hit·miss / copy-then-patch / verify。
 * 业务语义来自 domains/<biz>/knowledge，运行时只读取其确定性 Seed V3 产物。
 */
import fs from 'fs';
import path from 'path';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { execute, query } from '../db';

export type MetricKind = 'sum' | 'ratio' | 'count';
export type SeedMode = 'hit' | 'miss';
export type RowStrategy = 'synthetic' | 'copy-then-patch';
export type SeedScenario = 'rule_trigger';
export type TimeGrain = 'hour' | 'day';
export type MetricStatus = 'verified' | 'provisional';
export type SeedEvaluationPhase = 'aggregate' | 'post-filter';
export type SeedPolicy = {
  forceGrain?: TimeGrain;
  evaluationPhase: SeedEvaluationPhase;
  standaloneRule: 'allowed' | 'blocked';
};
export type MetricEvidence = {
  source: string;
  formulaChecked?: boolean;
  schemaChecked?: boolean;
  checkedAt?: string;
  notes?: string;
};

export type TableMapEntry = {
  plineForm: string;
  dataType: string;
  timeGrain: TimeGrain;
  table: string;
  entityIdColumn?: string;
  entityNameColumn?: string;
  /** Job 路由：3=全域 → pay_roi3_*；缺省=默认表（排除 releaseVer=3 的 Job） */
  releaseVer?: number;
  notes?: string;
  jobKey?: string;
  jobTitle?: string;
};

export type MetricMapEntry = {
  column: string;
  metricKind: MetricKind;
  writeColumns: string[];
  numeratorColumn?: string;
  denominatorColumn?: string;
  notes?: string;
  desc?: string;
  plines?: string[];
  status?: MetricStatus;
  seedPolicy?: SeedPolicy;
  evidence?: MetricEvidence;
  requireReleaseVer?: number;
};

/** 白名单行：不含 table/metricKind（由 map 拼装） */
export type SeedAllowEntry = {
  key: string;
  plineForm: string;
  dataType: string;
  timeType: string;
  column: string;
  releaseVers?: number[];
  sourceFilter?: { minConsume?: number };
  statusDefaults?: Record<string, string>;
  fixedDefaults?: Record<string, string | number>;
  skeletonColumns?: string[];
  allowSynthetic?: boolean;
  notes?: string;
};

/** 运行时能力（allow + maps 拼装结果） */
export type SeedCapability = {
  key: string;
  releaseVer: number;
  plineForm: string;
  dataType: string;
  timeType: string;
  column: string;
  table: string;
  metricKind: MetricKind;
  writeColumns: string[];
  timeGrain: TimeGrain;
  statusDefaults?: Record<string, string>;
  fixedDefaults?: Record<string, string | number>;
  rowStrategy?: RowStrategy;
  sourceFilter?: { minConsume?: number };
  skeletonColumns?: string[];
  entityIdColumn?: string;
  entityNameColumn?: string;
  numeratorColumn?: string;
  denominatorColumn?: string;
  /** 白名单命中即 true */
  implemented: boolean;
  allowSynthetic: boolean;
  notes?: string;
  tableMapKey?: string;
  metricMapColumn?: string;
  metricStatus: MetricStatus;
  seedPolicy: SeedPolicy;
  metricEvidence?: MetricEvidence;
};

export function resolveEntityIdColumn(
  cap: SeedCapability,
  registry: SeedCapabilityFile,
): string {
  return cap.entityIdColumn || registry.entityIdColumn;
}

export function resolveEntityNameColumn(cap: SeedCapability): string | undefined {
  // 渠道表无名称列；仅 table-map / capability 显式配置时写入（如 promotion_name / project_name）
  return cap.entityNameColumn || undefined;
}

/** 实体键是否须全数字（项目 / 渠道） */
export function isNumericEntityIdColumn(column: string): boolean {
  return column === 'channel_code' || column === 'promotion_id' || column === 'project_id';
}

export type SeedCapabilityFile = {
  knowledgeVersion: string;
  evidenceDigest: string;
  biz: string;
  ruleTable: string;
  entityIdColumn: string;
  markerPrefix: string;
  defaultReleaseVer?: number;
  supportedReleaseVers?: number[];
  defaultRowStrategy: RowStrategy;
  allowSynthetic: boolean;
  allowed: SeedAllowEntry[];
  /** 由 allowed × maps 预解析，供 assertTableAllowed / 按 key 查找 */
  capabilities: SeedCapability[];
  tableMap: TableMapEntry[];
  metricMap: MetricMapEntry[];
  filterKnowledge: Array<{
    id: string;
    ruleField: string;
    status: 'verified' | 'unknown' | 'deprecated';
    unlimited?: unknown[];
    patchColumn?: string;
  }>;
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

export type SeedExtraInsert = {
  table: string;
  recipeKey: string;
  rows: SeedPlanRow[];
  /** verify 用的指标 column（capability key 第 4 段） */
  verifyColumn: string;
  compareType: string;
  threshold: number;
  note?: string;
};

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
  /** 规则侧过滤摘要（与 form.applied / Job WHERE 对齐） */
  ruleFilters?: Record<string, string | number | null>;
  rows: SeedPlanRow[];
  /**
   * 附加写入（跨表）。例：小时维 + model_pred_roi → 主行写 hour(convert_num)，
   * extra 写 day(model_pred_roi) 供 Job 后置过滤。
   */
  extraInserts?: SeedExtraInsert[];
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

const CLIENT_PLINES = new Set(['syhplay', 'cltmain', 'cltplay']);
const NEAR_HOUR_TYPES = new Set(['1', '2', '3', '6', '53', '43']);

export function dbDir(biz: string, cwd = process.cwd()): string {
  return path.join(cwd, '.cursor', 'skills', 'domains', biz, 'knowledge');
}

export function capabilityPath(biz: string, cwd = process.cwd()): string {
  return path.join(dbDir(biz, cwd), 'seed-runtime-v3.json');
}

export function tableMapPath(biz: string, cwd = process.cwd()): string {
  return capabilityPath(biz, cwd);
}

export function metricMapPath(biz: string, cwd = process.cwd()): string {
  return capabilityPath(biz, cwd);
}

function readJsonFile<T>(file: string, label: string): T {
  if (!fs.existsSync(file)) {
    throw new SeedGapError(`缺少 ${label}: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

const capabilityFileCache = new Map<string, SeedCapabilityFile>();

/** Job timeType + releaseVer → hour|day（对齐 DataControlService.calTableDimension）
 *
 * - 客户端：仅近 N 小时 → hour，否则 day
 * - 非客户端且 releaseVer≠3：当天 / 近 N 小时 → hour；近 N 天等 → day
 * - releaseVer=3（全域）：仅近 N 小时 → hour；**当天 / 近 N 天 → day（roi3 天表）**
 */
export function resolveTimeGrain(
  plineForm: string,
  timeType: string,
  releaseVer?: number | null,
): TimeGrain {
  const t = String(timeType);
  const rv = releaseVer == null || releaseVer === -1 ? null : Number(releaseVer);

  if (CLIENT_PLINES.has(plineForm)) {
    return NEAR_HOUR_TYPES.has(t) ? 'hour' : 'day';
  }

  if (rv === 3) {
    // 全域：当天不进「非客户端当天→hour」分支，保持 DAY
    return NEAR_HOUR_TYPES.has(t) ? 'hour' : 'day';
  }

  if (NEAR_HOUR_TYPES.has(t) || t === '0') {
    return 'hour';
  }
  return 'day';
}

export function lookupTableMap(
  entries: TableMapEntry[],
  plineForm: string,
  dataType: string,
  timeGrain: TimeGrain,
  releaseVer?: number | null,
): TableMapEntry {
  const base = entries.filter(
    (e) =>
      e.plineForm === plineForm && e.dataType === dataType && e.timeGrain === timeGrain,
  );
  if (!base.length) {
    throw new SeedGapError(
      `KNOWLEDGE_UNKNOWN: dimensions 未覆盖 ${plineForm}|${dataType}|${timeGrain}，禁止臆造表名。`,
      `${plineForm}|${dataType}|${timeGrain}`,
    );
  }
  const rv = releaseVer == null || releaseVer === -1 ? null : Number(releaseVer);
  if (rv != null) {
    const exact = base.find((e) => e.releaseVer === rv);
    if (exact) return exact;
  }
  const def = base.find((e) => e.releaseVer == null);
  if (def) return def;
  return base[0];
}

export function lookupMetricMap(
  entries: MetricMapEntry[],
  column: string,
  plineForm?: string,
): MetricMapEntry {
  const col = String(column);
  let matches = entries.filter((e) => e.column === col);
  if (!matches.length && col.startsWith('hour_')) {
    matches = entries.filter((e) => e.column === col.slice(5));
  }
  if (!matches.length) {
    throw new SeedGapError(
      `KNOWLEDGE_UNKNOWN: conditions 未覆盖 column=${col}，禁止臆造写列。`,
      col,
    );
  }
  if (plineForm) {
    const byPline = matches.find((e) => e.plines?.includes(plineForm));
    if (byPline) return byPline;
  }
  return matches[0];
}

export function composeCapability(
  allow: SeedAllowEntry,
  table: TableMapEntry,
  metric: MetricMapEntry,
  opts: {
    defaultRowStrategy: RowStrategy;
    allowSynthetic: boolean;
    releaseVer: number;
  },
): SeedCapability {
  const allowSynthetic = allow.allowSynthetic === true || opts.allowSynthetic === true;
  return {
    key: buildRecipeKey(
      allow.plineForm,
      allow.dataType,
      opts.releaseVer,
      allow.timeType,
      allow.column,
    ),
    releaseVer: opts.releaseVer,
    plineForm: allow.plineForm,
    dataType: allow.dataType,
    timeType: allow.timeType,
    column: allow.column,
    table: table.table,
    metricKind: metric.metricKind,
    writeColumns: [...metric.writeColumns],
    timeGrain: table.timeGrain,
    statusDefaults: allow.statusDefaults,
    fixedDefaults: allow.fixedDefaults,
    rowStrategy: opts.defaultRowStrategy,
    sourceFilter: allow.sourceFilter,
    skeletonColumns: allow.skeletonColumns,
    entityIdColumn: table.entityIdColumn,
    entityNameColumn: table.entityNameColumn,
    numeratorColumn: metric.numeratorColumn,
    denominatorColumn: metric.denominatorColumn,
    implemented: true,
    allowSynthetic,
    notes: [allow.notes, metric.notes].filter(Boolean).join('；') || undefined,
    tableMapKey:
      table.releaseVer != null
        ? `${table.plineForm}|${table.dataType}|${table.timeGrain}|rv${table.releaseVer}`
        : `${table.plineForm}|${table.dataType}|${table.timeGrain}`,
    metricMapColumn: metric.column,
    metricStatus: metric.status ?? 'provisional',
    seedPolicy: metric.seedPolicy ?? {
      evaluationPhase: 'aggregate',
      standaloneRule: 'allowed',
    },
    metricEvidence: metric.evidence,
  };
}

export function loadCapabilityFile(biz: string, cwd = process.cwd()): SeedCapabilityFile {
  const cacheKey = `${path.resolve(cwd)}|${biz}`;
  const cached = capabilityFileCache.get(cacheKey);
  if (cached) return cached;
  const runtime = readJsonFile<{
    knowledgeVersion: string;
    evidenceDigest: string;
    seedDefaults: {
      biz: string;
      ruleTable: string;
      entityIdColumn?: string;
      markerPrefix: string;
      defaultRowStrategy?: RowStrategy;
      allowSynthetic?: boolean;
      defaultReleaseVer?: number;
      supportedReleaseVers?: number[];
    };
    tables: TableMapEntry[];
    metrics: MetricMapEntry[];
    capabilities: SeedAllowEntry[];
    filters: SeedCapabilityFile['filterKnowledge'];
  }>(capabilityPath(biz, cwd), 'Seed V3 knowledge runtime');
  const raw = {
    ...runtime.seedDefaults,
    allowed: runtime.capabilities,
  };

  if (raw.biz !== biz) {
    throw new Error(`capability.biz=${raw.biz} 与请求 biz=${biz} 不一致`);
  }

  const tableMap = [...runtime.tables];
  const metricMap = runtime.metrics;
  const jobRouteFile = path.join(
    dbDir(biz, cwd),
    'compiled',
    'job-chain',
    'dimension-route-matrix.json',
  );
  if (fs.existsSync(jobRouteFile)) {
    const routes = readJsonFile<Array<{
      plineForm: string;
      dataType: string;
      releaseVersion: string | number;
      grain: TimeGrain;
      table: string;
      tableExists: boolean;
      status: string;
      mapperStatement?: string;
    }>>(jobRouteFile, 'promoted Job dimension routes');
    for (const route of routes) {
      if (route.status !== 'verified' || !route.tableExists) continue;
      const releaseVer = String(route.releaseVersion) === '3' ? 3 : undefined;
      if (
        tableMap.some(
          (entry) =>
            entry.plineForm === route.plineForm &&
            entry.dataType === route.dataType &&
            entry.timeGrain === route.grain &&
            entry.releaseVer === releaseVer,
        )
      ) {
        continue;
      }
      const entityIdColumn =
        route.dataType === 'channel'
          ? 'channel_code'
          : route.dataType === 'project'
            ? 'project_id'
            : route.dataType === 'promotion'
              ? 'promotion_id'
              : 'agent_user_name';
      const entityNameColumn =
        route.dataType === 'project'
          ? 'project_name'
          : route.dataType === 'promotion'
            ? 'promotion_name'
            : undefined;
      tableMap.push({
        plineForm: route.plineForm,
        dataType: route.dataType,
        timeGrain: route.grain,
        table: route.table,
        entityIdColumn,
        entityNameColumn,
        releaseVer,
        jobKey: route.mapperStatement,
        notes: `promoted Job route: release=${route.releaseVersion}`,
      });
    }
  }

  const defaultRowStrategy = raw.defaultRowStrategy ?? 'copy-then-patch';
  const allowSynthetic = raw.allowSynthetic === true;

  const allowedByKey = new Map<string, SeedAllowEntry>(
    (raw.allowed ?? []).map((entry) => [entry.key, { ...entry }]),
  );
  for (const entry of allowedByKey.values()) {
    const metric = lookupMetricMap(metricMap, entry.column, entry.plineForm);
    if (metric.requireReleaseVer != null) {
      entry.releaseVers = [metric.requireReleaseVer];
    }
  }
  const jobMatrixFile = path.join(
    dbDir(biz, cwd),
    'compiled',
    'job-chain',
    'condition-formula-matrix.json',
  );
  if (fs.existsSync(jobMatrixFile)) {
    const matrix = readJsonFile<Array<{
      plineForm: string;
      dataType: string;
      releaseVersion: string | number;
      timeType: string;
      metric: string;
      tableExists: boolean;
      status: string;
      missingAliases?: string[];
      mapperStatement?: string;
    }>>(jobMatrixFile, 'promoted Job condition matrix');
    const supported = runtime.seedDefaults.supportedReleaseVers ?? [];
    for (const row of matrix) {
      if (
        row.status !== 'verified' ||
        !row.tableExists ||
        (row.missingAliases?.length ?? 0) > 0 ||
        !metricMap.some(
          (metric) =>
            metric.column === row.metric ||
            (row.metric.startsWith('hour_') &&
              metric.column === row.metric.slice(5)),
        )
      ) {
        continue;
      }
      const key = `${row.plineForm}|${row.dataType}|${row.timeType}|${row.metric}`;
      const releaseVersion = String(row.releaseVersion);
      const releaseVers =
        releaseVersion === '3'
          ? [3]
          : releaseVersion === 'not-3'
            ? supported.filter((version) => version !== 3)
            : [...supported];
      const current = allowedByKey.get(key);
      if (current) {
        current.releaseVers = [
          ...new Set([...(current.releaseVers ?? []), ...releaseVers]),
        ].sort();
      } else {
        allowedByKey.set(key, {
          key,
          plineForm: row.plineForm,
          dataType: row.dataType,
          timeType: String(row.timeType),
          column: row.metric,
          releaseVers: [...new Set(releaseVers)].sort(),
          sourceFilter: { minConsume: 0 },
          notes: `promoted Job matrix: ${row.mapperStatement ?? 'unknown mapper'}`,
        });
      }
    }
  }
  const allowed = [...allowedByKey.values()];

  const capabilities: SeedCapability[] = [];
  for (const allow of allowed) {
    const metric = lookupMetricMap(metricMap, allow.column, allow.plineForm);
    // 预解析：默认表 + releaseVer=3（grain 可能不同：当天默认 hour，全域当天 day）
    const rvList = [
      ...(runtime.seedDefaults.supportedReleaseVers ?? []),
      runtime.seedDefaults.defaultReleaseVer,
    ].filter((value, index, values): value is number =>
      value != null && values.indexOf(value) === index,
    );
    for (const rv of rvList) {
      if (allow.releaseVers?.length && !allow.releaseVers.includes(rv)) {
        continue;
      }
      if (metric.requireReleaseVer != null && metric.requireReleaseVer !== rv) {
        continue;
      }
      const grain = resolveTimeGrain(allow.plineForm, allow.timeType, rv);
      try {
        const table = lookupTableMap(
          tableMap,
          allow.plineForm,
          allow.dataType,
          grain,
          rv,
        );
        capabilities.push(
          composeCapability(allow, table, metric, {
            defaultRowStrategy,
            allowSynthetic,
            releaseVer: rv,
          }),
        );
      } catch {
        // 该 rv 无表映射则跳过
      }
    }
  }

  const result: SeedCapabilityFile = {
    knowledgeVersion: runtime.knowledgeVersion,
    evidenceDigest: runtime.evidenceDigest,
    biz: raw.biz,
    ruleTable: raw.ruleTable,
    entityIdColumn: raw.entityIdColumn || 'promotion_id',
    markerPrefix: raw.markerPrefix,
    defaultReleaseVer: runtime.seedDefaults.defaultReleaseVer,
    supportedReleaseVers: runtime.seedDefaults.supportedReleaseVers,
    defaultRowStrategy,
    allowSynthetic,
    allowed,
    capabilities,
    tableMap,
    metricMap,
    filterKnowledge: runtime.filters,
  };
  capabilityFileCache.set(cacheKey, result);
  return result;
}

export function buildRecipeKey(
  plineForm: string,
  dataType: string,
  releaseVer: number,
  timeType: string,
  column: string,
): string {
  return `${plineForm}|${dataType}|rv${releaseVer}|${timeType}|${column}`;
}

function findAllowEntry(
  registry: SeedCapabilityFile,
  plineForm: string,
  dataType: string,
  timeType: string,
  column: string,
): SeedAllowEntry {
  const legacyKey = `${plineForm}|${dataType}|${timeType}|${column}`;
  const hit = registry.allowed.find(
    (c) =>
      c.key === legacyKey ||
      (c.plineForm === plineForm &&
        c.dataType === dataType &&
        c.timeType === timeType &&
        c.column === column),
  );
  if (!hit) {
    const known = registry.allowed.map((c) => c.key).join(', ');
    throw new SeedGapError(
      `白名单未覆盖: key=${legacyKey}。已允许: [${known || '无'}]。` +
        `请通过 knowledge candidate/diff/promote 补齐 verified capability，禁止臆造 INSERT。`,
      legacyKey,
    );
  }
  return hit;
}

/** 白名单 + table-map + metric-map → 运行时 SeedCapability
 * releaseVer：仅用于 Job 选表（3→roi3）；不是 capability 字段白名单。
 * forceGrain：覆盖 resolveTimeGrain（如 model_pred_roi 天表后置过滤须写 day）
 */
export function resolveSeedCapability(
  registry: SeedCapabilityFile,
  plineForm: string,
  dataType: string,
  timeType: string,
  column: string,
  releaseVer?: number | null,
  opts?: { forceGrain?: TimeGrain },
): SeedCapability {
  const effectiveReleaseVer =
    releaseVer == null || releaseVer === -1
      ? registry.defaultReleaseVer
      : Number(releaseVer);
  if (effectiveReleaseVer == null) {
    throw new SeedGapError(
      'RELEASE_VERSION_UNRESOLVED: 规则未指定投放版本，知识库也没有 defaultReleaseVer',
    );
  }
  const allow = findAllowEntry(registry, plineForm, dataType, timeType, column);
  const key = buildRecipeKey(plineForm, dataType, effectiveReleaseVer, timeType, column);
  const registered = registry.capabilities.find((capability) => capability.key === key);
  if (!registered) {
    throw new SeedGapError(
      `CAPABILITY_NOT_ALLOWED: 投放版本能力未覆盖 ${key}`,
      key,
    );
  }
  const grain =
    opts?.forceGrain ?? resolveTimeGrain(plineForm, timeType, effectiveReleaseVer);
  const table = lookupTableMap(
    registry.tableMap,
    plineForm,
    dataType,
    grain,
    effectiveReleaseVer,
  );
  const metric = lookupMetricMap(registry.metricMap, column, plineForm);
  if (
    metric.requireReleaseVer != null &&
    metric.requireReleaseVer !== effectiveReleaseVer
  ) {
    throw new SeedGapError(
      `CAPABILITY_NOT_ALLOWED: ${column} 仅适用于 releaseVer=${metric.requireReleaseVer}`,
      key,
    );
  }
  return composeCapability(allow, table, metric, {
    defaultRowStrategy: registry.defaultRowStrategy,
    allowSynthetic: registry.allowSynthetic,
    releaseVer: effectiveReleaseVer,
  });
}

/** @deprecated 使用 resolveSeedCapability */
export function resolveCapability(
  registry: SeedCapabilityFile,
  plineForm: string,
  dataType: string,
  timeType: string,
  column: string,
  releaseVer?: number | null,
): SeedCapability {
  return resolveSeedCapability(registry, plineForm, dataType, timeType, column, releaseVer);
}

export function resolveRowStrategy(
  cap: SeedCapability,
  opts?: Pick<SeedOpts, 'rowStrategy' | 'spec'>,
  registry?: SeedCapabilityFile,
): RowStrategy {
  return (
    opts?.rowStrategy ??
    opts?.spec?.rowStrategy ??
    cap.rowStrategy ??
    registry?.defaultRowStrategy ??
    'copy-then-patch'
  );
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
  'channel_code',
  'book_id',
  'book_name',
  'video_type',
  'media',
  'app_name',
  'promotion_name',
  'promotion_status',
  'project_id',
  'project_name',
  'project_status',
  'delivery_way',
  'external_action',
  'agent_user_name',
];

/** 预警/管控记录页常展示的身份字段（造数预览优先列出） */
export const SEED_DISPLAY_IDENTITY_COLS = [
  'account',
  'channel_code',
  'book_id',
  'book_name',
  'app_name',
  'agent_user_name',
  'promotion_id',
  'project_id',
  'project_name',
  'media',
  'external_action',
] as const;

export async function buildPlanRow(opts: {
  cap: SeedCapability;
  registry: SeedCapabilityFile;
  strategy: RowStrategy;
  entityId: string;
  entityName: string;
  cdate: string;
  hour?: string;
  metricValues: Record<string, number>;
  /** 来自规则过滤的事实列补丁（状态 / 转化目标 / 投放方式等） */
  finalFactPatch?: Record<string, string | number>;
}): Promise<{ row: SeedPlanRow; sourceRowId?: number | string; strategyUsed: RowStrategy }> {
  const { cap, registry, entityId, entityName, cdate, hour, metricValues } = opts;
  let strategyUsed = opts.strategy;
  let sourceRowId: number | string | undefined;
  let row: SeedPlanRow = {};

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
        ...Object.keys(opts.finalFactPatch ?? {}),
      ]);
      for (const [k, v] of Object.entries(copied.skeleton)) {
        if (!allow.has(k)) continue;
        if (cap.writeColumns.includes(k)) continue;
        row[k] = v;
      }
      sourceRowId = copied.sourceRowId;
    } else if (cap.allowSynthetic) {
      strategyUsed = 'synthetic';
    } else {
      throw new SeedGapError(
        `copy-then-patch 无源行: table=${cap.table} pline=${cap.plineForm}。` +
          `禁止静默 synthetic；请确认库内有可复制行，或白名单显式 allowSynthetic=true。`,
        cap.key,
      );
    }
  }

  // fixedDefaults 仅补缺，不覆盖源行已复制的 account / channel_code / book_id 等
  for (const [k, v] of Object.entries(cap.fixedDefaults ?? {})) {
    if (row[k] == null || row[k] === '') row[k] = v;
  }

  const idCol = resolveEntityIdColumn(cap, registry);
  const nameCol = resolveEntityNameColumn(cap);
  row = {
    ...row,
    cdate,
    pline_form: cap.plineForm,
    [idCol]: entityId,
    ...(nameCol ? { [nameCol]: entityName } : {}),
    ...(cap.statusDefaults ?? {}),
    ...(opts.finalFactPatch ?? {}),
    ...metricValues,
  };
  if (cap.timeGrain === 'hour' && hour != null) {
    row.hour = hour;
  }

  // 渠道/项目/广告事实表列集不同：丢掉目标表不存在的列（如 channel 无 promotion_name / project_status）
  row = await filterRowToTableColumns(cap.table, row);

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
  ];

  for (let i = 0; i < plan.rows.length; i++) {
    const row = plan.rows[i];
    const identityKeys = SEED_DISPLAY_IDENTITY_COLS.filter(
      (k) => row[k] != null && String(row[k]) !== '',
    );
    lines.push(
      `#### 行 ${i + 1} · 预警展示字段（优先自源行复制 account / channel_code / book_id）`,
      '',
      `| 字段 | 值 |`,
      `|------|----|`,
    );
    if (identityKeys.length) {
      for (const k of identityKeys) {
        lines.push(`| ${k} | ${typeof row[k] === 'string' ? row[k] : String(row[k])} |`);
      }
    } else {
      lines.push('| _(无)_ | 源行未带出 account/channel_code/book_id |');
    }

    lines.push('', `#### 行 ${i + 1} · 其余拟 INSERT 字段`, '', `| 字段 | 值 |`, `|------|----|`);
    const identitySet = new Set<string>(SEED_DISPLAY_IDENTITY_COLS as unknown as string[]);
    for (const [k, v] of Object.entries(row)) {
      if (identitySet.has(k)) continue;
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
    throw new SeedGapError(
      `表 ${table} 不在白名单解析结果中（allowed × table-map），拒绝 INSERT`,
    );
  }
}

/**
 * 取当前表中「纯数字」实体键的 MAX+1（字符串形式，避免科学计数）。
 * 仅用于 `channel_code` / `promotion_id` / `project_id`；表内无纯数字行时从 1 起。
 */
export async function allocateNumericEntityId(opts: {
  table: string;
  column: string;
  registry: SeedCapabilityFile;
  offset?: number;
}): Promise<string> {
  return allocateNumericEntityIdAcrossTables({
    tables: [opts.table],
    column: opts.column,
    registry: opts.registry,
    offset: opts.offset,
  });
}

/**
 * 在多个目标表中取同一数字实体列的全局 MAX，再加指定偏移。
 * 多表计划必须共用一个渠道号，才能让小时表、天表数据归属于同一实体。
 */
export async function allocateNumericEntityIdAcrossTables(opts: {
  tables: string[];
  column: string;
  registry: SeedCapabilityFile;
  offset?: number;
}): Promise<string> {
  const tables = [...new Set(opts.tables)].sort();
  if (tables.length === 0) {
    throw new Error('allocateNumericEntityIdAcrossTables 至少需要一张目标表');
  }
  for (const table of tables) assertTableAllowed(table, opts.registry);
  if (!TABLE_NAME_RE.test(opts.column)) {
    throw new Error(`非法实体列: ${opts.column}`);
  }
  if (!isNumericEntityIdColumn(opts.column)) {
    throw new Error(
      `allocateNumericEntityId 仅支持 channel_code/promotion_id/project_id，收到 ${opts.column}`,
    );
  }
  const offset = BigInt(opts.offset ?? 1);
  if (offset < 1n) throw new Error(`allocateNumericEntityId offset 必须大于 0，收到 ${offset}`);
  /** DECIMAL(20,0) 上限 20 位；更长纯数字视为脏数据，截断末尾后再 MAX，避免溢出 */
  const maxDigits = 20;
  let maximum = 0n;
  for (const table of tables) {
    const rows = await query<RowDataPacket[]>(
      `SELECT CAST(MAX(CAST(
          CASE
            WHEN CHAR_LENGTH(\`${opts.column}\`) > ${maxDigits}
              THEN LEFT(\`${opts.column}\`, ${maxDigits})
            ELSE \`${opts.column}\`
          END AS DECIMAL(20,0)
        )) AS CHAR) AS m
       FROM \`${table}\`
       WHERE \`${opts.column}\` REGEXP '^[0-9]+$'`,
    );
    const raw = rows[0]?.m == null ? '' : String(rows[0].m).trim();
    if (/^\d+$/.test(raw)) {
      const normalized = raw.length > maxDigits ? raw.slice(0, maxDigits) : raw;
      const value = BigInt(normalized);
      if (value > maximum) maximum = value;
    }
  }
  let next = maximum + offset;
  if (next < 1n) next = 1n;
  return next.toString();
}

const tableColumnCache = new Map<string, Set<string>>();

async function getTableColumnSet(table: string): Promise<Set<string>> {
  const cached = tableColumnCache.get(table);
  if (cached) return cached;
  if (!TABLE_NAME_RE.test(table)) throw new Error(`非法表名: ${table}`);
  const rows = await query<RowDataPacket[]>(`SHOW COLUMNS FROM ${table}`);
  const set = new Set(rows.map((r) => String(r.Field)));
  tableColumnCache.set(table, set);
  return set;
}

/** 仅保留目标表真实存在的列，避免 channel/project/promotion 列集差异导致 INSERT 失败 */
export async function filterRowToTableColumns(
  table: string,
  row: SeedPlanRow,
): Promise<SeedPlanRow> {
  const cols = await getTableColumnSet(table);
  const out: SeedPlanRow = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (cols.has(k)) out[k] = v;
    else dropped.push(k);
  }
  if (dropped.length) {
    console.warn(
      `SEED_COL_FILTER table=${table} dropped=${dropped.join(',')}`,
    );
  }
  return out;
}

export async function insertPlanRow(
  table: string,
  row: SeedPlanRow,
  registry: SeedCapabilityFile,
): Promise<number> {
  throw new Error('SEED_V3_ONLY: direct row insertion is disabled');
  assertTableAllowed(table, registry);
  const filtered = await filterRowToTableColumns(table, row);
  const columns = Object.keys(filtered);
  if (!columns.length) throw new Error('insertPlanRow: 空行');
  for (const col of columns) {
    if (!TABLE_NAME_RE.test(col)) throw new Error(`非法列名: ${col}`);
  }
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `REMOVED_V3_ONLY ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  const values = columns.map((c) => filtered[c]);
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
  throw new Error('SEED_V3_ONLY: direct row cleanup is disabled');
  assertTableAllowed(opts.table, opts.registry);
  if (!TABLE_NAME_RE.test(opts.entityIdColumn)) {
    throw new Error(`非法实体列: ${opts.entityIdColumn}`);
  }
  const result = await execute(
    `SELECT 0 FROM ${opts.table}
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

/** 写库后校验：sum 指标或 ratio=sum(num)/sum(den) 是否落在 mode 期望侧 */
export async function verifySeedAggregate(opts: {
  plan: SeedPlan;
  registry: SeedCapabilityFile;
  metricColumn: string;
  entityIdColumn?: string;
}): Promise<SeedVerify> {
  const { plan, registry, metricColumn } = opts;
  assertTableAllowed(plan.table, registry);
  const idCol = opts.entityIdColumn || registry.entityIdColumn;
  if (!TABLE_NAME_RE.test(idCol)) {
    return { ok: false, detail: `非法实体列 ${idCol}` };
  }
  const entityId = String(plan.rows[0]?.[idCol] ?? '');
  const cap = registry.capabilities.find((c) => c.key === plan.recipeKey);

  let agg: number | null = null;
  let label = metricColumn;

  if (cap?.metricKind === 'ratio') {
    const numCol = cap.numeratorColumn ?? cap.writeColumns[0];
    const denCol = cap.denominatorColumn ?? 'consume';
    if (!numCol || !TABLE_NAME_RE.test(numCol) || !TABLE_NAME_RE.test(denCol)) {
      return { ok: false, detail: `ratio 写列非法 num=${numCol} den=${denCol}` };
    }
    const rows = await query<RowDataPacket[]>(
      `SELECT SUM(\`${numCol}\`) AS num_agg, SUM(\`${denCol}\`) AS den_agg
       FROM \`${plan.table}\`
       WHERE pline_form = ? AND \`${idCol}\` = ? AND cdate = ?`,
      [plan.plineForm, entityId, plan.rows[0]?.cdate],
    );
    const numAgg = rows[0]?.num_agg == null ? null : Number(rows[0].num_agg);
    const denAgg = rows[0]?.den_agg == null ? null : Number(rows[0].den_agg);
    if (numAgg == null || denAgg == null || Number.isNaN(numAgg) || Number.isNaN(denAgg)) {
      return { ok: false, aggregate: null, detail: '聚合为空，未找到造数行' };
    }
    if (denAgg === 0) {
      agg = 0;
    } else {
      agg = Number((numAgg / denAgg).toFixed(4));
    }
    label = `${numCol}/${denCol}`;
  } else {
    const writeCol =
      cap?.writeColumns?.[0] ||
      (metricColumn.startsWith('hour_') ? metricColumn.slice(5) : metricColumn);
    if (!TABLE_NAME_RE.test(writeCol)) {
      return { ok: false, detail: `非法指标列 ${writeCol}` };
    }
    const rows = await query<RowDataPacket[]>(
      `SELECT SUM(\`${writeCol}\`) AS agg
       FROM \`${plan.table}\`
       WHERE pline_form = ? AND \`${idCol}\` = ? AND cdate = ?`,
      [plan.plineForm, entityId, plan.rows[0]?.cdate],
    );
    agg = rows[0]?.agg == null ? null : Number(rows[0].agg);
    label = writeCol;
  }

  if (agg == null || Number.isNaN(agg)) {
    return { ok: false, aggregate: agg, detail: '聚合为空，未找到造数行' };
  }
  const ok = compareHolds(agg, plan.compareType, plan.threshold, undefined, plan.mode);
  return {
    ok,
    aggregate: agg,
    detail: ok
      ? `verify OK: ${label}=${agg} 符合 mode=${plan.mode} ${plan.compareType} ${plan.threshold}`
      : `verify FAIL: ${label}=${agg} 不符合 mode=${plan.mode} ${plan.compareType} ${plan.threshold}`,
  };
}
