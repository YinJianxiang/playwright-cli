# 新媒体-免费短剧-管控指标测试SQL

# 新媒体-免费短剧

| 维度 | 库表-小时表 | 库表-天表 | 业务线 |
| --- | --- | --- | --- |
| 广告 | ad\_advertiser\_online\_free\_promotion\_hour | ad\_advertiser\_online\_free\_promotion\_day | cpsvideomf |
| 渠道 | ad\_advertiser\_online\_free\_channel\_hour | ad\_advertiser\_online\_free\_channel\_day | cpsvideomf |
| 项目 | ad\_advertiser\_online\_free\_project\_hour | ad\_advertiser\_online\_free\_project\_day | cpsvideomf |

PS：项目状态和广告状态是否为null ，null的数据不纳入统计范围

# 指标

#### 消耗：sum(consume)

#### 预估ROI：sum(n\_predict\_cpm)/sum(consume) 

#### ROI\_H1：sum(n\_total\_income\_h1) / sum(consume)

#### ROI\_H2：sum(n\_total\_income\_h2) / sum(consume)

#### ROI\_H3：sum(n\_total\_income\_h3) / sum(consume)

#### ROI\_H4：sum(n\_total\_income\_h4) / sum(consume)

#### ROI\_H12：sum(n\_total\_income\_h12) / sum(consume)

#### 转化数：sum(convert\_num)

#### 转化成本：sum(consume)/sum(convert\_num)

#### 转化计费比：(sum(consume)/sum(convert\_num))/cpa\_bid 

# 时间维度

#### 近2天/近3天的指标计算SQL

cdate >=当天日期-1

cpa\_bid ，取当天表，最新且存在的天维度数据

```json
select cdate,promotion_id,
sum(consume) as '消耗',
sum(n_predict_cpm)/sum(consume) as '预估ROI',
sum(n_total_income_h1) / sum(consume) as 'ROI_H1',
sum(n_total_income_h2) / sum(consume) as 'ROI_H2',
sum(n_total_income_h3) / sum(consume) as 'ROI_H3',
sum(n_total_income_h4) / sum(consume) as 'ROI_H4',
sum(n_total_income_h12) / sum(consume) as 'ROI_H12',
sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
(sum(consume)/sum(convert_num))/cpa_bid as '转化计费比'

from ad_advertiser_online_free_promotion_day
where (cdate >= '2026-01-14') AND (pline_form = 'cpsvideomf')
group by promotion_id
order by promotion_id desc
```

#### 当日的指标计算SQL

```json
select cdate,promotion_id,
sum(consume) as '消耗',
sum(n_predict_cpm)/sum(consume) as '预估ROI',
sum(n_total_income_h1) / sum(consume) as 'ROI_H1',
sum(n_total_income_h2) / sum(consume) as 'ROI_H2',
sum(n_total_income_h3) / sum(consume) as 'ROI_H3',
sum(n_total_income_h4) / sum(consume) as 'ROI_H4',
sum(n_total_income_h12) / sum(consume) as 'ROI_H12',
sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
(sum(consume)/sum(convert_num))/cpa_bid as '转化计费比'

from ad_advertiser_online_free_promotion_hour
where (cdate = '2026-01-14') AND (pline_form = 'cpsvideomf')
group by promotion_id
order by promotion_id desc
```

#### 近2小时/近3小时

cdate是当天日期

hour是当天时间的T-2或者T-3

```json
select cdate,hour,promotion_id,
sum(consume) as '消耗',
sum(n_predict_cpm)/sum(consume) as '预估ROI',
sum(n_total_income_h1) / sum(consume) as 'ROI_H1',
sum(n_total_income_h2) / sum(consume) as 'ROI_H2',
sum(n_total_income_h3) / sum(consume) as 'ROI_H3',
sum(n_total_income_h4) / sum(consume) as 'ROI_H4',
sum(n_total_income_h12) / sum(consume) as 'ROI_H12',
sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
(sum(consume)/sum(convert_num))/cpa_bid as '转化计费比'

from ad_advertiser_online_free_promotion_hour
where (cdate = '2026-01-14') AND (pline_form = 'cpsvideomf') and hour>=10
group by promotion_id,hour
order by promotion_id desc
```

#### 单书剧筛选框测试SQL

T为当天

```json
select cdate,book_id,
sum(consume),
n_total_income_h12,sum(n_total_income_h12) / sum(consume)
from ad_advertiser_online_free_channel_day
where cdate >= T-2
group BY book_id,cdate
```

#### 是否当日上架

需要去查看对应的渠道day表的up\_date字段，付费，需要去内容中台查询

#### 单书/剧数据筛选

```json
select cdate,book_id,sum(consume)
,sum(n_predict_cpm)/sum(consume) as '预估ROI'
from ad_advertiser_online_free_channel_day
where (cdate >= '2026-01-25') AND (pline_form = 'cpsvideomf')
group by book_id,cdate
```