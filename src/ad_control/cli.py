from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Annotated

import typer

from .browser import BrowserAutomation
from .cases import compile_new_media_free_promotion_cases, compile_today_toutiao_project_cases
from .config import get_settings
from .db import Database
from .evidence import EvidenceWriter
from .flow import FlowRunner
from .knowledge import KnowledgeBase
from .llm import validate_model
from .models import CaseSpec, SeedPlan
from .seed import SeedService
from .seed import SeedPlanner
from .redaction import redact

app = typer.Typer(help="Browser Use based ad-control automation", no_args_is_help=True)
knowledge_app = typer.Typer(help="Knowledge-base operations")
cases_app = typer.Typer(help="Case compilation")
db_app = typer.Typer(help="Database preflight operations")
seed_app = typer.Typer(help="Local Seed run lifecycle")
rule_app = typer.Typer(help="Browser Use rule automation")
flow_app = typer.Typer(help="Complete UI + data flow")
model_app = typer.Typer(help="SiliconFlow model checks")
app.add_typer(knowledge_app, name="knowledge")
app.add_typer(cases_app, name="cases")
app.add_typer(db_app, name="db")
app.add_typer(seed_app, name="seed")
app.add_typer(rule_app, name="rule")
app.add_typer(flow_app, name="flow")
app.add_typer(model_app, name="model")


def output(value, destination: Path | None = None) -> None:
    text = json.dumps(redact(value), ensure_ascii=False, indent=2, default=str)
    if destination:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(text + "\n", encoding="utf-8")
        typer.echo(str(destination))
    else:
        typer.echo(text)


def load_case(path: Path) -> CaseSpec:
    return CaseSpec.model_validate_json(path.read_text(encoding="utf-8"))


def load_cases(path: Path) -> list[CaseSpec]:
    value = json.loads(path.read_text(encoding="utf-8"))
    rows = value if isinstance(value, list) else [value]
    return [CaseSpec.model_validate(row) for row in rows]


@knowledge_app.command("validate")
def knowledge_validate(root: Path = Path(".cursor/skills/domains/ad-control/knowledge")) -> None:
    result = KnowledgeBase(root).validate()
    output(result.model_dump(mode="json"))
    if not result.valid:
        raise typer.Exit(1)


@knowledge_app.command("compile")
def knowledge_compile(root: Path = Path(".cursor/skills/domains/ad-control/knowledge")) -> None:
    knowledge = KnowledgeBase(root)
    result = knowledge.validate()
    if not result.valid:
        output(result.model_dump(mode="json"))
        raise typer.Exit(1)
    output({"knowledge_version": result.version, "runtime": str(root / "seed-runtime-v3.json")})


@cases_app.command("compile")
def cases_compile(
    expected: Annotated[str, typer.Option(help="hit or miss")] = "miss",
    threshold: float = 10,
    destination: Annotated[Path | None, typer.Option("--output")] = None,
) -> None:
    if expected not in {"hit", "miss"}:
        raise typer.BadParameter("expected must be hit or miss")
    cases = compile_today_toutiao_project_cases(KnowledgeBase(), expected=expected, threshold=threshold)
    output([case.model_dump(mode="json") for case in cases], destination)


@cases_app.command("compile-new-media-free")
def cases_compile_new_media_free(
    destination: Annotated[Path | None, typer.Option("--output")] = None,
) -> None:
    knowledge = KnowledgeBase()
    for case in compile_new_media_free_promotion_cases():
        for condition in case.conditions:
            knowledge.find_metric(
                product=case.product,
                dimension=case.dimension,
                time_type=condition.time_type,
                column=condition.column,
            )
    output([case.model_dump(mode="json") for case in compile_new_media_free_promotion_cases()], destination)


@db_app.command("ping")
def db_ping() -> None:
    output(asyncio.run(Database(get_settings()).ping()))


@db_app.command("preflight")
def db_preflight(run_id: str) -> None:
    output(asyncio.run(SeedService(get_settings()).preflight(run_id)))


@model_app.command("validate")
def model_validate(skip_vision: bool = False) -> None:
    output(asyncio.run(validate_model(get_settings(), verify_vision=not skip_vision)))


@seed_app.command("plan")
def seed_plan(case_file: Path, destination: Path | None = None) -> None:
    knowledge = KnowledgeBase()
    validation = knowledge.validate()
    if not validation.valid:
        raise RuntimeError("Knowledge validation failed")
    settings = get_settings()
    async def build_all():
        planner = SeedPlanner(settings, knowledge)
        return [await planner.build(case) for case in load_cases(case_file)]
    plans = asyncio.run(build_all())
    service = SeedService(settings)
    records = [service.register(plan).model_dump(mode="json") for plan in plans]
    output(records, destination)


@seed_app.command("approve")
def seed_approve(run_id: str, approved_by: str) -> None:
    output(SeedService(get_settings()).approve(run_id, approved_by).model_dump(mode="json"))


@seed_app.command("apply")
def seed_apply(run_id: str, confirmed: bool = False) -> None:
    output(asyncio.run(SeedService(get_settings()).apply(run_id, confirmed=confirmed)).model_dump(mode="json"))


@seed_app.command("status")
def seed_status(run_id: str) -> None:
    output(SeedService(get_settings()).store.get(run_id).model_dump(mode="json"))


@seed_app.command("cancel")
def seed_cancel(run_id: str, reason: str) -> None:
    output(SeedService(get_settings()).cancel(run_id, reason).model_dump(mode="json"))


@seed_app.command("cleanup")
def seed_cleanup(run_id: str) -> None:
    output(asyncio.run(SeedService(get_settings()).cleanup(run_id)).model_dump(mode="json"))


@seed_app.command("recover")
def seed_recover() -> None:
    output({"recovered": asyncio.run(SeedService(get_settings()).recover())})


@rule_app.command("create")
def rule_create(case_file: Path, confirmed: bool = False) -> None:
    if not confirmed:
        raise RuntimeError("Rule creation requires --confirmed")
    case = load_case(case_file)
    evidence = EvidenceWriter(get_settings().e2e_artifact_dir, case.case_id)
    output(asyncio.run(BrowserAutomation(get_settings()).create_rule(case, evidence)).model_dump(mode="json"))


@rule_app.command("login")
def rule_login(confirmed: bool = False) -> None:
    if not confirmed:
        raise RuntimeError("Browser login requires --confirmed")
    settings = get_settings()
    evidence = EvidenceWriter(settings.e2e_artifact_dir, "login-smoke")
    output(asyncio.run(BrowserAutomation(settings).login(evidence)))


@flow_app.command("run")
def flow_run(run_id: str, confirmed: bool = False) -> None:
    output(asyncio.run(FlowRunner(get_settings()).run(run_id, confirmed=confirmed)).model_dump(mode="json"))


if __name__ == "__main__":
    app()
