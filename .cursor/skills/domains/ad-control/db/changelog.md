# Changelog · 广告管控 DB 文档

按时间倒序追加。

| 日期 | 变更摘要 | 影响分册 | 作者 |
|------|----------|----------|------|
| 2026-07-23 | 迁入 `.cursor/skills/domains/ad-control/db/`；与 UI/apis/env 同包 | 全包路径 | agent |
| 2026-07-23 | 造数增加确认门禁：`planSeedViaDb` + 表单展示，确认后再 INSERT | 05, seed-contract, SKILL | agent |
| 2026-07-22 | 落地 Recipe A：`seedViaDb` / `cleanupSeedViaDb`；实库校准 hour 表与「投放中」 | 05, README, seed-contract | agent |
| 2026-07-22 | 首版知识库：7 份测试 SQL + market-job DataControl 对齐；标注文档瑕疵；默认 Recipe A | 01–06, README, _inbox/SOURCES | agent |

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
