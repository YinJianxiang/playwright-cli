import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function loadEnv() {
  for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) {
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

loadEnv();

const pool = await mysql.createPool({
  host: process.env.E2E_DB_HOST,
  port: Number(process.env.E2E_DB_PORT || 3306),
  user: process.env.E2E_DB_USER,
  password: process.env.E2E_DB_PASSWORD,
  database: process.env.E2E_DB_NAME,
});

const ids = [167477692, 167477693, 167477694, 167477695];
const [byId] = await pool.query(
  `SELECT id, cdate, channel_code, pline_form, consume, n_uv_hour, n_predict_income, n_cz_money,
          ROUND(consume / NULLIF(n_uv_hour, 0), 2) AS cpa,
          ROUND(((n_predict_income / 1000) + n_cz_money) / NULLIF(consume, 0), 4) AS all_roi
   FROM ad_advertiser_hm_channel_day WHERE id IN (?, ?, ?, ?)`,
  ids,
);
console.log('BY_ID', JSON.stringify(byId, null, 2));

const [byCh] = await pool.query(
  `SELECT id, cdate, channel_code, consume, n_uv_hour,
          ROUND(consume / NULLIF(n_uv_hour, 0), 2) AS cpa,
          ROUND(((n_predict_income / 1000) + n_cz_money) / NULLIF(consume, 0), 4) AS all_roi
   FROM ad_advertiser_hm_channel_day
   WHERE channel_code LIKE 'e2e_dc_16161%'
   ORDER BY id DESC LIMIT 10`,
);
console.log('BY_CH', JSON.stringify(byCh, null, 2));

await pool.end();
