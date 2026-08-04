---
name: ui-flow-db
description: >-
  为 UI+API flow 使用 Seed V3 声明式准备数据库测试数据：解析旧 conditions 或
  AND/OR/NOT AST，求解 HIT/MISS，执行只读 preflight、风险批准、可取消事务
  apply/verify、Job 编排和可恢复 cleanup。用于 Job 前造数、SQL 审计、复杂条件、
  执行中止、崩溃恢复和 DB 排障。
---

# UI Flow DB（Seed V3）

上游规则创建统一由 `../ui-ad-control-rule-create/SKILL.md` 负责。本 Skill 接受其 `RuleCreateResult.handoff`，必须按 handoff 的 `ruleId` 从数据库重新读取并核对规则；不得在本 Skill 内重复创建规则。

仅用于 `suite=flow`。业务差异必须由版本化 Seed Config Bundle 声明，禁止在引擎中增加
指标名特殊分支。

## 开始前必读

1. [env-db.md](env-db.md)
2. [references/seed-contract.md](references/seed-contract.md)
3. 当前 domain 的 `SKILL.md`、`knowledge/` 与派生的 `knowledge/seed-runtime-v3.json`

## 强制流水线

```text
旧 conditions[] / RuleExpressionV2
→ compileSeedRun：验证 AST 并求解节点期望
→ preflightSeedRun：只读 schema/source/formula/SQL 模拟
→ blocked：停止
→ awaiting_approval：取得有作用域、有效期的风险批准
→ startSeedRun：租约 + 事务 INSERT/verify
→ markSeedRunJobRunning → Job
→ markSeedRunAsserting → 页面断言
→ finally cleanupSeedRun
```

## 硬约束

- Apply/Cleanup 必须满足 `E2E_DB_ENV=test` 与业务数据库名一致。
- V3 还必须配置 `E2E_META_DB_NAME`，且元库 migration version 匹配；运行时禁止 DDL。
- AST 支持 AND/OR/NOT，最大深度 8、最多 64 个叶子；新节点使用稳定 UUID。
- HIT 可指定 `hitNodeId`；MISS 必须指定 `missNodeId`。旧数组迁移期才允许
  `legacyMissConditionIndex`。
- provisional、公式/过滤/来源证据不完整属于高风险，通用自动确认不得绕过。
- 展示性可选列缺失是 info，不应制造批准噪音。
- 每阶段检查取消；提交前取消回滚，提交后取消按 manifest 清理。
- SQL 审计只记录模板和脱敏参数，禁止密码、token、cookie、Authorization 落盘。
- `finally` 必须调用 `finalizeSeedRun(runId)`：`always` 自动清理；`manual` 将 run 标记为 retained 并输出手动清理命令。CI 禁止 manual。
- 目标表存在 `channel_code` 时，Preflight 必须自动分配独立渠道号：HIT 使用所有相关目标表中数字渠道号全局 `MAX+1`，MISS 使用 `MAX+2`；同一多表计划必须共用该渠道号。
- UI 断言必须在记录页按“规则 ID + 渠道号”定位同一行。HIT 等待该行出现；MISS 在观察窗口内确认该行始终不出现。禁止只按规则 ID 判断，以免历史记录干扰。

## 命令

```bash
npm run seed:preflight -- --ruleId=123 --mode=hit --hitNodeId=<uuid>
npm run seed:preflight -- --ruleId=123 --mode=miss --missNodeId=<uuid>
npm run seed:approve -- --plan=<plan> --approvedBy=user --reason="已核对"
npm run seed:apply -- --plan=<plan> --confirmed=1 --approvalFingerprint=sha256:...
npm run seed:cancel -- --runId=<uuid> --reason="用户提前结束"
npm run seed:status -- --runId=<uuid>
npm run seed:cleanup -- --runId=<uuid>
npm run seed:recover
```

配置治理：

```bash
npm run seed:config:candidate
npm run seed:config:diff
npm run seed:config:promote -- --approvedBy=user --reason="Mapper/schema 已核对"
```

candidate 命令只能写 `_inbox`；未经显式 promote 不得覆盖正式配置。

## Job AST 能力边界

- 本阶段不修改 `market-job`。
- 旧条件数组，以及可无损展平为旧条件数组的纯 AND AST，可以进入 Apply 和真实 Job。
- 包含 OR 或 NOT 的 AST 只允许 Compile、Boolean Solver 和只读 Preflight。
- 这类计划必须产生 `JOB_AST_CAPABILITY_UNAVAILABLE` error 并进入 blocked。
- approval、confirmed 或自动确认变量都不能绕过该错误。
- 禁止把 OR/NOT 叶子退化成 AND，也禁止通过修改事实数据伪装 Job 已支持 AST。

## 新 Recipe

1. 从 Job/Mapper 和 schema 生成 candidate。
2. 审阅 table、filter、formula、执行阶段和证据差异。
3. 执行纯函数、schema preflight、事务回滚和脱敏测试。
4. 证据不足时保持 provisional。
5. 用户显式 promote 后才能供新 run 使用。

上游：`../ui-ad-control-rule-create/SKILL.md`（可选；接收创建成功的 ruleId handoff）
下游：[../ui-flow-validate/SKILL.md](../ui-flow-validate/SKILL.md)
