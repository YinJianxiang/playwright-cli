import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function loadEnv() {
  const file = path.resolve('.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadEnv();
if (process.env.E2E_DB_ENV !== 'test') throw new Error('E2E_DB_ENV must equal test');
const metaStore = (process.env.E2E_META_STORE || 'mysql').trim().toLowerCase();
if (!['mysql', 'file'].includes(metaStore)) {
  throw new Error(`E2E_META_STORE must be mysql or file, received: ${metaStore}`);
}
if (metaStore === 'file') {
  console.log('E2E_META_STORE=file: no database migration is required; storage is initialized on first use');
  process.exit(0);
}
if (!process.env.E2E_META_DB_NAME) throw new Error('Missing E2E_META_DB_NAME');
if (process.env.E2E_META_DB_NAME === process.env.E2E_DB_NAME) {
  throw new Error('E2E_META_DB_NAME must be different from E2E_DB_NAME');
}

const metaConnection = {
  host: process.env.E2E_META_DB_HOST || process.env.E2E_DB_HOST,
  port: Number(process.env.E2E_META_DB_PORT || process.env.E2E_DB_PORT || 3306),
  user: process.env.E2E_META_DB_USER || process.env.E2E_DB_USER,
  password: process.env.E2E_META_DB_PASSWORD ?? process.env.E2E_DB_PASSWORD,
  database: process.env.E2E_META_DB_NAME,
};
for (const [key, value] of Object.entries(metaConnection)) {
  if (value == null || value === '') throw new Error(`Missing meta database connection field: ${key}`);
}

if (!/^[A-Za-z0-9_]+$/.test(metaConnection.database)) {
  throw new Error('E2E_META_DB_NAME contains unsafe characters');
}
if (process.argv.includes('--create-database')) {
  const bootstrap = await mysql.createConnection({
    host: metaConnection.host,
    port: metaConnection.port,
    user: metaConnection.user,
    password: metaConnection.password,
  });
  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${metaConnection.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`database ready: ${metaConnection.database}`);
  } finally {
    await bootstrap.end();
  }
}

const connection = await mysql.createConnection({
  ...metaConnection,
  multipleStatements: true,
});
try {
  const files = fs.readdirSync(path.resolve('migrations/e2e-meta'))
    .filter((name) => /^V\d+__.*\.sql$/.test(name))
    .sort();
  for (const name of files) {
    const version = Number(name.match(/^V(\d+)__/)?.[1]);
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS installed
         FROM information_schema.tables
        WHERE table_schema = ? AND table_name = 'e2e_seed_schema_version'`,
      [process.env.E2E_META_DB_NAME],
    );
    if (Number(rows[0].installed) === 1) {
      const [installed] = await connection.query(
        'SELECT COUNT(*) AS installed FROM e2e_seed_schema_version WHERE version = ?',
        [version],
      );
      if (Number(installed[0].installed) === 1) continue;
    }
    await connection.query(fs.readFileSync(path.resolve('migrations/e2e-meta', name), 'utf8'));
    console.log(`installed ${name}`);
  }
} finally {
  await connection.end();
}
