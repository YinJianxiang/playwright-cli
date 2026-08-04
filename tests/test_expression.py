import pytest

from ad_control.expression import ExpressionError, evaluate_expression, solve_expression, validate_expression
from ad_control.models import Condition, ExpressionNode


def leaf(name: str) -> ExpressionNode:
    return ExpressionNode(node_id=name, type="condition", condition=Condition(node_id=name, column=name, val1=10))


def test_and_or_not_solver():
    root = ExpressionNode(node_id="root", type="and", children=[
        leaf("a"),
        ExpressionNode(node_id="or", type="or", children=[leaf("b"), ExpressionNode(node_id="not", type="not", children=[leaf("c")])]),
    ])
    hit = solve_expression(root, True)
    miss = solve_expression(root, False)
    assert evaluate_expression(root, hit.assignments)["root"] is True
    assert evaluate_expression(root, miss.assignments)["root"] is False


def test_duplicate_node_rejected():
    root = ExpressionNode(node_id="root", type="and", children=[leaf("same"), leaf("same")])
    with pytest.raises(ExpressionError, match="DUPLICATE"):
        validate_expression(root)

