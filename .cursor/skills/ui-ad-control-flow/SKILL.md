---
name: ui-ad-control-flow
description: 串联广告管控业务知识、页面规则创建、Seed V3 数据准备、Job、HIT/MISS 页面断言、自动 Heal、数据清理和证据报告归档。用于执行或恢复广告管控 UI+DB+Job 端到端流程，以及要求最终产出 Allure、Playwright HTML、录屏、Trace、截图和逐用例日志的测试任务。
---

# 广告管控端到端流程

将本 Skill 作为唯一总控入口。按阶段读取并执行现有子 Skill，不复制或绕过子 Skill 的业务、安全和审批约束。

## 开始前读取

按需完整读取：

1. 业务解析：`../domains/ad-control/SKILL.md`
2. 规则创建：`../ui-ad-control-rule-create/SKILL.md`
3. Seed、Job 与断言：`../ui-flow-db/SKILL.md`
4. 跑测、Heal 与汇总：`../ui-flow-validate/SKILL.md`

子 Skill 要求读取其引用文件时，继续按其路由读取。遇到冲突时采用更严格的确认、审批、数据安全和清理要求。

## 强制流水线

```text
解析请求与正式业务知识
→ 生成规则创建计划
→ 展示完整计划并等待用户明确确认
→ UI 创建规则并取得 ruleId/handoff
→ 从数据库按 ruleId 回读并核对规则
→ 为 HIT 与 MISS 分别 Compile + 只读 Preflight
→ 完成所需风险审批
→ Apply/Verify → Job → UI 记录页断言
→ 执行 Playwright 用例，失败时按策略 Heal
→ finally 清理或保留数据
→ 无论测试成功或失败都生成报告并汇总证据
```

不得在规则创建失败、结果不确定、页面与数据库不一致或缺少 `ruleId` 时进入 Seed。不得用 API/Job 成功替代最终 UI 记录页断言。

## 确认与暂停点

- 缺少管控维度、业务线、指标条件或 HIT/MISS 意图时，先询问用户。
- 在任何页面写入前，完整展示规则创建计划并等待明确确认；一次确认仅覆盖展示的规则计划和测试范围。
- 测试执行前再次列出将运行的 suite、CASE_ID/文件、配置文件和有头/无头模式，并取得明确确认。
- Seed 风险为 medium/high 时，按 `ui-flow-db` 获取作用域和有效期匹配的批准；`error` 或 blocked 不得绕过。
- 默认失败后自动 Heal 最多 2 轮。用户明确要求“不自动修复”或“先问再修”时服从用户。
- Flow 结束时询问是否删除本批数据；CI 使用项目已有环境开关。无论用户选择清理或保留，都记录状态和恢复/清理命令。

## HIT/MISS 执行约束

- 默认对同一规则分别执行 HIT 和 MISS；用户只要求其中一种时缩小范围。
- 使用规则创建结果的 handoff，但由 `ui-flow-db` 按 `ruleId` 重新读取并核对数据库事实。
- 若目标表含 `channel_code`，沿用 Seed V3 分配值，并以 `ruleId + channelCode` 定位同一 UI 记录行。
- HIT 等待目标行出现；MISS 在完整观察窗口内确认目标组合始终不出现。
- OR/NOT AST 仅允许求解和只读 Preflight；出现 `JOB_AST_CAPABILITY_UNAVAILABLE` 时停止 Apply 和 Job。
- 每个 Seed run 都在 `finally` 调用其终结/清理流程，不因测试或报告生成失败跳过。

## 证据模式

运行前检查所选 Playwright config 是否同时启用以下设置；缺失时先报告差异并修正配置或选择已有证据配置，再请求跑测确认：

```ts
video: 'on'
trace: 'retain-on-failure'
screenshot: 'only-on-failure'
reporter: list + html(open: 'never') + allure-playwright
```

优先复用项目的 `playwright.evidence.ts`：

- 普通生成用例：`playwright.generated.config.ts`，产出 `test-results/`、`playwright-report/`、`allure-results/`。
- 广告管控 Seed V3 Flow：`playwright.ad-control-flow.config.ts`，产出 `test-results-flow/`、`playwright-report-flow/`、`allure-results-flow/`。

不得为获得“通过”而关闭录屏、Trace、截图或 Reporter。Allure `detail: false` 时仅保留业务步骤，避免密码等底层填充值进入步骤名。

## 跑测与报告生成

取得跑测确认后，只执行已确认的 suite/CASE。记录测试命令和退出码。测试命令失败后仍继续执行报告生成：

- 普通生成用例：单独运行 `npm run report:allure:gen`。
- 广告管控 Flow：单独运行 `npm run report:allure:flow`。
- HTML 报告由 Reporter 在测试结束时生成；不要以打开报告代替生成或验证。

生成后验证对应目录存在且非空。Allure 生成失败不改变测试本身的 passed/failed 结论，但必须把报告状态标记为 `report_failed` 并给出错误摘要。

## Heal 与不中断原则

- 按 `ui-flow-validate` 对每个 CASE 或同因簇最多执行 2 轮 Heal，只定点重跑受影响范围。
- 优先修复共享 helper、真实 locator、选项采集和正确业务预期，不修改 Job/业务流来掩盖失败。
- 单条 `exhausted_fail` 不得中止整批；继续剩余用例，最后统一汇总。
- 每次原始执行和 Heal 重跑都保留其 Playwright 证据，不覆盖需要审计的失败材料。

## 最终交付契约

最终答复必须给出：

1. 规则：`ruleId`、规则名、实际字段和条件摘要。
2. 运行：suite、CASE_ID/文件、HIT/MISS、配置、命令、开始/结束时间和退出码。
3. 结果：`passed`、`healed_pass`、`exhausted_fail`、`blocked` 数量及失败摘要。
4. Seed：runId、channelCode、Job 状态、UI 断言和 cleanup/retained 状态。
5. 报告：Allure results、Allure report、Playwright HTML 的实际路径和生成状态。
6. 证据：每个失败/修复用例对应的录屏、Trace、截图、JSONL 与 Markdown 日志路径；通过用例至少给出录屏或其所在结果目录。
7. 遗留问题：未清理数据、手动清理命令、报告生成错误或需要人工判断的差异。

只报告实际存在并经过检查的文件。不要把预期路径描述成已生成产物，也不要自动打开报告；向用户提供查看命令即可。
