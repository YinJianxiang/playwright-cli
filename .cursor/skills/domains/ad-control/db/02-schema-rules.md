# 02 · Schema · 规则相关

## 规则主表

| 项 | 值 |
|----|-----|
| 表名 | `ad_data_control_rule` |
| 可跑条件 | Job `getRuleList`：`status = 1`（开启） |
| 入口 | `DataControlSchedule.process0(ruleIds)` → 按 ID 加载规则后 `doJob` |

主要字段（Job 模型 `DataControlRule`，列名多为下划线）：

| 概念 | 字段（示意） | 说明 |
|------|--------------|------|
| 规则 ID | `id` | UI「广告规则ID」；Job URL 末尾 |
| 业务线 | `pline_form` | 存 **alias**（如 `cpsvideomf`），见下表 |
| 维度 | `data_type` | `promotion` / `channel` / `project` / `user` |
| 条件 JSON | `conditions` | 时间类型、指标列、运算符、阈值 |
| 广告状态 | `opt_status` | `null`/`-1`=不限；1 开启 / 2 关闭 / 3 不在投放时段 |
| 项目状态 | `project_status` | `null`/`-1`=不限；1 开启 / 2 关闭 |
| 开关/启用 | `status` | `1` 才进入可跑列表 |

> 规则表完整 DDL 以库内 `SHOW CREATE TABLE ad_data_control_rule` 为准；本分册只记 Job 消费字段。

## 业务线：UI 文案 ↔ `pline_form`

权威：`com.dz.glory.job.utils.PlineEnum`（`desc` ↔ `alias`）。

| PlineEnum.desc（Job/映射用） | alias (`pline_form`) | 测试 SQL 文档常用名 |
|------------------------------|----------------------|---------------------|
| 新媒体-短剧 | `xmtplay` | 常称「新媒体-付费短剧」——**以后端 desc 为准** |
| 新媒体-免费短剧 | `cpsvideomf` | 同 |
| 新媒体-短篇 | `cpsshort` | 同 |
| 新媒体-免费小说 | `cpsfree` | 同 |
| 客户端-免费短剧 | `syhplay` | 同 |
| 头条端原生-免费 | `cpsdyfree` | 文档常写「端原生-免费」 |
| 头条端原生-付费 | `cpsdy` | 文档常写「端原生-付费」 |
| 客户端-付费小说 | `cltmain` | 测试 SQL 末尾提及 |
| 客户端-付费短剧 | `cltplay` | 测试 SQL 末尾提及 |

**待产品确认：** 前端下拉是否严格等于 `PlineEnum.desc`（尤其「新媒体-短剧」vs「付费短剧」）。E2E 默认「新媒体-免费短剧」与 enum 一致。

## 维度 `data_type`

| UI | dataType | 说明 |
|----|----------|------|
| 广告 | `promotion` | 默认；键多为 `promotion_id`（HM 广告侧常用 `plan_id`） |
| 渠道 | `channel` | |
| 项目 | `project` | |
| 负责人 | `user` | 主要客户端/HM 扫描任务 |

## 条件时间类型 `timeType`（节选）

`DataControlRule.RuleCondition.TimeTypeEnum`：

| value | 含义 |
|-------|------|
| `0` | 当天 TODAY |
| `1`/`2`/`3`/`6` | 近 1/2/3/6 小时 |
| `53`/`43` | 近 5–3 / 4–3 小时（偏客户端） |
| 近 2/3 天等 | 另有 DAY_* / DAY_*_LAST 等枚举值 |

## 表维度选择 `calTableDimension`（关键）

`DataControlService.calTableDimension`：

- **非客户端**（含 `cpsvideomf`、`xmtplay`、`cpsfree`…）：条件含 **当天或近 1/2/3/6 小时** → 使用 **HOUR** 事实表。  
- **客户端**（`syhplay` / `cltmain` / `cltplay`）：仅近 N 小时类 → HOUR；否则默认 **DAY**。  

因此默认 E2E「当天」+ 新媒体-免费短剧 → **hour 表**，不是 day 表。

## 状态过滤（与测试 SQL「null 不纳入」的差异）

Job **不是**「状态列为 SQL NULL 则排除」：

- 规则 `opt_status` / `project_status` 为不限时：不加状态条件。  
- 选「开启」时（非 HM）：常见  
  - 广告：`promotion_status <> '已暂停' AND promotion_status <> '已删除'`  
  - 项目：`project_status <> '暂停' AND project_status <> '删除'`  
- HM：多用 `plan_status` / `='投放中'` 等。

造数时按规则是否限制状态，写入能通过过滤的状态文案。

## 规则侧其它

- 书/剧、当日上架：`book_up_type` / `book_data_filter_flag` 等，首期可选「不限」跳过。  
- 可跑规则还受执行周期、当前小时批次等控制（`startControl`，0 点首批可能 skip）。  
