from ad_control.config import Settings
from ad_control.cases import compile_today_toutiao_project_cases
from ad_control.knowledge import KnowledgeBase
from ad_control.seed import SeedPlanner


class FakeDatabase:
    async def read(self, statement, params=None, *, redact_result=True):
        if statement.startswith("SHOW COLUMNS"):
            return [
                {"Field": "id", "Type": "bigint", "Null": "NO", "Default": None, "Extra": "auto_increment"},
                {"Field": "project_id", "Type": "bigint", "Null": "NO", "Default": None, "Extra": ""},
                {"Field": "project_name", "Type": "varchar(255)", "Null": "YES", "Default": None, "Extra": ""},
                {"Field": "consume", "Type": "decimal(10,2)", "Null": "NO", "Default": 0, "Extra": ""},
                {"Field": "date", "Type": "date", "Null": "NO", "Default": None, "Extra": ""},
            ]
        if "MAX(`project_id`)" in statement:
            return [{"max_id": 42}]
        if statement.startswith("SELECT *"):
            return [{"id": 1, "project_id": 2, "project_name": "source", "consume": 20, "date": "2026-01-01"}]
        raise AssertionError(statement)


async def test_seed_planner_creates_parameterized_insert_and_rollback():
    settings = Settings(
        llm_api_key="dummy",
        e2e_db_host="127.0.0.1",
        e2e_db_name="test",
        e2e_db_user="test",
        e2e_db_password="dummy",
        e2e_db_env="test",
    )
    planner = SeedPlanner(settings)
    planner.db = FakeDatabase()
    case = compile_today_toutiao_project_cases(KnowledgeBase(), expected="miss")[0]
    plan = await planner.build(case)
    assert len(plan.operations) == 1
    operation = plan.operations[0]
    assert "%s" in operation.statement
    assert operation.rollback_statement.startswith("DELETE")
    assert operation.rollback_params == [43]
    assert 9 in operation.params


async def test_conditions_for_same_table_share_one_entity():
    settings = Settings(
        llm_api_key="dummy", e2e_db_host="127.0.0.1", e2e_db_name="test",
        e2e_db_user="test", e2e_db_password="dummy", e2e_db_env="test",
    )
    planner = SeedPlanner(settings)
    planner.db = FakeDatabase()
    case = compile_today_toutiao_project_cases(KnowledgeBase(), expected="hit")[:1][0]
    case.conditions.append(case.conditions[0].model_copy(update={"node_id": "second", "val1": 1000}))
    plan = await planner.build(case)
    assert len(plan.operations) == 1
