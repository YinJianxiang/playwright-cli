import pytest

from ad_control.formula import compile_formula_sql


def test_ratio_is_zero_safe():
    sql = compile_formula_sql({
        "op": "ratio",
        "left": {"op": "column", "name": "income"},
        "right": {"op": "column", "name": "consume"},
        "zeroDivision": "zero",
    })
    assert "NULLIF(`consume`, 0)" in sql
    assert "COALESCE" in sql


def test_unsafe_column_rejected():
    with pytest.raises(ValueError, match="UNSAFE_COLUMN"):
        compile_formula_sql({"op": "column", "name": "x; DROP TABLE users"})

