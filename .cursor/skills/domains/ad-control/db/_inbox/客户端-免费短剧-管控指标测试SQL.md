# 客户端-免费短剧-管控指标测试SQL

# 客户端-免费短剧

管控依赖数据报表

| 维度 | 业务线 | 业务解释 | 数据库表 | 业务线 |
| --- | --- | --- | --- | --- |
| 广告 | 客户端-免费短剧<br>syhplay | 基于广告维度的数据报表管控 | ad\_advertiser\_hm\_plan\_day |  |
| 渠道 |  | 基于渠道维度的数据报表管控 | ad\_advertiser\_hm\_channel\_day |  |
| 项目 |  | 基于项目维度的数据报表管控 | ad\_advertiser\_hm\_project\_day |  |
| 负责人 |  | 基于负责人维度的项目聚合管控 | ad\_advertiser\_hm\_project\_day |  |

PS：项目状态和广告状态是否为null ，null的数据不纳入统计范围

# 指标

#### 消耗：sum(consume)

#### 新回UV：sum(n\_uv\_hour)

#### CPA：SUM(consume)/SUM(n\_uv\_hour)

#### 人均观看时长：sum(play\_time\_day)/sum(n\_uv\_hour)

#### 实时次留：SUM(stay\_uv\_a\_1\_total\_hour)/SUM(stay\_uv\_b\_1)

# 时间维度

#### 当天的指标计算SQL

客户端只有day天维度数据，读取的是天表数据累计求和

```json

select cdate,plan_id,
sum(consume) as '消耗',
sum(n_uv_hour) as '新回UV',
SUM(consume)/SUM(n_uv_hour) as 'CPA',
sum(play_time_day)/sum(n_uv_hour) as '人均观看时长',
SUM(stay_uv_a_1_total_hour)/SUM(stay_uv_b_1) as '实时次留'

from ad_advertiser_hm_plan_day
where pline_form = 'syhplay' and cdate = '2026-01-16'
group by plan_id
order by plan_id desc
```

#### 前X日至Y日/近X日

条件是连续，分天累计求和

时间分别是T-X 和T-Y

```json
select cdate,plan_id,
sum(consume) as '消耗',
sum(n_uv_hour) as '新回UV',
SUM(consume)/SUM(n_uv_hour) as 'CPA',
sum(play_time_day)/sum(n_uv_hour) as '人均观看时长',
SUM(stay_uv_a_1_total_hour)/SUM(stay_uv_b_1) as '实时次留'

from ad_advertiser_hm_plan_day
where pline_form = 'syhplay' and cdate >= 'T-X' and cdate <= 'T-Y'
group by plan_id,cdate
order by plan_id desc
```

#### 近X日

条件是连续，累计求和

时间分别是T-X

```json
select cdate,plan_id,
sum(consume) as '消耗',
sum(n_uv_hour) as '新回UV',
SUM(consume)/SUM(n_uv_hour) as 'CPA',
sum(play_time_day)/sum(n_uv_hour) as '人均观看时长',
SUM(stay_uv_a_1_total_hour)/SUM(stay_uv_b_1) as '实时次留'

from ad_advertiser_hm_plan_day
where pline_form = 'syhplay' and cdate >= 'T-X' and cdate <= 'T'
group by plan_id
order by plan_id desc
```

客户端-付费小说：

market.ad\_advertiser\_client\_pay\_promotion\_hour 广告小时     业务线：cltmain

market.ad\_advertiser\_client\_pay\_promotion\_day 天                业务线：cltmain

客户端-付费短剧

market.ad\_advertiser\_client\_pay\_promotion\_hour              业务线：cltplay