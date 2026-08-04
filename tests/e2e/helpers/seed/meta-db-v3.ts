import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mysql, {
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';
import { getDbConfig } from '../db';

export const SEED_META_SCHEMA_VERSION = 3;

export type SeedRunStatus =
  | 'created'
  | 'compiling'
  | 'preflighting'
  | 'awaiting_approval'
  | 'blocked'
  | 'ready'
  | 'applying'
  | 'committed'
  | 'job_running'
  | 'asserting'
  | 'retained'
  | 'cleaning'
  | 'succeeded'
  | 'cancelled'
  | 'failed'
  | 'cleanup_failed'
  | 'expired';

export type SeedRunSnapshot = {
  runId: string;
  ruleId: string;
  pairId?: string;
  mode: 'hit' | 'miss';
  status: SeedRunStatus;
  configVersion?: string;
  approvalFingerprint?: string;
  executionHash?: string;
  planPath?: string;
  auditPath?: string;
  manifestPath?: string;
  cancelRequestedAt?: string;
  cancelReason?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  primaryError?: string;
  rollbackError?: string;
  cleanupError?: string;
  cleanupPolicy?: 'always' | 'manual';
  createdAt: string;
  updatedAt: string;
};

type RunRow = RowDataPacket & {
  run_id: string;
  rule_id: string;
  pair_id: string | null;
  mode: 'hit' | 'miss';
  status: SeedRunStatus;
  config_version: string | null;
  approval_fingerprint: string | null;
  execution_hash: string | null;
  plan_path: string | null;
  audit_path: string | null;
  manifest_path: string | null;
  cancel_requested_at: Date | null;
  cancel_reason: string | null;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  primary_error: string | null;
  rollback_error: string | null;
  cleanup_error: string | null;
  cleanup_policy: 'always' | 'manual' | null;
  created_at: Date;
  updated_at: Date;
};

let metaPool: Pool | undefined;

export type SeedMetaStoreMode = 'mysql' | 'file';

type FileApproval = {
  fingerprint: string;
  environment: 'test';
  biz: 'ad-control';
  scenario: 'rule_trigger';
  configVersion: string;
  riskLevel: 'medium' | 'high';
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  reason: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
};

const terminalStatuses = new Set<SeedRunStatus>([
  'blocked', 'succeeded', 'cancelled', 'failed', 'cleanup_failed', 'expired',
]);

export function resolveSeedMetaStoreMode(): SeedMetaStoreMode {
  const value = (process.env.E2E_META_STORE || 'mysql').trim().toLowerCase();
  if (value !== 'mysql' && value !== 'file') {
    throw new Error(`E2E_META_STORE_INVALID: ${value}; expected mysql|file`);
  }
  return value;
}

function fileRoot(): string {
  return path.resolve(process.env.E2E_META_DIR || '.local/seed-meta');
}

function runsDir(): string {
  return path.join(fileRoot(), 'runs');
}

function runFile(runId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) throw new Error(`SEED_RUN_ID_UNSAFE: ${runId}`);
  return path.join(runsDir(), `${runId}.json`);
}

function approvalFile(): string {
  return path.join(fileRoot(), 'approvals.json');
}

function atomicWriteJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temp, file);
}

function readJson<T>(file: string, fallback?: T): T {
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`SEED_META_FILE_NOT_FOUND: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

async function withFileLock<T>(name: string, callback: () => Promise<T> | T): Promise<T> {
  const lockDir = path.join(fileRoot(), 'locks');
  fs.mkdirSync(lockDir, { recursive: true });
  const lockFile = path.join(lockDir, `${name}.lock`);
  const deadline = Date.now() + 10_000;
  let handle: number | undefined;
  while (handle === undefined) {
    try {
      handle = fs.openSync(lockFile, 'wx');
      fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      const age = Date.now() - fs.statSync(lockFile).mtimeMs;
      if (age > 60_000) {
        fs.rmSync(lockFile, { force: true });
        continue;
      }
      if (Date.now() >= deadline) throw new Error(`SEED_META_FILE_LOCK_TIMEOUT: ${name}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  try {
    return await callback();
  } finally {
    fs.closeSync(handle);
    fs.rmSync(lockFile, { force: true });
  }
}

function readFileRun(runId: string): SeedRunSnapshot {
  const file = runFile(runId);
  if (!fs.existsSync(file)) throw new Error(`SEED_RUN_NOT_FOUND: ${runId}`);
  return readJson<SeedRunSnapshot>(file);
}

const allowedTransitions: Record<SeedRunStatus, ReadonlySet<SeedRunStatus>> = {
  created: new Set(['compiling', 'cancelled', 'failed']),
  compiling: new Set(['preflighting', 'cancelled', 'failed']),
  preflighting: new Set(['awaiting_approval', 'blocked', 'ready', 'cancelled', 'failed']),
  awaiting_approval: new Set(['ready', 'cancelled', 'expired', 'failed']),
  blocked: new Set(),
  ready: new Set(['applying', 'cancelled', 'expired', 'failed']),
  applying: new Set(['committed', 'cancelled', 'failed']),
  committed: new Set(['job_running', 'retained', 'cleaning', 'failed']),
  job_running: new Set(['asserting', 'retained', 'cleaning', 'failed']),
  asserting: new Set(['retained', 'cleaning', 'failed']),
  retained: new Set(['cleaning', 'cancelled']),
  cleaning: new Set(['succeeded', 'cancelled', 'cleanup_failed']),
  succeeded: new Set(),
  cancelled: new Set(),
  failed: new Set(),
  cleanup_failed: new Set(['cleaning']),
  expired: new Set(),
};

function pool(): Pool {
  if (metaPool) return metaPool;
  const base = getDbConfig();
  const database = process.env.E2E_META_DB_NAME;
  if (!database) throw new Error('Missing E2E_META_DB_NAME');
  metaPool = mysql.createPool({
    host: process.env.E2E_META_DB_HOST || base.host,
    port: Number(process.env.E2E_META_DB_PORT || base.port),
    user: process.env.E2E_META_DB_USER || base.user,
    password: process.env.E2E_META_DB_PASSWORD ?? base.password,
    database,
    charset: 'utf8mb4',
    connectionLimit: 4,
    waitForConnections: true,
  });
  return metaPool;
}

function iso(value: Date | null): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function snapshot(row: RunRow): SeedRunSnapshot {
  return {
    runId: row.run_id,
    ruleId: row.rule_id,
    pairId: row.pair_id ?? undefined,
    mode: row.mode,
    status: row.status,
    configVersion: row.config_version ?? undefined,
    approvalFingerprint: row.approval_fingerprint ?? undefined,
    executionHash: row.execution_hash ?? undefined,
    planPath: row.plan_path ?? undefined,
    auditPath: row.audit_path ?? undefined,
    manifestPath: row.manifest_path ?? undefined,
    cancelRequestedAt: iso(row.cancel_requested_at),
    cancelReason: row.cancel_reason ?? undefined,
    leaseOwner: row.lease_owner ?? undefined,
    leaseExpiresAt: iso(row.lease_expires_at),
    primaryError: row.primary_error ?? undefined,
    rollbackError: row.rollback_error ?? undefined,
    cleanupError: row.cleanup_error ?? undefined,
    cleanupPolicy: row.cleanup_policy ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function assertMetaSchema(): Promise<void> {
  // getDbConfig also loads the repository-root .env for direct Playwright runs.
  getDbConfig();
  if (process.env.E2E_DB_ENV !== 'test') throw new Error('DATABASE_ENV_UNSAFE');
  if (resolveSeedMetaStoreMode() === 'file') {
    fs.mkdirSync(runsDir(), { recursive: true });
    fs.mkdirSync(path.join(fileRoot(), 'locks'), { recursive: true });
    const schemaFile = path.join(fileRoot(), 'schema-version.json');
    if (fs.existsSync(schemaFile)) {
      const schema = readJson<{ version: number }>(schemaFile);
      if (schema.version !== SEED_META_SCHEMA_VERSION) {
        throw new Error(
          `E2E_META_SCHEMA_MISMATCH expected=${SEED_META_SCHEMA_VERSION} actual=${schema.version}`,
        );
      }
    } else {
      atomicWriteJson(schemaFile, { version: SEED_META_SCHEMA_VERSION, store: 'file' });
    }
    return;
  }
  const [rows] = await pool().query<Array<RowDataPacket & { version: number }>>(
    'SELECT MAX(version) AS version FROM e2e_seed_schema_version',
  );
  if (Number(rows[0]?.version) !== SEED_META_SCHEMA_VERSION) {
    throw new Error(
      `E2E_META_SCHEMA_MISMATCH expected=${SEED_META_SCHEMA_VERSION} actual=${rows[0]?.version ?? '-'}`,
    );
  }
}

export function newRunId(): string {
  return crypto.randomUUID();
}

export async function createSeedRun(input: {
  runId: string;
  ruleId: string;
  pairId?: string;
  mode: 'hit' | 'miss';
  status?: SeedRunStatus;
  configVersion?: string;
}): Promise<void> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    await withFileLock('runs', () => {
      const target = runFile(input.runId);
      if (fs.existsSync(target)) throw new Error(`SEED_RUN_ALREADY_EXISTS: ${input.runId}`);
      const activeKey = `${input.ruleId}|${input.mode}|${input.pairId ?? '-'}`;
      const conflict = fs.readdirSync(runsDir())
        .filter((name) => name.endsWith('.json'))
        .map((name) => readJson<SeedRunSnapshot>(path.join(runsDir(), name)))
        .find((run) =>
          !terminalStatuses.has(run.status) &&
          `${run.ruleId}|${run.mode}|${run.pairId ?? '-'}` === activeKey,
        );
      if (conflict) throw new Error(`SEED_RUN_ACTIVE_CONFLICT: ${conflict.runId}`);
      const now = new Date().toISOString();
      atomicWriteJson(target, {
        runId: input.runId,
        ruleId: input.ruleId,
        pairId: input.pairId,
        mode: input.mode,
        status: input.status ?? 'created',
        configVersion: input.configVersion,
        createdAt: now,
        updatedAt: now,
      } satisfies SeedRunSnapshot);
    });
    return;
  }
  await pool().execute(
    `INSERT INTO e2e_seed_run
      (run_id, environment, biz, scenario, rule_id, pair_id, mode, active_key, status, config_version)
     VALUES (?, 'test', 'ad-control', 'rule_trigger', ?, ?, ?, ?, ?, ?)`,
    [
      input.runId,
      input.ruleId,
      input.pairId ?? null,
      input.mode,
      `${input.ruleId}|${input.mode}|${input.pairId ?? '-'}`,
      input.status ?? 'created',
      input.configVersion ?? null,
    ],
  );
}

export async function getSeedRunSnapshot(runId: string): Promise<SeedRunSnapshot> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') return readFileRun(runId);
  const [rows] = await pool().query<RunRow[]>(
    'SELECT * FROM e2e_seed_run WHERE run_id = ?',
    [runId],
  );
  if (!rows.length) throw new Error(`SEED_RUN_NOT_FOUND: ${runId}`);
  return snapshot(rows[0]);
}

export async function transitionSeedRun(
  runId: string,
  from: SeedRunStatus | SeedRunStatus[],
  to: SeedRunStatus,
  patch: Partial<{
    approvalFingerprint: string;
    executionHash: string;
    planPath: string;
    auditPath: string;
    manifestPath: string;
    primaryError: string;
    rollbackError: string;
    cleanupError: string;
    cleanupPolicy: 'always' | 'manual';
  }> = {},
): Promise<SeedRunSnapshot> {
  const allowed = Array.isArray(from) ? from : [from];
  const invalidFrom = allowed.find((status) => !allowedTransitions[status].has(to));
  if (invalidFrom) {
    throw new Error(`SEED_RUN_TRANSITION_NOT_ALLOWED: ${invalidFrom} -> ${to}`);
  }
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    return withFileLock(`run-${runId}`, () => {
      const current = readFileRun(runId);
      if (!allowed.includes(current.status)) {
        throw new Error(`SEED_RUN_INVALID_TRANSITION: ${runId} ${allowed.join('|')} -> ${to}`);
      }
      const next: SeedRunSnapshot = {
        ...current,
        ...patch,
        status: to,
        updatedAt: new Date().toISOString(),
      };
      atomicWriteJson(runFile(runId), next);
      return next;
    });
  }
  const assignments = ['status = ?', 'updated_at = CURRENT_TIMESTAMP(3)'];
  const params: unknown[] = [to];
  if (['blocked', 'succeeded', 'cancelled', 'failed', 'cleanup_failed', 'expired'].includes(to)) {
    assignments.push('active_key = NULL');
  }
  const columns: Array<[keyof typeof patch, string]> = [
    ['approvalFingerprint', 'approval_fingerprint'],
    ['executionHash', 'execution_hash'],
    ['planPath', 'plan_path'],
    ['auditPath', 'audit_path'],
    ['manifestPath', 'manifest_path'],
    ['primaryError', 'primary_error'],
    ['rollbackError', 'rollback_error'],
    ['cleanupError', 'cleanup_error'],
    ['cleanupPolicy', 'cleanup_policy'],
  ];
  for (const [key, column] of columns) {
    if (patch[key] !== undefined) {
      assignments.push(`${column} = ?`);
      params.push(patch[key]);
    }
  }
  params.push(runId, ...allowed);
  const [result] = await pool().execute<ResultSetHeader>(
    `UPDATE e2e_seed_run SET ${assignments.join(', ')}
      WHERE run_id = ? AND status IN (${allowed.map(() => '?').join(', ')})`,
    params,
  );
  if (result.affectedRows !== 1) {
    throw new Error(`SEED_RUN_INVALID_TRANSITION: ${runId} ${allowed.join('|')} -> ${to}`);
  }
  return getSeedRunSnapshot(runId);
}

export async function acquireSeedRunLease(
  runId: string,
  owner: string,
  ttlMs = 30_000,
): Promise<void> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    await withFileLock(`run-${runId}`, () => {
      const current = readFileRun(runId);
      const expiresAt = current.leaseExpiresAt ? Date.parse(current.leaseExpiresAt) : 0;
      if (current.leaseOwner && current.leaseOwner !== owner && expiresAt >= Date.now()) {
        throw new Error(`SEED_RUN_LEASE_CONFLICT: ${runId}`);
      }
      atomicWriteJson(runFile(runId), {
        ...current,
        leaseOwner: owner,
        leaseExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    return;
  }
  const [result] = await pool().execute<ResultSetHeader>(
    `UPDATE e2e_seed_run
        SET lease_owner = ?,
            lease_expires_at = DATE_ADD(NOW(3), INTERVAL ? MICROSECOND),
            heartbeat_at = NOW(3)
      WHERE run_id = ?
        AND (lease_expires_at IS NULL OR lease_expires_at < NOW(3) OR lease_owner = ?)`,
    [owner, ttlMs * 1000, runId, owner],
  );
  if (result.affectedRows !== 1) throw new Error(`SEED_RUN_LEASE_CONFLICT: ${runId}`);
}

export async function heartbeatSeedRunLease(
  runId: string,
  owner: string,
  ttlMs = 30_000,
): Promise<void> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    await withFileLock(`run-${runId}`, () => {
      const current = readFileRun(runId);
      if (
        current.leaseOwner !== owner ||
        !current.leaseExpiresAt ||
        Date.parse(current.leaseExpiresAt) < Date.now()
      ) {
        throw new Error(`SEED_RUN_LEASE_LOST: ${runId}`);
      }
      atomicWriteJson(runFile(runId), {
        ...current,
        leaseExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    return;
  }
  const [result] = await pool().execute<ResultSetHeader>(
    `UPDATE e2e_seed_run
        SET lease_expires_at = DATE_ADD(NOW(3), INTERVAL ? MICROSECOND),
            heartbeat_at = NOW(3)
      WHERE run_id = ? AND lease_owner = ? AND lease_expires_at >= NOW(3)`,
    [ttlMs * 1000, runId, owner],
  );
  if (result.affectedRows !== 1) throw new Error(`SEED_RUN_LEASE_LOST: ${runId}`);
}

export async function releaseSeedRunLease(runId: string, owner: string): Promise<void> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    await withFileLock(`run-${runId}`, () => {
      const current = readFileRun(runId);
      if (current.leaseOwner !== owner) return;
      const next = { ...current, updatedAt: new Date().toISOString() };
      delete next.leaseOwner;
      delete next.leaseExpiresAt;
      atomicWriteJson(runFile(runId), next);
    });
    return;
  }
  await pool().execute(
    `UPDATE e2e_seed_run
        SET lease_owner = NULL, lease_expires_at = NULL
      WHERE run_id = ? AND lease_owner = ?`,
    [runId, owner],
  );
}

export async function requestRunCancel(runId: string, reason: string): Promise<void> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    await withFileLock(`run-${runId}`, () => {
      const current = readFileRun(runId);
      if (terminalStatuses.has(current.status)) {
        throw new Error(`SEED_RUN_NOT_CANCELLABLE: ${runId}`);
      }
      atomicWriteJson(runFile(runId), {
        ...current,
        cancelRequestedAt: current.cancelRequestedAt ?? new Date().toISOString(),
        cancelReason: current.cancelReason ?? reason,
        updatedAt: new Date().toISOString(),
      });
    });
    return;
  }
  const [result] = await pool().execute<ResultSetHeader>(
    `UPDATE e2e_seed_run
        SET cancel_requested_at = COALESCE(cancel_requested_at, NOW(3)),
            cancel_reason = COALESCE(cancel_reason, ?),
            updated_at = NOW(3)
      WHERE run_id = ?
        AND status NOT IN ('succeeded','cancelled','failed','cleanup_failed','expired')`,
    [reason, runId],
  );
  if (result.affectedRows !== 1) throw new Error(`SEED_RUN_NOT_CANCELLABLE: ${runId}`);
}

export async function upsertSeedApproval(input: {
  fingerprint: string;
  configVersion: string;
  riskLevel: 'medium' | 'high';
  approvedBy: string;
  reason: string;
  validDays?: number;
}): Promise<void> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    await withFileLock('approvals', () => {
      const approvals = readJson<FileApproval[]>(approvalFile(), []);
      const now = new Date();
      const next: FileApproval = {
        fingerprint: input.fingerprint,
        environment: 'test',
        biz: 'ad-control',
        scenario: 'rule_trigger',
        configVersion: input.configVersion,
        riskLevel: input.riskLevel,
        approvedBy: input.approvedBy,
        approvedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + (input.validDays ?? 90) * 86_400_000).toISOString(),
        reason: input.reason,
      };
      const index = approvals.findIndex((approval) =>
        approval.fingerprint === input.fingerprint &&
        approval.configVersion === input.configVersion,
      );
      if (index >= 0) approvals[index] = next;
      else approvals.push(next);
      atomicWriteJson(approvalFile(), approvals);
    });
    return;
  }
  await pool().execute(
    `INSERT INTO e2e_seed_approval
      (fingerprint, environment, biz, scenario, config_version, risk_level,
       approved_by, approved_at, expires_at, reason)
     VALUES (?, 'test', 'ad-control', 'rule_trigger', ?, ?, ?, NOW(3),
             DATE_ADD(NOW(3), INTERVAL ? DAY), ?)
     ON DUPLICATE KEY UPDATE
       risk_level = VALUES(risk_level),
       approved_by = VALUES(approved_by),
       approved_at = VALUES(approved_at),
       expires_at = VALUES(expires_at),
       reason = VALUES(reason),
       revoked_at = NULL,
       revoked_by = NULL,
       revoke_reason = NULL`,
    [
      input.fingerprint,
      input.configVersion,
      input.riskLevel,
      input.approvedBy,
      input.validDays ?? 90,
      input.reason,
    ],
  );
}

export async function hasValidSeedApproval(input: {
  fingerprint: string;
  configVersion: string;
}): Promise<boolean> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    const approvals = readJson<FileApproval[]>(approvalFile(), []);
    return approvals.some((approval) =>
      approval.fingerprint === input.fingerprint &&
      approval.configVersion === input.configVersion &&
      approval.environment === 'test' &&
      approval.biz === 'ad-control' &&
      approval.scenario === 'rule_trigger' &&
      !approval.revokedAt &&
      Date.parse(approval.expiresAt) > Date.now(),
    );
  }
  const [rows] = await pool().query<Array<RowDataPacket & { approved: number }>>(
    `SELECT COUNT(*) AS approved
       FROM e2e_seed_approval
      WHERE fingerprint = ?
        AND environment = 'test'
        AND biz = 'ad-control'
        AND scenario = 'rule_trigger'
        AND config_version = ?
        AND expires_at > NOW(3)
        AND revoked_at IS NULL`,
    [input.fingerprint, input.configVersion],
  );
  return Number(rows[0]?.approved) === 1;
}

export async function revokeSeedApproval(input: {
  fingerprint: string;
  configVersion: string;
  revokedBy: string;
  reason: string;
}): Promise<void> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    await withFileLock('approvals', () => {
      const approvals = readJson<FileApproval[]>(approvalFile(), []);
      const approval = approvals.find((value) =>
        value.fingerprint === input.fingerprint &&
        value.configVersion === input.configVersion &&
        !value.revokedAt,
      );
      if (!approval) throw new Error('SEED_APPROVAL_NOT_ACTIVE');
      approval.revokedAt = new Date().toISOString();
      approval.revokedBy = input.revokedBy;
      approval.revokeReason = input.reason;
      atomicWriteJson(approvalFile(), approvals);
    });
    return;
  }
  const [result] = await pool().execute<ResultSetHeader>(
    `UPDATE e2e_seed_approval
        SET revoked_at = NOW(3), revoked_by = ?, revoke_reason = ?
      WHERE fingerprint = ?
        AND environment = 'test'
        AND biz = 'ad-control'
        AND scenario = 'rule_trigger'
        AND config_version = ?
        AND revoked_at IS NULL`,
    [input.revokedBy, input.reason, input.fingerprint, input.configVersion],
  );
  if (result.affectedRows !== 1) throw new Error('SEED_APPROVAL_NOT_ACTIVE');
}

export async function assertRunNotCancelled(runId: string): Promise<void> {
  const current = await getSeedRunSnapshot(runId);
  if (current.cancelRequestedAt) {
    const error = new Error(`SEED_RUN_CANCELLED: ${current.cancelReason ?? 'requested'}`);
    Object.assign(error, { code: 'SEED_RUN_CANCELLED' });
    throw error;
  }
}

export async function findRecoverableRuns(): Promise<SeedRunSnapshot[]> {
  await assertMetaSchema();
  if (resolveSeedMetaStoreMode() === 'file') {
    const recoverable = new Set<SeedRunStatus>([
      'applying', 'committed', 'job_running', 'asserting', 'cleaning', 'cleanup_failed',
    ]);
    return fs.readdirSync(runsDir())
      .filter((name) => name.endsWith('.json'))
      .map((name) => readJson<SeedRunSnapshot>(path.join(runsDir(), name)))
      .filter((run) =>
        recoverable.has(run.status) &&
        (!run.leaseExpiresAt || Date.parse(run.leaseExpiresAt) < Date.now()),
      )
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  }
  const [rows] = await pool().query<RunRow[]>(
    `SELECT * FROM e2e_seed_run
      WHERE status IN ('applying','committed','job_running','asserting','cleaning','cleanup_failed')
        AND (lease_expires_at IS NULL OR lease_expires_at < NOW(3))
      ORDER BY updated_at ASC`,
  );
  return rows.map(snapshot);
}

export async function closeMetaPool(): Promise<void> {
  if (!metaPool) return;
  await metaPool.end();
  metaPool = undefined;
}
