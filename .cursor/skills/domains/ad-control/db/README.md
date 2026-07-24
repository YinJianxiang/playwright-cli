# 广告管控 · DB 文档包

本目录为 `domains/ad-control` 的 DB 分册。包入口见 [../README.md](../README.md)。

## 读序

1. [01-overview.md](01-overview.md) — 目标、权威优先级、首期范围  
2. [02-schema-rules.md](02-schema-rules.md) — 规则表、pline、维度、时间维、状态  
3. [03-schema-facts.md](03-schema-facts.md) — 事实表族、指标公式、文档瑕疵  
4. [04-field-mapping.md](04-field-mapping.md) — UI ↔ Job/DB  
5. [05-seed-recipes.md](05-seed-recipes.md) — hit 造数剧本  
6. [06-cleanup.md](06-cleanup.md) — 清理  
7. [changelog.md](changelog.md)  

原始资料与来源索引：[_inbox/](_inbox/)

## 当前缺口

- [x] 01 overview  
- [x] 02 规则 / pline / 时间维（Job）  
- [x] 03 事实表与指标（Job + 测试 SQL）  
- [x] 04 映射（默认链路）  
- [x] 05 Recipe A（默认冒烟）  
- [x] 06 清理约定  
- [x] `_inbox` 七份测试 SQL 原件 + SOURCES  
- [ ] 前端业务线文案是否 100%=PlineEnum.desc（待产品确认）  
- [x] 实库 DESCRIBE 校准 free_promotion_hour（状态样例含「投放中」）  
- [x] 实现 `seedViaDb` Recipe A（`tests/e2e/helpers/seed/ad-control.ts`）  

## `_inbox` 消化约定

1. 资料放入 `_inbox/`（或登记在 `_inbox/SOURCES.md`）  
2. 合并进 `01`–`06`，**冲突以 market-job 为准**  
3. 写 [changelog.md](changelog.md)  
4. 更新本页缺口  
