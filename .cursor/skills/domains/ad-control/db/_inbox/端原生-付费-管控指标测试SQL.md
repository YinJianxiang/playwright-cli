# 端原生-付费-管控指标测试SQL

# 端原生-付费

| 维度 | 库表-小时表 | 库表-天表 | 业务线 |
| --- | --- | --- | --- |
| 广告 | ad\_advertiser\_online\_pay\_promotion\_hour | ad\_advertiser\_online\_pay\_promotion\_day | cpsdy |
| 渠道 | ad\_advertiser\_online\_pay\_channel\_hour | ad\_advertiser\_online\_pay\_channel\_day | cpsdy |
| 项目 | ad\_advertiser\_online\_pay\_project\_hour | ad\_advertiser\_online\_pay\_project\_day | cpsdy |

PS：项目状态和广告状态是否为null ，null的数据不纳入统计范围

# 指标

#### 消耗：sum(consume)

#### 激活后24小时付费roi：sum(active\_pay\_intra\_one\_day\_amount)/sum(consume)

#### 转化数：sum(convert\_num)

#### 转化成本：sum(consume)/sum(convert\_num)

#### 转化计费比：roi\_goal/(sum(active\_pay\_intra\_one\_day\_amount)/sum(consume))

# 时间维度

## 近3天

访问的是天表，实时计算T和T-1天满足条件的数据

最近一天存在数据的roi\_goal字段

```json
select cdate,account,pline_form,promotion_id,sum(consume) as '消耗',
sum(active_pay_intra_one_day_amount),sum(consume),sum(active_pay_intra_one_day_amount)/sum(consume) as '● 激活后24小时付费',
sum(consume),sum(convert_num) as '转化数',sum(consume)/sum(convert_num) as '转化成本',
cz_h12,consume,sum(cz_h12) / sum(consume) as 'ROI_H12', 
roi_goal/(sum(active_pay_intra_one_day_amount)/sum(consume)) as '转化计费比'
from ad_advertiser_online_pay_promotion_day
where (cdate >= T-2 ) AND (pline_form = 'cpsdy') 
group by promotion_id,cdate 
order by project_id desc
```

## 近2天

访问的是天表，实时计算T和T-1天满足条件的数据

最近一天存在数据的roi\_goal字段

```json
select cdate,account,pline_form,promotion_id,sum(consume) as '消耗',
sum(active_pay_intra_one_day_amount),sum(consume),sum(active_pay_intra_one_day_amount)/sum(consume) as '● 激活后24小时付费',
sum(consume),sum(convert_num) as '转化数',sum(consume)/sum(convert_num) as '转化成本',
cz_h12,consume,sum(cz_h12) / sum(consume) as 'ROI_H12', 
roi_goal/(sum(active_pay_intra_one_day_amount)/sum(consume)) as '转化计费比'
from ad_advertiser_online_pay_promotion_day
where (cdate >= T-1 ) AND (pline_form = 'cpsdy') 
group by promotion_id,cdate 
order by project_id desc
```

## 当天

访问的是小时表，将当天所有的小时表对应的数据求和计算

```json
select cdate,account,pline_form,promotion_id,sum(consume) as '消耗',
sum(active_pay_intra_one_day_amount),sum(consume),sum(active_pay_intra_one_day_amount)/sum(consume) as '● 激活后24小时付费',
sum(consume),sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
cz_h12,consume,sum(cz_h12) / sum(consume) as 'ROI_H12', 
roi_goal/(sum(active_pay_intra_one_day_amount)/sum(consume)) as '转化计费比'
from ad_advertiser_online_pay_promotion_hour
where (cdate = '2026-01-12') AND (pline_form = 'cpsdy')
group by promotion_id
```

## 近1小时

访问的是小时表，将此刻T-1小时表对应的数据求和计算

```json
select cdate,hour,account,pline_form,promotion_id,sum(consume) as '消耗',
sum(active_pay_intra_one_day_amount),sum(consume),sum(active_pay_intra_one_day_amount)/sum(consume) as '● 激活后24小时付费',
sum(consume),sum(convert_num) as '转化数',sum(consume)/sum(convert_num) as '转化成本',
cz_h12,consume,sum(cz_h12) / sum(consume) as 'ROI_H12', 
roi_goal/(sum(active_pay_intra_one_day_amount)/sum(consume)) as '转化计费比'
from ad_advertiser_online_pay_promotion_hour
where (cdate = '2026-01-12') AND (pline_form = 'cpsdy') and hour = 当前小时T-1
group by promotion_id
```

## 近2小时

访问的是小时表，将此刻，大于等于T-2小时表对应的数据求和计算

最近小时的数据缺失，取数据库最新的数据计算，例如：roi\_goal字段

```json
select cdate,hour,account,pline_form,promotion_id,sum(consume) as '消耗',
sum(active_pay_intra_one_day_amount),sum(consume),sum(active_pay_intra_one_day_amount)/sum(consume) as '● 激活后24小时付费',
sum(consume),sum(convert_num) as '转化数',sum(consume)/sum(convert_num) as '转化成本',
cz_h12,consume,sum(cz_h12) / sum(consume) as 'ROI_H12', 
roi_goal/(sum(active_pay_intra_one_day_amount)/sum(consume)) as '转化计费比'
from ad_advertiser_online_pay_promotion_hour
where (cdate = '2026-01-12') AND (pline_form = 'cpsdy') and hour >= 当前小时T-2
group by promotion_id,hour
```

## 近3小时

访问的是小时表，将此刻，大于等于T-3小时表对应的数据求和计算

最近小时的数据缺失，取数据库最新的数据计算，例如：roi\_goal字段

```json
select cdate,hour,account,pline_form,promotion_id,sum(consume) as '消耗',
sum(active_pay_intra_one_day_amount),sum(consume),sum(active_pay_intra_one_day_amount)/sum(consume) as '● 激活后24小时付费',
sum(consume),sum(convert_num) as '转化数',sum(consume)/sum(convert_num) as '转化成本',
cz_h12,consume,sum(cz_h12) / sum(consume) as 'ROI_H12', 
roi_goal/(sum(active_pay_intra_one_day_amount)/sum(consume)) as '转化计费比'
from ad_advertiser_online_pay_promotion_hour
where (cdate = '2026-01-12') AND (pline_form = 'cpsdy') and hour >= 当前小时T-3
group by promotion_id,hour
```

IAA 端 = 头条端原生-免费 + 新媒体-免费短剧 = ad\_advertiser\_online\_free\_channel\_hour/day

IAP 端 = 头条端原生-付费 + 新媒体-短剧 = ad\_advertiser\_online\_pay\_channel\_hour/day