---
name: ui-flow-generate
description: >-
  在本任务 explore 门禁通过后，按 suite=ui|flow 生成 helpers 与 specs。
  ui 只断言 options；flow 走整链。禁止无探索或错配旧 explore 直接生成。
---

# UI Flow 生成（Step 2）

**仅在本任务 explore 门禁通过后执行。**  
文案、必填、options、点击方式来自本批 `explore/report.md`；用例故事来自 **`cases-ui.md`（suite=ui）或 `cases-flow.md` / `cases.md`（suite=flow）**。禁止猜测。

**未指定 suite → 询问后停止。** 一次只生成一个 suite。  
**未指定 domain → 询问后停止。**

控件点击按 [control-patterns.md](../ui-flow-codegen/references/control-patterns.md) 与 report。  
说明书见 [case-spec.md](../ui-flow-codegen/references/case-spec.md)。  
门禁详见 [handoff.md](../ui-flow-codegen/references/handoff.md)。

## suite 分流

| suite | 说明书 | 模板 | 产出 | 禁止 |
|-------|--------|------|------|------|
| `ui` | `cases-ui.md` | [ui-options.spec.md](../ui-flow-codegen/templates/ui-options.spec.md) | `specs/ui/*.spec.ts`、`matrix-ui.json` | 提交保存、开开关、造数、Job、记录页 |
| `flow` | `cases-flow.md` 或 `cases.md` | [mixed-ui-api.spec.md](../ui-flow-codegen/templates/mixed-ui-api.spec.md) | `specs/flow/*.spec.ts`、`matrix-flow.json` | 存在 `blocked`；或可跑条件未成对 HIT/MISS |

## 前置门禁（缺一则停止，不写 spec）

### 共用

- [ ] **任务对齐**：`report.md` 的 suite/上下文 ⊇ 本 suite 用例范围  
- [ ] `auth.json`、`list-snapshot.md`、`form-snapshot.md`、`report.md` 同批  
- [ ] locator / 点击只抄 report；static / v2 / filterable 不得混用  

### suite=ui

- [ ] 存在 `cases-ui.md`；每节含测什么、选择因、期望展示、怎么操作、预期终态  
- [ ] report 已采目标下拉 options，并有与期望对照记录  
- [ ] `matrix-ui.json` 行 id = cases-ui 的 CASE_ID  
- [ ] `expectedOptions` 来自 cases-ui，**禁止**用 report 全量覆盖需求期望  

### suite=flow

- [ ] 存在 `cases-flow.md` 或 `cases.md`；无 `blocked: need-conditions`（或已清除）  
- [ ] 每节含测什么、规则/数据条件、怎么操作、预期终态、pairId / seed mode  
- [ ] **成对**：每个逻辑 `pairId` 同时存在 `-HIT`（mode=hit）与 `-MISS`（mode=miss）两节 / 两行 matrix；缺一则停止  
- [ ] HIT 终态=记录有命中；MISS 终态=有数但不触发（不同实体 ID）  
- [ ] 必填下拉 options 已采；filterable/remote 有 fill 剧本  
- [ ] 上下文切换 / 典型 combobox / 提交按钮 操作方式非「未验证」  
- [ ] `matrix-flow.json`（或兼容 `matrix.json`）与 CASE_ID 1:1（含全部 `-HIT`/`-MISS`）

门禁失败 → **不写 spec**，回 `ui-flow-explore`。  
**禁止**复制旧批次 specs、未探索写 `tests/e2e/manual` 冒充本任务产物。  
**禁止**把 UI 与 flow 写进同一个 `test()`。

## Checklist

```text
- [ ] 确认 suite=ui | flow；通过对应门禁
- [ ] 拼 matrix-ui.json 或 matrix-flow.json（行 id = CASE_ID；枚举操作方式来自 report）
- [ ] suite=ui：按 ui-options 模板生成 specs/ui；step=准备/交互/打开下拉/断言 options
- [ ] suite=flow：按 mixed-ui-api 模板生成 specs/flow；每个 pair 两个 `test()`（HIT/MISS）；step 对齐 domain 整链  
- [ ] suite=flow：造数调用带 `mode` + 同一 `pairId`；MISS 用新实体；取值优先级 用户/矩阵 > defaults > options[0]
- [ ] README.md 更新本 suite 产物链接
```

## 产出

```text
# suite=ui
{root}/matrix-ui.json
{root}/helpers/*.ts          # 可复用 auth；可选 options.ts
{root}/specs/ui/*.spec.ts
{root}/README.md

# suite=flow
{root}/matrix-flow.json
{root}/helpers/*.ts
{root}/specs/flow/*.spec.ts
{root}/README.md
```

## 硬约束

- 禁止无本任务 explore / 错配旧 explore 写 spec  
- 禁止无对应说明书写 spec  
- `suite=ui`：终态仅 options 断言；关闭弹层用取消，不用确认提交  
- `suite=flow`：domain 声明的 TODO（如造数）可空实现；完整造数由 `ui-flow-db` 驱动；**必须**按 pair 生成 hit+miss 两个 test  
- 有 `auth.json` 时优先 `storageState`  
- filterable/remote 必须 fill 后再选；`ep-select-v2` 按 form 目标选  

## 门禁失败

任务未对齐 / 缺 explore / 缺对应 cases / ui 无期望 options / flow 仍 blocked / **flow 未成对 HIT+MISS** / cases 与 matrix 不对齐 → **不写 spec**，回 explore。
