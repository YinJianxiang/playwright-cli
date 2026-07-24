# 01 · Overview · 广告管控 SQL / 造数

## 权威优先级

1. **Job 实现**（最高）：`market-job` → `DataControlSchedule` / `DataControlService` / `DataControlMapper.xml` / `PlineEnum`  
2. 本目录分册（消化后的知识库）  
3. 测试 SQL 原稿（[`_inbox/`](_inbox/)）：口径参考；与 Job 冲突时以 Job 为准并在 changelog 标明  

## 造数目标

用例链路：

```text
开开关 → seedViaDb(ruleId) → GET DataControlSchedule#process0:{ruleId} → 管控记录页出现该 ruleId
```

造数须让 Job 扫描到满足规则条件的事实行，从而写入管控记录。

## 总模型

```text
业务线(pline_form) × 维度(dataType) × 时间窗(timeType)
  → 选 hour/day 事实表
  → SQL 聚合指标
  → 与规则阈值比较
  → 命中则记管控日志/动作
```

## 与系统关系

| 组件 | 作用 |
|------|------|
| UI 规则页 | 建规则、开关；库表 `ad_data_control_rule`（`status=1` 可跑） |
| 测试库 `market` | 事实表（online_pay / online_free / pay_book / hm / client_pay…） |
| market-job | `DATACONTROL` → `process0(ruleId)` |
| 记录页 | 断言出现 ruleId |

连接与探针：仓库 `tests/e2e/helpers/db.ts`、`npm run db:ping`（见 [`../../../ui-flow-db/env-db.md`](../../../ui-flow-db/env-db.md)）。

## 首期可执行造数（capability）

与 [../ui.defaults.md](../ui.defaults.md)、[`seed-capability.json`](seed-capability.json) 对齐：

| 项 | 值 |
|----|-----|
| key | `cpsvideomf\|promotion\|0\|consume` |
| 业务线 UI | 新媒体-免费短剧 |
| `pline_form` | `cpsvideomf` |
| 维度 | 广告 → `dataType=promotion` |
| 时间 | 当天 → Job 走 **HOUR** 表 |
| 指标 | 消耗 → `sum(consume)` |
| 事实表 | `ad_advertiser_online_free_promotion_hour` |

其它条件：方法通用（resolve），须先在 capability 增行后再造。

## 非范围（首期可不做）

- 书剧白名单 / 当日上架（`bookUpType`）全覆盖  
- 全业务线全指标矩阵（按 flow 用例逐行扩展 capability）  
- 以测试 SQL 文档为准的错误口径（见 [03](03-schema-facts.md)「文档瑕疵」）  
- 全域* 指标（Job 未合入）  

## 参考路径

- UI domain：[../ui.md](../ui.md)  
- Job API：[../apis.md](../apis.md)  
- Job 源码根：`d:\Project\market-job\market-job\`  
- 种子契约：[`../../../ui-flow-db/references/seed-contract.md`](../../../ui-flow-db/references/seed-contract.md)  
