---
name: ui-flow-db
description: 使用 Python Seed 服务为广告管控 Browser Use 流程准备、审批、写入、检查、取消、恢复和清理测试库数据。用于条件 HIT/MISS 造数、SQL 预检、本地运行状态管理和异常回收。
---

# Python Seed 数据流程

将 `../domains/ad-control/knowledge/` 作为业务事实的唯一权威来源。不要从旧 TypeScript、Playwright 文件或业务源码临时推断指标。

## 强制流程

1. 执行 `uv run ad-control knowledge validate`。
2. 执行 `uv run ad-control seed plan <case.json>`，审阅生成的 plan 和 SQL 操作。
3. 执行 `uv run ad-control db preflight <run-id>`；Preflight 只能执行只读 SQL。
4. 获得用户明确确认后执行 `uv run ad-control seed approve <run-id> <approved-by>`。
5. 执行 `uv run ad-control seed apply <run-id> --confirmed`。
6. 无论成功或失败，执行 `uv run ad-control seed cleanup <run-id>`；中断后执行 `uv run ad-control seed recover`。

## 安全约束

- 数据写入必须满足 `E2E_DB_ENV=test`，否则立即停止。
- 元数据必须使用 `E2E_META_STORE=file`，默认目录为 `.local/seed-meta`。
- SQL 必须参数化；审计与报告只保存脱敏参数，禁止保存密码、Token、Cookie 或 Authorization。
- Apply 必须同时具备审批人与 `--confirmed`；不得自动批准。
- Cleanup 必须幂等，倒序执行 plan 中的 rollback 操作。
- 包含 OR/NOT 的表达式可编译和求解；真实 Job 不支持时必须报告能力缺口，不得降级语义。

详细数据契约按需读取 [references/seed-contract.md](references/seed-contract.md)。
