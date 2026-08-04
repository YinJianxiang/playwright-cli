from __future__ import annotations

from dataclasses import dataclass

from .models import ExpressionNode

MAX_DEPTH = 8
MAX_LEAVES = 64


class ExpressionError(ValueError):
    pass


def validate_expression(root: ExpressionNode) -> None:
    ids: set[str] = set()
    leaves = 0

    def visit(node: ExpressionNode, depth: int) -> None:
        nonlocal leaves
        if depth > MAX_DEPTH:
            raise ExpressionError("EXPRESSION_TOO_DEEP")
        if node.node_id in ids:
            raise ExpressionError(f"EXPRESSION_DUPLICATE_NODE: {node.node_id}")
        ids.add(node.node_id)
        if node.type == "condition":
            if node.condition is None or node.children:
                raise ExpressionError("EXPRESSION_INVALID_CONDITION")
            leaves += 1
        elif node.type == "not":
            if len(node.children) != 1 or node.condition is not None:
                raise ExpressionError("EXPRESSION_INVALID_NOT")
            visit(node.children[0], depth + 1)
        else:
            if len(node.children) < 2 or node.condition is not None:
                raise ExpressionError("EXPRESSION_INVALID_GROUP")
            for child in node.children:
                visit(child, depth + 1)

    visit(root, 1)
    if leaves > MAX_LEAVES:
        raise ExpressionError("EXPRESSION_TOO_LARGE")


def evaluate_expression(root: ExpressionNode, assignments: dict[str, bool]) -> dict[str, bool]:
    validate_expression(root)
    values: dict[str, bool] = {}

    def evaluate(node: ExpressionNode) -> bool:
        if node.type == "condition":
            if node.node_id not in assignments:
                raise ExpressionError(f"EXPRESSION_MISSING_ASSIGNMENT: {node.node_id}")
            result = assignments[node.node_id]
        elif node.type == "not":
            result = not evaluate(node.children[0])
        elif node.type == "and":
            result = all(evaluate(child) for child in node.children)
        else:
            result = any(evaluate(child) for child in node.children)
        values[node.node_id] = result
        return result

    evaluate(root)
    return values


@dataclass(frozen=True)
class ExpressionSolution:
    assignments: dict[str, bool]
    node_expectations: dict[str, bool]


def solve_expression(root: ExpressionNode, desired: bool) -> ExpressionSolution:
    validate_expression(root)

    def candidates(node: ExpressionNode, target: bool) -> list[dict[str, bool]]:
        if node.type == "condition":
            return [{node.node_id: target}]
        if node.type == "not":
            return candidates(node.children[0], not target)
        require_all = (node.type == "and" and target) or (node.type == "or" and not target)
        if not require_all:
            return [candidate for child in node.children for candidate in candidates(child, target)]
        result = [{}]
        for child in node.children:
            result = [{**left, **right} for left in result for right in candidates(child, target)]
        return result

    leaves: list[str] = []
    def collect(node: ExpressionNode) -> None:
        if node.type == "condition":
            leaves.append(node.node_id)
        else:
            for child in node.children:
                collect(child)
    collect(root)

    ranked = sorted(candidates(root, desired), key=lambda item: (len(item), sorted(item)))
    for candidate in ranked:
        completed = {leaf: candidate.get(leaf, desired) for leaf in leaves}
        values = evaluate_expression(root, completed)
        if values[root.node_id] is desired:
            return ExpressionSolution(completed, values)
    raise ExpressionError("EXPRESSION_UNSATISFIABLE")

