# 管控维度

管控维度负责回答四个问题：规则筛选什么、Job 如何过滤、数据落到哪张表、事实行
用什么身份字段定位。机器权威为 `../knowledge/dimensions.json`。

## 规则骨架

最终造数行严格按以下优先级生成：

```text
source skeleton
→ table defaults
→ ruleFilterPatch
→ identity values
→ HIT/MISS metric values
```

业务线、管控层级、版本、转化目标、投放方式和状态是当前已验证骨架字段。
`external_action=IAP` 等明确值必须同时进入源行选择条件和最终行。

负责人、主体范围和账户类型已被发现，但事实表映射尚未完整证明，当前为
`unknown`。规则使用这些非“不限”值时，Preflight 必须阻断。

## 表路由与身份

- 广告：优先使用 `promotion_id`。
- 渠道：使用 `channel_code`。
- 项目：使用 `project_id`。
- 负责人：使用配置声明的实体 ID；缺少声明时阻断。
- `release_ver=3` 的渠道/项目路由到 ROI3 表。
- `channel_code`、`promotion_id`、`project_id` 必须是纯数字，并按相关表全局
  `MAX+offset` 分配。

完整 42 条表路由位于机器知识中，不在本文重复维护。

