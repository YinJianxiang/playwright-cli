from __future__ import annotations

from itertools import product

from .knowledge import KnowledgeBase
from .models import CaseSpec, Condition

PRODUCTS = {"free": "cpsdyfree", "paid": "cpsdy"}
METRICS = {
    "today_consume": "consume",
    "today_global_cost": "all_stat_total_cost_trend",
    "today_global_roi": "all_roi_trend",
    "today_global_24h_roi": "all_roi_24h_trend",
}


def compile_today_toutiao_project_cases(
    knowledge: KnowledgeBase,
    *,
    expected: str = "miss",
    threshold: float = 10,
) -> list[CaseSpec]:
    cases: list[CaseSpec] = []
    for (product_label, product_code), (metric_label, column) in product(PRODUCTS.items(), METRICS.items()):
        knowledge.find_metric(product=product_code, dimension="project", time_type="0", column=column)
        cases.append(CaseSpec(
            case_id=f"toutiao-native-{product_label}-global-project-{metric_label}-{expected}",
            media="toutiao",
            product=product_code,
            delivery_scope="global",
            dimension="project",
            expected=expected,
            conditions=[Condition(
                column=column,
                time_type="0",
                compare_type="ge",
                val1=threshold,
                should_match=expected == "hit",
            )],
        ))
    return cases


def compile_new_media_free_promotion_cases() -> list[CaseSpec]:
    """HIT plus one isolated MISS for each requested condition."""
    variants = [
        ("hit", "hit", True, True),
        ("miss-model-roi", "miss", False, True),
        ("miss-consume", "miss", True, False),
    ]
    cases: list[CaseSpec] = []
    for suffix, expected, roi_matches, consume_matches in variants:
        cases.append(CaseSpec(
            case_id=f"new-media-free-short-drama-promotion-today-{suffix}",
            media="new-media",
            product="cpsvideomf",
            delivery_scope="all",
            dimension="promotion",
            expected=expected,
            conditions=[
                Condition(
                    node_id=f"{suffix}-model-pred-roi",
                    column="model_pred_roi",
                    time_type="0",
                    compare_type="ge",
                    val1=10,
                    should_match=roi_matches,
                ),
                Condition(
                    node_id=f"{suffix}-consume",
                    column="consume",
                    time_type="0",
                    compare_type="ge",
                    val1=1000,
                    should_match=consume_matches,
                ),
            ],
        ))
    return cases
