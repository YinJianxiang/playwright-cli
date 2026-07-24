---
name: ui-flow-codegen
description: >-
  编排 Playwright UI+API 流程：有需求 MD 时先 ui-flow-req-cases 一次产出 UI/流程说明书；
  执行按 suite=ui|flow 分开 explore → generate（→ db）→ validate。
  支持冒烟/全量/scoped。业务细节只来自 domains/<biz>/。
---

# UI Flow Codegen（编排入口）

总编排。子 Skill：

- 需求说明书（一块）：`ui-flow-req-cases`  
- 执行（分开）：`ui-flow-explore` → `ui-flow-generate` →（仅 flow）`ui-flow-db` → `ui-flow-validate`  

`<skill-root>` = 本目录（`ui-flow-codegen/`）。

**分层：**

| 层 | 内容 |
|----|------|
| 通用 | 子 Skill、handoff 门禁、操作验证、字段表、scope 模式、suite 分流、本目录 `env.md` |
| 领域 | [`../domains/<biz>/`](../domains/)：UI、defaults、apis、业务 env、DB 分册 |

## 触发

- 按资料生成自动化 / 冒烟 / 全量 / scoped / ui-flow-codegen  
- 根据需求文档生成用例（→ 先 `ui-flow-req-cases`）  
- 可只跑单阶段：只探索 / 只生成 / 只验证（**「只生成」仍须本任务已有合格 explore，否则先探索**）  
- 执行时指定 **suite=`ui` | `flow`**（未指定则询问；一次只跑一个 suite）  

## 生成一块 / 执行分开

| 阶段 | 行为 |
|------|------|
| **生成用例说明书** | 用户给出需求 `.md`（可含图）→ `ui-flow-req-cases` → `req-extract.md` + `cases-ui.md` + `cases-flow.md`。**到此可停**，不自动写 specs |
| **执行 suite=ui** | explore → generate → `specs/ui` + `matrix-ui.json` → validate；**跳过** ui-flow-db / Job |
| **执行 suite=flow** | explore → generate → `specs/flow` + `matrix-flow.json` → ui-flow-db → validate |

流程 cases 若含 `blocked: need-conditions` → 先询问用户补条件，禁止 generate flow。  
flow 说明书须 HIT（生效）+ MISS（不生效）成对；只写正向命中视为不合格。

## 任务级探索（强制，禁止捷径）

**每次生成自动化（specs）前，必须先对本任务做探索。** 不得因「以前探过广告维度 / 已有 helper / 用户只想快点出规则」而跳过。

| 规则 | 要求 |
|------|------|
| 一任务一批次 | 每个生成任务新建（或明确复用且上下文一致的）`tests/e2e/generated/{yyyyMMdd-HHmmss}/` |
| 有需求 MD | 先 `ui-flow-req-cases`，再按 suite explore |
| 上下文对齐 | explore 的 mode / 维度 / 业务线 / 表单面必须覆盖**本 suite 要生成的用例范围** |
| 禁止复用错配 | 禁止拿旧批次 explore 顶替其它维度/业务线 |
| 禁止凭记忆写码 | 禁止只靠聊天、旧 helper、domain 默认值猜测 locator/options 后写 `specs/` |

判定：「本任务」= 用户本轮指定的 domain + **suite** + mode + 覆盖轴/点名条件。范围变化即新任务或补探。

## 开始前必读

1. [env.md](env.md)（通用凭据与登录策略；**无业务 URL**）  
2. **指定 domain**：用户须给出 biz id（见 [`../domains/README.md`](../domains/README.md)）。**未指定 → 询问后停止，禁止默认业务**  
3. 读该业务包 `README.md` 及读序文件（`ui.md` / `ui.defaults.md` / `apis.md` / `env.md` / `db/`）  
4. [references/default-preferences.md](references/default-preferences.md)  
5. [references/scope-modes.md](references/scope-modes.md)  
6. [references/handoff.md](references/handoff.md)  
7. [references/case-spec.md](references/case-spec.md)（含 suite=ui / suite=flow）  
8. [references/control-patterns.md](references/control-patterns.md)  
9. [references/repo-layout.md](references/repo-layout.md)  

## 工作流 Checklist

```text
Task Progress:
- [ ] Step 0: 解析 mode；确认 domain（未指定则询问并停止）
- [ ] Step 0a: 若用户提供需求 md → ui-flow-req-cases（产出 cases-ui + cases-flow）；缺流程条件则询问
- [ ] Step 0b: 创建或复用 tests/e2e/generated/{yyyyMMdd-HHmmss}/
- [ ] Step 0c: 确认执行 suite=ui | flow（未指定则询问；一次只跑一个）
- [ ] Step 1: ui-flow-explore（覆盖本 suite 的 cases 上下文）
- [ ] Step 1b: handoff 门禁（按 suite 检查 cases-ui 或 cases-flow）
- [ ] Step 2: ui-flow-generate（ui → specs/ui；flow → specs/flow）
- [ ] Step 2b: 仅 suite=flow → ui-flow-db；suite=ui 跳过
- [ ] Step 3: 询问是否跑测本 suite
- [ ] Step 4: 确认后 ui-flow-validate（只跑对应 specs 目录）
```

## 硬约束

- **先说明书（若有需求）再探索再生成 specs**  
- `suite=ui`：禁止造数、Job、记录页断言；终态为 options 展示  
- `suite=flow`：走 domain 整链；`blocked` 未解除禁止 generate；可跑条件须 **HIT+MISS 成对**（见 case-spec）  
- 禁止跳过探索直接点页面写 spec / 直接套旧 helper  
- 禁止无用例说明书生成 spec；禁止 UI 与 flow 写进同一 `test()`  
- 业务文案与 URL **只**来自 `domains/<biz>/` 与**本任务** explore  
- 凭据只从项目根 `.env` 读；禁止提交密钥  
- 同一次编排共用一个时间戳根目录  
- 阻塞即停并报告  

## 子 Skill

- 需求→说明书：`../ui-flow-req-cases/SKILL.md`  
- 探索：`../ui-flow-explore/SKILL.md`  
- 生成：`../ui-flow-generate/SKILL.md`  
- 造数/DB：`../ui-flow-db/SKILL.md`（仅 flow）  
- 验证：`../ui-flow-validate/SKILL.md`  

## 模板

- [templates/ui-options.spec.md](templates/ui-options.spec.md) — suite=ui  
- [templates/mixed-ui-api.spec.md](templates/mixed-ui-api.spec.md) — suite=flow  
