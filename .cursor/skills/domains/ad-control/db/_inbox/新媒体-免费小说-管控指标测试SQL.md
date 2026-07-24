# 新媒体-免费小说-管控指标测试SQL

# 新媒体-短篇

| 维度 | 库表-小时表 | 库表-天表 | 业务线 |
| --- | --- | --- | --- |
| 广告 | ad\_advertiser\_online\_pay\_book\_promotion\_hour | ad\_advertiser\_online\_pay\_book\_promotion\_day | cpsshort |
| 渠道 | ad\_advertiser\_online\_pay\_book\_channel\_hour | ad\_advertiser\_online\_pay\_book\_channel\_day | cpsshort |
| 项目 | ad\_advertiser\_online\_pay\_book\_project\_hour | ad\_advertiser\_online\_pay\_book\_project\_day | cpsshort |

PS：项目状态和广告状态是否为null ，null的数据不纳入统计范围

# 新媒体-免费小说

| 维度 | 库表-小时表 | 库表-天表 | 业务线 |
| --- | --- | --- | --- |
| 广告 | ad\_advertiser\_online\_pay\_book\_promotion\_hour | ad\_advertiser\_online\_pay\_book\_promotion\_day | cpsfree |
| 渠道 | ad\_advertiser\_online\_pay\_book\_channel\_hour | ad\_advertiser\_online\_pay\_book\_channel\_day | cpsfree |
| 项目 | ad\_advertiser\_online\_pay\_book\_project\_hour | ad\_advertiser\_online\_pay\_book\_project\_day | cpsfree |

# 指标

#### 消耗：sum(consume)

#### 预估ROI：sum(n\_predict\_cpm)/sum(consume)

#### 补贴后ROI：(sum(n\_predict\_cpm) + sum(n\_predict\_cpm) \* 0.3  / 0.7 + sum(n\_recharge\_discount)) / sum(consume)

# 时间维度

#### 近2天/近3天的指标计算SQL

近2天/近3天的指标是day表的数据累计求和

cdate是当天日期是当前天数的T-2和T-1

```json
select cdate,account,promotion_id,agent_user_name, main_body,bid_strategy_id,bid_strategy_name,account_type,video_type,delivery_way,bid_type,promotion_status,
sum(consume) as '消耗',
sum(n_predict_cpm),sum(n_predict_cpm)/ sum(consume) as '预估roi',
sum(n_predict_cpm),sum(n_recharge_discount),(sum(n_predict_cpm) + sum(n_predict_cpm) * 0.3  / 0.7 + sum(n_recharge_discount)) / sum(consume) as '补贴后roi'
FROM  ad_advertiser_online_pay_book_promotion_day
where cdate >= '2026-04-27'  and pline_form = 'cpsfree'  
group by promotion_id	
order by promotion_id desc
```

#### 当天的指标计算SQL

小时表累计求和

```json
select cdate,account,promotion_id,agent_user_name, main_body,bid_strategy_id,bid_strategy_name,account_type,video_type,delivery_way,bid_type,promotion_status,
project_status,delivery_mode,
sum(consume) as '消耗',
sum(n_predict_cpm),sum(n_predict_cpm) / sum(consume) as '预估roi',
sum(n_predict_cpm),sum(n_recharge_discount),(sum(n_predict_cpm) + sum(n_predict_cpm) * 0.3  / 0.7 + sum(n_recharge_discount)) / sum(consume) as '补贴后roi'
FROM  ad_advertiser_online_pay_book_promotion_hour aaopbph 
where cdate >= '2026-04-27'  and pline_form = 'cpsfree' 
group by promotion_id
order by promotion_id desc
```

#### 近2小时/近3小时

hour是当天小时的T-1/T-2

```json
select cdate,hour,account,promotion_id,agent_user_name, main_body,bid_strategy_id,bid_strategy_name,account_type,video_type,delivery_way,bid_type,
sum(consume) as '消耗',
sum(n_predict_cpm),sum(n_predict_cpm)/1000 / sum(consume) as '预估roi',
sum(n_predict_cpm),sum(n_recharge_discount),(sum(n_predict_cpm) / 1000 + sum(n_predict_cpm) / 1000 * 0.3  / 0.7 + sum(n_recharge_discount)) / sum(consume) as '补贴后roi'
FROM  ad_advertiser_online_pay_book_promotion_hour aaopbph 
where cdate >= '2026-04-25'  and pline_form = 'cpsfree'  and `hour` >=14
group by promotion_id
order by promotion_id desc
```