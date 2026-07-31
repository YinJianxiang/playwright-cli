import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  buildRecipeKey,
  computeHitScalar,
  computeMetricValues,
  computeMissScalar,
  loadCapabilityFile,
  resolveSeedCapability,
} from '../e2e/helpers/seed/engine';
import {
  buildRuleFilters,
  calculateExecutionHash,
  semanticApprovalFingerprint,
  type CompiledExecutionPlanV3,
  type SeedRuleRow,
  type SeedExecutionPlanV3,
} from '../e2e/helpers/seed/execution-plan-v3';

function fingerprintFixture(): CompiledExecutionPlanV3 {
  const registry = loadCapabilityFile('ad-control');
  const capability = resolveSeedCapability(
    registry,
    'cpsdyfree',
    'project',
    '0',
    'consume',
  );
  return {
    version: 3,
    biz: 'ad-control',
    scenario: 'rule_trigger',
    ruleId: '100',
    mode: 'hit',
    conditions: [{
      condition: {
        index: 0,
        timeType: '0',
        reduceType: 'current',
        column: 'consume',
        compareType: 'ge',
        val1: 100,
      },
      recipeKey: capability.key,
      metricStatus: capability.metricStatus,
      evaluationPhase: capability.seedPolicy.evaluationPhase,
      capability,
      targetGrain: 'hour',
      targetTable: capability.table,
      metricValues: computeMetricValues(capability, 'hit', 'ge', 100),
      expectedHolds: true,
    }],
    plineForm: 'cpsdyfree',
    dataType: 'project',
    releaseVer: 2,
    ruleFilters: { country: 'US' },
    sourceSelectorPatch: {},
    finalFactPatch: {},
    issues: [],
    registry,
    configDigest: 'sha256:config-a',
  };
}

test.describe('Seed V3 execution plan pure contracts', () => {
  test('hit/miss boundaries cover all compare operators', () => {
    expect(computeHitScalar('le', 10)).toBeLessThanOrEqual(10);
    expect(computeMissScalar('le', 10)).toBeGreaterThan(10);
    expect(computeHitScalar('lt', 10)).toBeLessThan(10);
    expect(computeMissScalar('lt', 10)).toBeGreaterThanOrEqual(10);
    expect(computeHitScalar('ge', 10)).toBeGreaterThanOrEqual(10);
    expect(computeMissScalar('ge', 10)).toBeLessThan(10);
    expect(computeHitScalar('gt', 10)).toBeGreaterThan(10);
    expect(computeMissScalar('gt', 10)).toBeLessThanOrEqual(10);
    expect(computeHitScalar('between', 10, 20)).toBeGreaterThanOrEqual(10);
    expect(computeHitScalar('between', 10, 20)).toBeLessThanOrEqual(20);
    expect(computeMissScalar('between', 10, 20)).toBeGreaterThan(20);
  });

  test('ratio values write numerator and denominator', () => {
    const registry = loadCapabilityFile('ad-control');
    const cap = resolveSeedCapability(
      registry,
      'cpsdyfree',
      'project',
      '0',
      'all_roi_trend',
      3,
    );
    const values = computeMetricValues(cap, 'hit', 'ge', 0.8);
    expect(values[cap.numeratorColumn!]).toBe(80);
    expect(values[cap.denominatorColumn!]).toBe(100);
  });

  test('every allowed capability resolves table and metric maps', () => {
    const registry = loadCapabilityFile('ad-control');
    for (const allowed of registry.allowed) {
      const metric = registry.metricMap.find(
        (entry) =>
          entry.column === allowed.column ||
          (allowed.column.startsWith('hour_') &&
            entry.column === allowed.column.slice(5)),
      );
      expect(metric, allowed.key).toBeTruthy();
      expect(
        registry.tableMap.some(
          (entry) =>
            entry.plineForm === allowed.plineForm && entry.dataType === allowed.dataType,
        ),
        allowed.key,
      ).toBeTruthy();
      for (const releaseVer of allowed.releaseVers ?? registry.supportedReleaseVers ?? []) {
        expect(
          registry.capabilities.some(
            (capability) =>
              capability.key ===
              buildRecipeKey(
                allowed.plineForm,
                allowed.dataType,
                releaseVer,
                allowed.timeType,
                allowed.column,
              ),
          ),
          `${allowed.key}|rv${releaseVer}`,
        ).toBeTruthy();
      }
    }
    expect(registry.allowed.length).toBeGreaterThan(1_000);
  });

  test('metric policies are explicit and model prediction is declarative', () => {
    const registry = loadCapabilityFile('ad-control');
    for (const metric of registry.metricMap) {
      expect(['verified', 'provisional']).toContain(metric.status);
      expect(['aggregate', 'post-filter']).toContain(metric.seedPolicy?.evaluationPhase);
      expect(['allowed', 'blocked']).toContain(metric.seedPolicy?.standaloneRule);
    }
    const model = registry.metricMap.find((entry) => entry.column === 'model_pred_roi');
    expect(model?.status).toBe('verified');
    expect(model?.seedPolicy).toEqual({
      forceGrain: 'day',
      evaluationPhase: 'post-filter',
      standaloneRule: 'blocked',
    });
  });

  test('V3 implementation does not branch on model prediction field name', () => {
    const source = fs.readFileSync(
      path.resolve('tests/e2e/helpers/seed/execution-plan-v3.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/column\s*===\s*['"]model_pred_roi['"]/);
    expect(source).not.toMatch(/conditions\s*\[\s*0\s*\]/);
  });

  test('approval fingerprint excludes rule id but includes mapping semantics', () => {
    const first = fingerprintFixture();
    const sameSemantics = { ...first, ruleId: '999' };
    expect(semanticApprovalFingerprint(first)).toBe(
      semanticApprovalFingerprint(sameSemantics),
    );
    expect(
      semanticApprovalFingerprint({ ...first, configDigest: 'sha256:config-b' }),
    ).not.toBe(semanticApprovalFingerprint(first));
  });

  test('execution hash changes when a final row changes', () => {
    const compiled = fingerprintFixture();
    const base = {
      ...compiled,
      insertGroups: [{
        groupId: 'g1',
        table: compiled.conditions[0].targetTable,
        timeGrain: 'hour' as const,
        entityIdColumn: compiled.conditions[0].capability.entityIdColumn,
        entityId: 'e2e_seed_1',
        rows: [{ cdate: '2026-07-29', hour: '12', consume: 101 }],
        conditionIndexes: [0],
        requiredColumns: ['cdate', 'hour', 'consume'],
        optionalColumns: [],
        schemaSignature: 'sha256:schema',
      }],
      status: 'ready' as const,
      approvalFingerprint: semanticApprovalFingerprint(compiled),
      createdAt: '2026-07-29T00:00:00.000Z',
      expiresAt: '2026-07-29T00:30:00.000Z',
    } satisfies Omit<SeedExecutionPlanV3, 'executionHash'>;
    const changed = {
      ...base,
      insertGroups: base.insertGroups.map((group) => ({
        ...group,
        rows: group.rows.map((row) => ({ ...row, consume: 102 })),
      })),
    };
    expect(calculateExecutionHash(changed)).not.toBe(calculateExecutionHash(base));
  });

  test('release version is excluded from source selection and required in final facts', () => {
    const alignment = buildRuleFilters({
      id: 16262,
      pline_form: 'cpsvideomf',
      data_type: 'channel',
      conditions: '[]',
      opt_status: null,
      project_status: null,
      external_action: '不限',
      delivery_way: '0',
      channel_users: '不限',
      effect_scope: null,
      account_type: null,
      release_ver: 2,
    } as SeedRuleRow);

    expect(alignment.sourceSelectorPatch).not.toHaveProperty('release_ver');
    expect(alignment.finalFactPatch).toMatchObject({ release_ver: 2 });
  });

  test('capability lookup uses explicit or knowledge-default release version', () => {
    const registry = loadCapabilityFile('ad-control');
    const byDefault = resolveSeedCapability(
      registry,
      'cpsdyfree',
      'project',
      '0',
      'consume',
      null,
    );
    expect(byDefault.releaseVer).toBe(2);
    expect(byDefault.key).toContain('|rv2|');

    const explicitV1 = resolveSeedCapability(
      registry,
      'cpsdyfree',
      'project',
      '0',
      'consume',
      1,
    );
    expect(explicitV1.releaseVer).toBe(1);
    expect(explicitV1.key).toContain('|rv1|');

    const explicitV3 = resolveSeedCapability(
      registry,
      'cpsdyfree',
      'project',
      '0',
      'consume',
      3,
    );
    expect(explicitV3.releaseVer).toBe(3);
    expect(explicitV3.key).toContain('|rv3|');
  });

  test('promoted Job matrix fills capabilities absent from the hand-maintained list', () => {
    const registry = loadCapabilityFile('ad-control');
    const capability = resolveSeedCapability(
      registry,
      'xmtplay',
      'promotion',
      '0',
      'roi_h2',
      2,
    );
    expect(capability.key).toBe('xmtplay|promotion|rv2|0|roi_h2');
    expect(capability.table).toBe('ad_advertiser_online_pay_promotion_hour');
    expect(capability.metricKind).toBe('ratio');
    expect(capability.writeColumns).toEqual(
      expect.arrayContaining(['cz_h2', 'consume']),
    );
  });

  test('missing default or unknown release version is blocked', () => {
    const registry = loadCapabilityFile('ad-control');
    expect(() =>
      resolveSeedCapability(
        { ...registry, defaultReleaseVer: undefined },
        'cpsdyfree',
        'project',
        '0',
        'consume',
        null,
      ),
    ).toThrow(/RELEASE_VERSION_UNRESOLVED/);
    expect(() =>
      resolveSeedCapability(
        registry,
        'cpsdyfree',
        'project',
        '0',
        'consume',
        99,
      ),
    ).toThrow(/CAPABILITY_NOT_ALLOWED/);
  });
});
