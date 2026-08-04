from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


class RunStatus(StrEnum):
    PLANNED = "planned"
    APPROVED = "approved"
    APPLYING = "applying"
    APPLIED = "applied"
    BROWSER_RUNNING = "browser_running"
    ASSERTING = "asserting"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
    CLEANING = "cleaning"
    CLEANED = "cleaned"
    RECOVERY_REQUIRED = "recovery_required"


class Condition(BaseModel):
    node_id: str = Field(default_factory=lambda: str(uuid4()))
    column: str
    time_type: str = "0"
    reduce_type: str = "total"
    compare_type: Literal["le", "lt", "ge", "gt", "between"] = "ge"
    val1: float
    val2: float | None = None
    should_match: bool = True

    @model_validator(mode="after")
    def validate_between(self) -> "Condition":
        if self.compare_type == "between" and self.val2 is None:
            raise ValueError("between requires val2")
        return self


class ExpressionNode(BaseModel):
    node_id: str = Field(default_factory=lambda: str(uuid4()))
    type: Literal["and", "or", "not", "condition"]
    condition: Condition | None = None
    children: list["ExpressionNode"] = Field(default_factory=list)


class CaseSpec(BaseModel):
    case_id: str
    media: str
    product: str
    delivery_scope: str
    dimension: str
    date_scope: Literal["today"] = "today"
    expected: Literal["hit", "miss"]
    conditions: list[Condition]


class SqlOperation(BaseModel):
    statement: str
    params: list[Any] = Field(default_factory=list)
    rollback_statement: str
    rollback_params: list[Any] = Field(default_factory=list)
    table: str


class SeedPlan(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid4()))
    case: CaseSpec
    operations: list[SqlOperation] = Field(default_factory=list)
    knowledge_version: str
    approved_by: str | None = None
    approved_at: datetime | None = None


class RunRecord(BaseModel):
    run_id: str
    status: RunStatus
    plan: SeedPlan
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    error: str | None = None
    cleanup_results: list[dict[str, Any]] = Field(default_factory=list)
    artifacts: list[str] = Field(default_factory=list)


class RuleCreateResult(BaseModel):
    success: bool
    rule_id: str | None = None
    final_url: str | None = None
    summary: str
    history_path: str | None = None
    recording_path: str | None = None


class FlowResult(BaseModel):
    run_id: str
    success: bool
    rule: RuleCreateResult | None = None
    assertion: dict[str, Any] = Field(default_factory=dict)
    cleanup_status: str
