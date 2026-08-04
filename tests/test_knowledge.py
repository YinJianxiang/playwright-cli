from ad_control.cases import compile_new_media_free_promotion_cases, compile_today_toutiao_project_cases
from ad_control.knowledge import KnowledgeBase


def test_knowledge_is_valid():
    result = KnowledgeBase().validate()
    assert result.valid, result.errors


def test_compile_requested_today_matrix():
    cases = compile_today_toutiao_project_cases(KnowledgeBase(), expected="miss", threshold=10)
    assert len(cases) == 8
    assert {case.product for case in cases} == {"cpsdyfree", "cpsdy"}
    assert {case.conditions[0].column for case in cases} == {
        "consume", "all_stat_total_cost_trend", "all_roi_trend", "all_roi_24h_trend"
    }
    assert all(case.dimension == "project" and case.date_scope == "today" for case in cases)


def test_compile_new_media_hit_and_isolated_misses():
    cases = compile_new_media_free_promotion_cases()
    assert len(cases) == 3
    assert [case.expected for case in cases] == ["hit", "miss", "miss"]
    assert [[condition.should_match for condition in case.conditions] for case in cases] == [
        [True, True], [False, True], [True, False]
    ]
    for case in cases:
        for condition in case.conditions:
            KnowledgeBase().find_metric(
                product=case.product,
                dimension=case.dimension,
                time_type=condition.time_type,
                column=condition.column,
            )
