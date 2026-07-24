import fs from 'node:fs';
import path from 'node:path';
import mysql, { type Pool, type PoolOptions, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

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
  const [rows] = await getDbPool().query<T>(sql, params);
  return rows;
}

export async function execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
  const [result] = await getDbPool().execute<ResultSetHeader>(sql, params);
  return result;
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
