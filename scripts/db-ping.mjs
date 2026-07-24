/**
 * CLI: npm run db:ping
 * Reads project root .env (E2E_DB_*) and runs SELECT 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env at ${envPath}`);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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

async function main() {
  loadDotEnv();
  const host = process.env.E2E_DB_HOST;
  const port = Number(process.env.E2E_DB_PORT || 3306);
  const database = process.env.E2E_DB_NAME;
  const user = process.env.E2E_DB_USER;
  const password = process.env.E2E_DB_PASSWORD;
  if (!host || !database || !user || password === undefined) {
    throw new Error('Set E2E_DB_HOST/PORT/NAME/USER/PASSWORD in .env');
  }
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset: 'utf8mb4',
  });
  try {
    const [rows] = await conn.query('SELECT 1 AS ok, DATABASE() AS db');
    console.log('DB_OK', rows[0]);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('DB_FAIL', e.message || e);
  process.exit(1);
});
