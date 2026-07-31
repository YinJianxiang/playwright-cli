import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getDbConfig, query, type DbExecutor, withTransaction } from '../db';
import {
  type MetricStatus,
  type SeedCapability,
  type SeedCapabilityFile,
  type SeedMode,
  type SeedPlanRow,
  type TimeGrain,
  SeedGapError,
  allocateNumericEntityIdAcrossTables,
  computeMetricValues,
  isNumericEntityIdColumn,
  loadCapabilityFile,
  lookupMetricMap,
  resolveEntityIdColumn,
  resolveEntityNameColumn,
  resolveSeedCapability,
} from './engine';

const BIZ = 'ad-control' as const;
const PLAN_TTL_MS = 30 * 60 * 1000;
const NAME_RE = /^[A-Za-z0-9_]+$/;
const OPTIONAL_SKELETON_COLUMNS = [
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
] as const;

export type CompareType = 'le' | 'lt' | 'ge' | 'gt' | 'between';
export type IssueSeverity = 'warning' | 'error';
export type PreflightIssueCode =
  | 'CAPABILITY_NOT_ALLOWED'
  | 'TABLE_MAP_MISSING'
  | 'METRIC_MAP_MISSING'
  | 'REQUIRED_COLUMN_MISSING'
  | 'RULE_FILTER_UNMAPPED'
  | 'SOURCE_ROW_NOT_FOUND'
  | 'FORMULA_UNSUPPORTED'
  | 'CONDITION_COMBINATION_UNSUPPORTED'
  | 'POST_FILTER_WITHOUT_AGGREGATE'
  | 'PLAN_ROW_CONFLICT'
  | 'DATABASE_ENV_UNSAFE'
  | 'PLAN_EXPIRED'
  | 'EXECUTION_HASH_MISMATCH'
  | 'METRIC_PROVISIONAL'
  | 'EVIDENCE_INCOMPLETE'
  | 'OPTIONAL_SKELETON_COLUMN_MISSING'
  | 'SOURCE_ROW_FILTER_PARTIAL';

export type PreflightIssue = {
  severity: IssueSeverity;
  code: PreflightIssueCode;
  message: string;
  conditionIndex?: number;
  recipeKey?: string;
  table?: string;
  column?: string;
  evidence?: Record<string, unknown>;
};

export type NormalizedCondition = {
  index: number;
  timeType: string;
  reduceType: string;
  column: string;
  compareType: CompareType;
  val1: number;
  val2?: number;
};

export type ConditionPlanV3 = {
  condition: NormalizedCondition;
  recipeKey: string;
  metricStatus: MetricStatus;
  evaluationPhase: 'aggregate' | 'post-filter';
  capability: SeedCapability;
  targetGrain: TimeGrain;
  targetTable: string;
  metricValues: Record<string, number>;
  expectedHolds: boolean;
};

export type CompiledExecutionPlanV3 = {
  version: 3;
  biz: typeof BIZ;
  scenario: 'rule_trigger';
  ruleId: string;
  pairId?: string;
  mode: SeedMode;
  missConditionIndex?: number;
  plineForm: string;
  dataType: string;
  releaseVer: number | null;
  conditions: ConditionPlanV3[];
  ruleFilters: Record<string, string | number | null>;
  sourceSelectorPatch: Record<string, string | number>;
  finalFactPatch: Record<string, string | number>;
  issues: PreflightIssue[];
  configDigest: string;
  registry: SeedCapabilityFile;
};

export type InsertGroupV3 = {
  groupId: string;
  table: string;
  timeGrain: TimeGrain;
  entityIdColumn: string;
  entityId: string;
  rows: SeedPlanRow[];
  conditionIndexes: number[];
  requiredColumns: string[];
  optionalColumns: string[];
  schemaSignature: string;
  sourceRowId?: string | number;
  channelCode?: string;
};

export type SeedExecutionPlanV3 = Omit<CompiledExecutionPlanV3, 'registry'> & {
  insertGroups: InsertGroupV3[];
  status: 'blocked' | 'approval-required' | 'ready';
  approvalFingerprint: string;
  executionHash: string;
  createdAt: string;
  expiresAt: string;
};

export type SeedCleanupTarget = {
  table: string;
  primaryInsertIds: Array<string | number>;
  entityIdColumn: string;
  entityId: string;
  plineForm: string;
  cdate: string;
  hours?: string[];
  channelCode?: string;
};

export type SeedCleanupManifest = {
  version: 1;
  planExecutionHash: string;
  approvalFingerprint: string;
  ruleId: string;
  pairId?: string;
  mode: SeedMode;
  committedAt: string;
  targets: SeedCleanupTarget[];
  status: 'committed' | 'cleaned' | 'cleanup-failed';
  manifestPath?: string;
  cleanupError?: string;
};

export type SeedExecutionApplyResultV3 = {
  plan: SeedExecutionPlanV3;
  cleanupManifest: SeedCleanupManifest;
  manifestPath: string;
};

export function buildFactInsertSql(
  table: string,
  columns: string[],
): string {
  return `INSERT INTO \`${table}\` (${columns
    .map((column) => `\`${column}\``)
    .join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
}

export type SeedCleanupResult = {
  deleted: number;
  manifest: SeedCleanupManifest;
};

export type SeedRuleRow = RowDataPacket & {
  id: number;
  pline_form: string;
  data_type: string;
  conditions: string;
  opt_status: number | null;
  project_status: number | null;
  external_action: string | null;
  delivery_way: string | null;
  channel_users: string | null;
  effect_scope: number | null;
  account_type: number | null;
  release_ver: number | null;
};

export type RawCondition = Partial<Omit<NormalizedCondition, 'index'>> & {
  logic?: unknown;
  operator?: unknown;
  children?: unknown;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stableValue(v)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return `sha256:${crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex')}`;
}

function assertName(value: string, label: string): void {
  if (!NAME_RE.test(value)) throw new Error(`非法${label}: ${value}`);
}

function issue(
  severity: IssueSeverity,
  code: PreflightIssueCode,
  message: string,
  rest: Omit<PreflightIssue, 'severity' | 'code' | 'message'> = {},
): PreflightIssue {
  return { severity, code, message, ...rest };
}

export function normalizeCondition(raw: RawCondition, index: number): NormalizedCondition {
  if (raw.logic != null || raw.operator != null || raw.children != null) {
    throw new SeedGapError(`conditions[${index}] 含 OR/嵌套结构，第一阶段仅支持 AND`);
  }
  if (!raw.column) throw new SeedGapError(`conditions[${index}] 缺少 column`);
  if (raw.timeType == null || raw.timeType === '') {
    throw new SeedGapError(`conditions[${index}] 缺少 timeType`);
  }
  const compareType = String(raw.compareType || 'le') as CompareType;
  if (!['le', 'lt', 'ge', 'gt', 'between'].includes(compareType)) {
    throw new SeedGapError(`conditions[${index}] compareType=${compareType} 不受支持`);
  }
  const val1 = Number(raw.val1);
  if (!Number.isFinite(val1)) throw new SeedGapError(`conditions[${index}] val1 无效`);
  const val2 = raw.val2 == null ? undefined : Number(raw.val2);
  if (compareType === 'between' && !Number.isFinite(val2)) {
    throw new SeedGapError(`conditions[${index}] between 缺少 val2`);
  }
  return {
    index,
    timeType: String(raw.timeType),
    reduceType: String(raw.reduceType || 'total'),
    column: String(raw.column),
    compareType,
    val1,
    val2,
  };
}

function isUnlimitedText(value: string | null | undefined): boolean {
  const text = value == null ? '' : String(value).trim();
  return !text || text === '-1' || text === '不限';
}

/** Job: project_status=1 → <>暂停/删除；事实文案因业务线而异（xmtplay/cpsvideomf 多为「启用」） */
function projectStatusActiveLabel(plineForm: string): string {
  if (plineForm === 'xmtplay' || plineForm === 'cpsvideomf') return '启用';
  return '开启';
}

export function buildRuleFilters(
  rule: SeedRuleRow,
  knowledge: SeedCapabilityFile['filterKnowledge'] = [],
): {
  filters: Record<string, string | number | null>;
  sourceSelectorPatch: Record<string, string | number>;
  finalFactPatch: Record<string, string | number>;
  issues: PreflightIssue[];
} {
  const filters = {
    opt_status: rule.opt_status,
    project_status: rule.project_status,
    external_action: rule.external_action,
    delivery_way: rule.delivery_way,
    channel_users: rule.channel_users,
    effect_scope: rule.effect_scope,
    account_type: rule.account_type,
    release_ver: rule.release_ver,
  };
  const finalFactPatch: Record<string, string | number> = {};
  const issues: PreflightIssue[] = [];
  for (const field of knowledge) {
    if (field.status !== 'unknown') continue;
    const value = (rule as unknown as Record<string, unknown>)[field.ruleField];
    const unlimited = field.unlimited ?? [null, '', -1, '不限'];
    if (!unlimited.some((candidate) => candidate === value)) {
      issues.push(
        issue(
          'error',
          'RULE_FILTER_UNMAPPED',
          `KNOWLEDGE_UNKNOWN: ${field.ruleField}=${String(value)} 尚未形成 verified 事实表映射`,
        ),
      );
    }
  }

  if (rule.data_type === 'promotion' && rule.opt_status === 1) {
    finalFactPatch.promotion_status = '投放中';
  } else if (rule.data_type === 'promotion' && rule.opt_status != null && rule.opt_status !== -1) {
    issues.push(issue('error', 'RULE_FILTER_UNMAPPED', `opt_status=${rule.opt_status} 无事实列映射`));
  }
  if (rule.data_type === 'project' && rule.project_status === 1) {
    finalFactPatch.project_status = projectStatusActiveLabel(rule.pline_form);
  } else if (rule.data_type === 'promotion' && rule.project_status === 1) {
    finalFactPatch.project_status = projectStatusActiveLabel(rule.pline_form);
  } else if (rule.project_status != null && rule.project_status !== -1) {
    issues.push(
      issue('error', 'RULE_FILTER_UNMAPPED', `project_status=${rule.project_status} 无事实列映射`),
    );
  }
  if (!isUnlimitedText(rule.external_action)) {
    finalFactPatch.external_action = String(rule.external_action).trim();
  }
  if (!isUnlimitedText(rule.delivery_way)) {
    const value = String(rule.delivery_way).trim();
    // Job: 仅 1→自动订阅、2→常规投放 加 WHERE；0/其他非 -1 不加过滤（勿把 "0" 写进事实列）
    if (value === '1') finalFactPatch.delivery_way = '自动订阅';
    else if (value === '2') finalFactPatch.delivery_way = '常规投放';
  }
  if (!isUnlimitedText(rule.channel_users) && rule.channel_users !== '本部门全部') {
    const names = String(rule.channel_users)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (names.length === 1) finalFactPatch.agent_user_name = names[0];
    else {
      issues.push(
        issue(
          'error',
          'RULE_FILTER_UNMAPPED',
          `channel_users 包含 ${names.length} 人，无法唯一映射 agent_user_name`,
        ),
      );
    }
  }
  // 投放版本可以不参与骨架源行选择，但规则明确值必须覆盖最终事实行。
  if (rule.release_ver != null && rule.release_ver !== -1) {
    finalFactPatch.release_ver = Number(rule.release_ver);
  }
  if (rule.effect_scope === 2) {
    issues.push(
      issue(
        'error',
        'RULE_FILTER_UNMAPPED',
        'effect_scope=2 需要 service_provider_name，当前规则没有唯一映射',
      ),
    );
  }
  const sourceSelectorPatch = { ...finalFactPatch };
  delete sourceSelectorPatch.release_ver;
  return { filters, sourceSelectorPatch, finalFactPatch, issues };
}

export function seedConfigDigest(registry: SeedCapabilityFile): string {
  return digest({
    knowledgeVersion: registry.knowledgeVersion,
    evidenceDigest: registry.evidenceDigest,
    allowed: registry.allowed,
    tableMap: registry.tableMap,
    metricMap: registry.metricMap,
  });
}

export async function compileExecutionPlanV3(
  ruleId: string,
  options: {
    mode: SeedMode;
    pairId?: string;
    missConditionIndex?: number;
  },
): Promise<CompiledExecutionPlanV3> {
  const registry = loadCapabilityFile(BIZ);
  const rows = await query<SeedRuleRow[]>(
    `SELECT id, pline_form, data_type, conditions, opt_status, project_status,
            external_action, delivery_way, channel_users, effect_scope, account_type,
            release_ver
       FROM ${registry.ruleTable}
      WHERE id = ?`,
    [ruleId],
  );
  if (!rows.length) throw new SeedGapError(`规则 ${ruleId} 不存在`);
  const rule = rows[0];
  let rawConditions: RawCondition[];
  try {
    rawConditions = JSON.parse(rule.conditions) as RawCondition[];
  } catch {
    throw new SeedGapError(`规则 ${ruleId} conditions JSON 解析失败`);
  }
  if (!Array.isArray(rawConditions) || !rawConditions.length) {
    throw new SeedGapError(`规则 ${ruleId} conditions 为空`);
  }
  if (
    options.mode === 'miss' &&
    (!Number.isInteger(options.missConditionIndex) ||
      Number(options.missConditionIndex) < 0 ||
      Number(options.missConditionIndex) >= rawConditions.length)
  ) {
    throw new SeedGapError('MISS 必须提供有效 missConditionIndex');
  }

  const issues: PreflightIssue[] = [];
  const normalized: NormalizedCondition[] = [];
  for (let index = 0; index < rawConditions.length; index++) {
    try {
      normalized.push(normalizeCondition(rawConditions[index], index));
    } catch (error) {
      issues.push(
        issue(
          'error',
          'CONDITION_COMBINATION_UNSUPPORTED',
          error instanceof Error ? error.message : String(error),
          { conditionIndex: index },
        ),
      );
    }
  }

  const conditionPlans: ConditionPlanV3[] = [];
  for (const condition of normalized) {
    try {
      const metric = lookupMetricMap(registry.metricMap, condition.column, rule.pline_form);
      const policy = metric.seedPolicy ?? {
        evaluationPhase: 'aggregate' as const,
        standaloneRule: 'allowed' as const,
      };
      const capability = resolveSeedCapability(
        registry,
        rule.pline_form,
        rule.data_type,
        condition.timeType,
        condition.column,
        rule.release_ver,
        policy.forceGrain ? { forceGrain: policy.forceGrain } : undefined,
      );
      const expectedHolds =
        options.mode === 'hit' || condition.index !== options.missConditionIndex;
      const metricValues = computeMetricValues(
        capability,
        expectedHolds ? 'hit' : 'miss',
        condition.compareType,
        condition.val1,
        condition.val2,
      );
      const metricStatus = metric.status ?? 'provisional';
      if (metricStatus === 'provisional') {
        issues.push(
          issue('warning', 'METRIC_PROVISIONAL', `指标 ${condition.column} 尚未完全验证`, {
            conditionIndex: condition.index,
            recipeKey: capability.key,
            table: capability.table,
            column: condition.column,
          }),
        );
      }
      if (!metric.evidence?.formulaChecked || !metric.evidence?.schemaChecked) {
        issues.push(
          issue('warning', 'EVIDENCE_INCOMPLETE', `指标 ${condition.column} 证据不完整`, {
            conditionIndex: condition.index,
            recipeKey: capability.key,
            evidence: metric.evidence as unknown as Record<string, unknown>,
          }),
        );
      }
      conditionPlans.push({
        condition,
        recipeKey: capability.key,
        metricStatus,
        evaluationPhase: policy.evaluationPhase,
        capability,
        targetGrain: capability.timeGrain,
        targetTable: capability.table,
        metricValues,
        expectedHolds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code: PreflightIssueCode = message.includes('白名单')
        ? 'CAPABILITY_NOT_ALLOWED'
        : message.includes('table-map')
          ? 'TABLE_MAP_MISSING'
          : message.includes('metric-map')
            ? 'METRIC_MAP_MISSING'
            : 'FORMULA_UNSUPPORTED';
      issues.push(
        issue('error', code, message, {
          conditionIndex: condition.index,
          column: condition.column,
        }),
      );
    }
  }

  const aggregateCount = conditionPlans.filter((v) => v.evaluationPhase === 'aggregate').length;
  if (!aggregateCount && conditionPlans.some((v) => v.capability.seedPolicy.standaloneRule === 'blocked')) {
    issues.push(
      issue(
        'error',
        'POST_FILTER_WITHOUT_AGGREGATE',
        '规则只包含禁止独立执行的 post-filter 条件',
      ),
    );
  }
  const alignment = buildRuleFilters(rule, registry.filterKnowledge);
  issues.push(...alignment.issues);

  return {
    version: 3,
    biz: BIZ,
    scenario: 'rule_trigger',
    ruleId: String(ruleId),
    pairId: options.pairId,
    mode: options.mode,
    missConditionIndex: options.missConditionIndex,
    plineForm: rule.pline_form,
    dataType: rule.data_type,
    releaseVer: rule.release_ver,
    conditions: conditionPlans,
    ruleFilters: alignment.filters,
    sourceSelectorPatch: alignment.sourceSelectorPatch,
    finalFactPatch: alignment.finalFactPatch,
    issues,
    configDigest: seedConfigDigest(registry),
    registry,
  };
}

async function tableColumns(table: string): Promise<string[]> {
  assertName(table, '表名');
  const rows = await query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${table}\``);
  return rows.map((row) => String(row.Field)).sort();
}

async function databaseEnvironmentIssue(): Promise<PreflightIssue | undefined> {
  const configured = getDbConfig().database;
  const rows = await query<RowDataPacket[]>('SELECT DATABASE() AS db');
  const actual = rows[0]?.db == null ? '' : String(rows[0].db);
  if (process.env.E2E_DB_ENV !== 'test' || actual !== configured) {
    return issue(
      'error',
      'DATABASE_ENV_UNSAFE',
      `写库环境不安全：E2E_DB_ENV=${process.env.E2E_DB_ENV ?? '-'} configured=${configured} actual=${actual}`,
    );
  }
  return undefined;
}

function planSlots(
  condition: NormalizedCondition,
  grain: TimeGrain,
  cdate: string,
  hourNumber: number,
): Array<{ cdate: string; hour?: string }> {
  const near = Number(condition.timeType);
  const dayWindows: Record<string, number> = { '99': 2, '100': 3 };
  if (condition.reduceType === 'all' && Number.isInteger(near) && near >= 1 && near <= 6) {
    return Array.from({ length: near }, (_, index) => {
      const value = hourNumber - index - 1;
      if (value < 0) throw new SeedGapError(`当前小时不足以生成近 ${near} 小时全部槽位`);
      return { cdate, hour: String(value).padStart(2, '0') };
    });
  }
  const dayCount = condition.reduceType === 'all' ? dayWindows[condition.timeType] : undefined;
  if (dayCount) {
    return Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(`${cdate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - index);
      return { cdate: date.toISOString().slice(0, 10) };
    });
  }
  if (grain === 'hour' && near >= 1 && near <= 6) {
    const value = hourNumber - near;
    if (value < 0) throw new SeedGapError(`当前小时不足以生成近 ${near} 小时槽位`);
    return [{ cdate, hour: String(value).padStart(2, '0') }];
  }
  return [{ cdate, hour: grain === 'hour' ? String(hourNumber).padStart(2, '0') : undefined }];
}

async function sourceSkeleton(
  capability: SeedCapability,
  columns: Set<string>,
  filterPatch: Record<string, string | number>,
): Promise<{ id?: string | number; row: SeedPlanRow } | null> {
  const clauses = ['`pline_form` = ?'];
  const params: unknown[] = [capability.plineForm];
  if (columns.has('consume')) {
    clauses.push('`consume` > ?');
    params.push(capability.sourceFilter?.minConsume ?? 0);
  }
  for (const [column, value] of Object.entries(filterPatch)) {
    if (!columns.has(column)) continue;
    assertName(column, '过滤列');
    clauses.push(`\`${column}\` = ?`);
    params.push(value);
  }
  const rows = await query<RowDataPacket[]>(
    `SELECT * FROM \`${capability.table}\`
      WHERE ${clauses.join(' AND ')}
      ORDER BY id DESC LIMIT 1`,
    params,
  );
  if (!rows.length) return null;
  const row: SeedPlanRow = {};
  for (const column of OPTIONAL_SKELETON_COLUMNS) {
    const value = rows[0][column];
    if (value == null || typeof value === 'object') continue;
    row[column] = typeof value === 'number' ? value : String(value);
  }
  return { id: rows[0].id as string | number, row };
}

function approvalPayload(compiled: CompiledExecutionPlanV3): unknown {
  return {
    version: 3,
    biz: compiled.biz,
    scenario: compiled.scenario,
    mode: compiled.mode,
    missConditionIndex: compiled.missConditionIndex,
    conditions: compiled.conditions.map((value) => ({
      condition: value.condition,
      recipeKey: value.recipeKey,
      metricStatus: value.metricStatus,
      evaluationPhase: value.evaluationPhase,
      targetGrain: value.targetGrain,
      targetTable: value.targetTable,
      metricKind: value.capability.metricKind,
      writeColumns: value.capability.writeColumns,
      numeratorColumn: value.capability.numeratorColumn,
      denominatorColumn: value.capability.denominatorColumn,
      seedPolicy: value.capability.seedPolicy,
    })),
    ruleFilters: compiled.ruleFilters,
    configDigest: compiled.configDigest,
  };
}

export function semanticApprovalFingerprint(compiled: CompiledExecutionPlanV3): string {
  return digest(approvalPayload(compiled));
}

function executionPayload(plan: Omit<SeedExecutionPlanV3, 'executionHash'>): unknown {
  const { createdAt, expiresAt, approvalFingerprint, ...rest } = plan;
  return { ...rest, createdAt, expiresAt, approvalFingerprint };
}

export function calculateExecutionHash(
  plan: Omit<SeedExecutionPlanV3, 'executionHash'>,
): string {
  return digest(executionPayload(plan));
}

export async function preflightExecutionPlanV3(
  compiled: CompiledExecutionPlanV3,
): Promise<SeedExecutionPlanV3> {
  const issues = [...compiled.issues];
  const unsafe = await databaseEnvironmentIssue();
  if (unsafe) issues.push(unsafe);
  const clock = await query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS cdate, HOUR(NOW()) AS hour_num`,
  );
  const cdate = String(clock[0].cdate);
  const hourNumber = Number(clock[0].hour_num);
  const entitySeed = `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
  const markerEntity = `${compiled.registry.markerPrefix}${compiled.ruleId}_${compiled.mode}_${entitySeed}`;
  const groupBuilders = new Map<
    string,
    {
      capability: SeedCapability;
      slots: Array<{ cdate: string; hour?: string }>;
      conditions: ConditionPlanV3[];
    }
  >();

  for (const conditionPlan of compiled.conditions) {
    let slots: Array<{ cdate: string; hour?: string }>;
    try {
      slots = planSlots(conditionPlan.condition, conditionPlan.targetGrain, cdate, hourNumber);
    } catch (error) {
      issues.push(
        issue('error', 'CONDITION_COMBINATION_UNSUPPORTED', String((error as Error).message), {
          conditionIndex: conditionPlan.condition.index,
        }),
      );
      continue;
    }
    const key = `${conditionPlan.targetTable}|${conditionPlan.targetGrain}|${JSON.stringify(slots)}`;
    const current = groupBuilders.get(key);
    if (current) current.conditions.push(conditionPlan);
    else groupBuilders.set(key, { capability: conditionPlan.capability, slots, conditions: [conditionPlan] });
  }

  const insertGroups: InsertGroupV3[] = [];
  const groupSchemas = new Map<
    string,
    { columnSet: Set<string>; schemaSignature: string }
  >();
  for (const [key, builder] of groupBuilders) {
    const columns = await tableColumns(builder.capability.table);
    groupSchemas.set(key, {
      columnSet: new Set(columns),
      schemaSignature: digest(columns),
    });
  }
  const numericIdentifierColumns = ['channel_code', 'promotion_id', 'project_id'] as const;
  const numericIdentifiers = new Map<string, string>();
  for (const column of numericIdentifierColumns) {
    const tables = [...groupBuilders]
      .filter(([key]) => groupSchemas.get(key)?.columnSet.has(column))
      .map(([, builder]) => builder.capability.table);
    if (tables.length === 0) continue;
    numericIdentifiers.set(
      column,
      await allocateNumericEntityIdAcrossTables({
        tables,
        column,
        registry: compiled.registry,
        offset: compiled.mode === 'hit' ? 1 : 2,
      }),
    );
  }

  for (const [key, builder] of groupBuilders) {
    const capability = builder.capability;
    const schema = groupSchemas.get(key);
    if (!schema) throw new Error(`Preflight schema cache missing: ${key}`);
    const { columnSet, schemaSignature } = schema;
    const entityIdColumn = resolveEntityIdColumn(capability, compiled.registry);
    const entityNameColumn = resolveEntityNameColumn(capability);
    const requiredColumns = new Set<string>([
      'pline_form',
      'cdate',
      entityIdColumn,
      ...Object.keys(capability.statusDefaults ?? {}),
      ...Object.keys(compiled.finalFactPatch),
    ]);
    if (capability.timeGrain === 'hour') requiredColumns.add('hour');
    if (entityNameColumn) requiredColumns.add(entityNameColumn);
    for (const plan of builder.conditions) {
      for (const column of plan.capability.writeColumns) requiredColumns.add(column);
      if (plan.capability.numeratorColumn) requiredColumns.add(plan.capability.numeratorColumn);
      if (plan.capability.denominatorColumn) requiredColumns.add(plan.capability.denominatorColumn);
    }
    for (const column of requiredColumns) {
      if (!columnSet.has(column)) {
        issues.push(
          issue('error', 'REQUIRED_COLUMN_MISSING', `${capability.table} 缺少必需列 ${column}`, {
            table: capability.table,
            column,
          }),
        );
      }
    }
    const missingOptional = OPTIONAL_SKELETON_COLUMNS.filter((column) => !columnSet.has(column));
    for (const column of missingOptional) {
      issues.push(
        issue('warning', 'OPTIONAL_SKELETON_COLUMN_MISSING', `${capability.table} 无可选列 ${column}`, {
          table: capability.table,
          column,
        }),
      );
    }

    let source: Awaited<ReturnType<typeof sourceSkeleton>> = null;
    if ((capability.rowStrategy ?? compiled.registry.defaultRowStrategy) === 'copy-then-patch') {
      source = await sourceSkeleton(capability, columnSet, compiled.sourceSelectorPatch);
      if (!source && !capability.allowSynthetic) {
        issues.push(
          issue('error', 'SOURCE_ROW_NOT_FOUND', `${capability.table} 找不到符合规则过滤的骨架源行`, {
            table: capability.table,
          }),
        );
      }
    }

    const identifierPatch = Object.fromEntries(
      numericIdentifierColumns
        .filter((column) => columnSet.has(column) && numericIdentifiers.has(column))
        .map((column) => [column, numericIdentifiers.get(column)!]),
    );
    const channelCode = identifierPatch.channel_code;
    const entityId =
      isNumericEntityIdColumn(entityIdColumn) && numericIdentifiers.has(entityIdColumn)
        ? numericIdentifiers.get(entityIdColumn)!
        : markerEntity;
    const rows: SeedPlanRow[] = [];
    for (const slot of builder.slots) {
      const row: SeedPlanRow = {
        ...(source?.row ?? {}),
        ...(capability.fixedDefaults ?? {}),
        cdate: slot.cdate,
        ...(slot.hour ? { hour: slot.hour } : {}),
        pline_form: capability.plineForm,
        ...identifierPatch,
        [entityIdColumn]: entityId,
        ...(entityNameColumn ? { [entityNameColumn]: markerEntity } : {}),
        ...(capability.statusDefaults ?? {}),
        ...compiled.finalFactPatch,
      };
      for (const condition of builder.conditions) {
        for (const [column, value] of Object.entries(condition.metricValues)) {
          if (row[column] != null && Number(row[column]) !== value) {
            issues.push(
              issue(
                'error',
                'PLAN_ROW_CONFLICT',
                `${capability.table}.${column} 同一行要求 ${row[column]} 与 ${value}`,
                {
                  table: capability.table,
                  column,
                  conditionIndex: condition.condition.index,
                },
              ),
            );
          } else {
            row[column] = value;
          }
        }
      }
      for (const column of Object.keys(row)) {
        if (!columnSet.has(column) && !requiredColumns.has(column)) delete row[column];
      }
      rows.push(row);
    }
    insertGroups.push({
      groupId: digest(key),
      table: capability.table,
      timeGrain: capability.timeGrain,
      entityIdColumn,
      entityId,
      rows,
      conditionIndexes: builder.conditions.map((value) => value.condition.index),
      requiredColumns: [...requiredColumns].sort(),
      optionalColumns: OPTIONAL_SKELETON_COLUMNS.filter((column) => columnSet.has(column)),
      schemaSignature,
      sourceRowId: source?.id,
      channelCode,
    });
  }

  const createdAt = new Date();
  const withoutHash: Omit<SeedExecutionPlanV3, 'executionHash'> = {
    version: 3,
    biz: compiled.biz,
    scenario: compiled.scenario,
    ruleId: compiled.ruleId,
    pairId: compiled.pairId,
    mode: compiled.mode,
    missConditionIndex: compiled.missConditionIndex,
    plineForm: compiled.plineForm,
    dataType: compiled.dataType,
    releaseVer: compiled.releaseVer,
    conditions: compiled.conditions,
    ruleFilters: compiled.ruleFilters,
    sourceSelectorPatch: compiled.sourceSelectorPatch,
    finalFactPatch: compiled.finalFactPatch,
    issues,
    configDigest: compiled.configDigest,
    insertGroups,
    status: issues.some((value) => value.severity === 'error')
      ? 'blocked'
      : issues.some((value) => value.severity === 'warning')
        ? 'approval-required'
        : 'ready',
    approvalFingerprint: semanticApprovalFingerprint(compiled),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + PLAN_TTL_MS).toISOString(),
  };
  return {
    ...withoutHash,
    executionHash: calculateExecutionHash(withoutHash),
  };
}

function compareHolds(
  value: number,
  condition: NormalizedCondition,
): boolean {
  switch (condition.compareType) {
    case 'le':
      return value <= condition.val1;
    case 'lt':
      return value < condition.val1;
    case 'ge':
      return value >= condition.val1;
    case 'gt':
      return value > condition.val1;
    case 'between':
      return value >= condition.val1 && value <= Number(condition.val2);
  }
}

async function evaluateConditionHolds(
  executor: DbExecutor,
  plan: SeedExecutionPlanV3,
  condition: ConditionPlanV3,
): Promise<{ holds: boolean; observed: number }> {
  const group = plan.insertGroups.find((value) =>
    value.conditionIndexes.includes(condition.condition.index),
  );
  if (!group) throw new Error(`condition ${condition.condition.index} 无 InsertGroup`);
  const reduceType = condition.condition.reduceType;
  const slotRows =
    group.timeGrain === 'hour' && (reduceType === 'all' || reduceType === 'anyone')
      ? group.rows
      : null;
  if (slotRows && slotRows.length > 0) {
    const slotValues: number[] = [];
    for (const row of slotRows) {
      const dates = [String(row.cdate)];
      const hours = row.hour == null ? [] : [row.hour];
      const where = [
        '`pline_form` = ?',
        `\`${group.entityIdColumn}\` = ?`,
        `\`cdate\` IN (${dates.map(() => '?').join(',')})`,
      ];
      const params: unknown[] = [plan.plineForm, group.entityId, ...dates];
      if (hours.length) {
        where.push(`\`hour\` IN (${hours.map(() => '?').join(',')})`);
        params.push(...hours);
      }
      const value = await readMetricAggregate(executor, group.table, condition, where, params);
      slotValues.push(value);
    }
    const slotHolds = slotValues.map((value) => compareHolds(value, condition.condition));
    const holds =
      reduceType === 'all' ? slotHolds.every(Boolean) : slotHolds.some(Boolean);
    return {
      holds,
      observed: reduceType === 'all' ? Math.min(...slotValues) : Math.max(...slotValues),
    };
  }
  const aggregate = await aggregateCondition(executor, plan, condition);
  return { holds: compareHolds(aggregate, condition.condition), observed: aggregate };
}

async function readMetricAggregate(
  executor: DbExecutor,
  table: string,
  condition: ConditionPlanV3,
  where: string[],
  params: unknown[],
): Promise<number> {
  const capability = condition.capability;
  if (capability.metricKind === 'ratio') {
    const numerator = capability.numeratorColumn ?? capability.writeColumns[0];
    const denominator = capability.denominatorColumn;
    if (!numerator || !denominator) throw new Error(`ratio ${condition.recipeKey} 缺少分子/分母`);
    assertName(numerator, '分子列');
    assertName(denominator, '分母列');
    const result = await executor.query<RowDataPacket[]>(
      `SELECT SUM(\`${numerator}\`) AS numerator, SUM(\`${denominator}\`) AS denominator
         FROM \`${table}\` WHERE ${where.join(' AND ')}`,
      params,
    );
    const den = Number(result[0]?.denominator);
    return den === 0 ? 0 : Number(result[0]?.numerator) / den;
  }
  const column = capability.writeColumns[0];
  if (!column) throw new Error(`${condition.recipeKey} 缺少 writeColumns`);
  assertName(column, '指标列');
  const result = await executor.query<RowDataPacket[]>(
    `SELECT SUM(\`${column}\`) AS aggregate FROM \`${table}\` WHERE ${where.join(' AND ')}`,
    params,
  );
  return Number(result[0]?.aggregate);
}

async function aggregateCondition(
  executor: DbExecutor,
  plan: SeedExecutionPlanV3,
  condition: ConditionPlanV3,
): Promise<number> {
  const group = plan.insertGroups.find((value) =>
    value.conditionIndexes.includes(condition.condition.index),
  );
  if (!group) throw new Error(`condition ${condition.condition.index} 无 InsertGroup`);
  const rows = group.rows;
  const dates = [...new Set(rows.map((row) => String(row.cdate)))];
  const hours = [...new Set(rows.map((row) => row.hour).filter((value) => value != null))];
  const where = [
    '`pline_form` = ?',
    `\`${group.entityIdColumn}\` = ?`,
    `\`cdate\` IN (${dates.map(() => '?').join(',')})`,
  ];
  const params: unknown[] = [plan.plineForm, group.entityId, ...dates];
  if (hours.length) {
    where.push(`\`hour\` IN (${hours.map(() => '?').join(',')})`);
    params.push(...hours);
  }
  return readMetricAggregate(executor, group.table, condition, where, params);
}

function assertApplyAllowed(
  plan: SeedExecutionPlanV3,
  options: {
    confirmed: boolean;
    approvalFingerprint?: string;
    outputDir: string;
    cancellationCheck?: () => Promise<void>;
  },
): void {
  if (plan.status === 'blocked') {
    throw new SeedGapError(`计划 blocked: ${plan.issues.filter((v) => v.severity === 'error').map((v) => v.message).join('; ')}`);
  }
  const auto = ['1', 'true'].includes(String(process.env.E2E_SEED_AUTO_CONFIRM).toLowerCase());
  if (!options.confirmed && !auto) throw new Error('applyExecutionPlanV3: 未确认写库');
  if (plan.status === 'approval-required') {
    const approvedInFile = loadSeedApproval(
      path.join(options.outputDir, 'seed-approvals.json'),
      plan.approvalFingerprint,
    );
    if (
      options.approvalFingerprint !== plan.approvalFingerprint ||
      approvedInFile !== plan.approvalFingerprint
    ) {
      const warnings = plan.issues
        .filter((value) => value.severity === 'warning')
        .map((value) => `${value.code}: ${value.message}`)
        .join('; ');
      throw new SeedGapError(
        `warning 计划缺少批准文件中的匹配指纹，当前 ${plan.approvalFingerprint}；${warnings}`,
        plan.approvalFingerprint,
      );
    }
  }
  if (Date.now() > Date.parse(plan.expiresAt)) throw new SeedGapError('计划已过期', 'PLAN_EXPIRED');
  const { executionHash, ...withoutHash } = plan;
  if (calculateExecutionHash(withoutHash) !== executionHash) {
    throw new SeedGapError('executionHash 不匹配', 'EXECUTION_HASH_MISMATCH');
  }
}

function manifestPath(outputDir: string, plan: SeedExecutionPlanV3): string {
  return path.join(outputDir, `seed-cleanup-${plan.ruleId}-${plan.mode}.json`);
}

function persistManifest(file: string, manifest: SeedCleanupManifest): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function applyExecutionPlanV3(
  plan: SeedExecutionPlanV3,
  options: {
    confirmed: boolean;
    approvalFingerprint?: string;
    outputDir: string;
  },
): Promise<SeedExecutionApplyResultV3> {
  assertApplyAllowed(plan, options);
  const unsafe = await databaseEnvironmentIssue();
  if (unsafe) throw new SeedGapError(unsafe.message, unsafe.code);
  for (const group of plan.insertGroups) {
    const signature = digest(await tableColumns(group.table));
    if (signature !== group.schemaSignature) {
      throw new SeedGapError(`表 ${group.table} schema 已变化`, 'EXECUTION_HASH_MISMATCH');
    }
  }

  let manifest: SeedCleanupManifest | undefined;
  await withTransaction(async (executor) => {
    const targets: SeedCleanupTarget[] = [];
    for (const group of plan.insertGroups) {
      await options.cancellationCheck?.();
      const insertedRows: Array<{ insertId: string | number; row: SeedPlanRow }> = [];
      for (const row of group.rows) {
        const columns = Object.keys(row);
        columns.forEach((column) => assertName(column, '列名'));
        const result = await executor.execute(
          buildFactInsertSql(group.table, columns),
          columns.map((column) => row[column]),
        );
        insertedRows.push({
          insertId: String((result as ResultSetHeader).insertId),
          row,
        });
      }
      const rowsByDate = new Map<string, typeof insertedRows>();
      for (const inserted of insertedRows) {
        const cdate = String(inserted.row.cdate);
        const sameDate = rowsByDate.get(cdate) ?? [];
        sameDate.push(inserted);
        rowsByDate.set(cdate, sameDate);
      }
      for (const [cdate, sameDate] of rowsByDate) {
        targets.push({
          table: group.table,
          primaryInsertIds: sameDate.map(({ insertId }) => insertId),
          entityIdColumn: group.entityIdColumn,
          entityId: group.entityId,
          plineForm: plan.plineForm,
          cdate,
          hours: [
            ...new Set(
              sameDate
                .map(({ row }) => String(row.hour ?? ''))
                .filter(Boolean),
            ),
          ],
          channelCode: group.channelCode,
        });
      }
      await options.cancellationCheck?.();
    }
    for (const condition of plan.conditions) {
      await options.cancellationCheck?.();
      const { holds, observed } = await evaluateConditionHolds(executor, plan, condition);
      if (!Number.isFinite(observed) || holds !== condition.expectedHolds) {
        throw new Error(
          `事务内 verify 失败 condition=${condition.condition.index} value=${observed} holds=${holds} expectedHolds=${condition.expectedHolds}`,
        );
      }
      await options.cancellationCheck?.();
    }
    manifest = {
      version: 1,
      planExecutionHash: plan.executionHash,
      approvalFingerprint: plan.approvalFingerprint,
      ruleId: plan.ruleId,
      pairId: plan.pairId,
      mode: plan.mode,
      committedAt: new Date().toISOString(),
      targets,
      status: 'committed',
    };
  });
  if (!manifest) throw new Error('事务成功但 cleanup manifest 未生成');
  const file = manifestPath(options.outputDir, plan);
  manifest.manifestPath = file;
  try {
    persistManifest(file, manifest);
  } catch (error) {
    try {
      await cleanupExecutionManifestV3(manifest);
    } catch (cleanupError) {
      Object.assign(error as object, { cleanupError });
    }
    throw error;
  }
  fs.writeFileSync(
    path.join(options.outputDir, `seed-log-v3-${plan.ruleId}-${plan.mode}.json`),
    `${JSON.stringify({ plan, manifest }, null, 2)}\n`,
    'utf8',
  );
  return { plan, cleanupManifest: manifest, manifestPath: file };
}

export async function cleanupExecutionManifestV3(
  manifest: SeedCleanupManifest,
): Promise<SeedCleanupResult> {
  const unsafe = await databaseEnvironmentIssue();
  if (unsafe) throw new SeedGapError(unsafe.message, unsafe.code);
  const registry = loadCapabilityFile(BIZ);
  let deleted = 0;
  try {
    await withTransaction(async (executor) => {
      for (const target of manifest.targets) {
        assertName(target.table, '表名');
        assertName(target.entityIdColumn, '实体列');
        if (!target.entityId.startsWith(registry.markerPrefix) && !/^\d+$/.test(target.entityId)) {
          throw new Error(`cleanup 实体未带合法 marker: ${target.entityId}`);
        }
        const result = await executor.execute(
          `DELETE FROM \`${target.table}\`
            WHERE \`pline_form\` = ?
              AND \`${target.entityIdColumn}\` = ?
              AND \`cdate\` = ?`,
          [target.plineForm, target.entityId, target.cdate],
        );
        deleted += Number(result.affectedRows);
      }
    });
    manifest.status = 'cleaned';
    delete manifest.cleanupError;
  } catch (error) {
    manifest.status = 'cleanup-failed';
    manifest.cleanupError = error instanceof Error ? error.message : String(error);
    if (manifest.manifestPath) persistManifest(manifest.manifestPath, manifest);
    throw error;
  }
  if (manifest.manifestPath) persistManifest(manifest.manifestPath, manifest);
  return { deleted, manifest };
}

export function formatSeedPlan(plan: SeedExecutionPlanV3): string {
  const lines = [
    `### Seed Plan V2 · ${plan.mode}`,
    '',
    `- status: **${plan.status}**`,
    `- ruleId: ${plan.ruleId}`,
    `- approvalFingerprint: \`${plan.approvalFingerprint}\``,
    `- executionHash: \`${plan.executionHash}\``,
    `- expiresAt: ${plan.expiresAt}`,
    '',
    '#### Conditions',
    '',
    '| # | column | phase | table | expected | values |',
    '|---|--------|-------|-------|----------|--------|',
  ];
  for (const condition of plan.conditions) {
    lines.push(
      `| ${condition.condition.index} | ${condition.condition.column} | ${condition.evaluationPhase} | ${condition.targetTable} | ${condition.expectedHolds} | \`${JSON.stringify(condition.metricValues)}\` |`,
    );
  }
  lines.push('', '#### Issues', '');
  if (!plan.issues.length) lines.push('- none');
  for (const value of plan.issues) {
    lines.push(`- [${value.severity}] ${value.code}: ${value.message}`);
  }
  lines.push('', '#### INSERT preview', '');
  for (const group of plan.insertGroups) {
    lines.push(`- ${group.table}: ${group.rows.length} row(s), source=${group.sourceRowId ?? 'synthetic'}`);
    for (const row of group.rows) lines.push(`  - \`${JSON.stringify(row)}\``);
  }
  return lines.join('\n');
}

export function loadSeedApproval(
  approvalFile: string,
  fingerprint: string,
): string | undefined {
  if (!fs.existsSync(approvalFile)) return undefined;
  const parsed = JSON.parse(fs.readFileSync(approvalFile, 'utf8')) as {
    approvals?: Array<{ fingerprint?: string }>;
  };
  return parsed.approvals?.some((value) => value.fingerprint === fingerprint)
    ? fingerprint
    : undefined;
}

export function writeSeedPlan(outputDir: string, plan: SeedExecutionPlanV3): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, `seed-plan-v3-${plan.ruleId}-${plan.mode}.json`);
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return file;
}

export function loadSeedPlan(file: string): SeedExecutionPlanV3 {
  const plan = JSON.parse(fs.readFileSync(file, 'utf8')) as SeedExecutionPlanV3;
  if (
    plan.version !== 3 ||
    !plan.sourceSelectorPatch ||
    !plan.finalFactPatch
  ) {
    throw new Error(
      'PLAN_VERSION_UNSUPPORTED: plan must be regenerated by Seed V3 preflight',
    );
  }
  return plan;
}
