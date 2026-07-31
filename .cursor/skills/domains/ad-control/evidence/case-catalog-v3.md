# 广告管控 Seed V3 可处理 Case 全量清单

- 知识版本：`sha256:0d843dd7ffa53e4823a590cbf7de761afa20f73d3b9d96237c804b7ad61caeae`
- verified 原子能力：51
- 可独立执行：40
- 仅可参与组合：11
- HIT：51
- MISS：51
- 原子执行变体：102
- verified 动作：预警

> 多条件 AND/OR/NOT 由下列原子能力组合。组合数量理论上不封顶，因此本清单列举可组成组合的全部 verified 原子能力；实际组合仍需通过冲突检查和 Preflight。

## cpsdy / channel

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-022 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_channel_hour(default)<br>ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-023 | 0 | all_stat_total_cost_trend | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-024 | 0 | all_roi_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-025 | 0 | all_roi_24h_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-026 | 0 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_pay_channel_day(default)<br>ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-027 | 99 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_channel_day(default)<br>ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-028 | 99 | all_stat_total_cost_trend | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-029 | 99 | all_roi_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-030 | 99 | all_roi_24h_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-031 | 99 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_pay_channel_day(default)<br>ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-032 | 1 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_channel_hour(default)<br>ad_advertiser_online_pay_roi3_channel_hour(3) |
| seed-case-033 | 1 | all_stat_total_cost_trend | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_channel_hour(3) |
| seed-case-034 | 1 | all_roi_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_channel_hour(3) |
| seed-case-035 | 1 | all_roi_24h_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_channel_hour(3) |
| seed-case-036 | 1 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_pay_channel_day(default)<br>ad_advertiser_online_pay_roi3_channel_day(3) |

## cpsdy / project

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-014 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_project_hour(default)<br>ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-015 | 0 | all_stat_total_cost_trend | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-016 | 0 | all_roi_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-017 | 0 | all_roi_24h_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-018 | 99 | all_roi_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-019 | 0 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_pay_project_day(default)<br>ad_advertiser_online_pay_roi3_project_day(3) |

## cpsdy / promotion

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-020 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_promotion_hour(default) |
| seed-case-021 | 0 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_pay_promotion_day(default) |

## cpsdyfree / project

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-004 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_project_hour(default)<br>ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-005 | 0 | all_stat_total_cost_trend | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-006 | 0 | all_roi_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-007 | 0 | all_roi_24h_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-008 | 0 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_free_project_day(default)<br>ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-009 | 2 | hour_consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_project_hour(default)<br>ad_advertiser_online_pay_roi3_project_hour(3) |
| seed-case-010 | 1 | hour_all_roi_trend | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_roi3_project_hour(3) |

## cpsdyfree / promotion

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-011 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_promotion_hour(default) |
| seed-case-012 | 0 | convert_num | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_promotion_hour(default) |
| seed-case-013 | 0 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_free_promotion_day(default) |

## cpsfree / project

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-051 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_book_project_hour(default) |

## cpsvideomf / channel

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-041 | 0 | predict_roi | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_channel_hour(default)<br>ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-042 | 2 | hour_predict_roi | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_channel_hour(default)<br>ad_advertiser_online_pay_roi3_channel_hour(3) |
| seed-case-043 | 99 | convert_num | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_channel_day(default)<br>ad_advertiser_online_pay_roi3_channel_day(3) |
| seed-case-048 | 0 | predict_roi | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_channel_hour(default)<br>ad_advertiser_online_pay_roi3_channel_day(3) |

## cpsvideomf / project

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-045 | 2 | hour_roi_h1 | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_project_hour(default)<br>ad_advertiser_online_pay_roi3_project_hour(3) |
| seed-case-046 | 100 | convert_num | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_project_day(default)<br>ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-049 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_project_hour(default)<br>ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-050 | 0 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_free_project_day(default)<br>ad_advertiser_online_pay_roi3_project_day(3) |

## cpsvideomf / promotion

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-001 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_free_promotion_hour(default) |
| seed-case-047 | 0 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_free_promotion_day(default) |

## xmtplay / channel

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-044 | 0 | unsubscribe_rate | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_channel_hour(default)<br>ad_advertiser_online_pay_roi3_channel_day(3) |

## xmtplay / project

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-002 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_project_hour(default)<br>ad_advertiser_online_pay_roi3_project_day(3) |
| seed-case-040 | 0 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_pay_project_day(default)<br>ad_advertiser_online_pay_roi3_project_day(3) |

## xmtplay / promotion

| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |
|---|---:|---|---|---|---|---|---|---|
| seed-case-003 | 0 | consume | sum | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_promotion_hour(default) |
| seed-case-037 | 0 | roi_h12 | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_promotion_hour(default) |
| seed-case-038 | 0 | model_pred_roi | sum | post-filter | 否，须搭配 aggregate 条件 | HIT、MISS | 预警 | ad_advertiser_online_pay_promotion_day(default) |
| seed-case-039 | 2 | hour_roi_h12 | ratio | aggregate | 是 | HIT、MISS | 预警 | ad_advertiser_online_pay_promotion_hour(default) |

## 当前阻断项

### dimensions

- `dimension-field:channel_users` 负责人：尚未证明负责人到所有事实表字段的完整映射
- `dimension-field:effect_scope` 主体范围：尚未证明主体范围的事实表映射
- `dimension-field:account_type` 账户类型：尚未证明账户类型的事实表映射

### conditions

- `condition:convert_cost:cpsdyfree+cpsdy+xmtplay` convert_cost：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:hour_convert_cost:cpsdyfree+cpsdy+xmtplay` hour_convert_cost：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:bid_rate:cpsdyfree+cpsdy+xmtplay` bid_rate：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:hour_bid_rate:cpsdyfree+cpsdy+xmtplay` hour_bid_rate：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:n_auto_pay_cost:xmtplay` n_auto_pay_cost：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:hour_n_auto_pay_cost:xmtplay` hour_n_auto_pay_cost：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:n_uv:syhplay` n_uv：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:cpa:syhplay` cpa：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:stay_1:syhplay` stay_1：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:retention_d1_uv_ratio:syhplay` retention_d1_uv_ratio：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:retention_d3_uv_ratio:syhplay` retention_d3_uv_ratio：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:retention_d4_uv_ratio:syhplay` retention_d4_uv_ratio：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:retention_d5_uv_ratio:syhplay` retention_d5_uv_ratio：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:retention_d6_uv_ratio:syhplay` retention_d6_uv_ratio：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:retention_d7_uv_ratio:syhplay` retention_d7_uv_ratio：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:avg_play_time_day:syhplay` avg_play_time_day：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:hour_avg_play_time_day:syhplay` hour_avg_play_time_day：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:stay_h3:syhplay` stay_h3：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:hour_stay_h3:syhplay` hour_stay_h3：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:all_roi:syhplay` all_roi：HM 整体 ROI；仅登记，造数前核对
- `condition:arpu:syhplay` arpu：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:hour_arpu:syhplay` hour_arpu：ColumnEnum 已登记；写列默认同名，造数前核对 Mapper
- `condition:subsidies_roi:cpsfree` subsidies_roi：补贴后 ROI 含折扣项；hit/miss 首版近似
- `condition:hour_all_roi_24h_trend:cpsdy` hour_all_roi_24h_trend：临时白名单指标；沿用24h ROI聚合字段，首次写库前必须核对Job Mapper与实库schema

### capabilities

- `cpsdy|project|2|hour_all_roi_24h_trend` ：端付·项目·近2小时·分时全域24hROI；临时扩白名单供 rule 16209
- `cpsfree|project|100|subsidies_roi` ：新媒体-免费小说·项目·近3天·补贴后ROI；临时扩白名单供 rule 16242
- `cpsdyfree|promotion|0|all_stat_total_cost_trend` ：capability 和 metric 已 verified，但当前知识没有匹配的 verified 表路由
- `cpsdyfree|promotion|0|all_roi_trend` ：capability 和 metric 已 verified，但当前知识没有匹配的 verified 表路由
- `cpsdyfree|promotion|0|all_roi_24h_trend` ：capability 和 metric 已 verified，但当前知识没有匹配的 verified 表路由
- `cpsdy|promotion|0|all_stat_total_cost_trend` ：capability 和 metric 已 verified，但当前知识没有匹配的 verified 表路由
- `cpsdy|promotion|0|all_roi_trend` ：capability 和 metric 已 verified，但当前知识没有匹配的 verified 表路由
- `cpsdy|promotion|0|all_roi_24h_trend` ：capability 和 metric 已 verified，但当前知识没有匹配的 verified 表路由
- `xmtplay|promotion|0|all_stat_total_cost_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `xmtplay|promotion|0|all_roi_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `xmtplay|promotion|0|all_roi_24h_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `xmtplay|project|0|all_stat_total_cost_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `xmtplay|project|0|all_roi_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `xmtplay|project|0|all_roi_24h_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `cpsvideomf|promotion|0|all_stat_total_cost_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `cpsvideomf|promotion|0|all_roi_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `cpsvideomf|promotion|0|all_roi_24h_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `cpsvideomf|project|0|all_stat_total_cost_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `cpsvideomf|project|0|all_roi_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出
- `cpsvideomf|project|0|all_roi_24h_trend` ：capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出

### actions

- `action:pause` 暂停：当前 UI 证据不足，禁止生成或执行该动作
- `action:raise-budget` 调整预算：预算上下限和页面结果尚未形成闭环证据

