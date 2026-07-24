# 04 · 字段映射 UI / 测试 → DB / Job

## 业务线

| UI（explore / defaults） | Job `pline_form` | 备注 |
|--------------------------|------------------|------|
| 新媒体-免费短剧 | `cpsvideomf` | E2E 默认；与 PlineEnum 一致 |
| 新媒体-短剧 | `xmtplay` | 测试文档常写「付费短剧」；**以后端 desc 为准** |
| 新媒体-短篇 | `cpsshort` | |
| 新媒体-免费小说 | `cpsfree` | |
| 客户端-免费短剧 | `syhplay` | |
| 头条端原生-免费 | `cpsdyfree` | UI 若写「端原生-免费」需确认是否同 desc |
| 头条端原生-付费 | `cpsdy` | 同上 |

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

## 指标（UI → 列/公式）

| UI 指标 | Job column（示意） | 计算 |
|---------|-------------------|------|
| 消耗 | `consume` | `sum(consume)` |
| ROI_H12 等 | `roi_h12` … | 见 [03](03-schema-facts.md) |
| 预估 ROI | `predict_roi` | `n_predict_cpm/consume` |
| 补贴后 ROI | `subsidies_roi` | 见 03；无 /1000 |
| 转化成本 | `convert_cost` | `consume/convert_num` |
| 转化计费比 | `bid_rate` | 与 `roi_goal` 或 `cpa_bid` |

前端指标与业务线关系：Job 注释称「前端暂时硬编码」；以 `ColumnEnum` 中 `pline` 列表为准。

## 运算符 / 阈值

| UI | Job |
|----|-----|
| 小于等于等 | 条件 JSON 运算符；与聚合别名 `_data_d_consume` 等比较 |
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
| 新媒体-免费短剧 · 广告 · 当天 · 消耗 · ≤阈值 · 广告开启 | `pline_form=cpsvideomf` · `promotion` · hour 表 · `sum(consume)` · 状态可过开启过滤 |

## 待确认

- [ ] 前端业务线 option 是否 100% 等于 `PlineEnum.desc`  
- [ ] 各媒体下 `promotion_status` 枚举全集（造数最小集：避免「已暂停」「已删除」）  
