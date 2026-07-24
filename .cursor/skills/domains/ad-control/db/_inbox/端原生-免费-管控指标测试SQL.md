# 端原生-免费-管控指标测试SQL

# 端原生-免费

| 维度 | 库表-小时表 | 库表-天表 | 业务线 |
| --- | --- | --- | --- |
| 广告 | ad\_advertiser\_online\_free\_promotion\_hour | ad\_advertiser\_online\_free\_promotion\_day | cpsdyfree |
| 渠道 | ad\_advertiser\_online\_free\_channel\_hour | ad\_advertiser\_online\_free\_channel\_day | cpsdyfree |
| 项目 | ad\_advertiser\_online\_free\_project\_hour | ad\_advertiser\_online\_free\_project\_day | cpsdyfree |

PS：项目状态和广告状态是否为null ，null的数据不纳入统计范围

# 指标

#### 消耗：sum(consume)

#### 广告变现ROI：sum(micro\_game\_0d\_ltv)/sum(consume)

#### ROI\_H24：sum(n\_total\_income\_h24) / sum(consume)

#### 转化数：sum(convert\_num)

#### 转化成本：sum(consume)/sum(convert\_num)

#### 转化计费比：roi\_goal/(sum(micro\_game\_0d\_ltv)/sum(consume))

# 时间维度

#### 近2天/近3天的指标计算SQL

近2天/近3天的指标是day表的数据累计求和

cdate是当天日期是当前天数的T-2和T-1

roi\_goal是数据天表中，最新一条数据的值

```json
select cdate,promotion_id,
sum(consume) as '消耗',
sum(micro_game_0d_ltv)/sum(consume) as '广告变现ROI',
sum(n_total_income_h24) / sum(consume) as 'ROI_H24',

sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
roi_goal/(sum(micro_game_0d_ltv)/sum(consume)) as '转化计费比'

from ad_advertiser_online_free_promotion_hour
where (cdate >= '2026-01-14') AND (pline_form = 'cpsdyfree') 
order by promotion_id desc
```

#### 当天的指标计算SQL

小时表累计求和

```json
select cdate,promotion_id,
sum(consume) as '消耗',
sum(micro_game_0d_ltv)/sum(consume) as '广告变现ROI',
sum(n_total_income_h24) / sum(consume) as 'ROI_H24',

sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
roi_goal/(sum(micro_game_0d_ltv)/sum(consume)) as '转化计费比'

from ad_advertiser_online_free_promotion_hour
where (cdate = '2026-01-14') AND (pline_form = 'cpsdyfree') 
group by promotion_id
order by promotion_id desc
```

#### 近2小时/近3小时

hour是当天小时的T-1/T-2

```json
select cdate,hour,promotion_id,
sum(consume) as '消耗',
sum(micro_game_0d_ltv)/sum(consume) as '广告变现ROI',
sum(n_total_income_h24) / sum(consume) as 'ROI_H24',

sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
roi_goal/(sum(micro_game_0d_ltv)/sum(consume)) as '转化计费比'

from ad_advertiser_online_free_promotion_hour
where (cdate = '2026-01-14') AND (pline_form = 'cpsdyfree') and hour>=10
group by promotion_id,hour
order by promotion_id desc
```

#### 单书/剧数据筛选SQL

```json
select cdate,book_id,
sum(consume),
micro_game_0d_ltv,sum(micro_game_0d_ltv)/sum(consume)
from market.ad_advertiser_online_free_channel_day
where cdate >= '2026-01-21'
group BY book_id,cdate
```

#### 是否当日上架

需要去查看对应的渠道day表的up\_date字段，付费，需要去内容中台查询