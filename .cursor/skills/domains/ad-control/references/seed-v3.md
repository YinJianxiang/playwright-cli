# Seed V3

唯一流程：

```text
compileSeedRun
→ preflightSeedRun
→ approval
→ startSeedRun
→ Job / UI assertion
→ finalizeSeedRun / cleanupSeedRun
```

Seed V3 只读取 `knowledge/seed-runtime-v3.json`。正常执行不得访问
`market-job`、旧 map 或原始 SQL。

Preflight 必须检查：

- 知识版本与 runtime hash。
- 所有参与项均为 verified。
- 规则明确维度已映射到过滤条件和事实行。
- 表、必需列、源行和公式结果。
- HIT/MISS AST 的完整布尔求值。

历史 plan、audit 和 manifest 只读；新执行必须生成新的 V3 plan 和 runId。

