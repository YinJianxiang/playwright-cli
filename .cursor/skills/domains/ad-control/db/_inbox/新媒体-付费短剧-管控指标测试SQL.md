# 新媒体-付费短剧-管控指标测试SQL

# 新媒体-付费短剧（新媒体-短剧）

| 维度 | 库表-小时表 | 库表-天表 | 业务线 |
| --- | --- | --- | --- |
| 广告 | ad\_advertiser\_online\_pay\_promotion\_hour | ad\_advertiser\_online\_pay\_promotion\_day | xmtplay |
| 渠道 | ad\_advertiser\_online\_pay\_channel\_hour | ad\_advertiser\_online\_pay\_channel\_day | xmtplay |
| 项目 | ad\_advertiser\_online\_pay\_project\_hour | ad\_advertiser\_online\_pay\_project\_day | xmtplay |

PS：项目状态和广告状态是否为null ，null的数据不纳入统计范围

# 指标

#### 消耗：sum(consume)

#### ROI\_H2：cz\_h2,sum(cz\_h2) / sum(consume) as 'ROI\_H2'

#### ROI\_H12：cz\_h12,sum(cz\_h12) / sum(consume) as 'ROI\_H12'

#### 充值成本：也是付费成本，与看板维持一致,sum(consume)/sum(n\_recharge\_uv\_day)

#### 退订率：sum(n\_unsubscribe\_uv\_day)/sum(n\_auto\_pay\_uv\_day)

#### 转化数：sum(convert\_num)

#### 转化成本：sum(consume)/sum(convert\_num)

#### 订阅成本：sum(consume) / sum(n\_auto\_pay\_uv\_day)

#### 转化计费比：=roi系数/roi\_h12 ； roi\_goal/(sum(cz\_h12) / sum(consume))

# 时间维度

## 近2天/近3天

cdate >=当天日期-1

其中roi\_goal，取当天表，最新且存在的天维度数据

```json
select cdate,promotion_id,
sum(consume) as '消耗',
cz_h2,sum(cz_h2) / sum(consume) as 'ROI_H2',
cz_h12,sum(cz_h12) / sum(consume) as 'ROI_H12',
sum(consume)/sum(n_recharge_uv_day) as '充值成本',
sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day) as '退订率',
sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
sum(consume) / sum(n_auto_pay_uv_day) as '订阅成本',
roi_goal,sum(cz_h12) / sum(consume),roi_goal/(sum(cz_h12) / sum(consume))  as '转化计费比'
from ad_advertiser_online_pay_promotion_day
where (cdate >= '2026-01-12') AND (pline_form = 'xmtplay') 
group by promotion_id,cdate
order by promotion_id desc
```

## 当天

其中roi\_goal，取当天里，最新小时的数据

```json
select cdate,promotion_id,
sum(consume) as '消耗',
cz_h2,sum(cz_h2) / sum(consume) as 'ROI_H2',
cz_h12,sum(cz_h12) / sum(consume) as 'ROI_H12',
sum(consume)/sum(n_recharge_uv_day) as '充值成本',
sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day) as '退订率',
sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
sum(consume) / sum(n_auto_pay_uv_day) as '订阅成本',
roi_goal/(sum(cz_h12) / sum(consume))  as '转化计费比'
from ad_advertiser_online_pay_promotion_hour
where (cdate = '2026-01-12') AND (pline_form = 'xmtplay')
```

## 近1小时

sql中的hour的筛选条件，用当前时间的T-1代替

其中roi\_goal，取最新小时的值

```json
select cdate,hour,promotion_id,
sum(consume) as '消耗',
cz_h2,sum(cz_h2) / sum(consume) as 'ROI_H2',
cz_h12,sum(cz_h12) / sum(consume) as 'ROI_H12',
sum(consume)/sum(n_recharge_uv_day) as '充值成本',
sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day) as '退订率',
sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
sum(consume) / sum(n_auto_pay_uv_day) as '订阅成本',
roi_goal,sum(cz_h12) / sum(consume),roi_goal/(sum(cz_h12) / sum(consume))  as '转化计费比'
from ad_advertiser_online_pay_promotion_hour
where (cdate = '2026-01-13') AND (pline_form = 'xmtplay') and hour = 10
group by promotion_id
```

## 近2小时

sql中的hour的筛选条件，用当前时间的T-2代替

其中roi\_goal，取最新小时的值

```json
select cdate,hour,promotion_id,
sum(consume) as '消耗',
cz_h2,sum(cz_h2) / sum(consume) as 'ROI_H2',
cz_h12,sum(cz_h12) / sum(consume) as 'ROI_H12',
sum(consume)/sum(n_recharge_uv_day) as '充值成本',
sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day) as '退订率',
sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
sum(consume) / sum(n_auto_pay_uv_day) as '订阅成本',
roi_goal,sum(cz_h12) / sum(consume),roi_goal/(sum(cz_h12) / sum(consume))  as '转化计费比'
from ad_advertiser_online_pay_promotion_hour
where (cdate = '2026-01-13') AND (pline_form = 'xmtplay') and hour >= 10
group by promotion_id,hour
```

## 近6小时

sql中的hour的筛选条件，用当前时间的T-6代替

其中roi\_goal，取最新小时的值

```json
select cdate,hour,promotion_id,
sum(consume) as '消耗',
cz_h2,sum(cz_h2) / sum(consume) as 'ROI_H2',
cz_h12,sum(cz_h12) / sum(consume) as 'ROI_H12',
sum(consume)/sum(n_recharge_uv_day) as '充值成本',
sum(n_unsubscribe_uv_day)/sum(n_auto_pay_uv_day) as '退订率',
sum(convert_num) as '转化数',
sum(consume)/sum(convert_num) as '转化成本',
sum(consume) / sum(n_auto_pay_uv_day) as '订阅成本',
roi_goal,sum(cz_h12) / sum(consume),roi_goal/(sum(cz_h12) / sum(consume))  as '转化计费比'
from ad_advertiser_online_pay_promotion_hour
where (cdate = '2026-01-13') AND (pline_form = 'xmtplay') and hour >= 8 
group by promotion_id,hour
order by promotion_id desc
```

#### 是否当日上架

需要去内容中台查询,浏览数据页面确认对应短剧存在，在原始书库页面确认上架时间

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/a2QnV4jPMyPJ9O4X/img/d8631242-639b-4800-a514-f7464264a095.png)

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/a2QnV4jPMyPJ9O4X/img/69688658-9eba-4ee0-a012-3356f714c95b.png)