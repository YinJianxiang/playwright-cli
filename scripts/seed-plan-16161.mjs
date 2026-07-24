import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function loadEnv() {
  const envPath = path.resolve('.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

loadEnv();

const pool = await mysql.createPool({
  host: process.env.E2E_DB_HOST,
  port: Number(process.env.E2E_DB_PORT || 3306),
  user: process.env.E2E_DB_USER,
  password: process.env.E2E_DB_PASSWORD,
  database: process.env.E2E_DB_NAME,
});

const [rules] = await pool.query(
  'SELECT id, pline_form, data_type, conditions, opt_status, project_status, status FROM ad_data_control_rule WHERE id = ?',
  [16161],
);
console.log('RULE', JSON.stringify(rules, null, 2));

const [cols] = await pool.query('SHOW COLUMNS FROM ad_advertiser_hm_channel_day');
console.log(
  'COLUMNS',
  cols.map((c) => c.Field).join(', '),
);

const [sample] = await pool.query(
  "SELECT * FROM ad_advertiser_hm_channel_day WHERE pline_form='syhplay' ORDER BY cdate DESC LIMIT 1",
);
if (sample[0]) {
  console.log('SAMPLE', JSON.stringify(sample[0], null, 2).slice(0, 2500));
} else {
  console.log('SAMPLE empty');
}

const [dates] = await pool.query(
  `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d0,
          DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d') AS d1,
          DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '%Y-%m-%d') AS d2,
          DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '%Y-%m-%d') AS d3`,
);
console.log('DATES', dates[0]);

await pool.end();
