/**
 * 无 DB：校验 table-map + metric-map + 白名单 resolve（对齐 market-job 选表）。
 * 用法：node scripts/seed-resolve-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dbDir = path.resolve('.cursor/skills/domains/ad-control/knowledge');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(dbDir, name), 'utf8'));
}

const CLIENT = new Set(['syhplay', 'cltmain', 'cltplay']);
const NEAR_HOUR = new Set(['1', '2', '3', '6', '53', '43']);

function resolveTimeGrain(plineForm, timeType, releaseVer) {
  const t = String(timeType);
  const rv = releaseVer == null || releaseVer === -1 ? null : Number(releaseVer);
  if (CLIENT.has(plineForm)) {
    return NEAR_HOUR.has(t) ? 'hour' : 'day';
  }
  if (rv === 3) {
    return NEAR_HOUR.has(t) ? 'hour' : 'day';
  }
  if (NEAR_HOUR.has(t) || t === '0') return 'hour';
  return 'day';
}

function lookupTable(entries, plineForm, dataType, timeGrain, releaseVer) {
  const base = entries.filter(
    (e) =>
      e.plineForm === plineForm && e.dataType === dataType && e.timeGrain === timeGrain,
  );
  if (!base.length) throw new Error(`table-map miss ${plineForm}|${dataType}|${timeGrain}`);
  const rv = releaseVer == null || releaseVer === -1 ? null : Number(releaseVer);
  if (rv != null) {
    const exact = base.find((e) => e.releaseVer === rv);
    if (exact) return exact;
  }
  const def = base.find((e) => e.releaseVer == null);
  return def || base[0];
}

function lookupMetric(entries, column) {
  let hit = entries.find((e) => e.column === column);
  if (!hit && String(column).startsWith('hour_')) {
    hit = entries.find((e) => e.column === column.slice(5));
  }
  if (!hit) throw new Error(`metric-map miss ${column}`);
  return hit;
}

function resolve(capFile, tableMap, metricMap, pline, dataType, timeType, column, releaseVer) {
  const key = `${pline}|${dataType}|${timeType}|${column}`;
  const allow = capFile.allowed.find(
    (a) =>
      a.key === key ||
      (a.plineForm === pline &&
        a.dataType === dataType &&
        a.timeType === timeType &&
        a.column === column),
  );
  if (!allow) {
    const err = new Error(`allow miss ${key}`);
    err.code = 'ALLOW';
    throw err;
  }
  const grain = resolveTimeGrain(pline, timeType, releaseVer);
  const table = lookupTable(tableMap.entries, pline, dataType, grain, releaseVer);
  const metric = lookupMetric(metricMap.entries, column);
  return {
    key: allow.key,
    table: table.table,
    writeColumns: metric.writeColumns,
    metricKind: metric.metricKind,
    entityIdColumn: table.entityIdColumn || capFile.entityIdColumn,
    timeGrain: grain,
    releaseVer: table.releaseVer ?? null,
  };
}

const runtime = load('seed-runtime-v3.json');
const capFile = {
  ...runtime.seedDefaults,
  allowed: runtime.capabilities,
};
const tableMap = { entries: runtime.tables };
const metricMap = { entries: runtime.metrics };

assert.equal(capFile.allowSynthetic, false);
assert.ok(Array.isArray(capFile.allowed) && capFile.allowed.length >= 3);
assert.equal(capFile.ruleFilters, undefined, 'no release_ver field whitelist in capability');
assert.ok(tableMap.entries.some((e) => e.releaseVer === 3 && /roi3/.test(e.table)));
assert.ok(lookupMetric(metricMap.entries, 'model_pred_roi'));
assert.ok(lookupMetric(metricMap.entries, 'all_roi_trend').metricKind === 'ratio');

const expected = [
  {
    pline: 'cpsvideomf',
    dataType: 'promotion',
    timeType: '0',
    column: 'consume',
    table: 'ad_advertiser_online_free_promotion_hour',
  },
  {
    pline: 'cpsdyfree',
    dataType: 'project',
    timeType: '0',
    column: 'consume',
    table: 'ad_advertiser_online_free_project_hour',
    releaseVer: 1,
  },
  {
    pline: 'cpsdyfree',
    dataType: 'project',
    timeType: '0',
    column: 'consume',
    table: 'ad_advertiser_online_pay_roi3_project_day',
    releaseVer: 3,
  },
  {
    pline: 'cpsdy',
    dataType: 'channel',
    timeType: '99',
    column: 'all_roi_trend',
    table: 'ad_advertiser_online_pay_roi3_channel_day',
    releaseVer: 3,
    metricKind: 'ratio',
  },
  {
    pline: 'cpsdy',
    dataType: 'channel',
    timeType: '1',
    column: 'all_stat_total_cost_trend',
    table: 'ad_advertiser_online_pay_roi3_channel_hour',
    releaseVer: 3,
  },
];

for (const e of expected) {
  const r = resolve(
    capFile,
    tableMap,
    metricMap,
    e.pline,
    e.dataType,
    e.timeType,
    e.column,
    e.releaseVer,
  );
  assert.equal(r.table, e.table, `${e.pline}|${e.column}|rv${e.releaseVer ?? '-'} table`);
  if (e.metricKind) assert.equal(r.metricKind, e.metricKind);
  console.log(`OK resolve ${r.key} rv=${e.releaseVer ?? '-'} → ${r.table}`);
}

let threw = false;
try {
  resolve(capFile, tableMap, metricMap, 'cpsshort', 'promotion', '0', 'consume');
} catch (e) {
  threw = e.code === 'ALLOW';
}
assert.ok(threw, 'expected allow miss');
console.log('OK Gap: unlisted key');

console.log('\nseed-resolve-check: all passed');
