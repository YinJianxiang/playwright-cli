# Seed V3 执行契约

造数只有一条公开执行链：

```text
compileSeedRun
→ preflightSeedRun
→ approval
→ startSeedRun
→ Job / UI assertion
→ finalizeSeedRun / cleanupSeedRun
```

## 计划与执行

- 新计划必须同时满足 `SeedPlanV3.version === 3` 和 `executionPlan.version === 3`。
- Preflight 输出完整 AST、节点期望、`ConditionPlanV3[]`、`InsertGroupV3[]`、风险、批准指纹和执行 hash。
- HIT 使用稳定的满足解；MISS 必须提供 `missNodeId`，只翻转求解器声明的叶子。
- Apply 不重新选表、补字段或计算指标；计划过期、schema 或 execution hash 变化时必须重新 Preflight。
- 中高风险计划必须获得匹配环境、配置版本且未过期/未撤销的批准。

## 规则骨架

最终行按固定优先级构造：

```text
source skeleton
→ table defaults
→ ruleFilterPatch
→ identity values
→ HIT/MISS metric values
```

规则中明确且非“不限”的 Job 过滤字段必须进入 `ruleFilterPatch`；无法映射时计划 blocked。

## 历史产物

- 历史 plan、log、audit 和 manifest 只允许查看。
- 含旧嵌套计划结构的文件不能重新 Apply，运行时返回 `PLAN_VERSION_UNSUPPORTED`。
- 已 cleaned manifest 仅用于审计；新执行必须重新生成 V3 plan 和 runId。
