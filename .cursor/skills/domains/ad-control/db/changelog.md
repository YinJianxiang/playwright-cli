# Changelog · 广告管控 DB 文档

按时间倒序追加。

| 日期 | 变更摘要 | 影响分册 | 作者 |
|------|----------|----------|------|
| 2026-07-24 | seed-spec + copy-then-patch + hit/miss + apply verify | 05, capability, seed-contract, seed-spec, engine | agent |
| 2026-07-24 | 造数改为通用 resolve：capability 矩阵 + engine；Recipe A 降为矩阵一行 | 05, capability, seed-contract, SKILL, seed/* | agent |
| 2026-07-24 | 按 `ColumnEnum` 补齐指标映射（含分时/客户端）；**不含全域*** | 03, 04 | agent |
| 2026-07-23 | 迁入 `.cursor/skills/domains/ad-control/db/`；与 UI/apis/env 同包 | 全包路径 | agent |
| 2026-07-23 | 造数增加确认门禁：`planSeedViaDb` + 表单展示，确认后再 INSERT | 05, seed-contract, SKILL | agent |
| 2026-07-22 | 落地 Recipe A：`seedViaDb` / `cleanupSeedViaDb`；实库校准 hour 表与「投放中」 | 05, README, seed-contract | agent |
| 2026-07-22 | 首版知识库：7 份测试 SQL + market-job DataControl 对齐；标注文档瑕疵；默认 Recipe A | 01–06, README, _inbox/SOURCES | agent |

### 2026-07-24（seed-spec / copy / hit·miss）

- 变更：批次 `seed-spec`；`rowStrategy=copy-then-patch`（无源行回退 synthetic）；`mode=miss` 成对；apply 后聚合 verify + seed-log  
- 场景固定 `rule_trigger`  
- 参考：`ui-flow-db/references/seed-spec.md`  

### 2026-07-24（通用造数方法）

- 变更：`ui-flow-db` / seed-contract 改为 Capability → Resolve → Plan → Confirm → Apply  
- 新增 `seed-capability.json`；`tests/e2e/helpers/seed/engine.ts`；`ad-control.ts` 改为适配器  
- 原 Recipe A = `cpsvideomf|promotion|0|consume`（implemented）  
- 扩展：加 JSON 行，禁止再写死专用 Recipe 分支  

### 2026-07-24（ColumnEnum 指标补齐）

- 变更：`04` 按业务线展开 UI↔`column`↔pline；附 ColumnEnum 全量索引；`03` 公式表与之对齐并标 `cpsvideomf` ROI_Hn 与枚举缺口  
- 明确跳过：全域消耗/全域ROI/全域成本/全域24小时ROI 等  
- 来源：`DataControlRule.RuleCondition.ColumnEnum`  

### 2026-07-23（确认门禁）

- 变更：造数须 `planSeedViaDb` → 表单确认 → `seedViaDb({ confirmed: true, plan })`  
- 路径：`tests/e2e/helpers/seed/ad-control.ts`；契约见 seed-contract  

### 2026-07-22（代码）

- 变更：实现 Recipe A INSERT（`ad_advertiser_online_free_promotion_hour`，读规则阈值，`promotion_status=投放中`）  
- 路径：`tests/e2e/helpers/seed/ad-control.ts`；批次 `ad-control-job.ts` 仅引用  

### 2026-07-22

- 变更：整理管控 SQL 知识库（业务线/表族/时间维/指标/造数）  
- 影响：01–06  
- 来源：  
  - Downloads 七份「*-管控指标测试SQL.md」  
  - `d:\Project\market-job\market-job`（`DataControlSchedule` / `DataControlService.calTableDimension` / `DataControlMapper.xml` / `PlineEnum`）  
  - 对话结论：连接层共享、权威优先级 Job > 测试 SQL  
