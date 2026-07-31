---
name: ad-control-knowledge
description: 广告管控业务知识与 Seed V3 权威来源。用于创建或解释管控规则、填写管控维度、设计 HIT/MISS 条件、执行 SQL 造数、调用 Job、校验管控记录及处理动作和清理。
---

# 广告管控知识

不要在正常任务中搜索 `market-job` 或根据代码临时补业务结论。正式知识位于
`knowledge/`，人读说明位于 `references/`。

## 按任务读取

- 创建规则、选择业务线或维度、构造规则骨架：读
  [references/dimensions.md](references/dimensions.md) 和
  `knowledge/dimensions.json`。
- 选择指标、解释公式、设计 HIT/MISS、SQL 造数：读
  [references/conditions.md](references/conditions.md) 和
  `knowledge/conditions.json`。
- 填写动作、调用 Job、验证记录页、失败收尾：读
  [references/actions.md](references/actions.md) 和
  `knowledge/actions.json`。
- 完整 UI → Seed → Job → UI 流程：再读
  [references/seed-v3.md](references/seed-v3.md)。

## 硬约束

- `verified` 才能驱动自动化；`unknown` 必须报告缺口并阻断相关关键步骤。
- 规则明确且非“不限”的维度值必须进入规则骨架和 `ruleFilterPatch`。
- 维度决定骨架，条件决定指标与 HIT/MISS，动作决定 Job/UI 断言。
- `knowledge/seed-runtime-v3.json` 是确定性产物，禁止手工编辑。
- 只有用户显式要求 refresh 时，才运行 `knowledge:snapshot` 生成候选。
- 候选未经 diff、用户确认和 promote，不得覆盖正式知识。

