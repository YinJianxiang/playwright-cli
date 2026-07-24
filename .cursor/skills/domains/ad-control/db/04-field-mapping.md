# 04 · 字段映射 UI / 测试 → DB / Job

权威指标枚举：`market-job` → `DataControlRule.RuleCondition.ColumnEnum`（本机路径 `d:\Project\market-job\market-job\...\DataControlRule.java`）。  
公式细节见 [03-schema-facts.md](03-schema-facts.md)。**不含「全域*」类新指标**（未写入本版 ColumnEnum / 本分册暂不整理）。

## 业务线

| UI（explore / defaults） | Job `pline_form` | 备注 |
|--------------------------|------------------|------|
| 新媒体-免费短剧 | `cpsvideomf` | E2E 默认；与 PlineEnum 一致 |
| 新媒体-短剧 | `xmtplay` | 测试文档常写「付费短剧」；**以后端 desc 为准** |
| 新媒体-短篇 | `cpsshort` | |
| 新媒体-免费小说 | `cpsfree` | |
| 客户端-免费短剧 | `syhplay` | PlineEnum 亦作 `SYH_CLT_PLAY` |
| 头条端原生-免费 | `cpsdyfree` | UI 若写「端原生-免费」需确认是否同 desc |
| 头条端原生-付费 | `cpsdy` | 同上 |
| 客户端-付费小说 | `cltmain` | 见 [02](02-schema-rules.md)；指标多走客户端扫描，见下表「客户端」 |
| 客户端-付费短剧 | `cltplay` | 同上 |

## 维度

| UI | `data_type` | 事实表中段 | 聚合键（online 系） |
|----|-------------|------------|---------------------|
| 广告 | `promotion` | `*_promotion_*`（HM: `*_plan_*`） | `promotion_id` / `plan_id` |
| 渠道 | `channel` | `*_channel_*` | 渠道键 / `channel_code` |
| 项目 | `project` | `*_project_*` | `project_id` |
| 负责人 | `user` | 偏 HM project 聚合 | 负责人字段（Job 扫描任务） |

## 时间范围（条件 timeType）

| UI 文案（常见） | timeType（示意） | 非客户端读表 |
|-----------------|------------------|--------------|
| 当天 | `0` TODAY | **hour** |
| 近 1/2/3/6 小时 | `1`/`2`/`3`/`6` | hour |
| 近 2/3 天等 | DAY_* | day |

「广告创建时间 / 短剧上架时间」等是规则过滤，**不是**选 hour/day 的 `calTableDimension` 开关。

近 N 小时条件里，规则 `column` 常带 `hour_` 前缀（见下表「分时」列）；当天/近天累计用无前缀的 value。

## 指标（UI → ColumnEnum → 适用 pline）

来源：`ColumnEnum(value, desc, plineFormList)`。UI 文案以 `desc` / 前端硬编码为准，造数与断言用 `value`。

### 通用 / 多业务线

| UI（约） | Job `column` value | 分时 value（若有） | 适用 pline（alias） | 计算要点 |
|----------|-------------------|-------------------|---------------------|----------|
| 消耗 / 当日消耗 | `consume` | `hour_consume` | `xmtplay`,`cpsvideomf`,`cpsshort`,`cpsdy`,`cpsdyfree`,`cpsfree` | `sum(consume)` |
| 转化数 | `convert_num` | — | `cpsdyfree`,`cpsdy`,`xmtplay` | `sum(convert_num)` |
| 转化成本 | `convert_cost` | `hour_convert_cost` | 同上 | `sum(consume)/sum(convert_num)` |
| 计费比 / 转化计费比 | `bid_rate` | `hour_bid_rate` | 同上 | 与最新 `roi_goal` 或 `cpa_bid` 相关，见 03 |

### 新媒体-短剧 `xmtplay`

| UI（约） | Job `column` | 分时 | 计算要点 |
|----------|--------------|------|----------|
| ROI_H2 | `roi_h2` | —（短篇另有 hour） | `sum(cz_h2)/sum(consume)` |
| ROI_H12 | `roi_h12` | `hour_roi_h12` | `sum(cz_h12)/sum(consume)` |
| 付费成本 / 充值成本 | `pay_cost` | `hour_pay_cost` | `sum(consume)/sum(n_recharge_uv_day)` |
| 订阅成本 | `n_auto_pay_cost` | `hour_n_auto_pay_cost` | 见 Mapper / 测试 SQL |
| 转化数 / 转化成本 / 计费比 | 见上表 | 见上表 | |

### 新媒体-免费短剧 `cpsvideomf`

| UI（约） | Job `column` | 分时 | 计算要点 |
|----------|--------------|------|----------|
| 预估 ROI | `predict_roi` | `hour_predict_roi` | `sum(n_predict_cpm)/sum(consume)` |
| 消耗 | `consume` | `hour_consume` | `sum(consume)` |

> 测试 SQL 还有 ROI_H1/H2/H3/H4/H12（`n_total_income_h*`）；**当前 ColumnEnum 未为 `cpsvideomf` 注册这些 value**——UI 若仍展示，以实探 + Job 是否另分支为准，造数前核对 `conditions.column`。

### 新媒体-短篇 `cpsshort`

| UI（约） | Job `column` | 分时 | 计算要点 |
|----------|--------------|------|----------|
| ROI_H1 | `roi_h1` | `hour_roi_h1` | `sum(cz_h1)/sum(consume)` |
| ROI_H2 | `roi_h2` | `hour_roi_h2` | `sum(cz_h2)/sum(consume)` |
| ROI_H3 | `roi_h3` | `hour_roi_h3` | `sum(cz_h3)/sum(consume)` |
| ROI_H12 | `roi_h12` | `hour_roi_h12` | `sum(cz_h12)/sum(consume)` |
| 付费成本 | `pay_cost` | `hour_pay_cost` | `sum(consume)/sum(n_recharge_uv_day)` |
| 退订率 | `unsubscribe_rate` | `hour_unsubscribe_rate` | `sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day)` |
| 消耗 | `consume` | `hour_consume` | |

### 新媒体-免费小说 `cpsfree`

| UI（约） | Job `column` | 分时 | 计算要点 |
|----------|--------------|------|----------|
| 预估 ROI | `predict_roi` | `hour_predict_roi` | `sum(n_predict_cpm)/sum(consume)`，**无 /1000** |
| 补贴后 ROI | `subsidies_roi` | `hour_subsidies_roi` | `(n_predict_cpm + n_predict_cpm*0.3/0.7 + n_recharge_discount)/consume` |
| 消耗 | `consume` | `hour_consume` | |

### 头条端原生-免费 `cpsdyfree`

| UI（约） | Job `column` | 分时 | 计算要点 |
|----------|--------------|------|----------|
| ROI_H24 / ROI_h24 | `roi_h24` | — | `sum(n_total_income_h24)/sum(consume)` |
| 广告变现 ROI | `micro_game_0d_roi` | — | `sum(micro_game_0d_ltv)/sum(consume)` |
| 预估 roi | `ad_roi` | `hour_ad_roi` | 端原生「预估」；**不是** `predict_roi` |
| 转化数 / 转化成本 / 计费比 | 见通用表 | 见通用表 | |
| 消耗 | `consume` | `hour_consume` | |

### 头条端原生-付费 `cpsdy`

| UI（约） | Job `column` | 分时 | 计算要点 |
|----------|--------------|------|----------|
| 激活后 24h 付费 ROI | `active_pay_intra_one_day_roi` | `hour_ACTIVE_PAY_INTRA_ONE_DAY_ROI`（value 大小写以枚举为准） | `sum(active_pay_intra_one_day_amount)/sum(consume)` |
| 转化数 / 转化成本 / 计费比 | 见通用表 | 见通用表 | |
| 消耗 | `consume` | `hour_consume` | |

### 客户端-免费短剧 `syhplay`（ColumnEnum 挂 `SYH_CLT_PLAY`）

| UI（约） | Job `column` | 分时 | 计算要点 |
|----------|--------------|------|----------|
| 新回 UV | `n_uv` | — | `sum(n_uv_hour)` 等，见 03 |
| CPA | `cpa` | — | `sum(consume)/sum(n_uv_hour)` |
| 实时次留 | `stay_1` | — | `stay_uv_*` 相关 |
| 次留 | `retention_d1_uv_ratio` | — | |
| 3留～7留 | `retention_d3_uv_ratio` … `retention_d7_uv_ratio` | — | |
| 人均观看时长 | `avg_play_time_day` | `hour_avg_play_time_day` | `play_time_day` 等 |
| H3留存 | `stay_h3` | `hour_stay_h3` | |
| 整体 ROI | `all_roi` | `hour_all_roi` | HM 整体 ROI 公式，见 03 |
| arpu | `arpu` | `hour_arpu` | |

## ColumnEnum 全量索引（value → desc）

便于对照 `conditions.column`（**不含全域***）：

| value | desc | 主要 pline |
|-------|------|------------|
| `consume` | 当日消耗 | 多业务 |
| `hour_consume` | 分时消耗 | 多业务 |
| `roi_h1` / `hour_roi_h1` | ROI_H1 / 分时 | `cpsshort` |
| `roi_h2` / `hour_roi_h2` | ROI_H2 / 分时 | `cpsshort`；当日亦 `xmtplay` |
| `roi_h3` / `hour_roi_h3` | ROI_H3 / 分时 | `cpsshort` |
| `roi_h12` / `hour_roi_h12` | ROI_H12 / 分时 | `xmtplay`,`cpsshort` |
| `roi_h24` | ROI_h24 | `cpsdyfree` |
| `micro_game_0d_roi` | 当日广告变现ROI | `cpsdyfree` |
| `ad_roi` / `hour_ad_roi` | 预估roi / 分时预估roi | `cpsdyfree` |
| `convert_num` | 转化数 | `cpsdyfree`,`cpsdy`,`xmtplay` |
| `convert_cost` / `hour_convert_cost` | 转化成本 / 分时 | 同上 |
| `bid_rate` / `hour_bid_rate` | 计费比 / 分时 | 同上 |
| `active_pay_intra_one_day_roi` / `hour_ACTIVE_PAY_INTRA_ONE_DAY_ROI` | 激活后24h付费ROI | `cpsdy` |
| `predict_roi` / `hour_predict_roi` | 预估ROI / 分时 | `cpsvideomf`,`cpsfree` |
| `pay_cost` / `hour_pay_cost` | 付费成本 / 分时 | `cpsshort`,`xmtplay` |
| `n_auto_pay_cost` / `hour_n_auto_pay_cost` | 订阅成本 / 分时 | `xmtplay` |
| `unsubscribe_rate` / `hour_unsubscribe_rate` | 退订率 / 分时 | `cpsshort` |
| `subsidies_roi` / `hour_subsidies_roi` | 补贴后ROI / 分时 | `cpsfree` |
| `n_uv` | 新回UV | `syhplay` |
| `cpa` | CPA | `syhplay` |
| `stay_1` | 实时次留 | `syhplay` |
| `retention_d1_uv_ratio` … `d7` | 次留～7留 | `syhplay` |
| `avg_play_time_day` / `hour_avg_play_time_day` | 人均观看时长 | `syhplay` |
| `stay_h3` / `hour_stay_h3` | H3留存 | `syhplay` |
| `all_roi` / `hour_all_roi` | 整体ROI | `syhplay` |
| `arpu` / `hour_arpu` | arpu | `syhplay` |

前端指标与业务线关系：Job 注释称「前端暂时硬编码」；**落库条件以 `ColumnEnum` 的 value + pline 列表为准**。

## 运算符 / 阈值

| UI | Job |
|----|-----|
| 小于等于等 | 条件 JSON 运算符；与聚合别名 `_data_d_consume` / `_data_h1_*` 等比较 |
| 数值 | 与 UI 填值一致；ROI 类注意小数（80%→0.8 见 UI domain） |

## 状态

| UI | 规则字段 | 事实列过滤（开启、非 HM 示意） |
|----|----------|--------------------------------|
| 广告状态·开启 | `opt_status=1` | `promotion_status` 非「已暂停」「已删除」 |
| 广告状态·不限 | null/-1 | 不加条件 |
| 项目状态 | `project_status` | 广告维度时可带 `project_status` 条件 |

## 默认 E2E 映射一行

| UI 默认 | Job / DB |
|---------|-----------|
| 新媒体-免费短剧 · 广告 · 当天 · 消耗 · ≤阈值 · 广告开启 | `pline_form=cpsvideomf` · `promotion` · hour 表 · `column=consume` · `sum(consume)` · 状态可过开启过滤 |

## 待确认

- [ ] 前端业务线 option 是否 100% 等于 `PlineEnum.desc`  
- [ ] 各媒体下 `promotion_status` 枚举全集（造数最小集：避免「已暂停」「已删除」）  
- [ ] `cpsvideomf` UI 展示的 ROI_H* 与 ColumnEnum 未注册项：实探 `conditions.column` 实际写入值  
- [ ] 全域类指标：待 Job 合入后再补本表（本版明确跳过）  
