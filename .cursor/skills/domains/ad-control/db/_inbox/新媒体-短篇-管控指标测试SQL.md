# 新媒体-短篇-管控指标测试SQL

# 新媒体-短篇

| 维度 | 库表-小时表 | 库表-天表 | 业务线 |
| --- | --- | --- | --- |
| 广告 | ad\_advertiser\_online\_pay\_book\_promotion\_hour | ad\_advertiser\_online\_pay\_book\_promotion\_day | cpsshort |
| 渠道 | ad\_advertiser\_online\_pay\_book\_channel\_hour | ad\_advertiser\_online\_pay\_book\_channel\_day | cpsshort |
| 项目 | ad\_advertiser\_online\_pay\_book\_project\_hour | ad\_advertiser\_online\_pay\_book\_project\_day | cpsshort |

PS：项目状态和广告状态是否为null ，null的数据不纳入统计范围

# 指标

#### 消耗：sum(consume)

#### ROI\_H1：sum(cz\_h1) / sum(consume)

#### ROI\_H2：sum(cz\_h2) / sum(consume)

#### ROI\_H3：sum(cz\_h3) / sum(consume)

#### ROI\_H12：sum(cz\_h12) / sum(consume)

#### 充值成本：sum(consume)/sum(n\_recharge\_uv\_day)

#### 退订率：sum(n\_unsubscribe\_uv\_day)/sum(n\_auto\_pay\_uv\_day)

# 时间维度

#### 近2天/近3天的指标计算SQL

近2天/近3天的指标是day表的数据累计求和

cdate是当天日期是当前天数的T-2和T-1

```json
select cdate,promotion_id,
sum(consume) as '消耗',
sum(cz_h1),sum(cz_h1) / sum(consume) as 'ROI_H1',
sum(cz_h2),sum(consume),sum(cz_h2) / sum(consume) as 'ROI_H2',
sum(cz_h3),sum(consume),sum(cz_h3) / sum(consume) as 'ROI_H3',
sum(cz_h12),consume,sum(cz_h12) / sum(consume) as 'ROI_H12',
sum(consume)/sum(n_recharge_uv_day) as '充值成本',
sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day) as '退订率'
FROM  ad_advertiser_online_pay_book_promotion_day
where cdate >= '2026-01-02'  and pline_form = 'cpsshort'
group by promotion_id
order by promotion_id desc
```

#### 当天的指标计算SQL

小时表累计求和

```json
select cdate,promotion_id,
sum(consume) as '消耗',
sum(cz_h1),sum(cz_h1) / sum(consume) as 'ROI_H1',
sum(cz_h2),sum(consume),sum(cz_h2) / sum(consume) as 'ROI_H2',
sum(cz_h3),sum(consume),sum(cz_h3) / sum(consume) as 'ROI_H3',
sum(cz_h12),consume,sum(cz_h12) / sum(consume) as 'ROI_H12',
sum(consume)/sum(n_recharge_uv_day) as '充值成本',
sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day) as '退订率'
FROM  ad_advertiser_online_pay_book_promotion_day
where cdate = '2026-01-02'  and pline_form = 'cpsshort'
group by promotion_id
order by promotion_id desc
```

#### 近2小时/近3小时

hour是当天小时的T-1/T-2

```json
select cdate,hour,promotion_id,
sum(consume) as '消耗',
sum(cz_h1),sum(cz_h1) / sum(consume) as 'ROI_H1',
sum(cz_h2),sum(consume),sum(cz_h2) / sum(consume) as 'ROI_H2',
sum(cz_h3),sum(consume),sum(cz_h3) / sum(consume) as 'ROI_H3',
sum(cz_h12),consume,sum(cz_h12) / sum(consume) as 'ROI_H12',
sum(consume)/sum(n_recharge_uv_day) as '充值成本',
sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day) as '退订率'
FROM  ad_advertiser_online_pay_book_promotion_day
where cdate = '2026-01-02'  and pline_form = 'cpsshort' and hour >=10 
group by promotion_id,hour
order by promotion_id desc
```

#### 单书剧筛选框测试SQL

```json
select cdate,book_id,sum(consume),sum(cz_h12) / sum(consume)
from market.ad_advertiser_online_pay_book_channel_day
where cdate = '2026-01-23'
group BY book_id
```