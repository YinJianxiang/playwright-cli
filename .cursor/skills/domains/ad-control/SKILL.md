---
name: ad-control-knowledge
description: 广告管控规则、维度、条件、动作与 Seed 配方的权威知识入口。用于解释或创建管控规则、生成当天 HIT/MISS 用例、准备测试数据、调用 Job 和验证管控记录。
---

# 广告管控知识

正式知识位于 `knowledge/`，人工说明位于 `references/`，来源证据位于 `evidence/`。

## 使用顺序

1. 先执行 `uv run ad-control knowledge validate`。
2. 维度与规则骨架读取 `knowledge/dimensions.json` 和 [references/dimensions.md](references/dimensions.md)。
3. 指标、公式与 HIT/MISS 读取 `knowledge/conditions.json` 和 [references/conditions.md](references/conditions.md)。
4. 动作、Job 与记录断言读取 `knowledge/actions.json` 和 [references/actions.md](references/actions.md)。
5. 完整执行交给 `../../ad-control-browser-flow/SKILL.md`；数据准备交给 `../../ui-flow-db/SKILL.md`。

## 硬约束

- 只有 `verified` 知识可以驱动自动化；`unknown` 必须阻断相关步骤。
- 明确且非“不限”的维度必须写入规则过滤条件。
- `knowledge/seed-runtime-v3.json` 是确定性产物，不在执行流程中临时改写。
- 不搜索旧 Playwright/TypeScript 或业务源码补齐结论。
- 知识候选必须经过 diff 和用户明确确认后才能 promote。
