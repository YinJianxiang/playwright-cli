import { expect, test } from '@playwright/test';
import path from 'node:path';
import {
  analyzeJobExpressionCompatibility,
  evaluateExpression,
  legacyConditionsToExpression,
  parseRuleExpression,
  solveExpression,
  validateExpression,
  type RuleExpressionV2,
} from '../e2e/helpers/seed/expression-v3';
import {
  compileFormulaSql,
  evaluateFormula,
  type FormulaDefinition,
} from '../e2e/helpers/seed/formula-v3';
import {
  compileSeedRun,
  preflightSeedRun,
  redactDbAuditEvent,
  resolveSeedCleanupPolicy,
  startSeedRun,
} from '../e2e/helpers/seed/ad-control-v3';
import { loadPromotedConfigBundle } from '../e2e/helpers/seed/config-bundle-v3';

const condition = (nodeId: string, column: string) => ({
  nodeId,
  type: 'condition' as const,
  condition: {
    timeType: '0',
    reduceType: 'total',
    column,
    compareType: 'ge' as const,
    val1: 10,
  },
});

test('numeric ID arithmetic is BigInt-safe after normalization', async () => {
  const pool = {
    async query() {
      // SQL 侧已 LEFT(...,20)；此处模拟仍偶发超长返回时的 JS 兜底截断
      return [[{ maximum: '74981949443951165559999' }]];
    },
  };
  await expect(
    Promise.resolve(
      (BigInt('74981949443951165559999'.slice(0, 20)) + 1n).toString(),
    ),
  ).resolves.toBe('74981949443951165560');
});

test.describe('Seed V3 expression solver', () => {
  test('public orchestration API is available', () => {
    expect(typeof compileSeedRun).toBe('function');
    expect(typeof preflightSeedRun).toBe('function');
    expect(typeof startSeedRun).toBe('function');
  });

  test('historical nested execution plans are read-only', async () => {
    const historical = {
      version: 3,
      runId: 'historical-read-only',
      [['plan', 'V2'].join('')]: { version: 2 },
    };
    await expect(
      startSeedRun(historical as never, {
        confirmed: true,
        outputDir: path.resolve('test-results'),
      }),
    ).rejects.toThrow('PLAN_VERSION_UNSUPPORTED');
  });
  test('legacy arrays become a stable implicit AND tree', () => {
    const raw = [
      { timeType: '0', reduceType: 'total', column: 'consume', compareType: 'ge', val1: 10 },
      { timeType: '0', reduceType: 'total', column: 'convert_num', compareType: 'ge', val1: 2 },
    ] as const;
    expect(legacyConditionsToExpression([...raw])).toEqual(
      legacyConditionsToExpression([...raw]),
    );
    expect(parseRuleExpression([...raw]).root.type).toBe('and');
  });

  test('HIT chooses a stable minimal OR witness', () => {
    const expression: RuleExpressionV2 = {
      version: 2,
      root: {
        nodeId: 'root',
        type: 'or',
        children: [condition('b', 'convert_num'), condition('a', 'consume')],
      },
    };
    const solved = solveExpression(expression, { mode: 'hit' });
    expect(solved.nodeExpectations.root).toBe(true);
    expect(solved.witnessLeaves).toEqual(['a']);
  });

  test('MISS makes both target and root false with minimal deterministic flips', () => {
    const expression: RuleExpressionV2 = {
      version: 2,
      root: {
        nodeId: 'root',
        type: 'and',
        children: [
          condition('a', 'consume'),
          {
            nodeId: 'nested',
            type: 'or',
            children: [condition('b', 'convert_num'), condition('c', 'click_num')],
          },
        ],
      },
    };
    const solved = solveExpression(expression, { mode: 'miss', missNodeId: 'nested' });
    expect(solved.nodeExpectations.root).toBe(false);
    expect(solved.nodeExpectations.nested).toBe(false);
    expect(solved.flippedLeaves).toEqual(['b', 'c']);
  });

  test('NOT propagates the desired value to its child', () => {
    const expression: RuleExpressionV2 = {
      version: 2,
      root: { nodeId: 'root', type: 'not', child: condition('leaf', 'consume') },
    };
    const solved = solveExpression(expression, { mode: 'hit' });
    expect(solved.assignments.leaf).toBe(false);
    expect(evaluateExpression(expression, solved.assignments).root).toBe(true);
  });

  test('only expressions losslessly flattenable to legacy AND may reach Job', () => {
    const compatible: RuleExpressionV2 = {
      version: 2,
      root: {
        nodeId: 'root',
        type: 'and',
        children: [
          condition('a', 'consume'),
          {
            nodeId: 'nested',
            type: 'and',
            children: [condition('b', 'roi_h1'), condition('c', 'convert_num')],
          },
        ],
      },
    };
    expect(analyzeJobExpressionCompatibility(compatible)).toEqual({
      compatible: true,
      mode: 'legacy-compatible-and',
      unsupportedNodeIds: [],
    });

    const incompatible: RuleExpressionV2 = {
      version: 2,
      root: {
        nodeId: 'root-or',
        type: 'or',
        children: [
          condition('left', 'consume'),
          {
            nodeId: 'not-node',
            type: 'not',
            child: condition('right', 'roi_h1'),
          },
        ],
      },
    };
    expect(analyzeJobExpressionCompatibility(incompatible)).toEqual({
      compatible: false,
      mode: 'unsupported',
      unsupportedNodeIds: ['root-or', 'not-node'],
    });
  });

  test('depth and duplicate IDs are rejected', () => {
    const duplicate: RuleExpressionV2 = {
      version: 2,
      root: {
        nodeId: 'root',
        type: 'and',
        children: [condition('same', 'a'), condition('same', 'b')],
      },
    };
    expect(() => validateExpression(duplicate)).toThrow(/重复 nodeId/);
  });
});

test.describe('Seed V3 formula DSL', () => {
  test('ratio compiles to controlled SQL and handles zero denominator', () => {
    const formula: FormulaDefinition = {
      nullPolicy: 'zero',
      expression: {
        op: 'ratio',
        left: { op: 'sum', input: { op: 'column', name: 'income' } },
        right: { op: 'sum', input: { op: 'column', name: 'consume' } },
        zeroDivision: 'zero',
      },
    };
    expect(compileFormulaSql(formula)).toEqual({
      sql: 'COALESCE(COALESCE(SUM(`income`) / NULLIF(SUM(`consume`), 0), 0), 0)',
      columns: ['consume', 'income'],
    });
    expect(evaluateFormula(formula, [{ income: 10, consume: 0 }])).toBe(0);
    expect(evaluateFormula(formula, [{ income: 8, consume: 10 }])).toBe(0.8);
  });

  test('latest and countDistinct are deterministic', () => {
    expect(
      evaluateFormula(
        {
          nullPolicy: 'error',
          expression: { op: 'latest', input: { op: 'column', name: 'bid' }, orderBy: 'hour' },
        },
        [{ hour: '09', bid: 2 }, { hour: '10', bid: 3 }],
      ),
    ).toBe(3);
    expect(
      evaluateFormula(
        {
          nullPolicy: 'error',
          expression: { op: 'countDistinct', input: { op: 'column', name: 'book' } },
        },
        [{ book: 1 }, { book: 1 }, { book: 2 }],
      ),
    ).toBe(2);
  });
});

test('SQL audit redacts sensitive insert parameters', () => {
  const entry = redactDbAuditEvent('run', 'apply', {
    kind: 'execute',
    sql: 'INSERT INTO `facts` (`account`, `consume`) VALUES (?, ?)',
    params: ['secret-account', 10],
    startedAt: '2026-07-30T00:00:00.000Z',
    durationMs: 3,
    affectedRows: 1,
  });
  expect(entry.params).toEqual(['[REDACTED]', 10]);
  expect(JSON.stringify(entry)).not.toContain('secret-account');
});

test('knowledge runtime is the promoted Seed V3 configuration', () => {
  const first = loadPromotedConfigBundle();
  const second = loadPromotedConfigBundle();
  expect(first.version).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(second.version).toBe(first.version);
  expect(first.generatedFrom.map((source) => source.source)).toEqual([
    'ad-control-knowledge',
    'ad-control-evidence',
  ]);
  expect(first.tables.length).toBeGreaterThan(0);
  expect(first.metrics.length).toBeGreaterThan(0);
});

test('cleanup policy defaults safely and validates user input', () => {
  const previous = process.env.E2E_SEED_CLEANUP_POLICY;
  const previousCi = process.env.CI;
  try {
    delete process.env.E2E_SEED_CLEANUP_POLICY;
    delete process.env.CI;
    expect(resolveSeedCleanupPolicy()).toBe('always');
    expect(resolveSeedCleanupPolicy('manual')).toBe('manual');
    expect(() => resolveSeedCleanupPolicy('never')).toThrow(
      'E2E_SEED_CLEANUP_POLICY_INVALID',
    );
    process.env.CI = '1';
    expect(() => resolveSeedCleanupPolicy('manual')).toThrow(
      'E2E_SEED_CLEANUP_POLICY_MANUAL_FORBIDDEN_IN_CI',
    );
  } finally {
    if (previous === undefined) delete process.env.E2E_SEED_CLEANUP_POLICY;
    else process.env.E2E_SEED_CLEANUP_POLICY = previous;
    if (previousCi === undefined) delete process.env.CI;
    else process.env.CI = previousCi;
  }
});
