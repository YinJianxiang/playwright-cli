import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { RowDataPacket } from 'mysql2';
import { query, withDbAudit, type DbAuditEvent } from '../db';
import {
  applyExecutionPlanV3,
  buildFactInsertSql,
  buildRuleFilters,
  calculateExecutionHash,
  cleanupExecutionManifestV3,
  preflightExecutionPlanV3,
  type CompiledExecutionPlanV3,
  type ConditionPlanV3,
  type PreflightIssue,
  type SeedExecutionApplyResultV3,
  type SeedCleanupResult,
  type SeedExecutionPlanV3,
  type SeedRuleRow,
} from './execution-plan-v3';
import {
  computeMetricValues,
  loadCapabilityFile,
  lookupMetricMap,
  resolveSeedCapability,
} from './engine';
import {
  analyzeJobExpressionCompatibility,
  flattenConditionNodes,
  parseRuleExpression,
  solveExpression,
  type ExpressionSolution,
  type RuleExpressionV2,
} from './expression-v3';
import {
  assertRunNotCancelled,
  acquireSeedRunLease,
  createSeedRun,
  findRecoverableRuns,
  getSeedRunSnapshot,
  hasValidSeedApproval,
  newRunId,
  releaseSeedRunLease,
  requestRunCancel,
  transitionSeedRun,
  upsertSeedApproval,
  type SeedRunSnapshot,
  type SeedRunStatus,
} from './meta-db-v3';
import { loadPromotedConfigBundle } from './config-bundle-v3';

export type ApprovalRisk = 'none' | 'medium' | 'high';
export type SeedCleanupPolicy = 'always' | 'manual';
export type V3IssueSeverity = 'info' | 'warning' | 'error';
export type V3Issue = Omit<PreflightIssue, 'severity' | 'code'> & {
  code:
    | PreflightIssue['code']
    | 'EXPRESSION_UNSATISFIABLE'
    | 'JOB_AST_CAPABILITY_UNAVAILABLE';
  severity: V3IssueSeverity;
  risk: ApprovalRisk;
};

export type FormulaPlan = {
  nodeId: string;
  metricKind: string;
  writeColumns: string[];
  aggregateSqlKind: 'sum' | 'ratio' | 'count';
};

export type SqlAuditEntry = {
  runId: string;
  phase: string;
  groupId?: string;
  nodeId?: string;
  sql: string;
  params: unknown[];
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  affectedRows?: number;
  result?: Record<string, unknown>;
  errorCode?: string;
};

export type CompiledSeedRunV3 = {
  version: 3;
  runId: string;
  expression: RuleExpressionV2;
  rootNodeId: string;
  solution: ExpressionSolution;
  leafNodeIds: string[];
  nodeIdByConditionIndex: Record<number, string>;
  compiledExecution: CompiledExecutionPlanV3;
  configVersion: string;
  jobExpressionCompatible: boolean;
  unsupportedJobNodeIds: string[];
};

export type SeedPlanV3 = {
  version: 3;
  runId: string;
  expression: RuleExpressionV2;
  rootNodeId: string;
  nodeExpectations: Record<string, boolean>;
  witnessLeaves: string[];
  flippedLeaves: string[];
  nodeIdByConditionIndex: Record<number, string>;
  formulaPlans: FormulaPlan[];
  issues: V3Issue[];
  approvalRisk: ApprovalRisk;
  approvalFingerprint: string;
  executionHash: string;
  configVersion: string;
  sqlPreview: SqlAuditEntry[];
  executionPlan: SeedExecutionPlanV3;
  jobExpressionCompatible: boolean;
  unsupportedJobNodeIds: string[];
};

export type SeedRunResult = SeedExecutionApplyResultV3 & {
  runId: string;
  auditPath: string;
};

export function resolveSeedCleanupPolicy(
  explicit?: string,
): SeedCleanupPolicy {
  const value = explicit || process.env.E2E_SEED_CLEANUP_POLICY || 'always';
  if (value !== 'always' && value !== 'manual') {
    throw new Error(
      `E2E_SEED_CLEANUP_POLICY_INVALID: ${value}; expected always|manual`,
    );
  }
  if (value === 'manual' && process.env.CI) {
    throw new Error('E2E_SEED_CLEANUP_POLICY_MANUAL_FORBIDDEN_IN_CI');
  }
  return value;
}

export async function finalizeSeedRun(
  runId: string,
  options: { cleanupPolicy?: SeedCleanupPolicy } = {},
): Promise<
  | { policy: 'always'; cleanup: SeedCleanupResult }
  | {
      policy: 'manual';
      runId: string;
      manifestPath?: string;
      cleanupCommand: string;
    }
> {
  const run = await getSeedRunSnapshot(runId);
  const policy = resolveSeedCleanupPolicy(
    options.cleanupPolicy ?? run.cleanupPolicy,
  );
  if (policy === 'always') {
    return { policy, cleanup: await cleanupSeedRun(runId) };
  }
  if (run.status !== 'retained') {
    await transitionSeedRun(
      runId,
      ['committed', 'job_running', 'asserting'],
      'retained',
    );
  }
  return {
    policy,
    runId,
    manifestPath: run.manifestPath,
    cleanupCommand: `npm run seed:cleanup -- --runId=${runId}`,
  };
}

function digest(value: unknown): string {
  const stable = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stable);
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .filter(([, nested]) => nested !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, stable(nested)]),
      );
    }
    return input;
  };
  return `sha256:${crypto
    .createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex')}`;
}

function riskForIssue(issue: PreflightIssue): V3Issue {
  const code =
    issue.code === 'PLAN_ROW_CONFLICT' ? 'EXPRESSION_UNSATISFIABLE' : issue.code;
  if (issue.severity === 'error') return { ...issue, code, severity: 'error', risk: 'high' };
  if (issue.code === 'OPTIONAL_SKELETON_COLUMN_MISSING') {
    return { ...issue, code, severity: 'info', risk: 'none' };
  }
  const high = [
    'METRIC_PROVISIONAL',
    'EVIDENCE_INCOMPLETE',
    'SOURCE_ROW_FILTER_PARTIAL',
  ].includes(issue.code);
  return { ...issue, code, severity: 'warning', risk: high ? 'high' : 'medium' };
}

function maxRisk(issues: V3Issue[]): ApprovalRisk {
  if (issues.some((value) => value.risk === 'high')) return 'high';
  if (issues.some((value) => value.risk === 'medium')) return 'medium';
  return 'none';
}

function redactParam(column: string, value: unknown): unknown {
  if (/password|token|cookie|authorization|account|user_name/i.test(column)) return '[REDACTED]';
  if (typeof value === 'string' && value.length > 256) return `${value.slice(0, 32)}…[TRUNCATED]`;
  return value;
}

export function redactDbAuditEvent(
  runId: string,
  phase: string,
  event: DbAuditEvent,
): SqlAuditEntry {
  const insertColumns = event.sql?.match(/INSERT\s+INTO[\s\S]*?\(([^)]+)\)\s*VALUES/i)?.[1]
    .split(',')
    .map((value) => value.replace(/[`"'\s]/g, ''));
  return {
    runId,
    phase: `${phase}.${event.kind}`,
    sql: event.sql ?? event.kind.toUpperCase(),
    params: (event.params ?? []).map((value, index) =>
      redactParam(insertColumns?.[index] ?? '', value),
    ),
    startedAt: event.startedAt,
    finishedAt: new Date(Date.parse(event.startedAt) + event.durationMs).toISOString(),
    durationMs: event.durationMs,
    affectedRows: event.affectedRows,
    errorCode: event.error,
  };
}

function sqlPreview(runId: string, plan: SeedExecutionPlanV3): SqlAuditEntry[] {
  const entries: SqlAuditEntry[] = [];
  for (const group of plan.insertGroups) {
    for (const row of group.rows) {
      const columns = Object.keys(row);
      entries.push({
        runId,
        phase: 'apply.insert',
        groupId: group.groupId,
        sql: buildFactInsertSql(group.table, columns),
        params: columns.map((column) => redactParam(column, row[column])),
        startedAt: plan.createdAt,
      });
    }
  }
  for (const condition of plan.conditions) {
    entries.push({
      runId,
      phase: 'apply.verify',
      nodeId: String(condition.condition.index),
      sql: `VERIFY ${condition.targetTable} ${condition.capability.metricKind}`,
      params: [],
      startedAt: plan.createdAt,
      result: { expectedHolds: condition.expectedHolds },
    });
  }
  return entries;
}

function formulaPlans(
  conditions: ConditionPlanV3[],
  nodeIds: Record<number, string>,
): FormulaPlan[] {
  return conditions.map((condition) => ({
    nodeId: nodeIds[condition.condition.index],
    metricKind: condition.capability.metricKind,
    writeColumns: condition.capability.writeColumns,
    aggregateSqlKind: condition.capability.metricKind,
  }));
}

export async function compileSeedRun(
  ruleId: string,
  options: {
    mode: 'hit' | 'miss';
    pairId?: string;
    hitNodeId?: string;
    missNodeId?: string;
    legacyMissConditionIndex?: number;
  },
): Promise<CompiledSeedRunV3> {
  const registry = loadCapabilityFile('ad-control');
  const promoted = loadPromotedConfigBundle();
  const configVersion = promoted.version;
  if (
    promoted.generatedFrom.find((source) => source.source === 'ad-control-knowledge')
      ?.digest !== registry.knowledgeVersion ||
    promoted.generatedFrom.find((source) => source.source === 'ad-control-evidence')
      ?.digest !== registry.evidenceDigest
  ) {
    throw new Error(
      'SEED_CONFIG_V3_RUNTIME_DRIFT: promoted knowledge/evidence digest differs from runtime',
    );
  }
  const runId = newRunId();
  await createSeedRun({
    runId,
    ruleId,
    pairId: options.pairId,
    mode: options.mode,
    status: 'compiling',
    configVersion,
  });
  try {
    const rows = await query<SeedRuleRow[]>(
      `SELECT id, pline_form, data_type, conditions, opt_status, project_status,
              external_action, delivery_way, channel_users, effect_scope, account_type,
              release_ver
         FROM ${registry.ruleTable}
        WHERE id = ?`,
      [ruleId],
    );
    if (!rows.length) throw new Error(`规则 ${ruleId} 不存在`);
    const rule = rows[0];
    const expression = parseRuleExpression(rule.conditions);
    const jobCompatibility = analyzeJobExpressionCompatibility(expression);
    const expressionLeaves = flattenConditionNodes(expression);
    const resolvedMissNodeId =
      options.missNodeId ??
      (options.legacyMissConditionIndex == null
        ? undefined
        : expressionLeaves[options.legacyMissConditionIndex]?.nodeId);
    const solution =
      options.mode === 'hit'
        ? solveExpression(expression, { mode: 'hit', hitNodeId: options.hitNodeId })
        : solveExpression(expression, {
            mode: 'miss',
            missNodeId:
              resolvedMissNodeId ??
              (() => {
                throw new Error('MISS 必须提供 missNodeId');
              })(),
          });
    const leaves = expressionLeaves;
    const issues: PreflightIssue[] = [];
    const conditions: ConditionPlanV3[] = [];
    const nodeIdByConditionIndex: Record<number, string> = {};
    for (let index = 0; index < leaves.length; index++) {
      await assertRunNotCancelled(runId);
      const leaf = leaves[index];
      nodeIdByConditionIndex[index] = leaf.nodeId;
      try {
        const metric = lookupMetricMap(registry.metricMap, leaf.condition.column, rule.pline_form);
        const policy = metric.seedPolicy ?? {
          evaluationPhase: 'aggregate' as const,
          standaloneRule: 'allowed' as const,
        };
        const capability = resolveSeedCapability(
          registry,
          rule.pline_form,
          rule.data_type,
          leaf.condition.timeType,
          leaf.condition.column,
          rule.release_ver,
          policy.forceGrain ? { forceGrain: policy.forceGrain } : undefined,
        );
        const expectedHolds = solution.assignments[leaf.nodeId];
        conditions.push({
          condition: { index, ...leaf.condition },
          recipeKey: capability.key,
          metricStatus: metric.status ?? 'provisional',
          evaluationPhase: policy.evaluationPhase,
          capability,
          targetGrain: capability.timeGrain,
          targetTable: capability.table,
          metricValues: computeMetricValues(
            capability,
            expectedHolds ? 'hit' : 'miss',
            leaf.condition.compareType,
            leaf.condition.val1,
            leaf.condition.val2,
          ),
          expectedHolds,
        });
        if ((metric.status ?? 'provisional') === 'provisional') {
          issues.push({
            severity: 'warning',
            code: 'METRIC_PROVISIONAL',
            message: `指标 ${leaf.condition.column} 尚未完成验证`,
            conditionIndex: index,
            column: leaf.condition.column,
          });
        }
        if (!metric.evidence?.formulaChecked || !metric.evidence?.schemaChecked) {
          issues.push({
            severity: 'warning',
            code: 'EVIDENCE_INCOMPLETE',
            message: `指标 ${leaf.condition.column} 证据不完整`,
            conditionIndex: index,
            column: leaf.condition.column,
          });
        }
      } catch (error) {
        issues.push({
          severity: 'error',
          code: 'FORMULA_UNSUPPORTED',
          message: error instanceof Error ? error.message : String(error),
          conditionIndex: index,
          column: leaf.condition.column,
        });
      }
    }
    const alignment = buildRuleFilters(rule, registry.filterKnowledge);
    issues.push(...alignment.issues);
    const compiledExecution: CompiledExecutionPlanV3 = {
      version: 3,
      biz: 'ad-control',
      scenario: 'rule_trigger',
      ruleId,
      pairId: options.pairId,
      mode: options.mode,
      plineForm: rule.pline_form,
      dataType: rule.data_type,
      releaseVer: rule.release_ver,
      conditions,
      ruleFilters: alignment.filters,
      sourceSelectorPatch: alignment.sourceSelectorPatch,
      finalFactPatch: alignment.finalFactPatch,
      issues,
      configDigest: configVersion,
      registry,
    };
    await transitionSeedRun(runId, 'compiling', 'preflighting');
    return {
      version: 3,
      runId,
      expression,
      rootNodeId: expression.root.nodeId,
      solution,
      leafNodeIds: leaves.map((leaf) => leaf.nodeId),
      nodeIdByConditionIndex,
      compiledExecution,
      configVersion,
      jobExpressionCompatible: jobCompatibility.compatible,
      unsupportedJobNodeIds: jobCompatibility.unsupportedNodeIds,
    };
  } catch (error) {
    await transitionSeedRun(runId, ['compiling', 'preflighting'], 'failed', {
      primaryError: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  }
}

export async function preflightSeedRun(
  compiled: CompiledSeedRunV3,
): Promise<SeedPlanV3> {
  await assertRunNotCancelled(compiled.runId);
  const preflightAudit: SqlAuditEntry[] = [];
  const executionPlan = await withDbAudit(
    (event) => {
      preflightAudit.push(redactDbAuditEvent(compiled.runId, 'preflight', event));
    },
    () => preflightExecutionPlanV3(compiled.compiledExecution),
  );
  const issues = executionPlan.issues.map(riskForIssue);
  if (!compiled.jobExpressionCompatible) {
    issues.push({
      severity: 'error',
      risk: 'high',
      code: 'JOB_AST_CAPABILITY_UNAVAILABLE',
      message:
        'market-job 仅支持旧条件数组的隐式 AND；包含 OR/NOT 的 AST 只能求解和预检，禁止 Apply',
      evidence: { unsupportedNodeIds: compiled.unsupportedJobNodeIds },
    });
  }
  const approvalRisk = maxRisk(issues);
  const approvalFingerprint = digest({
    expression: compiled.expression,
    solution: compiled.solution.assignments,
    configVersion: compiled.configVersion,
    ruleFilters: executionPlan.ruleFilters,
    mode: executionPlan.mode,
  });
  const withoutHash = {
    version: 3 as const,
    runId: compiled.runId,
    expression: compiled.expression,
    rootNodeId: compiled.rootNodeId,
    nodeExpectations: compiled.solution.nodeExpectations,
    witnessLeaves: compiled.solution.witnessLeaves,
    flippedLeaves: compiled.solution.flippedLeaves,
    nodeIdByConditionIndex: compiled.nodeIdByConditionIndex,
    formulaPlans: formulaPlans(executionPlan.conditions, compiled.nodeIdByConditionIndex),
    issues,
    approvalRisk,
    approvalFingerprint,
    configVersion: compiled.configVersion,
    sqlPreview: [...preflightAudit, ...sqlPreview(compiled.runId, executionPlan)],
    executionPlan,
    jobExpressionCompatible: compiled.jobExpressionCompatible,
    unsupportedJobNodeIds: compiled.unsupportedJobNodeIds,
  };
  const plan: SeedPlanV3 = {
    ...withoutHash,
    executionHash: digest(withoutHash),
  };
  const hasError = issues.some((value) => value.severity === 'error');
  const next: SeedRunStatus = hasError
    ? 'blocked'
    : approvalRisk === 'none'
      ? 'ready'
      : 'awaiting_approval';
  await transitionSeedRun(compiled.runId, 'preflighting', next, {
    approvalFingerprint,
    executionHash: plan.executionHash,
  });
  return plan;
}

async function hasActiveApproval(plan: SeedPlanV3): Promise<boolean> {
  if (plan.approvalRisk === 'none') return true;
  return hasValidSeedApproval({
    fingerprint: plan.approvalFingerprint,
    configVersion: plan.configVersion,
  });
}

export async function approveSeedRun(
  plan: SeedPlanV3,
  input: { approvedBy: string; reason: string; validDays?: number },
): Promise<void> {
  if (plan.approvalRisk === 'none') return;
  await upsertSeedApproval({
    fingerprint: plan.approvalFingerprint,
    configVersion: plan.configVersion,
    riskLevel: plan.approvalRisk,
    approvedBy: input.approvedBy,
    reason: input.reason,
    validDays: input.validDays,
  });
  await transitionSeedRun(plan.runId, 'awaiting_approval', 'ready');
}

function persistAudit(outputDir: string, plan: SeedPlanV3, entries: SqlAuditEntry[]): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, `seed-audit-v3-${plan.runId}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ version: 1, runId: plan.runId, entries }, null, 2)}\n`);
  return file;
}

export async function startSeedRun(
  plan: SeedPlanV3,
  options: {
    confirmed: boolean;
    approvalFingerprint?: string;
    outputDir: string;
    timeoutMs?: number;
    cleanupPolicy?: SeedCleanupPolicy;
  },
): Promise<SeedRunResult> {
  const serializedPlan = plan as unknown as Record<string, unknown>;
  if (
    plan.version !== 3 ||
    !plan.executionPlan ||
    plan.executionPlan.version !== 3 ||
    !plan.executionPlan.sourceSelectorPatch ||
    !plan.executionPlan.finalFactPatch ||
    ['plan', 'V2'].join('') in serializedPlan
  ) {
    throw new Error(
      'PLAN_VERSION_UNSUPPORTED: historical plans are read-only; run compile and preflight again',
    );
  }
  const cleanupPolicy = resolveSeedCleanupPolicy(options.cleanupPolicy);
  const current = await getSeedRunSnapshot(plan.runId);
  if (!plan.jobExpressionCompatible) {
    throw new Error(
      `JOB_AST_CAPABILITY_UNAVAILABLE: ${plan.unsupportedJobNodeIds.join(',')}`,
    );
  }
  if (!['ready', 'awaiting_approval'].includes(current.status)) {
    throw new Error(`SEED_RUN_NOT_STARTABLE: ${current.status}`);
  }
  if (!options.confirmed) throw new Error('SEED_RUN_CONFIRMATION_REQUIRED');
  if (
    plan.approvalRisk !== 'none' &&
    (options.approvalFingerprint !== plan.approvalFingerprint ||
      !(await hasActiveApproval(plan)))
  ) {
    throw new Error(`SEED_RUN_APPROVAL_REQUIRED: ${plan.approvalFingerprint}`);
  }
  await assertRunNotCancelled(plan.runId);
  const owner = `${process.pid}-${crypto.randomUUID()}`;
  await acquireSeedRunLease(plan.runId, owner);
  const heartbeat = setInterval(() => {
    void import('./meta-db-v3').then(({ heartbeatSeedRunLease }) =>
      heartbeatSeedRunLease(plan.runId, owner).catch(() => undefined),
    );
  }, 10_000);
  heartbeat.unref();
  const audit = [...plan.sqlPreview];
  const auditPath = persistAudit(options.outputDir, plan, audit);
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('SEED_RUN_TIMEOUT')), timeoutMs);
    timeoutHandle.unref();
  });
  try {
    await transitionSeedRun(plan.runId, current.status, 'applying', {
      auditPath,
      cleanupPolicy,
    });
    const applyPlan: SeedExecutionPlanV3 = {
      ...plan.executionPlan,
      status: 'ready',
    };
    const { executionHash: _old, ...withoutHash } = applyPlan;
    applyPlan.executionHash = calculateExecutionHash(withoutHash);
    const result = await Promise.race([
      withDbAudit(
        (event) => {
          audit.push(redactDbAuditEvent(plan.runId, 'apply', event));
          persistAudit(options.outputDir, plan, audit);
        },
        () =>
          applyExecutionPlanV3(applyPlan, {
            confirmed: true,
            outputDir: options.outputDir,
            cancellationCheck: () => assertRunNotCancelled(plan.runId),
          }),
      ),
      timeout,
    ]);
    await transitionSeedRun(plan.runId, 'applying', 'committed', {
      manifestPath: result.manifestPath,
    });
    return { ...result, runId: plan.runId, auditPath };
  } catch (error) {
    const cancelled = (error as { code?: string }).code === 'SEED_RUN_CANCELLED';
    await transitionSeedRun(plan.runId, 'applying', cancelled ? 'cancelled' : 'failed', {
      primaryError: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    clearInterval(heartbeat);
    await releaseSeedRunLease(plan.runId, owner).catch(() => undefined);
  }
}

export async function requestSeedRunCancel(runId: string, reason: string): Promise<void> {
  await requestRunCancel(runId, reason);
}

export async function getSeedRun(runId: string): Promise<SeedRunSnapshot> {
  return getSeedRunSnapshot(runId);
}

export async function markSeedRunJobRunning(runId: string): Promise<void> {
  await assertRunNotCancelled(runId);
  await transitionSeedRun(runId, 'committed', 'job_running');
}

export async function markSeedRunAsserting(runId: string): Promise<void> {
  await assertRunNotCancelled(runId);
  await transitionSeedRun(runId, 'job_running', 'asserting');
}

export async function cleanupSeedRun(runId: string): Promise<SeedCleanupResult> {
  const run = await getSeedRunSnapshot(runId);
  if (!run.manifestPath) throw new Error(`SEED_RUN_MANIFEST_MISSING: ${runId}`);
  const manifest = JSON.parse(fs.readFileSync(run.manifestPath, 'utf8'));
  if (run.status !== 'cleaning') {
    await transitionSeedRun(
      runId,
      ['committed', 'job_running', 'asserting', 'retained', 'cleanup_failed'],
      'cleaning',
    );
  }
  try {
    const auditDocument =
      run.auditPath && fs.existsSync(run.auditPath)
        ? JSON.parse(fs.readFileSync(run.auditPath, 'utf8'))
        : { version: 1, runId, entries: [] };
    const result = await withDbAudit(
      (event) => {
        auditDocument.entries.push(redactDbAuditEvent(runId, 'cleanup', event));
        if (run.auditPath) {
          fs.writeFileSync(run.auditPath, `${JSON.stringify(auditDocument, null, 2)}\n`);
        }
      },
      () => cleanupExecutionManifestV3(manifest),
    );
    const latest = await getSeedRunSnapshot(runId);
    await transitionSeedRun(runId, 'cleaning', latest.cancelRequestedAt ? 'cancelled' : 'succeeded');
    return result;
  } catch (error) {
    await transitionSeedRun(runId, 'cleaning', 'cleanup_failed', {
      cleanupError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function resumeSeedRun(runId: string): Promise<SeedRunResult> {
  const run = await getSeedRunSnapshot(runId);
  if (['committed', 'job_running', 'asserting', 'cleaning', 'cleanup_failed'].includes(run.status)) {
    await cleanupSeedRun(runId);
    throw new Error(`SEED_RUN_RECOVERED_BY_CLEANUP: ${runId}`);
  }
  throw new Error(`SEED_RUN_NOT_RESUMABLE: ${run.status}`);
}

export async function recoverOrphanSeedRuns(): Promise<string[]> {
  const recovered: string[] = [];
  for (const run of await findRecoverableRuns()) {
    try {
      await resumeSeedRun(run.runId);
    } catch (error) {
      if (String((error as Error).message).includes('RECOVERED_BY_CLEANUP')) {
        recovered.push(run.runId);
      }
    }
  }
  return recovered;
}
