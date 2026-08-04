# 后续流程交接

创建成功返回：

```ts
{
  status: 'created',
  ruleId: string,
  ruleName: string,
  actualFields: Record<string, unknown>,
  conditions: Array<Record<string, unknown>>,
  evidence: { screenshotPaths: string[]; pageUrl?: string },
  handoff: {
    nextSkill: 'ui-flow-db',
    ruleId: string,
    suggestedModes: ['hit', 'miss']
  }
}
```

- handoff 只表示“可以进入后续流程”，不自动执行。
- `ui-flow-db` 收到 handoff 后必须按 `ruleId` 从数据库重新读取规则，并核对页面保存值。
- 页面与数据库不一致时停止造数并报告差异。
- `blocked`、`failed` 或无法取得 `ruleId` 时禁止生成 handoff。
- 后续完整链路固定为：规则创建 → Seed V3 → Job → UI 记录验证 → cleanup。
