---
name: ui-ad-control-rule-create
description: 通过已登录的 Playwright 页面通用创建广告管控规则。用于用户给出管控维度、业务线和一个或多个指标条件后，先生成可审阅计划、等待明确确认，再动态填写规则表单、提交、提取 ruleId，并把结果交接给 ui-flow-db；不负责造数、Job 或管控记录验证。
---

# 广告管控规则创建

只负责规则创建前半段。正常执行禁止扫描 `market-job`，业务值和默认值只读取正式广告管控知识库。

## 开始前必读

1. 创建计划或补必填字段时，读取 `../domains/ad-control/SKILL.md`、其 `knowledge/dimensions.json` 和 `knowledge/conditions.json`。
2. 处理必填、可选、默认值或冲突时，读取 [references/field-strategy.md](references/field-strategy.md)。
3. 创建成功或连接后续流程时，读取 [references/handoff-contract.md](references/handoff-contract.md)。

## 强制流程

```text
解析请求
→ 校验 controlDimension、businessLine、conditions[].metric
→ buildRuleCreatePlan
→ 向用户完整展示 plan.markdown
→ 等待用户明确确认
→ confirmRuleCreatePlan
→ 登录并进入规则页
→ createRuleFromConfirmedPlan
→ 返回 RuleCreateResult
```

## 执行约束

- 缺少管控维度、业务线或指标时，先询问用户，禁止打开创建弹窗；渠道是可选字段。
- 用户明确值优先级最高，默认值不得覆盖。
- 非必填且未指定的字段保持空白。
- verified 默认值仅在控件当前可见、必填且为空时填写。
- 每次选择管控维度、业务线、投放版本等上游字段后，等待联动稳定并重新扫描完整可见表单；禁止复用选择前的字段列表。
- 每次扫描必须输出字段标签、控件类型、必填状态和是否已有值；根据新快照循环补齐 verified 必填默认值，直到表单状态收敛。
- 下拉选项必须绑定当前 combobox 的 `aria-controls`，虚拟列表需要有限遍历；禁止从页面全局选项池点击。
- 所有复合控件统一采用“标签绑定控件 → 控件所属可见面板 → 精确选择 → 双重回读 → 重新扫描”的策略；禁止为主体、业务线或具体选项增加特判。完整规则见 [references/field-strategy.md](references/field-strategy.md)。
- Element Plus 隐藏 radio/checkbox 点击失败时，点击其可见 label，并以 checked 状态或选中标签回读确认。
- 提交前重新扫描所有必填字段；未知必填项必须一次性完整列出，不允许遇到一个修一个。
- 按标签、角色和可见选项定位控件；禁止依赖固定 DOM 层级、字段序号、规则 ID 或单一 case。
- 页面出现未知必填字段、缺少精确选项或提交前回读不一致时停止提交。
- 条件数组逐条创建；禁止只处理 `conditions[0]`。
- 只有 `status=confirmed` 的计划可调用页面创建 helper。
- 创建成功只返回 handoff。除非用户另行要求，否则不调用 Seed、Job 或记录页验证。
- 创建失败、结果不确定或无法取得 ruleId 时不得产生 handoff。

## 公共实现

使用 `tests/e2e/helpers/rule-create`：

- `buildRuleCreatePlan(request)`：校验知识并生成 Markdown 计划。
- `confirmRuleCreatePlan(plan)`：记录用户确认门禁。
- `createRuleFromConfirmedPlan(page, plan, outputDir)`：动态填写、提交并返回结果。

进入页面前使用 `tests/e2e/helpers/auth.ts` 的 `login()` 和 `gotoRulePage()`。调用方负责创建 `outputDir`。

## 输出

完整返回 `RuleCreateResult`。成功结果必须包含 `ruleId`、规则名称、实际字段、条件、页面证据和 `ui-flow-db` handoff；失败结果必须包含问题码且不能包含 handoff。
