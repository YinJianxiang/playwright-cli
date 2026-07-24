# 阶段产物交接（handoff）

同一次编排共用根目录：

```text
tests/e2e/generated/{yyyyMMdd-HHmmss}/
  explore/           # 说明书 + Step 1
    req-extract.md     # 可选：来自 ui-flow-req-cases
    cases-ui.md        # suite=ui 说明书
    cases-flow.md      # suite=flow 说明书
    cases.md           # 兼容旧批次（视为 flow）
    auth.json
    list-snapshot.md
    form-snapshot.md
    report.md
  helpers/
  specs/
    ui/                # suite=ui
    flow/              # suite=flow
  matrix-ui.json       # suite=ui
  matrix-flow.json     # suite=flow
  matrix.json          # 兼容旧批次
  README.md
```

## suite 与说明书对应

| 执行 suite | 说明书 | matrix | specs |
|------------|--------|--------|-------|
| `ui` | `cases-ui.md` | `matrix-ui.json` | `specs/ui/*.spec.ts` |
| `flow` | `cases-flow.md` 或旧 `cases.md` | `matrix-flow.json` 或旧 `matrix.json` | `specs/flow/*.spec.ts` 或旧 `specs/*.spec.ts` |

一次 generate / validate **只处理一个 suite**。

## 门禁（强制）

| 进入阶段 | 必须已有 |
|----------|----------|
| **ui-flow-req-cases** | domain + 需求 md；图片路径可解析 |
| **generate（suite=ui）** | 下列全部满足，否则拒绝、回 explore： |
| | - 本任务已探索：`report.md` 上下文覆盖 `cases-ui` 的选择因 |
| | - 同批 `auth.json`、`list-snapshot.md`、`form-snapshot.md`、`report.md`、**`cases-ui.md`** |
| | - `cases-ui` 每节含：测什么、选择因、期望展示（options）、怎么操作、预期终态（见 [case-spec.md](case-spec.md)） |
| | - report 已采目标下拉**完整** options，并与期望清单对照（差异写入 report/README，**不**静默改期望） |
| | - 目标字段操作方式已验证；禁止未探索写 specs |
| **generate（suite=flow）** | 下列全部满足，否则拒绝、回 explore： |
| | - 本任务已探索；同批 auth / snapshots / report |
| | - **`cases-flow.md`（或 `cases.md`）**；无 `blocked: need-conditions` |
| | - 每个逻辑 `pairId` 成对存在 `-HIT` / `-MISS`（seed mode=hit|miss）；缺一拒绝 |
| | - matrix 行与 `## CASE_ID` 1:1；测什么、规则/数据条件、怎么操作、预期终态、pairId/mode 齐全 |
| | - 字段表扩列、必填 options、控件模式等规则同前（filterable/v2/defaults 约束不变） |
| | - 禁止无说明书或错配旧 explore 生成 |
| **ui-flow-db（Step 2b）** | **仅 suite=flow**。按 matrix 的 HIT/MISS 各造一次（同 pairId、不同实体）。generate 已产出即可进入；DB 分册未齐不挡 generate。`suite=ui` **禁止**进入本步 |
| **validate** | 对应 `specs/ui` 或 `specs/flow`；**用户已确认执行** |

**禁止**无 explore 产物凭猜测写 locator/枚举。  
**禁止**未经操作验证的 locator 进入 generate。  
**禁止**跳过探索直接生成自动化。  
**禁止**无用例说明书生成 spec。  
**禁止** `suite=ui` 生成含造数/Job/记录页断言的步骤。  
**禁止** UI 与 flow 写进同一个 `test()`。  
**禁止** flow 只生成命中、不生成不生效对照（须 HIT+MISS）。  
**禁止**无 `ui-flow-db` 分册定稿时假装已完成造数（flow）。

覆盖轴名称以当前 **domain** 为准。

## explore/report.md 最低内容

- **本任务 scope**（suite + mode + 目标维度/业务线等；须与本 suite matrix/specs 一致）  
- 导航路径 / 最终 URL  
- 列表 + 表单全字段表（必填、options、已验证操作方式）  
- **suite=ui**：目标下拉完整 options + 与 `cases-ui` 期望对照表（匹配/缺失/多余）  
- **suite=flow**：覆盖轴 options、入口文案、唯一键取法、推荐默认、断言终态（HIT 有记录 / MISS 无该实体命中）  
- （flow 建议）试提交是否成功关闭弹层  

## explore/cases-ui.md / cases-flow.md

见 [case-spec.md](case-spec.md)。

## validate 追加

在 `explore/report.md` 或根 `README.md` 追加「运行与修复记录」（注明 suite）。

## 文件交接

禁止只靠聊天记忆；下一阶段只读本时间戳目录内文件 + Skill / domain 资料。
