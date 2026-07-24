# 03 · Schema · 事实表（Job 读取）

库：测试环境 `market`（`E2E_DB_NAME`）。

## 表族总览

同物理表常服务多业务线，**靠 `pline_form` 区分**。

| 表族前缀 | 典型 pline | 维度后缀 |
|----------|------------|----------|
| `ad_advertiser_online_pay_*` | `xmtplay`, `cpsdy` | `promotion` / `channel` / `project` + `_hour`/`_day` |
| `ad_advertiser_online_free_*` | `cpsvideomf`, `cpsdyfree` | 同上 |
| `ad_advertiser_online_pay_book_*` | `cpsshort`, `cpsfree` | 同上 |
| `ad_advertiser_hm_*` | `syhplay` | `plan`（广告）/ `channel` / `project`；有 hour 与 day |
| `ad_advertiser_client_pay_*` | `cltmain`, `cltplay` | promotion 等 |

文档附注（与 Job 扫描一致的方向）：

- IAA ≈ free channel 表族（端原生免费 + 新媒体免费短剧）  
- IAP ≈ pay channel 表族（端原生付费 + 新媒体短剧）  

## 业务线 × 维度 × 表（测试 SQL + Job 对齐）

| 业务 (alias) | 广告 hour | 广告 day | 渠道 / 项目 |
|--------------|-----------|----------|-------------|
| `xmtplay` | `ad_advertiser_online_pay_promotion_hour` | `..._day` | `..._pay_channel_*` / `..._pay_project_*` |
| `cpsdy` | 同上 pay 表族 | 同上 | 同上 |
| `cpsvideomf` | `ad_advertiser_online_free_promotion_hour` | `..._day` | `..._free_channel_*` / `..._free_project_*` |
| `cpsdyfree` | 同上 free 表族 | 同上 | 同上 |
| `cpsshort` / `cpsfree` | `ad_advertiser_online_pay_book_promotion_hour` | `..._day` | `..._book_channel_*` / `..._book_project_*` |
| `syhplay` | `ad_advertiser_hm_plan_hour`（Job 支持） | `ad_advertiser_hm_plan_day` | `hm_channel_*` / `hm_project_*` |

## 时间窗 → 读表（以 Job 为准）

| 场景 | 非客户端（如免费短剧） | 客户端 `syhplay` 等 |
|------|------------------------|---------------------|
| 当天 | **HOUR** 表，按日聚合各 hour | 默认 **DAY**（除非条件是近 N 小时） |
| 近 1/2/3/6 小时 | HOUR + `nearlyNHour` 绑定 | HOUR |
| 近 2/3 天等多日 | DAY | DAY |

近 N 小时未到点时 Job 用 `'--'`，对应指标为 null → 条件不命中。

## 维度键与常用列

| 列 | 用途 |
|----|------|
| `cdate` | 数据日 |
| `hour` | 小时（0–23）；小时表 |
| `pline_form` | 业务线 alias，**必填** |
| `promotion_id` | 广告维度主键（online 系） |
| `plan_id` | HM 广告维度 |
| `channel_code` / 渠道键 | 渠道维度 |
| `project_id` | 项目维度 |
| `book_id` | 书/剧筛选；渠道 day 常有 |
| `consume` | 消耗 |
| `promotion_status` / `project_status` / `plan_status` | 状态过滤 |
| `roi_goal` / `cpa_bid` | 「最新」：`GROUP_CONCAT(... ORDER BY hour|cdate DESC)` 取第一条 |
| `up_date` | 上架相关（渠道 day） |

## 核心指标公式（Job / Mapper，节选）

消耗：**`sum(consume)`**（各业务通用）。

| 业务 | 指标（逻辑名） | 公式要点 |
|------|----------------|----------|
| `xmtplay` | ROI_H2 / ROI_H12 | `sum(cz_h2\|cz_h12)/sum(consume)` |
| | 充值成本 | `sum(consume)/sum(n_recharge_uv_day)` |
| | 退订率 | `sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day)` |
| | 转化成本 | `sum(consume)/sum(convert_num)` |
| | 计费比 | 最新 `roi_goal` / ROI_H12 |
| `cpsvideomf` | 预估 ROI | `sum(n_predict_cpm)/sum(consume)` |
| | ROI_Hn | `sum(n_total_income_h*)/sum(consume)` |
| | 计费比 | 转化成本 / 最新 `cpa_bid` |
| `cpsdyfree` | 广告变现 ROI | `sum(micro_game_0d_ltv)/sum(consume)` |
| | ROI_H24 | `sum(n_total_income_h24)/sum(consume)` |
| `cpsdy` | 激活后 24h 付费 ROI | `sum(active_pay_intra_one_day_amount)/sum(consume)` |
| `cpsshort` | ROI_H1/H2/H3/H12 | `sum(cz_h*)/sum(consume)` |
| `cpsfree` | 预估 ROI | `sum(n_predict_cpm)/sum(consume)` |
| | 补贴后 ROI | `(n_predict_cpm + n_predict_cpm*0.3/0.7 + n_recharge_discount)/consume`，**无 /1000** |
| `syhplay` | CPA / 新回 UV / 次留等 | `n_uv_hour`、`stay_uv_*`、`play_time_day` 等 |

大量比率外层有 `IFNULL(ROUND(...,4),0)`：除零常得 0。条件比较时指标为 null → 不命中。

## 文档瑕疵（测试 SQL ≠ Job）

| 问题 | 处理 |
|------|------|
| 「当天」示例误用 day 表（短篇、部分免费） | 以 `calTableDimension` 为准：非客户端当天 → hour |
| 免费小说近小时 ROI `/1000` | Job **不用** /1000 |
| 「状态 null 不纳入」 | Job 按规则 opt/project 状态拼条件，见 [02](02-schema-rules.md) |
| 「客户端只有 day」 | Mapper 存在 `hm_*_hour`；当天默认 day，近小时才 hour |
| 端原生-免费「近 2/3 天」示例 from hour | 多日应走 day（Job） |

## 实库校验建议

```sql
SHOW TABLES LIKE 'ad_advertiser_online_free%';
DESCRIBE ad_advertiser_online_free_promotion_hour;
SELECT * FROM ad_advertiser_online_free_promotion_hour
WHERE pline_form='cpsvideomf' AND cdate=CURDATE() LIMIT 5;
```
