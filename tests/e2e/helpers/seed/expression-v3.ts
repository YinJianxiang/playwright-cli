import crypto from 'node:crypto';
import type { CompareType, NormalizedCondition } from './execution-plan-v3';

export type ConditionInput = Omit<NormalizedCondition, 'index'>;

export type ExpressionNode =
  | { nodeId: string; type: 'and' | 'or'; children: ExpressionNode[] }
  | { nodeId: string; type: 'not'; child: ExpressionNode }
  | { nodeId: string; type: 'condition'; condition: ConditionInput };

export type RuleExpressionV2 = {
  version: 2;
  root: ExpressionNode;
};

export type ExpressionSolution = {
  assignments: Record<string, boolean>;
  nodeExpectations: Record<string, boolean>;
  witnessLeaves: string[];
  flippedLeaves: string[];
  explanation: string;
};

export type JobExpressionCompatibility = {
  compatible: boolean;
  mode: 'legacy-compatible-and' | 'unsupported';
  unsupportedNodeIds: string[];
};

export class ExpressionValidationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'EXPRESSION_INVALID'
      | 'EXPRESSION_TOO_DEEP'
      | 'EXPRESSION_TOO_LARGE'
      | 'EXPRESSION_UNSATISFIABLE',
  ) {
    super(message);
  }
}

const MAX_DEPTH = 8;
const MAX_LEAVES = 64;
const MAX_CANDIDATES = 256;

function stableDigest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
}

function legacyNodeId(kind: string, value: unknown): string {
  return `legacy-${kind}-${stableDigest(value)}`;
}

export function legacyConditionsToExpression(
  conditions: Array<Partial<ConditionInput>>,
): RuleExpressionV2 {
  if (!Array.isArray(conditions) || !conditions.length) {
    throw new ExpressionValidationError('legacy conditions 不能为空', 'EXPRESSION_INVALID');
  }
  const children: ExpressionNode[] = conditions.map((raw, index) => {
    const condition = normalizeConditionInput(raw, `legacy conditions[${index}]`);
    return {
      nodeId: legacyNodeId('leaf', { index, condition }),
      type: 'condition',
      condition,
    };
  });
  return {
    version: 2,
    root:
      children.length === 1
        ? children[0]
        : {
            nodeId: legacyNodeId('and', children.map((child) => child.nodeId)),
            type: 'and',
            children,
          },
  };
}

function normalizeConditionInput(
  raw: Partial<ConditionInput>,
  label: string,
): ConditionInput {
  if (!raw.column || raw.timeType == null) {
    throw new ExpressionValidationError(`${label} 缺少 column/timeType`, 'EXPRESSION_INVALID');
  }
  const compareType = String(raw.compareType ?? 'le') as CompareType;
  if (!['le', 'lt', 'ge', 'gt', 'between'].includes(compareType)) {
    throw new ExpressionValidationError(`${label} compareType 非法`, 'EXPRESSION_INVALID');
  }
  const val1 = Number(raw.val1);
  const val2 = raw.val2 == null ? undefined : Number(raw.val2);
  if (!Number.isFinite(val1) || (compareType === 'between' && !Number.isFinite(val2))) {
    throw new ExpressionValidationError(`${label} 阈值非法`, 'EXPRESSION_INVALID');
  }
  return {
    timeType: String(raw.timeType),
    reduceType: String(raw.reduceType ?? 'total'),
    column: String(raw.column),
    compareType,
    val1,
    val2,
  };
}

export function parseRuleExpression(value: unknown): RuleExpressionV2 {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (Array.isArray(parsed)) return legacyConditionsToExpression(parsed);
  if (!parsed || typeof parsed !== 'object' || (parsed as RuleExpressionV2).version !== 2) {
    throw new ExpressionValidationError('conditions 既不是旧数组也不是 version=2 AST', 'EXPRESSION_INVALID');
  }
  const expression = parsed as RuleExpressionV2;
  validateExpression(expression);
  return expression;
}

export function validateExpression(expression: RuleExpressionV2): void {
  const ids = new Set<string>();
  let leaves = 0;
  const visiting = new Set<ExpressionNode>();
  const visit = (node: ExpressionNode, depth: number): void => {
    if (depth > MAX_DEPTH) {
      throw new ExpressionValidationError(`表达式深度超过 ${MAX_DEPTH}`, 'EXPRESSION_TOO_DEEP');
    }
    if (!node || typeof node !== 'object' || !node.nodeId?.trim()) {
      throw new ExpressionValidationError('表达式节点缺少 nodeId', 'EXPRESSION_INVALID');
    }
    if (ids.has(node.nodeId)) {
      throw new ExpressionValidationError(`重复 nodeId: ${node.nodeId}`, 'EXPRESSION_INVALID');
    }
    if (visiting.has(node)) {
      throw new ExpressionValidationError(`表达式存在循环: ${node.nodeId}`, 'EXPRESSION_INVALID');
    }
    ids.add(node.nodeId);
    visiting.add(node);
    if (node.type === 'condition') {
      leaves += 1;
      normalizeConditionInput(node.condition, node.nodeId);
    } else if (node.type === 'not') {
      if (!node.child) {
        throw new ExpressionValidationError(`${node.nodeId} NOT 缺少 child`, 'EXPRESSION_INVALID');
      }
      visit(node.child, depth + 1);
    } else if (node.type === 'and' || node.type === 'or') {
      if (!Array.isArray(node.children) || node.children.length < 2) {
        throw new ExpressionValidationError(
          `${node.nodeId} ${node.type.toUpperCase()} 至少需要两个子节点`,
          'EXPRESSION_INVALID',
        );
      }
      node.children.forEach((child) => visit(child, depth + 1));
    } else {
      throw new ExpressionValidationError('未知表达式节点类型', 'EXPRESSION_INVALID');
    }
    visiting.delete(node);
  };
  visit(expression.root, 1);
  if (leaves > MAX_LEAVES) {
    throw new ExpressionValidationError(`表达式叶子超过 ${MAX_LEAVES}`, 'EXPRESSION_TOO_LARGE');
  }
}

export function flattenConditionNodes(
  expression: RuleExpressionV2,
): Array<Extract<ExpressionNode, { type: 'condition' }>> {
  const result: Array<Extract<ExpressionNode, { type: 'condition' }>> = [];
  const visit = (node: ExpressionNode): void => {
    if (node.type === 'condition') result.push(node);
    else if (node.type === 'not') visit(node.child);
    else node.children.forEach(visit);
  };
  visit(expression.root);
  return result;
}

/**
 * market-job currently accepts only the legacy flat condition array, whose
 * semantics are an implicit AND. A condition leaf or an AND tree can be
 * flattened without changing meaning; OR and NOT cannot.
 */
export function analyzeJobExpressionCompatibility(
  expression: RuleExpressionV2,
): JobExpressionCompatibility {
  const unsupportedNodeIds: string[] = [];
  const visit = (node: ExpressionNode): void => {
    if (node.type === 'condition') return;
    if (node.type !== 'and') {
      unsupportedNodeIds.push(node.nodeId);
    }
    if (node.type === 'not') visit(node.child);
    else node.children.forEach(visit);
  };
  visit(expression.root);
  return unsupportedNodeIds.length
    ? { compatible: false, mode: 'unsupported', unsupportedNodeIds }
    : {
        compatible: true,
        mode: 'legacy-compatible-and',
        unsupportedNodeIds: [],
      };
}

export function findExpressionNode(
  expression: RuleExpressionV2,
  nodeId: string,
): ExpressionNode | undefined {
  let found: ExpressionNode | undefined;
  const visit = (node: ExpressionNode): void => {
    if (node.nodeId === nodeId) found = node;
    else if (node.type === 'not') visit(node.child);
    else if (node.type !== 'condition') node.children.forEach(visit);
  };
  visit(expression.root);
  return found;
}

type Assignment = Map<string, boolean>;

function assignmentKey(value: Assignment): string {
  return [...value].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('|');
}

function mergeAssignments(left: Assignment, right: Assignment): Assignment | undefined {
  const merged = new Map(left);
  for (const [key, value] of right) {
    if (merged.has(key) && merged.get(key) !== value) return undefined;
    merged.set(key, value);
  }
  return merged;
}

function rank(assignments: Assignment[]): Assignment[] {
  const unique = new Map<string, Assignment>();
  for (const value of assignments) unique.set(assignmentKey(value), value);
  return [...unique.values()]
    .sort((a, b) => a.size - b.size || assignmentKey(a).localeCompare(assignmentKey(b)))
    .slice(0, MAX_CANDIDATES);
}

function combine(groups: Assignment[][]): Assignment[] {
  let current: Assignment[] = [new Map()];
  for (const group of groups) {
    const next: Assignment[] = [];
    for (const left of current) {
      for (const right of group) {
        const merged = mergeAssignments(left, right);
        if (merged) next.push(merged);
      }
    }
    current = rank(next);
  }
  return current;
}

function solutionsFor(node: ExpressionNode, desired: boolean): Assignment[] {
  if (node.type === 'condition') return [new Map([[node.nodeId, desired]])];
  if (node.type === 'not') return solutionsFor(node.child, !desired);
  const allChildrenMustMatch =
    (node.type === 'and' && desired) || (node.type === 'or' && !desired);
  if (allChildrenMustMatch) {
    return combine(node.children.map((child) => solutionsFor(child, desired)));
  }
  return rank(node.children.flatMap((child) => solutionsFor(child, desired)));
}

export function evaluateExpression(
  expression: RuleExpressionV2,
  assignments: Record<string, boolean>,
): Record<string, boolean> {
  const values: Record<string, boolean> = {};
  const evaluate = (node: ExpressionNode): boolean => {
    let value: boolean;
    if (node.type === 'condition') {
      if (!(node.nodeId in assignments)) {
        throw new ExpressionValidationError(
          `叶子 ${node.nodeId} 没有布尔赋值`,
          'EXPRESSION_UNSATISFIABLE',
        );
      }
      value = assignments[node.nodeId];
    } else if (node.type === 'not') value = !evaluate(node.child);
    else if (node.type === 'and') value = node.children.every(evaluate);
    else value = node.children.some(evaluate);
    values[node.nodeId] = value;
    return value;
  };
  evaluate(expression.root);
  return values;
}

export function solveExpression(
  expression: RuleExpressionV2,
  options:
    | { mode: 'hit'; hitNodeId?: string }
    | { mode: 'miss'; missNodeId: string },
): ExpressionSolution {
  validateExpression(expression);
  const targetId =
    options.mode === 'hit' ? options.hitNodeId ?? expression.root.nodeId : options.missNodeId;
  if (!findExpressionNode(expression, targetId)) {
    throw new ExpressionValidationError(`目标节点不存在: ${targetId}`, 'EXPRESSION_INVALID');
  }
  const rootSolutions = solutionsFor(expression.root, options.mode === 'hit');
  const target = findExpressionNode(expression, targetId)!;
  const targetSolutions = solutionsFor(target, options.mode === 'hit');
  const candidates = rank(
    rootSolutions.flatMap((root) =>
      targetSolutions
        .map((selected) => mergeAssignments(root, selected))
        .filter((value): value is Assignment => Boolean(value)),
    ),
  );
  const leaves = flattenConditionNodes(expression);
  const completed = candidates
    .map((candidate) => {
      const full = new Map(candidate);
      for (const leaf of leaves) {
        if (!full.has(leaf.nodeId)) full.set(leaf.nodeId, options.mode === 'miss');
      }
      return full;
    })
    .filter((candidate) => {
      const record = Object.fromEntries(candidate);
      const values = evaluateExpression(expression, record);
      return values[expression.root.nodeId] === (options.mode === 'hit') &&
        values[targetId] === (options.mode === 'hit');
    });
  if (!completed.length) {
    throw new ExpressionValidationError(
      `无法构造 root=${options.mode === 'hit'} 且 ${targetId}=${options.mode === 'hit'}`,
      'EXPRESSION_UNSATISFIABLE',
    );
  }
  const desiredLeafValue = options.mode === 'hit';
  const selected = [...completed].sort((left, right) => {
    const leftIds = [...left]
      .filter(([, value]) => value === desiredLeafValue)
      .map(([id]) => id)
      .sort();
    const rightIds = [...right]
      .filter(([, value]) => value === desiredLeafValue)
      .map(([id]) => id)
      .sort();
    return leftIds.length - rightIds.length || leftIds.join('|').localeCompare(rightIds.join('|'));
  })[0];
  const assignments = Object.fromEntries(selected);
  const nodeExpectations = evaluateExpression(expression, assignments);
  const witnessLeaves = [...selected].filter(([, value]) => value).map(([id]) => id).sort();
  const flippedLeaves = [...selected].filter(([, value]) => !value).map(([id]) => id).sort();
  return {
    assignments,
    nodeExpectations,
    witnessLeaves,
    flippedLeaves,
    explanation:
      options.mode === 'hit'
        ? `根节点与目标 ${targetId} 为真；按叶子数量和 nodeId 选择稳定满足解`
        : `根节点与目标 ${targetId} 为假；按叶子数量和 nodeId 选择稳定反例`,
  };
}
