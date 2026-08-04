from __future__ import annotations

import re
from typing import Any

NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")


def _column(name: str) -> str:
    if not NAME_RE.fullmatch(name):
        raise ValueError(f"FORMULA_UNSAFE_COLUMN: {name}")
    return f"`{name}`"


def compile_formula_sql(expression: dict[str, Any], *, null_policy: str = "error") -> str:
    op = expression["op"]
    if op == "column":
        raw = _column(expression["name"])
    elif op == "constant":
        raw = str(float(expression["value"]))
    elif op in {"sum", "min", "max"}:
        raw = f"{op.upper()}({compile_formula_sql(expression['input'])})"
    elif op == "count":
        raw = "COUNT(*)"
    elif op == "countDistinct":
        raw = f"COUNT(DISTINCT {compile_formula_sql(expression['input'])})"
    elif op in {"add", "subtract", "multiply", "divide", "ratio"}:
        left = compile_formula_sql(expression["left"])
        right = compile_formula_sql(expression["right"])
        symbols = {"add": "+", "subtract": "-", "multiply": "*"}
        if op in symbols:
            raw = f"({left} {symbols[op]} {right})"
        else:
            policy = expression.get("zeroDivision", "error")
            if policy == "zero":
                raw = f"COALESCE({left} / NULLIF({right}, 0), 0)"
            elif policy == "null":
                raw = f"{left} / NULLIF({right}, 0)"
            else:
                raw = f"CASE WHEN {right} = 0 THEN NULL ELSE {left} / {right} END"
    else:
        raise ValueError(f"FORMULA_UNKNOWN_OPERATOR: {op}")
    return f"COALESCE({raw}, 0)" if null_policy == "zero" else raw
