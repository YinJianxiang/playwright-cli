from __future__ import annotations

from datetime import datetime, timezone
from datetime import date
import re
from uuid import uuid4

from .config import Settings
from .db import Database
from .models import RunStatus, SeedPlan
from .knowledge import KnowledgeBase
from .models import CaseSpec, SqlOperation
from .state import LocalRunStore


class SeedService:
    def __init__(self, settings: Settings, store: LocalRunStore | None = None):
        self.settings = settings
        self.store = store or LocalRunStore(settings.e2e_meta_dir)
        self.db = Database(settings)

    def register(self, plan: SeedPlan):
        return self.store.create(plan)

    def approve(self, run_id: str, approved_by: str):
        def mutate(record):
            record.plan.approved_by = approved_by
            record.plan.approved_at = datetime.now(timezone.utc)
            record.status = RunStatus.APPROVED
            return record
        return self.store.update(run_id, mutate)

    async def preflight(self, run_id: str) -> dict:
        record = self.store.get(run_id)
        self.settings.require_test_database()
        tables = sorted({operation.table for operation in record.plan.operations})
        checked = []
        for table in tables:
            if not table.replace("_", "").isalnum():
                raise ValueError(f"Unsafe table identifier: {table}")
            rows = await self.db.read(f"SHOW COLUMNS FROM `{table}`")
            checked.append({"table": table, "column_count": len(rows)})
        return {"run_id": run_id, "database": self.settings.e2e_db_name, "tables": checked, "operation_count": len(record.plan.operations)}

    async def apply(self, run_id: str, *, confirmed: bool = False):
        if not confirmed:
            raise RuntimeError("Seed apply requires --confirmed")
        self.settings.require_test_database()
        record = self.store.get(run_id)
        if record.status != RunStatus.APPROVED or not record.plan.approved_by:
            raise RuntimeError("Seed plan must be explicitly approved before apply")
        self.store.set_status(run_id, RunStatus.APPLYING)
        try:
            async with self.db.connection() as connection:
                async with connection.cursor() as cursor:
                    for operation in record.plan.operations:
                        await cursor.execute(operation.statement, operation.params)
                await connection.commit()
            return self.store.set_status(run_id, RunStatus.APPLIED)
        except Exception as exc:
            self.store.set_status(run_id, RunStatus.RECOVERY_REQUIRED, error=str(exc))
            raise

    async def cleanup(self, run_id: str):
        record = self.store.get(run_id)
        if record.status == RunStatus.CLEANED:
            return record
        self.settings.require_test_database()
        self.store.set_status(run_id, RunStatus.CLEANING)
        results = []
        try:
            async with self.db.connection() as connection:
                async with connection.cursor() as cursor:
                    for operation in reversed(record.plan.operations):
                        await cursor.execute(operation.rollback_statement, operation.rollback_params)
                        results.append({"table": operation.table, "affected": cursor.rowcount})
                await connection.commit()
            def finish(current):
                current.status = RunStatus.CLEANED
                current.cleanup_results = results
                return current
            return self.store.update(run_id, finish)
        except Exception as exc:
            self.store.set_status(run_id, RunStatus.RECOVERY_REQUIRED, error=str(exc))
            raise

    def cancel(self, run_id: str, reason: str):
        return self.store.set_status(run_id, RunStatus.CANCELLED, error=reason)

    async def recover(self) -> list[str]:
        recovered = []
        for record in self.store.list_recoverable():
            if record.status in {RunStatus.APPLYING, RunStatus.APPLIED, RunStatus.BROWSER_RUNNING, RunStatus.ASSERTING, RunStatus.CLEANING, RunStatus.RECOVERY_REQUIRED}:
                await self.cleanup(record.run_id)
                recovered.append(record.run_id)
        return recovered


class SeedPlanner:
    """Compile a copy-then-patch insert plan from verified knowledge and live schema."""

    SENSITIVE_COLUMN = re.compile(r"password|token|cookie|secret|authorization|api.?key", re.I)
    DATE_NAMES = {"date", "cdate", "dt", "stat_date", "data_date", "day", "create_date"}

    def __init__(self, settings: Settings, knowledge: KnowledgeBase | None = None):
        self.settings = settings
        self.knowledge = knowledge or KnowledgeBase()
        self.db = Database(settings)

    async def build(self, case: CaseSpec) -> SeedPlan:
        self.settings.require_test_database()
        grouped: dict[str, tuple[dict, list[tuple]]] = {}
        for condition in case.conditions:
            metric = self.knowledge.find_metric(
                product=case.product, dimension=case.dimension, time_type=condition.time_type, column=condition.column
            )
            table_recipe = self.knowledge.find_table(
                product=case.product, dimension=case.dimension, time_type=condition.time_type, metric=metric
            )
            table = table_recipe["table"]
            if table not in grouped:
                grouped[table] = (table_recipe, [])
            grouped[table][1].append((condition, metric))
        operations = [
            await self._operation(case, items, table_recipe)
            for table_recipe, items in grouped.values()
        ]
        return SeedPlan(case=case, operations=operations, knowledge_version=self.knowledge.version())

    async def _operation(self, case, items, table_recipe) -> SqlOperation:
        table = self._identifier(table_recipe["table"])
        entity_id = self._identifier(table_recipe["entityIdColumn"])
        columns = await self.db.read(f"SHOW COLUMNS FROM `{table}`", redact_result=False)
        source_rows = await self.db.read(f"SELECT * FROM `{table}` LIMIT 1", redact_result=False)
        if not source_rows:
            raise RuntimeError(f"SEED_SOURCE_EMPTY: {table}")
        source = dict(source_rows[0])
        auto_columns = {row["Field"] for row in columns if "auto_increment" in str(row.get("Extra", ""))}
        nullable_or_default = {row["Field"] for row in columns if row.get("Null") == "YES" or row.get("Default") is not None}
        for name in list(source):
            if name in auto_columns:
                source.pop(name)
            elif self.SENSITIVE_COLUMN.search(name):
                if name in nullable_or_default:
                    source.pop(name)
                else:
                    raise RuntimeError(f"Sensitive required column cannot be copied: {table}.{name}")
        entity_type = next(str(row.get("Type", "")).lower() for row in columns if row["Field"] == entity_id)
        if any(kind in entity_type for kind in ("char", "text")):
            new_entity_id = f"e2e_dc_{uuid4().hex[:20]}"
        else:
            max_rows = await self.db.read(f"SELECT COALESCE(MAX(`{entity_id}`), 0) AS max_id FROM `{table}`", redact_result=False)
            try:
                new_entity_id = int(max_rows[0]["max_id"]) + 1
            except (TypeError, ValueError) as exc:
                raise RuntimeError(f"Entity ID must be numeric: {table}.{entity_id}") from exc
        source[entity_id] = new_entity_id
        name_column = table_recipe.get("entityNameColumn")
        if name_column and name_column in source:
            source[name_column] = f"e2e_dc_{case.case_id[:32]}"
        if "channel_code" in source:
            channel_rows = await self.db.read(f"SELECT COALESCE(MAX(`channel_code`), 0) AS max_code FROM `{table}`", redact_result=False)
            source["channel_code"] = int(channel_rows[0]["max_code"]) + 1
        today = date.today()
        column_types = {row["Field"]: str(row.get("Type", "")).lower() for row in columns}
        for name in set(source) & self.DATE_NAMES:
            source[name] = datetime.combine(today, datetime.min.time()) if "time" in column_types[name] else today
        for condition, metric in items:
            target = condition.val1 + 1 if condition.should_match else condition.val1 - 1
            write_columns = metric.get("writeColumns") or [condition.column]
            if metric.get("metricKind") == "ratio":
                denominator = metric.get("denominatorColumn") or write_columns[-1]
                numerator = metric.get("numeratorColumn") or write_columns[0]
                source[denominator] = 1
                source[numerator] = target
            else:
                for name in write_columns:
                    source[name] = target
        unknown = set(source) - set(column_types)
        if unknown:
            raise RuntimeError(f"Unknown columns in source row: {sorted(unknown)}")
        names = list(source)
        statement = f"INSERT INTO `{table}` ({', '.join(f'`{name}`' for name in names)}) VALUES ({', '.join(['%s'] * len(names))})"
        rollback = f"DELETE FROM `{table}` WHERE `{entity_id}` = %s"
        return SqlOperation(
            statement=statement,
            params=[source[name] for name in names],
            rollback_statement=rollback,
            rollback_params=[new_entity_id],
            table=table,
        )

    @staticmethod
    def _identifier(value: str) -> str:
        if not value.replace("_", "").isalnum():
            raise ValueError(f"Unsafe SQL identifier: {value}")
        return value
