# Seed V3 契约

## API

```ts
compileSeedRun(ruleId, { mode, pairId, hitNodeId, missNodeId })
preflightSeedRun(compiled)
approveSeedRun(plan, { approvedBy, reason, validDays })
startSeedRun(plan, { confirmed, approvalFingerprint, outputDir, timeoutMs })
requestSeedRunCancel(runId, reason)
getSeedRun(runId)
resumeSeedRun(runId)
cleanupSeedRun(runId)
```

## 表达式

- 读取旧数组时转换成隐式 AND。
- 新协议为 `RuleExpressionV2`，节点类型是 `and`、`or`、`not`、`condition`。
- HIT 输出 `witnessLeaves`；MISS 输出 `flippedLeaves`。
- 计划必须记录所有 `nodeExpectations`，Apply 后重新求值根节点和目标节点。
- 同行同列约束冲突或无满足解时返回 `EXPRESSION_UNSATISFIABLE`。

## 风险

| risk | 行为 |
|---|---|
| none | 普通 confirmed 后可执行 |
| medium/high | 元库中必须存在未过期、未撤销且环境/配置版本匹配的批准 |
| error | blocked，任何开关不能写库 |

批准默认 90 天。配置版本变化会产生新 fingerprint。

## 状态与取消

正常状态：

```text
created → compiling → preflighting → ready/awaiting_approval
→ applying → committed → job_running → asserting → cleaning → succeeded
```

终态还包括 `blocked`、`cancelled`、`failed`、`cleanup_failed`、`expired`。

- 状态迁移使用 CAS。
- worker 必须持有有效 lease。
- 提交前取消触发 rollback。
- 提交后、Job 或断言阶段取消必须 cleanup。
- 崩溃恢复不得重复触发 Job，只允许幂等 cleanup。

## 审计

每条 Preflight、INSERT、verify、cleanup 记录 SQL 模板、脱敏参数、耗时、结果摘要、
事务事件和错误码。完整文件位于 outputDir；元库只保留路径与摘要。
- `market-job` 保持只读，只识别旧数组的隐式 AND 语义。
- 条件叶子或任意嵌套的纯 AND AST 可无损展平并执行真实 Job。
- 任意 OR/NOT 节点产生 `JOB_AST_CAPABILITY_UNAVAILABLE` error。
- 不兼容计划允许求解和只读 Preflight，但禁止 Apply、写库和触发 Job。
- approval 不得绕过该能力错误。

## 渠道号与页面断言

- 若计划涉及的目标表含 `channel_code`，Preflight 对所有相关表查询纯数字渠道号的全局最大值。
- HIT 固定选择 `MAX+1`，MISS 固定选择 `MAX+2`；一个 run 的所有 InsertGroup 使用同一个渠道号。
- 选出的渠道号必须写入 `InsertGroup.channelCode` 和 cleanup manifest，供 UI 断言与精确清理复用。
- 记录页校验键为 `ruleId + channelCode`：HIT 要求同一表格行出现两个值；MISS 要求整个观察窗口内同一组合不出现。
- MISS 不以“Job 接口无记录”替代 UI 校验，也不使用其他渠道或旧规则记录作为反证。
