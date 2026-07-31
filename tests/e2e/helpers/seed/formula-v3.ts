export type NullPolicy = 'zero' | 'propagate' | 'error';
export type ZeroDivisionPolicy = 'zero' | 'null' | 'error';

export type FormulaExpression =
  | { op: 'column'; name: string }
  | { op: 'constant'; value: number }
  | { op: 'sum' | 'min' | 'max'; input: FormulaExpression }
  | { op: 'count' }
  | { op: 'countDistinct'; input: FormulaExpression }
  | { op: 'latest'; input: FormulaExpression; orderBy: string }
  | {
      op: 'add' | 'subtract' | 'multiply' | 'divide' | 'ratio';
      left: FormulaExpression;
      right: FormulaExpression;
      zeroDivision?: ZeroDivisionPolicy;
    };

export type FormulaDefinition = {
  expression: FormulaExpression;
  nullPolicy: NullPolicy;
};

export type FormulaSql = {
  sql: string;
  columns: string[];
};

const NAME_RE = /^[A-Za-z0-9_]+$/;

function columnName(name: string): string {
  if (!NAME_RE.test(name)) throw new Error(`FORMULA_UNSAFE_COLUMN: ${name}`);
  return `\`${name}\``;
}

export function formulaColumns(expression: FormulaExpression): string[] {
  const columns = new Set<string>();
  const visit = (node: FormulaExpression): void => {
    if (node.op === 'column') columns.add(node.name);
    else if (node.op === 'sum' || node.op === 'min' || node.op === 'max') visit(node.input);
    else if (node.op === 'countDistinct' || node.op === 'latest') {
      visit(node.input);
      if (node.op === 'latest') columns.add(node.orderBy);
    } else if (
      node.op === 'add' ||
      node.op === 'subtract' ||
      node.op === 'multiply' ||
      node.op === 'divide' ||
      node.op === 'ratio'
    ) {
      visit(node.left);
      visit(node.right);
    }
  };
  visit(expression);
  return [...columns].sort();
}

export function compileFormulaSql(definition: FormulaDefinition): FormulaSql {
  const compile = (node: FormulaExpression): string => {
    switch (node.op) {
      case 'column':
        return columnName(node.name);
      case 'constant':
        if (!Number.isFinite(node.value)) throw new Error('FORMULA_INVALID_CONSTANT');
        return String(node.value);
      case 'sum':
        return `SUM(${compile(node.input)})`;
      case 'min':
        return `MIN(${compile(node.input)})`;
      case 'max':
        return `MAX(${compile(node.input)})`;
      case 'count':
        return 'COUNT(*)';
      case 'countDistinct':
        return `COUNT(DISTINCT ${compile(node.input)})`;
      case 'latest':
        return `SUBSTRING_INDEX(GROUP_CONCAT(${compile(node.input)} ORDER BY ${columnName(node.orderBy)} DESC), ',', 1)`;
      case 'add':
        return `(${compile(node.left)} + ${compile(node.right)})`;
      case 'subtract':
        return `(${compile(node.left)} - ${compile(node.right)})`;
      case 'multiply':
        return `(${compile(node.left)} * ${compile(node.right)})`;
      case 'divide':
      case 'ratio': {
        const left = compile(node.left);
        const right = compile(node.right);
        const policy = node.zeroDivision ?? 'error';
        if (policy === 'zero') return `COALESCE(${left} / NULLIF(${right}, 0), 0)`;
        if (policy === 'null') return `${left} / NULLIF(${right}, 0)`;
        return `CASE WHEN ${right} = 0 THEN CAST('division by zero' AS DECIMAL) ELSE ${left} / ${right} END`;
      }
    }
  };
  const raw = compile(definition.expression);
  const sql =
    definition.nullPolicy === 'zero'
      ? `COALESCE(${raw}, 0)`
      : raw;
  return { sql, columns: formulaColumns(definition.expression) };
}

type FormulaRow = Record<string, string | number | null | undefined>;

function numeric(value: unknown, policy: NullPolicy): number | null {
  if (value == null || value === '') {
    if (policy === 'zero') return 0;
    if (policy === 'propagate') return null;
    throw new Error('FORMULA_NULL_VALUE');
  }
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`FORMULA_NON_NUMERIC_VALUE: ${value}`);
  return result;
}

export function evaluateFormula(
  definition: FormulaDefinition,
  rows: FormulaRow[],
): number | null {
  const evaluate = (node: FormulaExpression, currentRows: FormulaRow[]): number | null => {
    switch (node.op) {
      case 'constant':
        return node.value;
      case 'column':
        return numeric(currentRows[0]?.[node.name], definition.nullPolicy);
      case 'count':
        return currentRows.length;
      case 'countDistinct': {
        const values = new Set(
          currentRows.map((row) => evaluate(node.input, [row])).filter((value) => value != null),
        );
        return values.size;
      }
      case 'sum': {
        const values = currentRows.map((row) => evaluate(node.input, [row]));
        if (definition.nullPolicy === 'propagate' && values.some((value) => value == null)) return null;
        return values.reduce<number>((total, value) => total + Number(value ?? 0), 0);
      }
      case 'min':
      case 'max': {
        const values = currentRows
          .map((row) => evaluate(node.input, [row]))
          .filter((value): value is number => value != null);
        if (!values.length) return definition.nullPolicy === 'zero' ? 0 : null;
        return node.op === 'min' ? Math.min(...values) : Math.max(...values);
      }
      case 'latest': {
        const sorted = [...currentRows].sort((a, b) =>
          String(b[node.orderBy] ?? '').localeCompare(String(a[node.orderBy] ?? '')),
        );
        return evaluate(node.input, sorted.slice(0, 1));
      }
      case 'add':
      case 'subtract':
      case 'multiply':
      case 'divide':
      case 'ratio': {
        const left = evaluate(node.left, currentRows);
        const right = evaluate(node.right, currentRows);
        if (left == null || right == null) return definition.nullPolicy === 'zero' ? 0 : null;
        if (node.op === 'add') return left + right;
        if (node.op === 'subtract') return left - right;
        if (node.op === 'multiply') return left * right;
        if (right === 0) {
          const policy = node.zeroDivision ?? 'error';
          if (policy === 'zero') return 0;
          if (policy === 'null') return null;
          throw new Error('FORMULA_DIVISION_BY_ZERO');
        }
        return left / right;
      }
    }
  };
  return evaluate(definition.expression, rows);
}
