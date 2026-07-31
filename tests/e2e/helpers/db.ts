import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import mysql, {
  type Pool,
  type PoolConnection,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';

function loadDotEnvFromRepoRoot() {
  // tests/e2e/helpers → repo root
  const envPath = path.resolve(__dirname, '../../../.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

export type DbConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export function getDbConfig(): DbConfig {
  loadDotEnvFromRepoRoot();
  const host = process.env.E2E_DB_HOST;
  const database = process.env.E2E_DB_NAME;
  const user = process.env.E2E_DB_USER;
  const password = process.env.E2E_DB_PASSWORD;
  const port = Number(process.env.E2E_DB_PORT || 3306);
  const missing = [
    !host && 'E2E_DB_HOST',
    !database && 'E2E_DB_NAME',
    !user && 'E2E_DB_USER',
    password === undefined && 'E2E_DB_PASSWORD',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Missing DB env in project root .env: ${missing.join(', ')}`);
  }
  return { host: host!, port, database: database!, user: user!, password: password! };
}

let pool: Pool | undefined;

export type DbAuditEvent = {
  kind: 'query' | 'execute' | 'begin' | 'commit' | 'rollback';
  sql?: string;
  params?: unknown[];
  startedAt: string;
  durationMs: number;
  affectedRows?: number;
  error?: string;
};

type DbAuditSink = (event: DbAuditEvent) => void | Promise<void>;
const auditStorage = new AsyncLocalStorage<DbAuditSink>();

async function audit(event: DbAuditEvent): Promise<void> {
  await auditStorage.getStore()?.(event);
}

export async function withDbAudit<T>(
  sink: DbAuditSink,
  callback: () => Promise<T>,
): Promise<T> {
  return auditStorage.run(sink, callback);
}

function poolOptions(): PoolOptions {
  const c = getDbConfig();
  return {
    host: c.host,
    port: c.port,
    user: c.user,
    password: c.password,
    database: c.database,
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',
  };
}

/** Shared pool (lazy). Call closeDbPool in afterAll if needed. */
export function getDbPool(): Pool {
  if (!pool) pool = mysql.createPool(poolOptions());
  return pool;
}

export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params?: unknown[],
): Promise<T> {
  const startedAt = new Date();
  try {
    const [rows] = await getDbPool().query<T>(sql, params);
    await audit({ kind: 'query', sql, params, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime() });
    return rows;
  } catch (error) {
    await audit({ kind: 'query', sql, params, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(), error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
  const startedAt = new Date();
  try {
    const [result] = await getDbPool().execute<ResultSetHeader>(sql, params);
    await audit({ kind: 'execute', sql, params, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(), affectedRows: result.affectedRows });
    return result;
  } catch (error) {
    await audit({ kind: 'execute', sql, params, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(), error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export type DbExecutor = {
  query<T extends RowDataPacket[] = RowDataPacket[]>(
    sql: string,
    params?: unknown[],
  ): Promise<T>;
  execute(sql: string, params?: unknown[]): Promise<ResultSetHeader>;
};

function connectionExecutor(connection: PoolConnection): DbExecutor {
  return {
    async query<T extends RowDataPacket[] = RowDataPacket[]>(
      sql: string,
      params?: unknown[],
    ): Promise<T> {
      const startedAt = new Date();
      try {
        const [rows] = await connection.query<T>(sql, params);
        await audit({ kind: 'query', sql, params, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime() });
        return rows;
      } catch (error) {
        await audit({ kind: 'query', sql, params, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(), error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    },
    async execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
      const startedAt = new Date();
      try {
        const [result] = await connection.execute<ResultSetHeader>(sql, params);
        await audit({ kind: 'execute', sql, params, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(), affectedRows: result.affectedRows });
        return result;
      } catch (error) {
        await audit({ kind: 'execute', sql, params, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(), error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    },
  };
}

/** Run all callback operations on one connection and commit atomically. */
export async function withTransaction<T>(
  callback: (executor: DbExecutor) => Promise<T>,
): Promise<T> {
  const connection = await getDbPool().getConnection();
  try {
    const beginAt = new Date();
    await connection.beginTransaction();
    await audit({ kind: 'begin', startedAt: beginAt.toISOString(), durationMs: Date.now() - beginAt.getTime() });
    try {
      const value = await callback(connectionExecutor(connection));
      const commitAt = new Date();
      await connection.commit();
      await audit({ kind: 'commit', startedAt: commitAt.toISOString(), durationMs: Date.now() - commitAt.getTime() });
      return value;
    } catch (error) {
      try {
        const rollbackAt = new Date();
        await connection.rollback();
        await audit({ kind: 'rollback', startedAt: rollbackAt.toISOString(), durationMs: Date.now() - rollbackAt.getTime() });
      } catch (rollbackError) {
        await audit({ kind: 'rollback', startedAt: new Date().toISOString(), durationMs: 0, error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError) });
        if (error instanceof Error) {
          Object.assign(error, { rollbackError });
        }
      }
      throw error;
    }
  } finally {
    connection.release();
  }
}

/** Connectivity check: SELECT 1 + current database name. */
export async function pingDb(): Promise<{ ok: number; db: string | null }> {
  const rows = await query<RowDataPacket[]>('SELECT 1 AS ok, DATABASE() AS db');
  const row = rows[0];
  return { ok: Number(row.ok), db: (row.db as string) ?? null };
}

export async function closeDbPool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
