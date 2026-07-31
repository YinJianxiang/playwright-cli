import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  assertKnowledgeEntryVerified,
  compileSeedConfigFromKnowledge,
  loadAdControlKnowledge,
} from '../e2e/helpers/seed/knowledge-v3';
import {
  buildRuleFilters,
  type SeedRuleRow,
} from '../e2e/helpers/seed/execution-plan-v3';

const DOMAIN = path.resolve('.cursor/skills/domains/ad-control');

test('three-domain knowledge is complete and evidence-backed', () => {
  const bundle = loadAdControlKnowledge();
  const evidence = new Set(bundle.evidence.map((item) => item.evidenceId));
  const entries = [
    ...bundle.dimensions.entries,
    ...bundle.dimensions.ruleFields,
    ...bundle.conditions.entries,
    ...bundle.actions.entries,
  ];
  expect(entries.length).toBeGreaterThan(100);
  expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  for (const entry of entries) {
    expect(['verified', 'unknown', 'deprecated']).toContain(entry.status);
    expect(entry.evidenceRefs.length, entry.id).toBeGreaterThan(0);
    for (const ref of entry.evidenceRefs) expect(evidence.has(ref), `${entry.id}:${ref}`).toBe(true);
  }
});

test('knowledge deterministically compiles the checked-in runtime', () => {
  const compiled = compileSeedConfigFromKnowledge(loadAdControlKnowledge());
  const checkedIn = JSON.parse(
    fs.readFileSync(path.join(DOMAIN, 'knowledge/seed-runtime-v3.json'), 'utf8'),
  );
  expect(compiled).toEqual(checkedIn);
});

test('promoted Job formula matrix contains only closed-loop verified rows', () => {
  const compiledDir = path.join(DOMAIN, 'knowledge/compiled/job-chain');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(compiledDir, 'manifest.json'), 'utf8'),
  );
  const rows = JSON.parse(
    fs.readFileSync(
      path.join(compiledDir, 'condition-formula-matrix.json'),
      'utf8',
    ),
  ) as Array<{
    conditionKey: string;
    status: string;
    tableExists: boolean;
    missingAliases: string[];
  }>;
  expect(manifest.verifiedConditionRows).toBe(6255);
  expect(rows).toHaveLength(6255);
  expect(new Set(rows.map((entry) => entry.conditionKey)).size).toBe(6255);
  expect(
    rows.every(
      (entry) =>
        entry.status === 'verified' &&
        entry.tableExists &&
        entry.missingAliases.length === 0,
    ),
  ).toBe(true);
});

test('dimension, condition and action domains answer flow questions without code', () => {
  const bundle = loadAdControlKnowledge();
  expect(
    bundle.dimensions.ruleFields.find(
      (entry) => entry.ruleField === 'external_action',
    ),
  ).toEqual(
    expect.objectContaining({
      status: 'verified',
      patchColumn: 'external_action',
    }),
  );
  expect(
    bundle.dimensions.entries.some(
      (entry) =>
        entry.seed?.tableRoute.releaseVer === 3 &&
        entry.seed.tableRoute.dataType === 'project' &&
        /roi3/.test(entry.seed.tableRoute.table),
    ),
  ).toBe(true);
  expect(
    bundle.conditions.entries.some(
      (entry) =>
        entry.status === 'verified' &&
        entry.seed.metric.metricKind === 'ratio' &&
        entry.seed.metric.numeratorColumn &&
        entry.seed.metric.denominatorColumn,
    ),
  ).toBe(true);
  expect(bundle.actions.entries.find((entry) => entry.id === 'action:warning')).toEqual(
    expect.objectContaining({
      status: 'verified',
      assertion: expect.objectContaining({
        hit: expect.stringContaining('ruleId'),
        miss: expect.stringContaining('channelCode'),
      }),
    }),
  );
});

test('unknown entries block automation', () => {
  const bundle = loadAdControlKnowledge();
  const unknown = bundle.actions.entries.find((entry) => entry.status === 'unknown');
  expect(unknown).toBeTruthy();
  expect(() => assertKnowledgeEntryVerified(unknown!, 'action execution')).toThrow(
    'KNOWLEDGE_UNKNOWN',
  );

  const rule = {
    data_type: 'project',
    pline_form: 'cpsdy',
    channel_users: 'someone',
    effect_scope: -1,
    account_type: null,
  } as SeedRuleRow;
  const result = buildRuleFilters(rule, bundle.dimensions.ruleFields);
  expect(result.issues).toContainEqual(
    expect.objectContaining({
      severity: 'error',
      code: 'RULE_FILTER_UNMAPPED',
      message: expect.stringContaining('KNOWLEDGE_UNKNOWN'),
    }),
  );
});

test('normal Seed runtime has no market-job source dependency', () => {
  for (const file of [
    'tests/e2e/helpers/seed/engine.ts',
    'tests/e2e/helpers/seed/execution-plan-v3.ts',
    'tests/e2e/helpers/seed/ad-control-v3.ts',
    'tests/e2e/helpers/seed/config-bundle-v3.ts',
  ]) {
    const source = fs.readFileSync(path.resolve(file), 'utf8');
    expect(source, file).not.toMatch(
      /(?:D:|\/)\/?Project\/market-job|readFileSync\([^)]*market-job|from\s+['"][^'"]*market-job/i,
    );
  }
});

test('new knowledge references contain no common mojibake markers', () => {
  for (const file of fs.readdirSync(path.join(DOMAIN, 'references'))) {
    const source = fs.readFileSync(path.join(DOMAIN, 'references', file), 'utf8');
    expect(source, file).not.toMatch(/[锛鈫鏄鐨]/);
    expect(source, file).not.toContain('\uFFFD');
  }
});

test('legacy conclusions and duplicate maps are absent', () => {
  for (const relative of [
    'README.md',
    'ui.md',
    'ui.defaults.md',
    'db/01-overview.md',
    'db/04-field-mapping.md',
    'db/table-map.json',
    'db/metric-map.json',
    'db/seed-capability.json',
    'db/seed-config-v3.json',
  ]) {
    expect(fs.existsSync(path.join(DOMAIN, relative)), relative).toBe(false);
  }
});
