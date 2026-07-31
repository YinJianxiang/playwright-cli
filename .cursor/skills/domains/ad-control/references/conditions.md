# 管控条件

管控条件负责指标、时间窗口、比较运算和 HIT/MISS 语义。机器权威为
`../knowledge/conditions.json`。

## 造数语义

- HIT：表达式求解器选择稳定满足解，所有 witness 条件为真。
- MISS：必须指定目标节点，仅翻转求解器声明的叶子，其他可满足条件保持为真。
- AND、OR、NOT 都由 AST 求解，不按指标名称写特殊分支。
- 比较符支持 `le/lt/ge/gt/between`。
- 指标按知识中的公式、写列、aggregate/post-filter 阶段和 hour/day 粒度生成。

## 证据状态

当前从既有正式配置迁入的 verified 指标可以执行。原 provisional 指标统一转成
`unknown`，不能通过批准绕过。新指标必须补齐公式、表字段和至少一条直接证据后，
才能 promote 为 verified。

完整指标和 capability 矩阵只维护在机器知识中，本文不复制表格。

## 投放版本与能力解析

- 能力查找键固定为 `plineForm|dataType|rv{releaseVer}|timeType|column`。
- `reduceType` 只决定累计或逐槽位求值，不参与选表和公式查找。
- 规则 `release_ver` 为空或 `-1` 时，只能使用知识库显式声明的
  `defaultReleaseVer`；没有默认版本必须阻断。
- 正常运行从已 promote 的 Job 条件矩阵和维度路由补齐 capability，
  不读取 `market-job` 源码。
- 条件矩阵中的 `any`、`not-3`、`3` 必须展开为知识库声明的受支持版本，
  未登记版本不得回退到通用公式。
