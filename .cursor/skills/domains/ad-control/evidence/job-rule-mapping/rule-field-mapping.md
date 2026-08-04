# ad_data_control_rule → Job 字段关系全量扫描

- 生成时间：2026-07-31T13:12:52.009Z
- 源码摘要：`sha256:023e094b1087fa9face2461ff8e31938e504137e61da93479d109eedd1985f63`
- 规则字段：85
- Job 中有使用：76
- 未发现 Job 使用：9

> 本报告是源码全量证据，不等于全部关系均已 verified。targetColumns 为空但有业务使用的字段必须人工核对。

| 规则字段 | DB列 | 类型 | Job语义 | 事实/关联字段 | 使用数 | 映射关系 |
|---|---|---|---|---|---:|---|
| `id` | `id` | Integer | rule-identity | - | 96 | 作为 ruleId、日志和频控 key，不过滤事实表 |
| `name` | `name` | String | rule-metadata | - | 11 | 仅用于日志和展示 |
| `dataType` | `data_type` | String | routing | `promotion_id`, `project_id`, `channel_code`, `agent_user_name` | 69 | 决定扫描维度、分组键和动作对象 |
| `plineForm` | `pline_form` | String | routing-and-direct | `pline_form` | 83 | 决定扫描函数/事实表，并写入 pline_form 条件 |
| `videoType` | `video_type` | Integer | direct-predicate | `video_type` | 2 | 非 -1 时 video_type = rule.videoType |
| `media` | `media` | Integer | rule-eligibility | - | 4 | 当前广告管控调度仅选择 MediaEnum.TT；ruleBaseCondition2Where 明确注释 media 暂时只支持头条，未追加事实表 media WHERE |
| `releaseVer` | `release_ver` | Integer | routing-and-conditional-predicate | `release_ver` | 15 | 决定 ROI3/普通表路由；特定业务线、渠道/项目维度且值为 1/2 时追加 release_ver 等值过滤 |
| `osType` | `os_type` | Integer | direct-predicate | `os_type` | 9 | 非 -1 时 os_type = rule.osType |
| `effectScope` | `effect_scope` | Integer | predicate-transform | `service_provider_name` | 4 | 1=自投：服务商为空/无；2=服务商：按 serviceProviderNames IN 或非空非无 |
| `roiCoefficientMin` | `roi_coefficient_min` | Double | having-boundary | `roi_goal` | 3 | 非 -10 时 roi_goal > min |
| `roiCoefficientMax` | `roi_coefficient_max` | Double | having-boundary | `roi_goal` | 2 | 非 -10 时 roi_goal < max；仅 max 时同时要求 roi_goal > 0 |
| `budgetMin` | `budget_min` | Double | having-boundary | `project_budget` | 2 | 非空时 project_budget > min |
| `budgetMax` | `budget_max` | Double | having-boundary | `project_budget` | 2 | 非空时 project_budget < max |
| `serviceProviderNames` | `service_provider_names` | String | list-predicate | `service_provider_name` | 3 | effectScope=2 且非 -1 时 service_provider_name IN 列表 |
| `mediaFree` | `media_free` | String | list-predicate | `media_free` | 3 | 非 -1 时 media_free IN 列表 |
| `putMode` | `put_mode` | String | value-transform-predicate | `put_mode` | 4 | 通过 PutModeEnum.getDescByValue 转为事实表中文值后等值过滤 |
| `channelUsers` | `channel_users` | String | list-or-derived-predicate | `agent_user_name` | 7 | 不限不筛；本部门全部按 creator 查部门人员；否则 agent_user_name IN 显式列表 |
| `bookUpType` | `book_up_type` | Integer | program-filter | `book_id` | 10 | 扫描后按 book_id 查询上架日期缓存，判断当日/非当日/日期范围 |
| `conditions` | `conditions` | String | metric-expression | - | 4 | 解析为时间范围、聚合方式、指标和比较条件；指标字段由 Mapper 公式矩阵决定 |
| `filterScriptLabel` | `filter_script_label` | Integer | not-used-by-job | - | 0 | 在广告管控 src/main 中未发现 DataControlRule getter 使用 |
| `copyType` | `copy_type` | Integer | not-used-by-job | - | 0 | 在广告管控 src/main 中未发现 DataControlRule getter 使用 |
| `copyConditionOld` | `copy_condition_old` | String | not-used-by-job | - | 0 | 在广告管控 src/main 中未发现 DataControlRule getter 使用 |
| `copyConditionNew` | `copy_condition_new` | String | not-used-by-job | - | 0 | 在广告管控 src/main 中未发现 DataControlRule getter 使用 |
| `doType` | `do_type` | Integer | action-control | - | 37 | 决定预警、暂停、启用、复制、删广告、改预算、改ROI/CPA等动作；ROI更新额外限制 delivery_mode=自动投放 |
| `emptyScheduleTime` | `empty_schedule_time` | String | action-parameter | - | 3 | 清空/调整投放时段动作参数，不参与事实数据扫描条件 |
| `emptyScheduleTimeToday` | `empty_schedule_time_today` | String | action-parameter | - | 1 | 当日清空投放时段动作参数，不参与事实数据扫描条件 |
| `deepExternalAction` | `deep_external_action` | String | dynamic-field-predicate | `advert_target`, `deep_conversion_type`, `deep_external_action` | 3 | syhplay 渠道→advert_target、其他维度→deep_conversion_type；其他业务→deep_external_action；次日留存转为次留 |
| `deliveryMode` | `delivery_mode` | String | direct-predicate | `delivery_mode` | 2 | 非 -1/不限时等值；doType=ROI_UPDATE 时强制自动投放 |
| `budgetUpdate` | `budget_update` | Double | action-parameter | - | 2 | 预算调整动作配置，不作为扫描事实字段 |
| `budgetChange` | `budget_change_json` | NumberChaneCondition | action-parameter | - | 2 | 预算变化 JSON 动作配置，不作为扫描事实字段 |
| `roiChange` | `roi_change_json` | NumberChaneCondition | action-parameter | - | 2 | ROI 系数调整动作配置，不作为扫描事实字段 |
| `cpaBidChange` | `cpa_bid_change_json` | CpaBidChaneCondition | action-parameter | - | 1 | CPA 出价调整动作配置，不作为扫描事实字段 |
| `rateLimitFlag` | `rate_limit_flag` | Integer | rate-limit-switch | - | 1 | 开启 ruleId+实体ID Redis 频控 |
| `restartDisabledFlag` | `restart_disabled_flag` | Integer | action-guard | - | 1 | 与 bookDataFilterFlag 联合控制是否允许重新启用 |
| `bookDataFilterRoi` | `book_data_filter_roi` | Double | program-filter-threshold | `book_id` | 4 | 书维度 ROI 阈值 |
| `bookDataFilterRoi3Day` | `book_data_filter_roi_3day` | Double | program-filter-threshold | `book_id` | 5 | 书维度近三日 ROI 阈值 |
| `bookDataFilterConsume` | `book_data_filter_consume` | Double | program-filter-threshold | `book_id`, `consume` | 6 | 书维度数据过滤的消耗阈值 |
| `bookDataFilterFlag` | `book_data_filter_flag` | Integer | program-filter-switch | `book_id` | 4 | 开启后按书维度聚合 consume/ROI 再过滤命中结果 |
| `rateLimitWindowHours` | `rate_limit_window_hours` | Integer | rate-limit-parameter | - | 1 | Redis 频控窗口小时数 |
| `rateLimitMaxCount` | `rate_limit_max_count` | Integer | rate-limit-parameter | - | 1 | 窗口内最大动作次数 |
| `bookUpDays` | `book_up_days` | Integer | program-filter-parameter | `book_id` | 4 | bookUpType=指定日期时作为开始边界 |
| `bookUpDaysEnd` | `book_up_days_end` | Integer | program-filter-parameter | `book_id` | 4 | bookUpType=指定日期时作为结束边界 |
| `placementMode` | `placement_mode` | String | list-predicate | `placement_mode` | 2 | 非 -1/不限时 placement_mode IN 列表 |
| `isNewBook` | `is_new_book` | Integer | having-predicate | `is_new_book` | 2 | 天粒度且非 -1 时 is_new_book 等值 |
| `articleType` | `article_type` | Integer | program-filter | `book_id` | 5 | 扫描后通过 book_id 的书籍缓存 articleType 比较，不直接要求事实表同名列 |
| `sex` | `sex` | Integer | program-filter | `book_id` | 3 | 扫描后通过 book_id 的书籍缓存 sex 比较，不直接要求事实表同名列 |
| `appName` | `app_name` | String | list-or-prefix-predicate | `app_name` | 3 | 客户端短剧使用 LIKE 前缀，其他业务使用 IN 列表 |
| `bookId` | `book_id` | String | list-predicate | `book_id` | 2 | 非 -1/不限时 book_id IN 列表 |
| `channelPrefix` | `channel_prefix` | String | prefix-predicate | `channel_code` | 2 | 每个前缀生成 channel_code LIKE prefix% |
| `cycleType` | `cycle_type` | Integer | schedule-gate | - | 5 | 控制每30分钟/每小时/每2小时/固定时间执行 |
| `runHours` | `run_hours` | String | schedule-gate-parameter | - | 2 | cycleType=固定时间时声明执行小时集合 |
| `skipHourRange` | `skip_hour_range` | String | schedule-gate | - | 3 | 当前小时处于跳过范围时跳过规则 |
| `effectiveDate` | `effective_date` | String | schedule-gate | - | 2 | 当前日期不在配置集合时跳过规则 |
| `status` | `status` | Integer | rule-eligibility | - | 4 | 仅 status=1 的规则进入执行 |
| `creatorId` | `creator_id` | Integer | rule-metadata | - | 1 | 创建人 ID，用于权限/审计，不作为事实扫描条件 |
| `creator` | `creator` | String | derived-filter-input | `agent_user_name` | 22 | channelUsers=本部门全部时用 creator 查询部门人员集合，间接形成 agent_user_name IN 条件 |
| `optUserName` | `opt_user_name` | String | rule-metadata | - | 1 | 最新操作人，仅审计展示 |
| `ctime` | `ctime` | Date | rule-metadata | - | 1 | 规则创建时间，仅日志/审计回填 |
| `utime` | `utime` | Date | rule-metadata | - | 1 | 规则更新时间，仅日志/审计回填 |
| `accountType` | `account_type` | Integer | direct-predicate | `account_type` | 2 | 非 -1 时 account_type = rule.accountType |
| `optStatus` | `opt_status` | Integer | dynamic-status-predicate | `promotion_status`, `project_status`, `plan_status` | 6 | 按 dataType、plineForm 与小时/天阶段转换为启停状态谓词 |
| `projectStatus` | `project_status` | Integer | dynamic-status-predicate | `project_status` | 4 | 广告维度可附加项目状态；1=非暂停/删除，2=暂停 |
| `isAnime` | `is_anime` | Integer | direct-predicate | `is_anime` | 6 | 非 -1 时等值过滤 |
| `externalAction` | `external_action` | String | direct-predicate | `external_action` | 2 | 非 -1/不限时等值过滤 |
| `raiseBudget` | `raise_budget` | BigDecimal | action-parameter | - | 1 | 预算提升动作参数，不作为扫描事实条件 |
| `raiseEndHour` | `raise_end_hour` | Integer | action-parameter | - | 1 | 预算提升结束小时，不作为扫描事实条件 |
| `roiGoal` | `roi_goal` | BigDecimal | action-parameter | `roi_goal` | 1 | ROI 调整动作目标值；扫描中的 ROI 系数过滤由 roiCoefficientMin/Max 控制 |
| `bidType` | `bid_type` | String | direct-predicate | `bid_type` | 2 | 非 -1 时等值过滤 |
| `newProjectNum` | `new_project_num` | Integer | not-used-by-job | - | 0 | 在广告管控 src/main 中未发现 DataControlRule getter 使用 |
| `createTime` | `create_time` | Integer | dynamic-time-predicate | `promotion_create_time`, `project_create_time`, `plan_create_time` | 11 | 按业务线与 dataType 选择时间字段并应用枚举时间范围 |
| `deliveryWay` | `delivery_way` | String | value-transform-predicate | `delivery_way` | 3 | 1→自动订阅，2→常规投放；xmtplay 固定排除自动订阅 |
| `bidStrategyId` | `bid_strategy_id` | Long | direct-predicate | `bid_strategy_id` | 2 | 单个 ID 优先等值过滤 |
| `bidStrategyName` | `bid_strategy_name` | String | not-used-by-job | - | 0 | 在广告管控 src/main 中未发现 DataControlRule getter 使用 |
| `bidStrategyIds` | `bid_strategy_ids` | String | list-predicate | `bid_strategy_id` | 2 | 无单值且非 -1 时 bid_strategy_id IN 列表 |
| `bidStrategyNames` | `bid_strategy_names` | String | not-used-by-job | - | 0 | 在广告管控 src/main 中未发现 DataControlRule getter 使用 |
| `mainBodys` | `main_bodys` | String | list-predicate | `main_body` | 3 | 非 -1/不限时 main_body IN 列表 |
| `ignoreBookIds` | `ignore_book_ids` | String | negative-list-predicate | `book_id` | 2 | 非 -1 时 book_id NOT IN 列表 |
| `effectiveBookIds` | `effective_book_ids` | String | list-predicate | `book_id` | 2 | 非 -1 时 book_id IN 列表 |
| `ignoreChannelCodes` | `ignore_channel_codes` | String | negative-list-predicate | `channel_code` | 2 | 非 -1 时 channel_code NOT IN 列表 |
| `ignoreAccounts` | `ignore_accounts` | String | negative-list-predicate | `account` | 2 | 非 -1 时 account NOT IN 列表 |
| `dramaType` | `drama_type` | String | list-predicate | `drama_type` | 2 | 非 -1/不限时 drama_type IN 列表 |
| `animeType` | `anime_type` | String | csv-membership-predicate | `anime_type` | 5 | 每个值生成 FIND_IN_SET(value, anime_type) |
| `idList` | `id_list` | List<Integer> | not-used-by-job | - | 0 | 在广告管控 src/main 中未发现 DataControlRule getter 使用 |
| `whereBy` | `where_by` | String | runtime-transient | - | 1 | 模型中的运行时动态 WHERE 载体，不是 ad_data_control_rule 业务输入映射 |
| `dayDimension` | `day_dimension` | boolean | not-used-by-job | - | 0 | 在广告管控 src/main 中未发现 DataControlRule getter 使用 |

## 逐字段使用位置

### id / id

- 关系：rule-identity
- 事实/关联字段：无直接事实字段
- 映射：作为 ruleId、日志和频控 key，不过滤事实表
- 使用次数：96

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:311` · action · this.setControlStrategyId(rule.getId());
- `src/main/java/com/dz/glory/job/model/AdDataControlScanPlanLog.java:148` · audit-log · this.setControlStrategyId(rule.getId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1003` · audit-log · log.info("投放管控,{}更新计算,ruleId:{},currentValue:{},mode:{},operator:{},value:{},limit:{},scale:{},result:{}", valueName, rule.getId(), currentValue, change.getMode(), change.getOperator(), change.getValue(), change.getLimit(), scale, result);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1297` · routing · jedisClient.set(ICacheKey.DB_4, channelKey, dataControlRule.getId(), 24 * 60 * 60);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1308` · audit-log · jedisClient.set(ICacheKey.DB_4, key, dataControlRule.getId(), 24 * 60 * 60);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1676` · sql-predicate · log.info("投放管控,{},强制中断,跳过执行:{}", controlJob.getTitle(), rule.getId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1688` · audit-log · log.error("投放管控,{},运行规则异常,规则ID:{}", controlJob.getTitle(), rule.getId(), e);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1738` · sql-predicate · scanPatten.setRuleId(rule.getId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1749` · action · rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(confirmedControlLogs), (System.currentTimeMillis() - startTime) / 1000);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2158` · action · log.info("投放管控,{},规则ID:{},素材起量动作,忽略项目:{}", controlJob.getTitle(), rule.getId(), dtLog.getProjectId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2204` · action · log.warn("投放管控,{},规则ID:{},复制不支持非自动批创,忽略广告:{}个,{}", controlJob.getTitle(), rule.getId(), CollectionUtils.size(ignorePromotionIds4Copy)
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2208` · action · log.warn("投放管控,{},规则ID:{},替换素材不支持非自动批创,忽略广告:{}个,{}", controlJob.getTitle(), rule.getId(), CollectionUtils.size(ignorePromotionIds4Copy)
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2261` · audit-log · rule.getId(), dtLog.getBookId(), upDate,
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2289` · audit-log · rule.getId(), dtLog.getBookId(), simpleBookVo.getBookName(), rule.getArticleType(), rule.getSex(), articleTypeMatch, sexMatch);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2325` · action · controlJob.getTitle(), rule.getId(),
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2345` · action · controlJob.getTitle(), rule.getId(),
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2394` · program-filter · controlJob.getTitle(), rule.getId(), qualified, dtLog.getBookId(),
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2572` · audit-log · log.info("投放管控,{},规则ID:{},river数据补充完成,耗时:{}ms", rule.getName(), rule.getId(), System.currentTimeMillis() - time1);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2607` · audit-log · String redisKey = rule.getId() + "_" + keyId;
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2615` · audit-log · controlJob.getTitle(), rule.getId(), dtLog.getDataType(), keyId, windowHours, currentCount, maxCount);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2626` · audit-log · controlJob.getTitle(), rule.getId(), dtLog.getDataType(), keyId, newCount);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2629` · audit-log · controlJob.getTitle(), rule.getId(), dtLog.getDataType(), keyId, e);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2736` · routing · throw DataControlException.create("ruleConditionError", String.join(",", rule.getId() + "", "规则条件错误", JsonUtil.obj2Json(rule)));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2750` · program-filter · log.warn("投放管控,规则ID:{},名称:{},仅配置了model_pred_roi(天表指标)且为小时维度,本次扫描跳过", rule.getId(), rule.getName());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2751` · program-filter · throw DataControlException.create("conditionSkip", String.join(",", rule.getId() + "", "仅配置model_pred_roi且小时维度,跳过", rule.getPlineForm()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2774` · business-logic · throw DataControlException.create("conditionSkip", String.join(",", rule.getId() + "", "00点不执行近X小时条件", ruleCondition.getTimeType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2778` · business-logic · throw DataControlException.create("conditionSkip", String.join(",", rule.getId() + "", "当前小时未满足近X小时", "聚合类型为连续", ruleCondition.getTimeType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2785` · business-logic · throw DataControlException.create("conditionSkip", String.join(",", rule.getId() + "", controlJob.getControlState().getHour() + "点不执行近X小时条件", ruleCondition.getTimeType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2788` · business-logic · throw DataControlException.create("conditionSkip", String.join(",", rule.getId() + "", "当前小时未满足近X小时", "聚合类型为连续", ruleCondition.getTimeType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2791` · business-logic · throw DataControlException.create("conditionTimeTypeError", String.join(",", rule.getId() + "", "条件数据范围错误", ruleCondition.getTimeType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2797` · sql-predicate · throw DataControlException.create("conditionColumnError", String.join(",", rule.getId() + "", "条件指标错误"));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2831` · business-logic · throw DataControlException.create("conditionReduceTypeError", String.join(",", rule.getId() + "", "条件聚合类型错误", ruleCondition.getReduceType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2840` · business-logic · throw DataControlException.create("conditionCompareValError", String.join(",", rule.getId() + "", "条件指标错误"));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2848` · business-logic · throw DataControlException.create("conditionCompareValError", String.join(",", rule.getId() + "", "条件指标错误"));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2852` · business-logic · throw DataControlException.create("conditionCompareValError", String.join(",", rule.getId() + "", "条件比较类型错误", ruleCondition.getCompareType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2903` · audit-log · log.info("投放管控,规则ID:{},model_pred_roi后置过滤,广告数:{},天表命中数:{}", rule.getId(), promoIds.size(), tmp.size());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2909` · audit-log · log.info("投放管控,规则ID:{},model_pred_roi后置过滤不通过,promotionId:{},跳过", rule.getId(), dtLog.getPromotionId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2958` · business-logic · throw DataControlException.create("conditionTimeTypeError", String.join(",", rule.getId() + "", "条件数据范围错误", ruleCondition.getTimeType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2962` · business-logic · throw DataControlException.create("conditionColumnError", String.join(",", rule.getId() + "", "条件指标错误"));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2970` · business-logic · throw DataControlException.create("conditionReduceTypeError", String.join(",", rule.getId() + "", "条件聚合类型错误", ruleCondition.getReduceType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3037` · sql-predicate · scanPatten.setRuleId(rule.getId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3066` · program-filter · log.info("投放管控河马日志,{},规则未命中数据,规则ID:{},规则名:{},动作:{},扫出数:0", controlJob.getTitle(), rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3087` · sql-predicate · log.info("投放管控河马日志,{},负责人规则命中数据,规则ID:{},规则名:{},负责人个数:{},对应项目个数:{}", controlJob.getTitle(), rule.getId(), rule.getName(), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(dataIdList));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3104` · program-filter · Set<String> hitDataIds = dataControlMapper.dataControlHitData(rule.getDataType(), cdate, rule.getId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3117` · program-filter · rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(adDataControlHmPlanLogList));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3154` · sql-predicate · log.info("投放管控扫描日志,{},强制中断,跳过执行:{}", controlJob.getTitle(), rule.getId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3167` · audit-log · log.error("投放管控扫描日志,{},运行规则异常,规则ID:{}", controlJob.getTitle(), rule.getId(), e);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3218` · sql-predicate · scanPatten.setRuleId(rule.getId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3228` · program-filter · log.info("投放管控扫描日志,{},规则未命中数据,规则ID:{},规则名:{},动作:{},扫出数:0", controlJob.getTitle(), rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3244` · audit-log · Map<String, Integer> dataIdHitRecordMap = dataControlMapper.dataControlHitRecords(rule.getDataType(), cdate, rule.getId()).stream().collect(Collectors.toMap(HitTimesDTO::getDimValue, HitTimesDTO::getHitTimes, (v1, v2) -> v2));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3252` · action · rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(adDataControlScanPlanLogList));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:213` · business-logic · throw DataControlException.create("conditionTimeTypeError", String.join(",", rule.getId() + "", "条件数据范围错误", ruleCondition.getTimeType()));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:217` · business-logic · throw DataControlException.create("conditionColumnError", String.join(",", rule.getId() + "", "条件指标错误"));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:230` · routing · throw DataControlException.create("conditionReduceTypeError", String.join(",", rule.getId() + "", "条件聚合类型错误", ruleCondition.getReduceType()));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:240` · routing · throw DataControlException.create("conditionCompareValError", String.join(",", rule.getId() + "", "条件指标错误"));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:249` · business-logic · throw DataControlException.create("conditionCompareValError", String.join(",", rule.getId() + "", "条件指标错误"));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:253` · business-logic · throw DataControlException.create("conditionCompareValError", String.join(",", rule.getId() + "", "条件比较类型错误", ruleCondition.getCompareType()));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:325` · program-filter · plineForm, rule.getCreator(), rule.getId(), e);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:330` · program-filter · ruleScanHitContext.recordRuleHits(rule.getId(), filteredBookIds);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:331` · program-filter · log.info("自动书单/剧单放量更新,规则命中详情, plineForm:{}, creator:{}, ruleId:{}, hitResult:{}", plineForm, rule.getCreator(), rule.getId(), filteredBookIds);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:374` · routing · plineForm, creator, rule.getId());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:377` · program-filter · log.info("自动书单/剧单放量更新,扫描上架时间在未来的书籍规则过滤前书籍, plineForm:{}, creator:{}, ruleId:{}, bookSize:{}", plineForm, creator, rule.getId(),candidateBookIds.size());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:385` · program-filter · log.info("自动书单/剧单放量更新,扫描上架时间在未来的书籍规则候选书籍中台没有查询到, plineForm:{}, creator:{}, ruleId:{},bookId:{}", plineForm, creator, rule.getId(), bookId);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:390` · program-filter · log.info("自动书单/剧单放量更新,规则黑名单过滤, plineForm:{}, creator:{}, ruleId:{}, bookId:{}", plineForm, rule.getCreator(), rule.getId(), bookId);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:402` · routing · plineForm, creator, rule.getId());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:440` · program-filter · log.info("自动书单/剧单放量更新,已存在书籍更新成未来上架评级, plineForm:{}, creator:{}, bookId:{}, ruleId:{}, level:{}->{}", plineForm, creator, book.getBookId(), rule.getId(), book.getExtendLevel(), ruleLevel);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:472` · routing · plineForm, creator, rule.getId(), candidateBookIds.size(), animePassedBookIds.size(), needInsert);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:529` · audit-log · rule.getId(), upDaysLeft, upDaysRight);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:648` · routing · plineForm, rule.getCreator(), rule.getId(), book.getBookId());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:655` · program-filter · log.info("校验上架天数 没从投放表查询到上架时间,ruleId:{},creator:{},bookId:{},UpDaysLeft:{},UpDaysRight:{}",rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getUpDaysLeft(), rule.getUpDaysRight());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:664` · program-filter · log.info("校验上架天数 剧没有匹配上,ruleId:{},creator:{},bookId:{},UpDaysLeft:{} ,days:{} ",rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getUpDaysLeft(), days);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:669` · program-filter · log.info("校验上架天数 剧没有匹配上,ruleId:{},creator:{},bookId:{},DaysRight:{} ,days:{} ",rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getUpDaysRight(), days);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:695` · audit-log · log.warn("校验新书 剧没有匹配上,没有查询到上架时间,,ruleId:{},creator:{},bookId:{},firstShelfDate:{} ", rule.getId(), rule.getCreator(), book.getBookId(), firstShelfDate);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:707` · audit-log · log.info("校验新书 剧没有匹配上,ruleId:{},creator:{},bookId:{},ruleBookType:{} ,bookTypeName:{} ", rule.getId(), rule.getCreator(), book.getBookId(), ruleBookType, bookTypeName);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:712` · audit-log · log.info("校验老书 剧没有匹配上,ruleId:{},creator:{},bookId:{},ruleBookType:{} ,bookTypeName:{} ", rule.getId(), rule.getCreator(), book.getBookId(), ruleBookType, bookTypeName);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:725` · program-filter · log.info("校验是短篇 剧没有匹配上,ruleId:{},creator:{},bookId:{},Rule_isShort:{} ,articleType:{} ", rule.getId(), rule.getCreator(), cacheBook.getBookId(), isShort, cacheBook.getArticleType());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:729` · program-filter · log.info("校验非短篇 剧没有匹配上,ruleId:{},creator:{},bookId:{},Rule_isShort:{} ,articleType:{} ", rule.getId(), rule.getCreator(), cacheBook.getBookId(), isShort, cacheBook.getArticleType());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:741` · program-filter · log.info("校验是否漫剧 剧没有匹配上,ruleId:{},creator:{}, bookId:{},isAnime:{} ,bookIsAnime:{},markNames:{} ", rule.getId(), rule.getCreator(), cacheBook.getBookId(), isAnime, containAnime(cacheBook.getMarkNames()), cacheBook.getMarkNames());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:755` · program-filter · log.info("校验短剧类型 剧没有匹配上,ruleId:{},creator:{}, bookId:{},dramaType:{} ,bookDramaType:{}", rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getDrama_type(), type);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:773` · program-filter · rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getAnimeType(), markNames);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:796` · routing · rule.getId(), rule.getCreator(), bookId, plineForm);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:825` · program-filter · log.info("校验篇幅没有匹配上,ruleId:{},creator:{},bookId:{},书籍篇幅:{} ,规则篇幅:{} ", rule.getId(), rule.getCreator(), cacheBook.getBookId(), cacheBook.getArticleType(), articleType);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1216` · program-filter · rule.getId(), JsonUtil.obj2Json(key), beforeRedisFilterCnt, oneSet.size(), JsonUtil.obj2Json(oneSet));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1222` · audit-log · log.info("自动书单/剧单放量更新,规则集合运算结果, ruleId:{}, finalCnt:{}, finalResult:{}", rule.getId(), internalHit.size(), JsonUtil.obj2Json(internalHit));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1248` · program-filter · rule.getId(), oneRuleBooks.size(), afterFilter.size());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1292` · audit-log · rule.getId(), rule.getAdxExposureColumn(),
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1303` · program-filter · rule.getId(), internalEmpty, hasAdxColumn, finalBookIds.size());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1534` · business-logic · if (!ruleDailyCreateLimitChecker.checkRuleDailyCreateMaxLimit(rule.getId(), rule.getDailyAdCreateMax())) {
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1539` · routing · Key hitKey = Key.get(ICacheKey.BOOK_ONEDAY_START, "autoLevelFirstHit", cdate, plineForm, creator, book.getBookId(), String.valueOf(rule.getId()), level);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1542` · routing · log.info("自动书单/剧单放量更新,评级达标去重命中(当日已触发), cdate:{}, plineForm:{}, creator:{}, bookId:{}, level:{}, ruleId:{}", cdate, plineForm, creator, book.getBookId(), level, rule.getId());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1548` · business-logic · .setDeliveryRuleId(rule.getId()).setExecutionTime("00:00").setPlineForm(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1630` · business-logic · if (rule != null && rule.getId() != null && ruleId.equals(rule.getId().longValue())) {
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1860` · audit-log · rule.getId(), conditionPlineForm, CollectionUtils.size(notInDBConditions), candidateBookIds.size(),
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1940` · business-logic · Integer ruleId = rule.getId();
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1995` · business-logic · Integer ruleId = rule.getId();
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:2064` · audit-log · Integer ruleId = rule.getId();

### name / name

- 关系：rule-metadata
- 事实/关联字段：无直接事实字段
- 映射：仅用于日志和展示
- 使用次数：11

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:312` · action · this.setControlStrategyName(rule.getName());
- `src/main/java/com/dz/glory/job/model/AdDataControlScanPlanLog.java:149` · action · this.setControlStrategyName(rule.getName());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1749` · action · rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(confirmedControlLogs), (System.currentTimeMillis() - startTime) / 1000);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2189` · audit-log · dtLog.setRuleName(rule.getName());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2572` · audit-log · log.info("投放管控,{},规则ID:{},river数据补充完成,耗时:{}ms", rule.getName(), rule.getId(), System.currentTimeMillis() - time1);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2750` · program-filter · log.warn("投放管控,规则ID:{},名称:{},仅配置了model_pred_roi(天表指标)且为小时维度,本次扫描跳过", rule.getId(), rule.getName());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3066` · program-filter · log.info("投放管控河马日志,{},规则未命中数据,规则ID:{},规则名:{},动作:{},扫出数:0", controlJob.getTitle(), rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3087` · sql-predicate · log.info("投放管控河马日志,{},负责人规则命中数据,规则ID:{},规则名:{},负责人个数:{},对应项目个数:{}", controlJob.getTitle(), rule.getId(), rule.getName(), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(dataIdList));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3117` · program-filter · rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(adDataControlHmPlanLogList));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3228` · program-filter · log.info("投放管控扫描日志,{},规则未命中数据,规则ID:{},规则名:{},动作:{},扫出数:0", controlJob.getTitle(), rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3252` · action · rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(adDataControlScanPlanLogList));

### dataType / data_type

- 关系：routing
- 事实/关联字段：promotion_id, project_id, channel_code, agent_user_name
- 映射：决定扫描维度、分组键和动作对象
- 使用次数：69

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:313` · action · this.setDataType(rule.getDataType());
- `src/main/java/com/dz/glory/job/model/AdDataControlScanPlanLog.java:151` · action · this.setDataType(rule.getDataType());
- `src/main/java/com/dz/glory/job/model/DataControlRule.java:1265` · sql-predicate · if (DataControlRule.DoTypeEnum.EMPTY_SCHEDULE_TIME.getValue().equals(rule.getDoType()) && DataTypeEnum.USER.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:391` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:399` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:408` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:417` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:425` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:434` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:443` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:451` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:459` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:467` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:475` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:483` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:491` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:499` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:507` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:515` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.USER.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:522` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:529` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:537` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:546` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:554` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:563` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:574` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:583` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:593` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:601` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:609` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:617` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.USER.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:626` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:634` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:642` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:650` · sql-predicate · .rulePredicate(rule -> DataControlRule.DataTypeEnum.USER.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1792` · sql-predicate · if (DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1815` · sql-predicate · } else if (DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1826` · sql-predicate · if (DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1934` · sql-predicate · if (DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1936` · sql-predicate · } else if (DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1956` · sql-predicate · if (DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1958` · sql-predicate · }else if (DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1963` · sql-predicate · if (DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1965` · sql-predicate · } else if (DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1971` · sql-predicate · if (DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1973` · sql-predicate · } else if (DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2010` · sql-predicate · String actionField = StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.SYH_CLT_PLAY.getAlias()) ? (DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType()) ? "advert_target" : "deep_conversion_type") : "deep_external_action";
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2066` · business-logic · && StringUtils.equalsAny(rule.getDataType(),
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2551` · audit-log · DataControlRule.DataTypeEnum.USER.getValue().equals(rule.getDataType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2560` · audit-log · List<DataControlLog> dataControlLogList = dataControlReadService.scanHmTodayData(rule.getDataType(), new ArrayList<>(dataSet));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2660` · audit-log · if (DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2662` · audit-log · /*} else if (DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2664` · audit-log · } else if (DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2666` · action · } else if (DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2803` · sql-predicate · //                    .map(column -> column.replaceAll("_data_d_predict_roi", CustomSqlUtil.ClientPredictRoiSql(rule.getDataType())))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3059` · program-filter · List<DataControlLog> initDataControlLogsBySql =   dataControlReadService.scanData4HmLog(rule.getPlineForm(), rule.getDataType(), scanPatten);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3075` · audit-log · if (DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3077` · audit-log · } else if (DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3079` · audit-log · } else if (DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3081` · sql-predicate · } else if (DataControlRule.DataTypeEnum.USER.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3095` · audit-log · adDataControlHmPlanLogList.addAll(PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm()) ? adDataPlanLogLoadService.hmLog4PromotionDetail(rule.getDataType(), cdate, dataIds) : adDataPlanLogLoadService.clientAppLog4PromotionDetail(rule.getDataType(), cdate, dataIds));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3104` · program-filter · Set<String> hitDataIds = dataControlMapper.dataControlHitData(rule.getDataType(), cdate, rule.getId());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3105` · program-filter · if (DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3107` · program-filter · } else if (DataControlRule.DataTypeEnum.PROJECT.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3109` · program-filter · } else if (DataControlRule.DataTypeEnum.PROMOTION.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3111` · program-filter · } else if (DataControlRule.DataTypeEnum.USER.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3221` · sql-predicate · List<DataControlLog> initDataControlLogsBySql = useAdbData ? dataControlReadService.scanData4LogAdb(rule.getPlineForm(), rule.getDataType(), scanPatten) : dataControlReadService.scanData4Log(rule.getPlineForm(), rule.getDataType(), scanPatten);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3237` · audit-log · adDataControlScanPlanLogList.addAll(useAdbData ? adDataPlanLogLoadService.scanLog4PromotionDetailAdb(rule.getPlineForm(),rule.getDataType(), cdate, dataIds) : adDataPlanLogLoadService.scanLog4PromotionDetail(rule.getPlineForm(),rule.getDataType(), cdate, dataIds));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3244` · audit-log · Map<String, Integer> dataIdHitRecordMap = dataControlMapper.dataControlHitRecords(rule.getDataType(), cdate, rule.getId()).stream().collect(Collectors.toMap(HitTimesDTO::getDimValue, HitTimesDTO::getHitTimes, (v1, v2) -> v2));

### plineForm / pline_form

- 关系：routing-and-direct
- 事实/关联字段：pline_form
- 映射：决定扫描函数/事实表，并写入 pline_form 条件
- 使用次数：83

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:314` · action · this.setPlineForm(rule.getPlineForm());
- `src/main/java/com/dz/glory/job/model/AdDataControlScanPlanLog.java:152` · action · this.setPlineForm(rule.getPlineForm());
- `src/main/java/com/dz/glory/job/model/DataControlRule.java:1262` · sql-predicate · plineForm = rule.getPlineForm();
- `src/main/java/com/dz/glory/job/model/DataControlRule.java:1264` · sql-predicate · if (StringUtils.equals(PlineEnum.SYH_CLT_PLAY.getAlias(), rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/schedule/DataControlHmLogSchedule.java:62` · program-filter · StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.SYH_CLT_PLAY.getAlias(), PlineEnum.CLIENT.getAlias(), PlineEnum.CLT_PLAY.getAlias()))
- `src/main/java/com/dz/glory/job/schedule/DataControlScanLogSchedule.java:60` · program-filter · StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.XMT_PLAY.getAlias(), PlineEnum.CPS_VIDEO_MF.getAlias(), PlineEnum.CPS_SHORT.getAlias(), PlineEnum.CPS_DY.getAlias(), PlineEnum.CPS_DY_FREE.getAlias(), PlineEnum.CPS_FREE.getAlias()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:392` · sql-predicate · && PlineEnum.XMT_PLAY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:400` · sql-predicate · && PlineEnum.XMT_PLAY.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:409` · sql-predicate · && PlineEnum.XMT_PLAY.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:418` · sql-predicate · && PlineEnum.CPS_VIDEO_MF.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:426` · sql-predicate · && PlineEnum.CPS_VIDEO_MF.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:435` · sql-predicate · && PlineEnum.CPS_VIDEO_MF.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:444` · sql-predicate · && PlineEnum.CPS_SHORT.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:452` · sql-predicate · && PlineEnum.CPS_SHORT.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:460` · sql-predicate · && PlineEnum.CPS_SHORT.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:468` · sql-predicate · && PlineEnum.CPS_FREE.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:476` · sql-predicate · && PlineEnum.CPS_FREE.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:484` · sql-predicate · && PlineEnum.CPS_FREE.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:492` · sql-predicate · && PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:500` · sql-predicate · && PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:508` · sql-predicate · && PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:516` · sql-predicate · && PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:523` · sql-predicate · && PlineEnum.CPS_DY_FREE.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:530` · sql-predicate · && PlineEnum.CPS_DY_FREE.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:538` · sql-predicate · && PlineEnum.CPS_DY_FREE.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:547` · sql-predicate · && PlineEnum.CPS_DY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:555` · sql-predicate · && PlineEnum.CPS_DY.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:564` · sql-predicate · && PlineEnum.CPS_DY.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:575` · sql-predicate · && StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.XMT_PLAY.getAlias(), PlineEnum.CPS_DY.getAlias(), PlineEnum.CPS_DY_FREE.getAlias(), PlineEnum.CPS_VIDEO_MF.getAlias())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:584` · sql-predicate · && StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.XMT_PLAY.getAlias(), PlineEnum.CPS_DY.getAlias(), PlineEnum.CPS_DY_FREE.getAlias(), PlineEnum.CPS_VIDEO_MF.getAlias())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:594` · sql-predicate · && PlineEnum.CLIENT.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:602` · sql-predicate · && PlineEnum.CLIENT.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:610` · sql-predicate · && PlineEnum.CLIENT.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:618` · sql-predicate · && PlineEnum.CLIENT.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:627` · sql-predicate · && PlineEnum.CLT_PLAY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:635` · sql-predicate · && PlineEnum.CLT_PLAY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:643` · sql-predicate · && PlineEnum.CLT_PLAY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:651` · sql-predicate · && PlineEnum.CLT_PLAY.getAlias().equals(rule.getPlineForm()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1741` · sql-predicate · scanPatten.setPlineForm(rule.getPlineForm());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1794` · sql-predicate · if (PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1804` · sql-predicate · if (PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1915` · sql-predicate · if (rule.getDeliveryWay() != null && !StringUtils.equals(rule.getDeliveryWay(), "-1") && !PlineEnum.XMT_PLAY.getAlias().equals(rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1922` · sql-predicate · if (rule.getPlineForm().equals(PlineEnum.XMT_PLAY.getAlias())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1932` · sql-predicate · if (StringUtils.equalsAny(rule.getPlineForm(),PlineEnum.SYH_CLT_PLAY.getAlias(), PlineEnum.CLIENT.getAlias(),PlineEnum.CLT_PLAY.getAlias())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1933` · sql-predicate · String promotionField = PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm()) ? "plan_create_time" : "promotion_create_time";
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2010` · sql-predicate · String actionField = StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.SYH_CLT_PLAY.getAlias()) ? (DataControlRule.DataTypeEnum.CHANNEL.getValue().equals(rule.getDataType()) ? "advert_target" : "deep_conversion_type") : "deep_external_action";
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2041` · sql-predicate · if (StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.CLT_PLAY.getAlias())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2069` · business-logic · && StringUtils.equalsAny(rule.getPlineForm(),
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2111` · audit-log · if(StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.SYH_CLT_PLAY.getAlias(), PlineEnum.CPS_VIDEO_MF.getAlias(),
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2221` · audit-log · if (PlineEnum.useDbUpdate(rule.getPlineForm())){
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2315` · action · if (StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.CPS_SHORT.getAlias(), PlineEnum.CPS_FREE.getAlias(), PlineEnum.CLIENT.getAlias())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2332` · action · } else if (StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.CPS_VIDEO_MF.getAlias(),
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2362` · program-filter · ConcurrentHashMap<String, BookDataControlFilterDTO> bookDataMap = controlJob.getControlState().getBookConsumeRoiDataByPline().get(rule.getPlineForm());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2374` · program-filter · if (StringUtils.equalsAny(rule.getPlineForm(),PlineEnum.CPS_SHORT.getAlias(),PlineEnum.CPS_FREE.getAlias(),PlineEnum.CLIENT.getAlias(),PlineEnum.CLT_PLAY.getAlias())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2385` · program-filter · && StringUtils.equalsAny(rule.getPlineForm(),
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2395` · program-filter · rule.getPlineForm(), bookData.getPlineFormRoi(), bookData.getD1Roi(), bookData.getD2Roi(),
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2486` · program-filter · if (PlineEnum.useDbUpdate(rule.getPlineForm())){
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2488` · program-filter · String plineDate = rule.getPlineForm().concat(today);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2504` · business-logic · List<BookUpDateDTO> list = StringUtils.equalsAny(rule.getPlineForm(),PlineEnum.CPS_SHORT.getAlias(),PlineEnum.CPS_FREE.getAlias()) ? dataControlReadService.queryUpDateChannelByBook(rule.getPlineForm(),batch) : dataControlReadService.queryUpDateChannelByBookAdb(rule.getPlineForm(),batch);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2549` · audit-log · !StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.SYH_CLT_PLAY.getAlias()) \|\|
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2650` · action · if (PlineEnum.CPS_SHORT.getAlias().equals(rule.getPlineForm()) \|\| PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2651` · action · \|\| PlineEnum.CPS_DY.getAlias().equals(rule.getPlineForm()) \|\| PlineEnum.CPS_DY_FREE.getAlias().equals(rule.getPlineForm())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2652` · action · \|\| PlineEnum.XMT_PLAY.getAlias().equals(rule.getPlineForm()) \|\| PlineEnum.CPS_VIDEO_MF.getAlias().equals(rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2738` · sql-predicate · if (calTableDimension(rule) == DataControlRule.TableDimension.DAY && PlineEnum.isClientPline(rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2744` · sql-predicate · && isModelPredRoiPline(rule.getPlineForm());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2751` · program-filter · throw DataControlException.create("conditionSkip", String.join(",", rule.getId() + "", "仅配置model_pred_roi且小时维度,跳过", rule.getPlineForm()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2800` · sql-predicate · //        if (StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.CLIENT.getAlias(), PlineEnum.CLT_PLAY.getAlias()) && !rule.isDayDimension() && columnList.stream().anyMatch(column -> column.equals("_data_d_predict_roi"))) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2865` · program-filter · if (!isModelPredRoiPline(rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2892` · business-logic · List<ModelPredRoiDTO> rows = dataControlReadService.selectModelPredRoiMap(rule.getPlineForm(), cdate, batch);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2984` · routing · if (PlineEnum.isClientPline(rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3047` · business-logic · channelUserSet = controlState.getLeaderFindChannelUserMap().computeIfAbsent("不限", k -> dataControlReadService.allAgentUserList(rule.getPlineForm(), cdate));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3059` · program-filter · List<DataControlLog> initDataControlLogsBySql =   dataControlReadService.scanData4HmLog(rule.getPlineForm(), rule.getDataType(), scanPatten);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3084` · sql-predicate · List<DataControlLog> projectByAgentUserName = dataControlReadService.getHmProjectByAgentUserName(rule.getPlineForm(), scanPatten.getWhereBy(), dataControlLog.getAgentUserName());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3095` · audit-log · adDataControlHmPlanLogList.addAll(PlineEnum.SYH_CLT_PLAY.getAlias().equals(rule.getPlineForm()) ? adDataPlanLogLoadService.hmLog4PromotionDetail(rule.getDataType(), cdate, dataIds) : adDataPlanLogLoadService.clientAppLog4PromotionDetail(rule.getDataType(), cdate, dataIds));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3198` · sql-predicate · boolean useAdbData = !StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.CPS_SHORT.getAlias(), PlineEnum.CPS_FREE.getAlias());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3221` · sql-predicate · List<DataControlLog> initDataControlLogsBySql = useAdbData ? dataControlReadService.scanData4LogAdb(rule.getPlineForm(), rule.getDataType(), scanPatten) : dataControlReadService.scanData4Log(rule.getPlineForm(), rule.getDataType(), scanPatten);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3237` · audit-log · adDataControlScanPlanLogList.addAll(useAdbData ? adDataPlanLogLoadService.scanLog4PromotionDetailAdb(rule.getPlineForm(),rule.getDataType(), cdate, dataIds) : adDataPlanLogLoadService.scanLog4PromotionDetail(rule.getPlineForm(),rule.getDataType(), cdate, dataIds));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:549` · business-logic · if (StringUtils.isBlank(rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:554` · business-logic · if (StringUtils.equalsAny(rule.getPlineForm(), PlineEnum.CLT_PLAY.getAlias(), PlineEnum.SYH_CLT_PLAY.getAlias())) {
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:556` · business-logic · Collections.singletonList(rule.getPlineForm()),
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:560` · program-filter · Collections.singletonList(rule.getPlineForm()),
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1312` · business-logic · String conditionPlineForm = StringUtils.defaultIfBlank(cond.getPlineForm(), rule.getPlineForm());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1548` · business-logic · .setDeliveryRuleId(rule.getId()).setExecutionTime("00:00").setPlineForm(rule.getPlineForm())

### videoType / video_type

- 关系：direct-predicate
- 事实/关联字段：video_type
- 映射：非 -1 时 video_type = rule.videoType
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1858` · sql-predicate · if (rule.getVideoType() != null && rule.getVideoType() != -1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1859` · sql-predicate · whereBy.append(" and video_type ='").append(rule.getVideoType()).append("'");

### media / media

- 关系：rule-eligibility
- 事实/关联字段：无直接事实字段
- 映射：当前广告管控调度仅选择 MediaEnum.TT；ruleBaseCondition2Where 明确注释 media 暂时只支持头条，未追加事实表 media WHERE
- 使用次数：4

- `src/main/java/com/dz/glory/job/schedule/DataControlHmLogSchedule.java:61` · program-filter · Objects.equals(rule.getStatus(), 1) && Objects.equals(rule.getMedia(), MediaEnum.TT.getVal()) &&
- `src/main/java/com/dz/glory/job/schedule/DataControlScanLogSchedule.java:59` · program-filter · Objects.equals(rule.getStatus(), 1) && Objects.equals(rule.getMedia(), MediaEnum.TT.getVal()) &&
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1655` · program-filter · .filter(r -> MediaEnum.TT.getVal() == r.getMedia()
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3135` · program-filter · .filter(r -> MediaEnum.TT.getVal() == r.getMedia()

### releaseVer / release_ver

- 关系：routing-and-conditional-predicate
- 事实/关联字段：release_ver
- 映射：决定 ROI3/普通表路由；特定业务线、渠道/项目维度且值为 1/2 时追加 release_ver 等值过滤
- 使用次数：15

- `src/main/java/com/dz/glory/job/service/DataControlService.java:401` · sql-predicate · && !Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:410` · sql-predicate · && !Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:427` · sql-predicate · && !Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:436` · sql-predicate · && !Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:531` · sql-predicate · && !Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:539` · sql-predicate · && !Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:556` · sql-predicate · && !Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:565` · sql-predicate · && !Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:576` · sql-predicate · && Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:585` · sql-predicate · && Integer.valueOf(3).equals(rule.getReleaseVer()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2064` · sql-predicate · if (rule.getReleaseVer() != null && rule.getReleaseVer() != -1
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2065` · sql-predicate · && (rule.getReleaseVer() == 1 \|\| rule.getReleaseVer() == 2)
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2075` · sql-predicate · whereBy.append(" and release_ver = ").append(rule.getReleaseVer()).append(" ");
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2995` · routing · } else if (!Integer.valueOf(3).equals(rule.getReleaseVer()) && ruleConditions.stream().anyMatch(rc -> StringUtils.equalsAny(
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3004` · routing · } else if ((Integer.valueOf(3).equals(rule.getReleaseVer()) && ruleConditions.stream().anyMatch(rc -> StringUtils.equalsAny(

### osType / os_type

- 关系：direct-predicate
- 事实/关联字段：os_type
- 映射：非 -1 时 os_type = rule.osType
- 使用次数：9

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:317` · action · this.setControlOsType(rule.getOsType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1980` · sql-predicate · if (rule.getOsType() != null && rule.getOsType() != -1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1981` · sql-predicate · whereBy.append(" and os_type = ").append("'").append(rule.getOsType()).append("'");
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:157` · sql-predicate · Integer osType = rule.getOsType();
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1450` · business-logic · Integer ruleOsType = rule.getOsType();
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1500` · program-filter · .filter(rule -> Objects.equals(osType, rule.getOsType()))
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1652` · business-logic · return ruleId + "(osType=" + rule.getOsType() + ",level=" + rule.getExtendLevel() + ")";
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1793` · business-logic · Integer rulePlatformType = rule.getOsType();
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1844` · business-logic · Double predictRoi = getPredictRoiFromRedis(condition.getTimeType(), conditionPlineForm, bookId, rule.getOsType());

### effectScope / effect_scope

- 关系：predicate-transform
- 事实/关联字段：service_provider_name
- 映射：1=自投：服务商为空/无；2=服务商：按 serviceProviderNames IN 或非空非无
- 使用次数：4

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:321` · audit-log · //        this.setControlEffectScope(rule.getEffectScope());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1984` · sql-predicate · if (rule.getEffectScope() != null && rule.getEffectScope() != -1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1985` · sql-predicate · if (rule.getEffectScope() == 1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1987` · sql-predicate · } else if (rule.getEffectScope() == 2) {

### roiCoefficientMin / roi_coefficient_min

- 关系：having-boundary
- 事实/关联字段：roi_goal
- 映射：非 -10 时 roi_goal > min
- 使用次数：3

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1771` · business-logic · if (rule.getRoiCoefficientMin() != null && rule.getRoiCoefficientMin() != -10D) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1772` · business-logic · havingBy.append(" and roi_goal > ").append("'").append(rule.getRoiCoefficientMin()).append("' ");
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1776` · business-logic · if (rule.getRoiCoefficientMin() == null \|\| rule.getRoiCoefficientMin() == -10D) {

### roiCoefficientMax / roi_coefficient_max

- 关系：having-boundary
- 事实/关联字段：roi_goal
- 映射：非 -10 时 roi_goal < max；仅 max 时同时要求 roi_goal > 0
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1774` · business-logic · if (rule.getRoiCoefficientMax() != null && rule.getRoiCoefficientMax() != -10D) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1775` · business-logic · havingBy.append(" and roi_goal < ").append("'").append(rule.getRoiCoefficientMax()).append("' ");

### budgetMin / budget_min

- 关系：having-boundary
- 事实/关联字段：project_budget
- 映射：非空时 project_budget > min
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1781` · action · if (rule.getBudgetMin() != null) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1782` · action · havingBy.append(" and project_budget > ").append("'").append(rule.getBudgetMin()).append("' ");

### budgetMax / budget_max

- 关系：having-boundary
- 事实/关联字段：project_budget
- 映射：非空时 project_budget < max
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1784` · action · if (rule.getBudgetMax() != null) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1785` · sql-predicate · havingBy.append(" and project_budget < ").append("'").append(rule.getBudgetMax()).append("' ");

### serviceProviderNames / service_provider_names

- 关系：list-predicate
- 事实/关联字段：service_provider_name
- 映射：effectScope=2 且非 -1 时 service_provider_name IN 列表
- 使用次数：3

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:322` · audit-log · this.setControlServiceProviderNames(rule.getServiceProviderNames());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1989` · sql-predicate · if (StringUtils.isNotBlank(rule.getServiceProviderNames()) && !StringUtils.equals(rule.getServiceProviderNames(), "-1")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1990` · sql-predicate · whereBy.append(" and service_provider_name in (").append(Arrays.stream(rule.getServiceProviderNames().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### mediaFree / media_free

- 关系：list-predicate
- 事实/关联字段：media_free
- 映射：非 -1 时 media_free IN 列表
- 使用次数：3

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:318` · action · this.setControlMediaFree(rule.getMediaFree());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2000` · sql-predicate · if (StringUtils.isNotBlank(rule.getMediaFree()) && !"-1".equals(rule.getMediaFree())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2001` · sql-predicate · whereBy.append(" and media_free in (").append(Arrays.stream(rule.getMediaFree().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### putMode / put_mode

- 关系：value-transform-predicate
- 事实/关联字段：put_mode
- 映射：通过 PutModeEnum.getDescByValue 转为事实表中文值后等值过滤
- 使用次数：4

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:319` · action · this.setControlPutMode(rule.getPutMode());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1997` · sql-predicate · if (StringUtils.isNotBlank(rule.getPutMode()) && !"-1".equals(rule.getPutMode())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1998` · sql-predicate · whereBy.append(" and put_mode = ").append("'").append(PutModeEnum.getDescByValue(rule.getPutMode())).append("' ");
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:166` · sql-predicate · String putMode = rule.getPutMode();

### channelUsers / channel_users

- 关系：list-or-derived-predicate
- 事实/关联字段：agent_user_name
- 映射：不限不筛；本部门全部按 creator 查部门人员；否则 agent_user_name IN 显式列表
- 使用次数：7

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:316` · action · this.setControlChannelUsers(rule.getChannelUsers());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1863` · sql-predicate · if (StringUtils.equals(rule.getChannelUsers(), "本部门全部")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1868` · sql-predicate · } else if (!StringUtils.equals(rule.getChannelUsers(), "不限")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1869` · sql-predicate · whereBy.append(" and agent_user_name in (").append(Arrays.stream(rule.getChannelUsers().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3042` · action · if (StringUtils.equals(rule.getChannelUsers(), "本部门全部")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3046` · business-logic · } else if (StringUtils.equals(rule.getChannelUsers(), "不限")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3049` · business-logic · channelUserSet = Arrays.stream(rule.getChannelUsers().split(",")).collect(Collectors.toSet());

### bookUpType / book_up_type

- 关系：program-filter
- 事实/关联字段：book_id
- 映射：扫描后按 book_id 查询上架日期缓存，判断当日/非当日/日期范围
- 使用次数：10

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:328` · audit-log · //        this.setControlBookUpType(rule.getBookUpType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2087` · program-filter · boolean checkBookUpToday = rule.getBookUpType() != null && DataControlRule.BookUpTypeEnum.TODAY.getValue().equals(rule.getBookUpType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2088` · program-filter · boolean checkBookUpNoToday = rule.getBookUpType() != null && DataControlRule.BookUpTypeEnum.NOT_TODAY.getValue().equals(rule.getBookUpType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2089` · program-filter · boolean checkBookUpDays = rule.getBookUpType() != null && rule.getBookUpType().equals(DataControlRule.BookUpTypeEnum.DAYS.getValue()) && rule.getBookUpDays() != null && rule.getBookUpDaysEnd() != null;
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3021` · sql-predicate · boolean checkBookUpToday = rule.getBookUpType() != null && DataControlRule.BookUpTypeEnum.TODAY.getValue().equals(rule.getBookUpType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3022` · sql-predicate · boolean checkBookUpNoToday = rule.getBookUpType() != null && DataControlRule.BookUpTypeEnum.NOT_TODAY.getValue().equals(rule.getBookUpType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3023` · sql-predicate · boolean checkBookUpDays = rule.getBookUpType() != null && rule.getBookUpType().equals(DataControlRule.BookUpTypeEnum.DAYS.getValue()) && rule.getBookUpDays() != null && rule.getBookUpDaysEnd() != null;
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3201` · sql-predicate · boolean checkBookUpToday = rule.getBookUpType() != null && DataControlRule.BookUpTypeEnum.TODAY.getValue().equals(rule.getBookUpType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3202` · sql-predicate · boolean checkBookUpNoToday = rule.getBookUpType() != null && DataControlRule.BookUpTypeEnum.NOT_TODAY.getValue().equals(rule.getBookUpType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3203` · sql-predicate · boolean checkBookUpDays = rule.getBookUpType() != null && rule.getBookUpType().equals(DataControlRule.BookUpTypeEnum.DAYS.getValue()) && rule.getBookUpDays() != null && rule.getBookUpDaysEnd() != null;

### conditions / conditions

- 关系：metric-expression
- 事实/关联字段：无直接事实字段
- 映射：解析为时间范围、聚合方式、指标和比较条件；指标字段由 Mapper 公式矩阵决定
- 使用次数：4

- `src/main/java/com/dz/glory/job/model/DataControlRule.java:1259` · sql-predicate · List<DataControlRule.RuleCondition> ruleConditions = JsonUtil.readValue(rule.getConditions(), new TypeReference<List<RuleCondition>>() {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2733` · business-logic · List<DataControlRule.RuleCondition> ruleConditions = JsonUtil.readValue(rule.getConditions(), new TypeReference<List<DataControlRule.RuleCondition>>() {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2879` · program-filter · List<DataControlRule.RuleCondition> allConditions = JsonUtil.readValue(rule.getConditions(), new TypeReference<List<DataControlRule.RuleCondition>>() {});
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2980` · routing · rule.getConditions(), new TypeReference<List<DataControlRule.RuleCondition>>() {

### filterScriptLabel / filter_script_label

- 关系：not-used-by-job
- 事实/关联字段：无直接事实字段
- 映射：在广告管控 src/main 中未发现 DataControlRule getter 使用
- 使用次数：0

- 未在 src/main Java/XML 中发现 getter 使用。

### copyType / copy_type

- 关系：not-used-by-job
- 事实/关联字段：无直接事实字段
- 映射：在广告管控 src/main 中未发现 DataControlRule getter 使用
- 使用次数：0

- 未在 src/main Java/XML 中发现 getter 使用。

### copyConditionOld / copy_condition_old

- 关系：not-used-by-job
- 事实/关联字段：无直接事实字段
- 映射：在广告管控 src/main 中未发现 DataControlRule getter 使用
- 使用次数：0

- 未在 src/main Java/XML 中发现 getter 使用。

### copyConditionNew / copy_condition_new

- 关系：not-used-by-job
- 事实/关联字段：无直接事实字段
- 映射：在广告管控 src/main 中未发现 DataControlRule getter 使用
- 使用次数：0

- 未在 src/main Java/XML 中发现 getter 使用。

### doType / do_type

- 关系：action-control
- 事实/关联字段：无直接事实字段
- 映射：决定预警、暂停、启用、复制、删广告、改预算、改ROI/CPA等动作；ROI更新额外限制 delivery_mode=自动投放
- 使用次数：37

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:315` · action · this.setDoType(rule.getDoType());
- `src/main/java/com/dz/glory/job/model/AdDataControlScanPlanLog.java:153` · routing · this.setDoType(rule.getDoType());
- `src/main/java/com/dz/glory/job/model/DataControlRule.java:1265` · sql-predicate · if (DataControlRule.DoTypeEnum.EMPTY_SCHEDULE_TIME.getValue().equals(rule.getDoType()) && DataTypeEnum.USER.getValue().equals(rule.getDataType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1739` · sql-predicate · scanPatten.setDoType(rule.getDoType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1749` · action · rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(confirmedControlLogs), (System.currentTimeMillis() - startTime) / 1000);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1881` · sql-predicate · /*if (DataControlRule.DoTypeEnum.COPY.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2026` · sql-predicate · if (DataControlRule.DoTypeEnum.ROI_UPDATE.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2099` · program-filter · if (DataControlRule.DoTypeEnum.MATERIAL_RAISE.getValue().equals(rule.getDoType())){
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2148` · action · if (DataControlRule.DoTypeEnum.COPY.getValue().equals(rule.getDoType()) && Objects.isNull(dtLog.getBidStrategyId())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2152` · action · if (DataControlRule.DoTypeEnum.REPLACE_MATERIAL.getValue().equals(rule.getDoType()) && Objects.isNull(dtLog.getBidStrategyId())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2156` · action · if (DataControlRule.DoTypeEnum.MATERIAL_RAISE.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2203` · action · if (CollectionUtils.isNotEmpty(ignorePromotionIds4Copy) && DataControlRule.DoTypeEnum.COPY.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2207` · action · if (CollectionUtils.isNotEmpty(ignorePromotionIds4ReplaceMaterial) && DataControlRule.DoTypeEnum.REPLACE_MATERIAL.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2317` · action · if (DataControlRule.DoTypeEnum.START.getValue().equals(rule.getDoType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2318` · action · \|\| DataControlRule.DoTypeEnum.COPY.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2335` · action · if (DataControlRule.DoTypeEnum.START.getValue().equals(rule.getDoType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2336` · action · \|\| DataControlRule.DoTypeEnum.COPY.getValue().equals(rule.getDoType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2337` · action · \|\| DataControlRule.DoTypeEnum.ROI_UPDATE.getValue().equals(rule.getDoType())
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2338` · action · \|\| DataControlRule.DoTypeEnum.MATERIAL_RAISE.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2649` · action · if (DataControlRule.DoTypeEnum.WARN.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2669` · action · } else if (DataControlRule.DoTypeEnum.STOP.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2672` · action · } else if (DataControlRule.DoTypeEnum.START.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2674` · action · } else if (DataControlRule.DoTypeEnum.COPY.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2677` · action · } else if (DataControlRule.DoTypeEnum.REPLACE_MATERIAL.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2680` · action · } else if (DataControlRule.DoTypeEnum.DEL.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2682` · action · } else if (DataControlRule.DoTypeEnum.EMPTY_SCHEDULE_TIME.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2685` · action · } else if (DataControlRule.DoTypeEnum.CPABID_UPDATE.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2688` · action · }  else if (DataControlRule.DoTypeEnum.ROI_UPDATE.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2694` · action · }else if (DataControlRule.DoTypeEnum.MATERIAL_RAISE.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2700` · action · } else if (DataControlRule.DoTypeEnum.BUDGET_UPDATE.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2706` · action · } else if (DataControlRule.DoTypeEnum.ALL_SCHEDULE_TIME.getValue().equals(rule.getDoType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3038` · sql-predicate · scanPatten.setDoType(rule.getDoType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3066` · program-filter · log.info("投放管控河马日志,{},规则未命中数据,规则ID:{},规则名:{},动作:{},扫出数:0", controlJob.getTitle(), rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3117` · program-filter · rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(adDataControlHmPlanLogList));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3219` · sql-predicate · scanPatten.setDoType(rule.getDoType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3228` · program-filter · log.info("投放管控扫描日志,{},规则未命中数据,规则ID:{},规则名:{},动作:{},扫出数:0", controlJob.getTitle(), rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3252` · action · rule.getId(), rule.getName(), DataControlRule.DoTypeEnum.getDescByValue(rule.getDoType()), CollectionUtils.size(initDataControlLogsBySql), CollectionUtils.size(adDataControlScanPlanLogList));

### emptyScheduleTime / empty_schedule_time

- 关系：action-parameter
- 事实/关联字段：无直接事实字段
- 映射：清空/调整投放时段动作参数，不参与事实数据扫描条件
- 使用次数：3

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:334` · audit-log · //        this.setControlEmptyScheduleTime(rule.getEmptyScheduleTime());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1187` · audit-log · String scheduleTIme = ScheduleTimeUtils.generateWeeklyTimeSlotString(rule.getEmptyScheduleTime(),rule.getEmptyScheduleTimeToday());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1188` · audit-log · Date scheduleEndTIme = ScheduleTimeUtils.generateEndTime(rule.getEmptyScheduleTime());

### emptyScheduleTimeToday / empty_schedule_time_today

- 关系：action-parameter
- 事实/关联字段：无直接事实字段
- 映射：当日清空投放时段动作参数，不参与事实数据扫描条件
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1187` · audit-log · String scheduleTIme = ScheduleTimeUtils.generateWeeklyTimeSlotString(rule.getEmptyScheduleTime(),rule.getEmptyScheduleTimeToday());

### deepExternalAction / deep_external_action

- 关系：dynamic-field-predicate
- 事实/关联字段：advert_target, deep_conversion_type, deep_external_action
- 映射：syhplay 渠道→advert_target、其他维度→deep_conversion_type；其他业务→deep_external_action；次日留存转为次留
- 使用次数：3

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2009` · sql-predicate · if (StringUtils.isNotBlank(rule.getDeepExternalAction()) && !"-1".equals(rule.getDeepExternalAction()) && !"不限".equals(rule.getDeepExternalAction())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2011` · sql-predicate · if ("无".equals(rule.getDeepExternalAction())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2014` · sql-predicate · whereBy.append(" and ").append(actionField).append(" = ").append("'").append(StringUtils.equals("次日留存", rule.getDeepExternalAction()) ? "次留" : rule.getDeepExternalAction()).append("' ");

### deliveryMode / delivery_mode

- 关系：direct-predicate
- 事实/关联字段：delivery_mode
- 映射：非 -1/不限时等值；doType=ROI_UPDATE 时强制自动投放
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2018` · sql-predicate · if (StringUtils.isNotBlank(rule.getDeliveryMode()) && !"-1".equals(rule.getDeliveryMode()) && !"不限".equals(rule.getDeliveryMode())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2019` · sql-predicate · whereBy.append(" and delivery_mode = ").append("'").append(rule.getDeliveryMode()).append("' ");

### budgetUpdate / budget_update

- 关系：action-parameter
- 事实/关联字段：无直接事实字段
- 映射：预算调整动作配置，不作为扫描事实字段
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:926` · action · if (rule != null && rule.getBudgetUpdate() != null) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:927` · action · return normalizeDecimal(rule.getBudgetUpdate(), 2);

### budgetChange / budget_change_json

- 关系：action-parameter
- 事实/关联字段：无直接事实字段
- 映射：预算变化 JSON 动作配置，不作为扫描事实字段
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:894` · action · if (dataControlLog != null && dataControlRule.getBudgetChange() != null && (dataControlLog.getProjectBudget() == null \|\| dataControlLog.getProjectBudget() <= 0)) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:931` · action · rule != null ? rule.getBudgetChange() : null,

### roiChange / roi_change_json

- 关系：action-parameter
- 事实/关联字段：无直接事实字段
- 映射：ROI 系数调整动作配置，不作为扫描事实字段
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:777` · audit-log · if (dataControlLog != null && dataControlRule.getRoiChange() != null && (dataControlLog.getRoiGoal() == null \|\| dataControlLog.getRoiGoal() <= 0)) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:949` · audit-log · rule != null ? rule.getRoiChange() : null,

### cpaBidChange / cpa_bid_change_json

- 关系：action-parameter
- 事实/关联字段：无直接事实字段
- 映射：CPA 出价调整动作配置，不作为扫描事实字段
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:818` · audit-log · DataControlRule.CpaBidChaneCondition cpaBidChange = dataControlRule.getCpaBidChange();

### rateLimitFlag / rate_limit_flag

- 关系：rate-limit-switch
- 事实/关联字段：无直接事实字段
- 映射：开启 ruleId+实体ID Redis 频控
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2583` · audit-log · Integer rateLimitFlag = rule.getRateLimitFlag();

### restartDisabledFlag / restart_disabled_flag

- 关系：action-guard
- 事实/关联字段：无直接事实字段
- 映射：与 bookDataFilterFlag 联合控制是否允许重新启用
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1287` · program-filter · if (dataControlRule != null && Objects.equals(dataControlRule.getBookDataFilterFlag(), 1) && Objects.equals(dataControlRule.getRestartDisabledFlag(), 1)) {

### bookDataFilterRoi / book_data_filter_roi

- 关系：program-filter-threshold
- 事实/关联字段：book_id
- 映射：书维度 ROI 阈值
- 使用次数：4

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2371` · program-filter · if (rule.getBookDataFilterRoi() != null && rule.getBookDataFilterConsume() != null) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2376` · program-filter · && bookData.getPlineFormRoi() < rule.getBookDataFilterRoi();
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2381` · program-filter · && bookData.getPlineFormRoi() < rule.getBookDataFilterRoi();
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2397` · program-filter · rule.getBookDataFilterRoi(), rule.getBookDataFilterRoi3Day(), rule.getBookDataFilterConsume()

### bookDataFilterRoi3Day / book_data_filter_roi_3day

- 关系：program-filter-threshold
- 事实/关联字段：book_id
- 映射：书维度近三日 ROI 阈值
- 使用次数：5

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2384` · program-filter · if (qualified && rule.getBookDataFilterRoi3Day() != null
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2388` · program-filter · qualified = bookData.getPlineFormRoi() < rule.getBookDataFilterRoi3Day()
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2389` · program-filter · && bookData.getD1Roi() < rule.getBookDataFilterRoi3Day()
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2390` · program-filter · && bookData.getD2Roi() < rule.getBookDataFilterRoi3Day();
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2397` · program-filter · rule.getBookDataFilterRoi(), rule.getBookDataFilterRoi3Day(), rule.getBookDataFilterConsume()

### bookDataFilterConsume / book_data_filter_consume

- 关系：program-filter-threshold
- 事实/关联字段：book_id, consume
- 映射：书维度数据过滤的消耗阈值
- 使用次数：6

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2371` · program-filter · if (rule.getBookDataFilterRoi() != null && rule.getBookDataFilterConsume() != null) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2375` · program-filter · qualified = bookData.getD0Consume() > rule.getBookDataFilterConsume()
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2378` · program-filter · qualified = bookData.getD0Consume() > rule.getBookDataFilterConsume()
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2379` · program-filter · && bookData.getD1Consume() > rule.getBookDataFilterConsume()
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2380` · program-filter · && bookData.getD2Consume() > rule.getBookDataFilterConsume()
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2397` · program-filter · rule.getBookDataFilterRoi(), rule.getBookDataFilterRoi3Day(), rule.getBookDataFilterConsume()

### bookDataFilterFlag / book_data_filter_flag

- 关系：program-filter-switch
- 事实/关联字段：book_id
- 映射：开启后按书维度聚合 consume/ROI 再过滤命中结果
- 使用次数：4

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1287` · program-filter · if (dataControlRule != null && Objects.equals(dataControlRule.getBookDataFilterFlag(), 1) && Objects.equals(dataControlRule.getRestartDisabledFlag(), 1)) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2086` · program-filter · boolean bookDataFilterFlag = rule.getBookDataFilterFlag() != null && rule.getBookDataFilterFlag() == 1;
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3020` · sql-predicate · boolean bookDataFilterFlag = rule.getBookDataFilterFlag() != null && rule.getBookDataFilterFlag() == 1;
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3200` · sql-predicate · boolean bookDataFilterFlag = rule.getBookDataFilterFlag() != null && rule.getBookDataFilterFlag() == 1;

### rateLimitWindowHours / rate_limit_window_hours

- 关系：rate-limit-parameter
- 事实/关联字段：无直接事实字段
- 映射：Redis 频控窗口小时数
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2587` · business-logic · Integer windowHours = rule.getRateLimitWindowHours();

### rateLimitMaxCount / rate_limit_max_count

- 关系：rate-limit-parameter
- 事实/关联字段：无直接事实字段
- 映射：窗口内最大动作次数
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2588` · business-logic · Integer maxCount = rule.getRateLimitMaxCount();

### bookUpDays / book_up_days

- 关系：program-filter-parameter
- 事实/关联字段：book_id
- 映射：bookUpType=指定日期时作为开始边界
- 使用次数：4

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2089` · program-filter · boolean checkBookUpDays = rule.getBookUpType() != null && rule.getBookUpType().equals(DataControlRule.BookUpTypeEnum.DAYS.getValue()) && rule.getBookUpDays() != null && rule.getBookUpDaysEnd() != null;
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2249` · business-logic · LocalDateTime.of(LocalDate.now().minusDays(rule.getBookUpDays()), LocalTime.MIN)
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3023` · sql-predicate · boolean checkBookUpDays = rule.getBookUpType() != null && rule.getBookUpType().equals(DataControlRule.BookUpTypeEnum.DAYS.getValue()) && rule.getBookUpDays() != null && rule.getBookUpDaysEnd() != null;
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3203` · sql-predicate · boolean checkBookUpDays = rule.getBookUpType() != null && rule.getBookUpType().equals(DataControlRule.BookUpTypeEnum.DAYS.getValue()) && rule.getBookUpDays() != null && rule.getBookUpDaysEnd() != null;

### bookUpDaysEnd / book_up_days_end

- 关系：program-filter-parameter
- 事实/关联字段：book_id
- 映射：bookUpType=指定日期时作为结束边界
- 使用次数：4

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2089` · program-filter · boolean checkBookUpDays = rule.getBookUpType() != null && rule.getBookUpType().equals(DataControlRule.BookUpTypeEnum.DAYS.getValue()) && rule.getBookUpDays() != null && rule.getBookUpDaysEnd() != null;
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2255` · business-logic · LocalDateTime.of(LocalDate.now().minusDays(rule.getBookUpDaysEnd()), LocalTime.MAX)
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3023` · sql-predicate · boolean checkBookUpDays = rule.getBookUpType() != null && rule.getBookUpType().equals(DataControlRule.BookUpTypeEnum.DAYS.getValue()) && rule.getBookUpDays() != null && rule.getBookUpDaysEnd() != null;
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3203` · sql-predicate · boolean checkBookUpDays = rule.getBookUpType() != null && rule.getBookUpType().equals(DataControlRule.BookUpTypeEnum.DAYS.getValue()) && rule.getBookUpDays() != null && rule.getBookUpDaysEnd() != null;

### placementMode / placement_mode

- 关系：list-predicate
- 事实/关联字段：placement_mode
- 映射：非 -1/不限时 placement_mode IN 列表
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2035` · sql-predicate · if (StringUtils.isNotBlank(rule.getPlacementMode()) && !"-1".equals(rule.getPlacementMode()) && !"不限".equals(rule.getPlacementMode())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2036` · sql-predicate · whereBy.append(" and placement_mode in (").append(Arrays.stream(rule.getPlacementMode().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### isNewBook / is_new_book

- 关系：having-predicate
- 事实/关联字段：is_new_book
- 映射：天粒度且非 -1 时 is_new_book 等值
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1765` · business-logic · if (Objects.nonNull(rule.getIsNewBook()) && -1 != rule.getIsNewBook()){
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1766` · business-logic · havingBy.append(" and is_new_book = ").append(rule.getIsNewBook()).append(" ");

### articleType / article_type

- 关系：program-filter
- 事实/关联字段：book_id
- 映射：扫描后通过 book_id 的书籍缓存 articleType 比较，不直接要求事实表同名列
- 使用次数：5

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2090` · program-filter · boolean checkBookAttribute = (rule.getArticleType() != null && rule.getArticleType() != -1) \|\| (rule.getSex() != null && rule.getSex() != -1);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2282` · business-logic · boolean articleTypeMatch = isAttributeMatch(rule.getArticleType(), simpleBookVo.getArticleType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2289` · audit-log · rule.getId(), dtLog.getBookId(), simpleBookVo.getBookName(), rule.getArticleType(), rule.getSex(), articleTypeMatch, sexMatch);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:823` · program-filter · Integer articleType = rule.getArticleType();
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1505` · program-filter · .filter(rule -> StringUtils.isNotBlank(rule.getArticleType()) && Arrays.asList(rule.getArticleType().split(",")).contains(String.valueOf(book.getArticleType())))

### sex / sex

- 关系：program-filter
- 事实/关联字段：book_id
- 映射：扫描后通过 book_id 的书籍缓存 sex 比较，不直接要求事实表同名列
- 使用次数：3

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2090` · program-filter · boolean checkBookAttribute = (rule.getArticleType() != null && rule.getArticleType() != -1) \|\| (rule.getSex() != null && rule.getSex() != -1);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2284` · audit-log · boolean sexMatch = isAttributeMatch(rule.getSex(), simpleBookVo.getSex());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2289` · audit-log · rule.getId(), dtLog.getBookId(), simpleBookVo.getBookName(), rule.getArticleType(), rule.getSex(), articleTypeMatch, sexMatch);

### appName / app_name

- 关系：list-or-prefix-predicate
- 事实/关联字段：app_name
- 映射：客户端短剧使用 LIKE 前缀，其他业务使用 IN 列表
- 使用次数：3

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2040` · sql-predicate · if (StringUtils.isNotBlank(rule.getAppName()) && !"-1".equals(rule.getAppName()) && !"不限".equals(rule.getAppName())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2042` · sql-predicate · whereBy.append(" and (").append(Arrays.stream(rule.getAppName().split(",")).map(s -> "app_name LIKE '" + s + "%'").collect(Collectors.joining(" OR "))).append(")");
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2044` · sql-predicate · whereBy.append(" and app_name in (").append(Arrays.stream(rule.getAppName().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### bookId / book_id

- 关系：list-predicate
- 事实/关联字段：book_id
- 映射：非 -1/不限时 book_id IN 列表
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2048` · sql-predicate · if (StringUtils.isNotBlank(rule.getBookId()) && !"-1".equals(rule.getBookId()) && !"不限".equals(rule.getBookId())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2049` · sql-predicate · whereBy.append(" and book_id in (").append(Arrays.stream(rule.getBookId().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### channelPrefix / channel_prefix

- 关系：prefix-predicate
- 事实/关联字段：channel_code
- 映射：每个前缀生成 channel_code LIKE prefix%
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2052` · sql-predicate · if (StringUtils.isNotBlank(rule.getChannelPrefix()) && !"-1".equals(rule.getChannelPrefix()) && !"不限".equals(rule.getChannelPrefix())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2053` · sql-predicate · whereBy.append(" and (").append(Arrays.stream(rule.getChannelPrefix().split(",")).map(prefix -> "channel_code LIKE '" + prefix + "%'").collect(Collectors.joining(" OR "))).append(")");

### cycleType / cycle_type

- 关系：schedule-gate
- 事实/关联字段：无直接事实字段
- 映射：控制每30分钟/每小时/每2小时/固定时间执行
- 使用次数：5

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:329` · audit-log · this.setControlCycleType(rule.getCycleType());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1626` · business-logic · if (DataControlRule.CycleTypeEnum.EVERY_30_MIN.getValue().equals(rule.getCycleType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1628` · business-logic · } else if (DataControlRule.CycleTypeEnum.EVERY_HOUR.getValue().equals(rule.getCycleType()) && controlState.isFirst4CurrentHour()) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1630` · business-logic · } else if (DataControlRule.CycleTypeEnum.EVERY_2_HOUR.getValue().equals(rule.getCycleType()) && controlState.isFirst4CurrentHour() && controlState.getHour() % 2 == 0) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1632` · business-logic · } else if (DataControlRule.CycleTypeEnum.FIXED_TIME.getValue().equals(rule.getCycleType()) && controlState.isFirst4CurrentHour()

### runHours / run_hours

- 关系：schedule-gate-parameter
- 事实/关联字段：无直接事实字段
- 映射：cycleType=固定时间时声明执行小时集合
- 使用次数：2

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:330` · audit-log · this.setControlRunHours(rule.getRunHours());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1633` · business-logic · && Arrays.stream(StringUtils.split(rule.getRunHours(), ",")).collect(Collectors.toSet()).contains(controlState.getHourHH())) {

### skipHourRange / skip_hour_range

- 关系：schedule-gate
- 事实/关联字段：无直接事实字段
- 映射：当前小时处于跳过范围时跳过规则
- 使用次数：3

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:331` · audit-log · this.setControlSkipHourRange(rule.getSkipHourRange());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1611` · business-logic · if (StringUtils.isNotBlank(rule.getSkipHourRange())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1612` · business-logic · Set<String> ranges = Arrays.stream(rule.getSkipHourRange().split(",")).collect(Collectors.toSet());

### effectiveDate / effective_date

- 关系：schedule-gate
- 事实/关联字段：无直接事实字段
- 映射：当前日期不在配置集合时跳过规则
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1605` · business-logic · if (StringUtils.isNotEmpty(rule.getEffectiveDate())&&!"-1".equals(rule.getEffectiveDate())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1606` · business-logic · Set<String> effectiveDateSet = Arrays.stream(rule.getEffectiveDate().split(",")).collect(Collectors.toSet());

### status / status

- 关系：rule-eligibility
- 事实/关联字段：无直接事实字段
- 映射：仅 status=1 的规则进入执行
- 使用次数：4

- `src/main/java/com/dz/glory/job/schedule/DataControlHmLogSchedule.java:61` · program-filter · Objects.equals(rule.getStatus(), 1) && Objects.equals(rule.getMedia(), MediaEnum.TT.getVal()) &&
- `src/main/java/com/dz/glory/job/schedule/DataControlScanLogSchedule.java:59` · program-filter · Objects.equals(rule.getStatus(), 1) && Objects.equals(rule.getMedia(), MediaEnum.TT.getVal()) &&
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1656` · program-filter · && DataControlRule.StatusEnum.ENABLE.getValue().equals(r.getStatus()))
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3136` · program-filter · && DataControlRule.StatusEnum.ENABLE.getValue().equals(r.getStatus()))

### creatorId / creator_id

- 关系：rule-metadata
- 事实/关联字段：无直接事实字段
- 映射：创建人 ID，用于权限/审计，不作为事实扫描条件
- 使用次数：1

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:323` · audit-log · this.setControlCreatorId(rule.getCreatorId());

### creator / creator

- 关系：derived-filter-input
- 事实/关联字段：agent_user_name
- 映射：channelUsers=本部门全部时用 creator 查询部门人员集合，间接形成 agent_user_name IN 条件
- 使用次数：22

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:324` · audit-log · this.setControlCreator(rule.getCreator());
- `src/main/java/com/dz/glory/job/model/AdDataControlScanPlanLog.java:150` · action · this.setControlCreator(rule.getCreator());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1866` · sql-predicate · Set<String> channelUserSet = controlJob.getControlState().getLeaderFindChannelUserMap().computeIfAbsent(rule.getCreator(), k -> Collections.synchronizedSet(userMapper.getUserByDeptLeader(k).stream().map(User::getName).collect(Collectors.toSet())));
- `src/main/java/com/dz/glory/job/service/DataControlService.java:3045` · business-logic · channelUserSet = controlState.getLeaderFindChannelUserMap().computeIfAbsent(rule.getCreator(), k -> Collections.synchronizedSet(userMapper.getUserByDeptLeader(k).stream().map(User::getName).collect(Collectors.toSet())));
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:180` · sql-predicate · whereBy.append(" and agent_user_name = '").append(rule.getCreator()).append("'");
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:325` · program-filter · plineForm, rule.getCreator(), rule.getId(), e);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:331` · program-filter · log.info("自动书单/剧单放量更新,规则命中详情, plineForm:{}, creator:{}, ruleId:{}, hitResult:{}", plineForm, rule.getCreator(), rule.getId(), filteredBookIds);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:390` · program-filter · log.info("自动书单/剧单放量更新,规则黑名单过滤, plineForm:{}, creator:{}, ruleId:{}, bookId:{}", plineForm, rule.getCreator(), rule.getId(), bookId);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:648` · routing · plineForm, rule.getCreator(), rule.getId(), book.getBookId());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:655` · program-filter · log.info("校验上架天数 没从投放表查询到上架时间,ruleId:{},creator:{},bookId:{},UpDaysLeft:{},UpDaysRight:{}",rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getUpDaysLeft(), rule.getUpDaysRight());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:664` · program-filter · log.info("校验上架天数 剧没有匹配上,ruleId:{},creator:{},bookId:{},UpDaysLeft:{} ,days:{} ",rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getUpDaysLeft(), days);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:669` · program-filter · log.info("校验上架天数 剧没有匹配上,ruleId:{},creator:{},bookId:{},DaysRight:{} ,days:{} ",rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getUpDaysRight(), days);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:695` · audit-log · log.warn("校验新书 剧没有匹配上,没有查询到上架时间,,ruleId:{},creator:{},bookId:{},firstShelfDate:{} ", rule.getId(), rule.getCreator(), book.getBookId(), firstShelfDate);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:707` · audit-log · log.info("校验新书 剧没有匹配上,ruleId:{},creator:{},bookId:{},ruleBookType:{} ,bookTypeName:{} ", rule.getId(), rule.getCreator(), book.getBookId(), ruleBookType, bookTypeName);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:712` · audit-log · log.info("校验老书 剧没有匹配上,ruleId:{},creator:{},bookId:{},ruleBookType:{} ,bookTypeName:{} ", rule.getId(), rule.getCreator(), book.getBookId(), ruleBookType, bookTypeName);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:725` · program-filter · log.info("校验是短篇 剧没有匹配上,ruleId:{},creator:{},bookId:{},Rule_isShort:{} ,articleType:{} ", rule.getId(), rule.getCreator(), cacheBook.getBookId(), isShort, cacheBook.getArticleType());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:729` · program-filter · log.info("校验非短篇 剧没有匹配上,ruleId:{},creator:{},bookId:{},Rule_isShort:{} ,articleType:{} ", rule.getId(), rule.getCreator(), cacheBook.getBookId(), isShort, cacheBook.getArticleType());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:741` · program-filter · log.info("校验是否漫剧 剧没有匹配上,ruleId:{},creator:{}, bookId:{},isAnime:{} ,bookIsAnime:{},markNames:{} ", rule.getId(), rule.getCreator(), cacheBook.getBookId(), isAnime, containAnime(cacheBook.getMarkNames()), cacheBook.getMarkNames());
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:755` · program-filter · log.info("校验短剧类型 剧没有匹配上,ruleId:{},creator:{}, bookId:{},dramaType:{} ,bookDramaType:{}", rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getDrama_type(), type);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:773` · program-filter · rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getAnimeType(), markNames);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:796` · routing · rule.getId(), rule.getCreator(), bookId, plineForm);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:825` · program-filter · log.info("校验篇幅没有匹配上,ruleId:{},creator:{},bookId:{},书籍篇幅:{} ,规则篇幅:{} ", rule.getId(), rule.getCreator(), cacheBook.getBookId(), cacheBook.getArticleType(), articleType);

### optUserName / opt_user_name

- 关系：rule-metadata
- 事实/关联字段：无直接事实字段
- 映射：最新操作人，仅审计展示
- 使用次数：1

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:325` · audit-log · this.setControlOptUserName(rule.getOptUserName());

### ctime / ctime

- 关系：rule-metadata
- 事实/关联字段：无直接事实字段
- 映射：规则创建时间，仅日志/审计回填
- 使用次数：1

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:326` · audit-log · this.setControlCtime(rule.getCtime());

### utime / utime

- 关系：rule-metadata
- 事实/关联字段：无直接事实字段
- 映射：规则更新时间，仅日志/审计回填
- 使用次数：1

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:327` · audit-log · this.setControlUtime(rule.getUtime());

### accountType / account_type

- 关系：direct-predicate
- 事实/关联字段：account_type
- 映射：非 -1 时 account_type = rule.accountType
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1910` · sql-predicate · if (rule.getAccountType() != null && rule.getAccountType() != -1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1911` · sql-predicate · whereBy.append(" and account_type =").append(rule.getAccountType());

### optStatus / opt_status

- 关系：dynamic-status-predicate
- 事实/关联字段：promotion_status, project_status, plan_status
- 映射：按 dataType、plineForm 与小时/天阶段转换为启停状态谓词
- 使用次数：6

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1791` · sql-predicate · if (rule.getOptStatus() != null && rule.getOptStatus() != -1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1793` · sql-predicate · if (rule.getOptStatus() == 1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1803` · sql-predicate · } else if (rule.getOptStatus() == 2) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1816` · sql-predicate · if (rule.getOptStatus() == 1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1818` · sql-predicate · } else if (rule.getOptStatus() == 2) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1820` · sql-predicate · } else if (Objects.equals(rule.getOptStatus(), 3)) {

### projectStatus / project_status

- 关系：dynamic-status-predicate
- 事实/关联字段：project_status
- 映射：广告维度可附加项目状态；1=非暂停/删除，2=暂停
- 使用次数：4

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:333` · audit-log · this.setControlProjectStatus(rule.getProjectStatus());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1825` · sql-predicate · if (rule.getProjectStatus() != null && rule.getProjectStatus() != -1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1827` · sql-predicate · if (rule.getProjectStatus() == 1) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1829` · sql-predicate · } else if (rule.getProjectStatus() == 2) {

### isAnime / is_anime

- 关系：direct-predicate
- 事实/关联字段：is_anime
- 映射：非 -1 时等值过滤
- 使用次数：6

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2022` · sql-predicate · if (Objects.nonNull(rule.getIsAnime()) && -1 != rule.getIsAnime()){
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2023` · sql-predicate · whereBy.append(" and is_anime = ").append("'").append(rule.getIsAnime()).append("' ");
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:739` · program-filter · Integer isAnime = rule.getIsAnime();
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1513` · program-filter · if (rule.getIsAnime() == null) return true; // 不限漫剧，直接放行
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1514` · program-filter · if (!Objects.equals(rule.getIsAnime(), book.getIsAnime())) return false; // isAnime 不匹配
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1515` · program-filter · if (!Objects.equals(rule.getIsAnime(), 1) \|\| StringUtils.isBlank(rule.getAnimeType())) return true; // （rule 和 book 的 isAnime 相等且非 null），但不需要进一步校验 animeType 的情况

### externalAction / external_action

- 关系：direct-predicate
- 事实/关联字段：external_action
- 映射：非 -1/不限时等值过滤
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2005` · sql-predicate · if (StringUtils.isNotBlank(rule.getExternalAction()) && !"-1".equals(rule.getExternalAction()) && !"不限".equals(rule.getExternalAction())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2006` · sql-predicate · whereBy.append(" and external_action = ").append("'").append(rule.getExternalAction()).append("' ");

### raiseBudget / raise_budget

- 关系：action-parameter
- 事实/关联字段：无直接事实字段
- 映射：预算提升动作参数，不作为扫描事实条件
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:858` · action · optLog.setRaise_budget(dataControlRule.getRaiseBudget());

### raiseEndHour / raise_end_hour

- 关系：action-parameter
- 事实/关联字段：无直接事实字段
- 映射：预算提升结束小时，不作为扫描事实条件
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:860` · action · optLog.setEnd_time(LocalDateTime.now().plusHours(dataControlRule.getRaiseEndHour()).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));

### roiGoal / roi_goal

- 关系：action-parameter
- 事实/关联字段：roi_goal
- 映射：ROI 调整动作目标值；扫描中的 ROI 系数过滤由 roiCoefficientMin/Max 控制
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:943` · audit-log · Double fixedRoiGoal = rule != null && rule.getRoiGoal() != null ? rule.getRoiGoal().doubleValue() : null;

### bidType / bid_type

- 关系：direct-predicate
- 事实/关联字段：bid_type
- 映射：非 -1 时等值过滤
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2030` · sql-predicate · if (StringUtils.isNotBlank(rule.getBidType()) && !"-1".equals(rule.getBidType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2031` · sql-predicate · whereBy.append(" and bid_type = ").append("'").append(rule.getBidType()).append("' ");

### newProjectNum / new_project_num

- 关系：not-used-by-job
- 事实/关联字段：无直接事实字段
- 映射：在广告管控 src/main 中未发现 DataControlRule getter 使用
- 使用次数：0

- 未在 src/main Java/XML 中发现 getter 使用。

### createTime / create_time

- 关系：dynamic-time-predicate
- 事实/关联字段：promotion_create_time, project_create_time, plan_create_time
- 映射：按业务线与 dataType 选择时间字段并应用枚举时间范围
- 使用次数：11

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:332` · audit-log · //        this.setControlCreateTime(rule.getCreateTime());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1930` · sql-predicate · if (rule.getCreateTime() != null && !DataControlRule.CreateTimeEnum.IGNORE.getValue().equals(rule.getCreateTime())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1935` · sql-predicate · DataControlRule.CreateTimeEnum.getTimeLimit(rule.getCreateTime(), promotionField, whereBy);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1937` · sql-predicate · DataControlRule.CreateTimeEnum.getTimeLimit(rule.getCreateTime(), "project_create_time", whereBy);
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1942` · business-logic · if(rule.getCreateTime() !=-2) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1943` · business-logic · if (rule.getCreateTime() < 100) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1945` · business-logic · gtTime = DateUtil.getDayLastSecond(DateUtil.getDateFrom(Calendar.DAY_OF_YEAR, -1 * rule.getCreateTime())).getTime();
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1946` · business-logic · } else if (rule.getCreateTime() > 100 && rule.getCreateTime() < 200) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1948` · business-logic · leTime = DateUtil.getDayLastSecond(DateUtil.getDateFrom(Calendar.DAY_OF_YEAR, -1 * (rule.getCreateTime() - 100))).getTime();
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1949` · business-logic · } else if (rule.getCreateTime() > 2000) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1951` · business-logic · leTime = DateUtil.getDateFrom(Calendar.HOUR_OF_DAY, -1 * (rule.getCreateTime() - 2000));

### deliveryWay / delivery_way

- 关系：value-transform-predicate
- 事实/关联字段：delivery_way
- 映射：1→自动订阅，2→常规投放；xmtplay 固定排除自动订阅
- 使用次数：3

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1915` · sql-predicate · if (rule.getDeliveryWay() != null && !StringUtils.equals(rule.getDeliveryWay(), "-1") && !PlineEnum.XMT_PLAY.getAlias().equals(rule.getPlineForm())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1916` · sql-predicate · if (StringUtils.equals(rule.getDeliveryWay(), "1")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1918` · sql-predicate · } else if (StringUtils.equals(rule.getDeliveryWay(), "2")) {

### bidStrategyId / bid_strategy_id

- 关系：direct-predicate
- 事实/关联字段：bid_strategy_id
- 映射：单个 ID 优先等值过滤
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1873` · sql-predicate · if (rule.getBidStrategyId() != null) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1874` · sql-predicate · whereBy.append(" and bid_strategy_id =").append(rule.getBidStrategyId());

### bidStrategyName / bid_strategy_name

- 关系：not-used-by-job
- 事实/关联字段：无直接事实字段
- 映射：在广告管控 src/main 中未发现 DataControlRule getter 使用
- 使用次数：0

- 未在 src/main Java/XML 中发现 getter 使用。

### bidStrategyIds / bid_strategy_ids

- 关系：list-predicate
- 事实/关联字段：bid_strategy_id
- 映射：无单值且非 -1 时 bid_strategy_id IN 列表
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1875` · sql-predicate · } else if (StringUtils.isNotBlank(rule.getBidStrategyIds()) && !StringUtils.equals(rule.getBidStrategyIds(), "-1")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1877` · sql-predicate · whereBy.append(" and bid_strategy_id in (").append(String.join(",", rule.getBidStrategyIds().split(","))).append(")");

### bidStrategyNames / bid_strategy_names

- 关系：not-used-by-job
- 事实/关联字段：无直接事实字段
- 映射：在广告管控 src/main 中未发现 DataControlRule getter 使用
- 使用次数：0

- 未在 src/main Java/XML 中发现 getter 使用。

### mainBodys / main_bodys

- 关系：list-predicate
- 事实/关联字段：main_body
- 映射：非 -1/不限时 main_body IN 列表
- 使用次数：3

- `src/main/java/com/dz/glory/job/model/AdDataControlHmPlanLog.java:320` · audit-log · //        this.setControlMainBodys(rule.getMainBodys());
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1888` · sql-predicate · if (StringUtils.isNotBlank(rule.getMainBodys()) && !StringUtils.equals(rule.getMainBodys(), "-1") && !StringUtils.equals(rule.getMainBodys(), "不限")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1889` · sql-predicate · whereBy.append(" and main_body in (").append(Arrays.stream(rule.getMainBodys().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### ignoreBookIds / ignore_book_ids

- 关系：negative-list-predicate
- 事实/关联字段：book_id
- 映射：非 -1 时 book_id NOT IN 列表
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1893` · sql-predicate · if (StringUtils.isNotBlank(rule.getIgnoreBookIds()) && !StringUtils.equals(rule.getIgnoreBookIds(), "-1")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1894` · sql-predicate · whereBy.append(" and book_id not in (").append(Arrays.stream(rule.getIgnoreBookIds().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### effectiveBookIds / effective_book_ids

- 关系：list-predicate
- 事实/关联字段：book_id
- 映射：非 -1 时 book_id IN 列表
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1897` · sql-predicate · if (StringUtils.isNotBlank(rule.getEffectiveBookIds()) && !StringUtils.equals(rule.getEffectiveBookIds(), "-1")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1898` · sql-predicate · whereBy.append(" and book_id  in (").append(Arrays.stream(rule.getEffectiveBookIds().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### ignoreChannelCodes / ignore_channel_codes

- 关系：negative-list-predicate
- 事实/关联字段：channel_code
- 映射：非 -1 时 channel_code NOT IN 列表
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1901` · sql-predicate · if (StringUtils.isNotBlank(rule.getIgnoreChannelCodes()) && !StringUtils.equals(rule.getIgnoreChannelCodes(), "-1")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1902` · sql-predicate · whereBy.append(" and channel_code not in (").append(Arrays.stream(rule.getIgnoreChannelCodes().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### ignoreAccounts / ignore_accounts

- 关系：negative-list-predicate
- 事实/关联字段：account
- 映射：非 -1 时 account NOT IN 列表
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1905` · sql-predicate · if (StringUtils.isNotBlank(rule.getIgnoreAccounts()) && !StringUtils.equals(rule.getIgnoreAccounts(), "-1")) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:1906` · sql-predicate · whereBy.append(" and account not in (").append(Arrays.stream(rule.getIgnoreAccounts().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### dramaType / drama_type

- 关系：list-predicate
- 事实/关联字段：drama_type
- 映射：非 -1/不限时 drama_type IN 列表
- 使用次数：2

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2056` · sql-predicate · if (StringUtils.isNotBlank(rule.getDramaType()) && !"-1".equals(rule.getDramaType()) && !"不限".equals(rule.getDramaType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2057` · sql-predicate · whereBy.append(" and drama_type in (").append(Arrays.stream(rule.getDramaType().split(",")).map(s -> "'" + s + "'").collect(Collectors.joining(","))).append(")");

### animeType / anime_type

- 关系：csv-membership-predicate
- 事实/关联字段：anime_type
- 映射：每个值生成 FIND_IN_SET(value, anime_type)
- 使用次数：5

- `src/main/java/com/dz/glory/job/service/DataControlService.java:2060` · sql-predicate · if (StringUtils.isNotBlank(rule.getAnimeType()) && !"-1".equals(rule.getAnimeType()) && !"不限".equals(rule.getAnimeType())) {
- `src/main/java/com/dz/glory/job/service/DataControlService.java:2061` · sql-predicate · whereBy.append(" and (").append(Arrays.stream(rule.getAnimeType().split(",")).map(s -> "FIND_IN_SET('" + s + "', anime_type)").collect(Collectors.joining(" OR "))).append(")");
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:773` · program-filter · rule.getId(), rule.getCreator(), cacheBook.getBookId(), rule.getAnimeType(), markNames);
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1515` · program-filter · if (!Objects.equals(rule.getIsAnime(), 1) \|\| StringUtils.isBlank(rule.getAnimeType())) return true; // （rule 和 book 的 isAnime 相等且非 null），但不需要进一步校验 animeType 的情况
- `src/main/java/com/dz/glory/job/service/TtAutoDeliveryBookRuleService.java:1517` · routing · && Arrays.asList(rule.getAnimeType().split(",")).stream().anyMatch(Arrays.asList(book.getAnimeType().split(","))::contains); // 书有类型 且 与规则有交集

### idList / id_list

- 关系：not-used-by-job
- 事实/关联字段：无直接事实字段
- 映射：在广告管控 src/main 中未发现 DataControlRule getter 使用
- 使用次数：0

- 未在 src/main Java/XML 中发现 getter 使用。

### whereBy / where_by

- 关系：runtime-transient
- 事实/关联字段：无直接事实字段
- 映射：模型中的运行时动态 WHERE 载体，不是 ad_data_control_rule 业务输入映射
- 使用次数：1

- `src/main/java/com/dz/glory/job/service/DataControlService.java:1170` · sql-predicate · List<DataControlLog> projectsByAgentUserName = dataControlReadService.getHmProjectByAgentUserName(dtLog.getPlineForm(), rule.getWhereBy(), dtLog.getAgentUserName());

### dayDimension / day_dimension

- 关系：not-used-by-job
- 事实/关联字段：无直接事实字段
- 映射：在广告管控 src/main 中未发现 DataControlRule getter 使用
- 使用次数：0

- 未在 src/main Java/XML 中发现 getter 使用。

