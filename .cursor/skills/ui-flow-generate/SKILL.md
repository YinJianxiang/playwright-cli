---
name: ui-flow-generate
description: >-
  在本任务 explore 门禁通过后，按冒烟/全量/scoped 生成 helpers 与 specs。
  禁止无探索或错配旧 explore 直接生成。用于 ui-flow-codegen 第 2 步、生成自动化代码。
---

# UI Flow 生成（Step 2）

**仅在本任务 explore 门禁通过后执行。** 文案、必填、options、点击方式必须来自**本批次** `explore/report.md`；用例故事来自 `explore/cases.md`。禁止猜测。  
用户要求「只生成」但本任务无合格 explore，或 report 上下文未覆盖本任务范围 → **停止写码**，先调 `ui-flow-explore`。

业务步骤名称、API、断言页以当前 **domain**（`domains/<biz>/`）与 [templates/](../ui-flow-codegen/templates/) 为准。**未指定 domain → 询问后停止。**  
控件点击按 [control-patterns.md](../ui-flow-codegen/references/control-patterns.md) 与 report「控件模式」列。  
用例说明书格式见 [case-spec.md](../ui-flow-codegen/references/case-spec.md)。

## 前置门禁（缺一则停止，不写 spec）

检查 `{root}/explore/`（详见 [handoff.md](../ui-flow-codegen/references/handoff.md)）：

- [ ] **任务对齐**：`report.md` 的 mode / 维度 / 业务线等上下文 ⊇ 本任务要生成的用例范围（禁止用其它维度/业务线旧报告顶替）
- [ ] `auth.json`、`list-snapshot.md`、`form-snapshot.md`、`report.md`、**`cases.md`** 属于**同一** `{root}`（禁止跨批次拼凑）
- [ ] **`cases.md`**：本任务每条将生成用例有 `## <CASE_ID>`；含测什么、规则/数据条件、怎么操作、预期终态；定稿后与 `matrix.json` 行 id **1:1**
- [ ] `report.md` 扩列字段表：上下文、必填、options、**操作方式（已验证）**、locator（推荐含控件模式）
- [ ] 目标上下文下「必填=是」的下拉 options 已采到；filterable/remote 须有 fill→option 剧本（禁止空 options+「选第一项」）
- [ ] 上下文切换控件 / 典型 combobox / 提交按钮 的操作方式不是「未验证」
- [ ] 无「必填下拉空着却用 defaults 猜枚举」

门禁失败 → **不写 spec**，回 `ui-flow-explore`。  
**禁止**捷径：复制旧批次 specs、只改枚举、或未探索就写 `tests/e2e/manual` 冒充本任务生成产物。  
**禁止**无 `cases.md` 或说明书与 matrix 不对齐就生成。

## Checklist

```text
- [ ] 通过门禁（含 cases.md）
- [ ] 按 mode + domain 覆盖轴拼 matrix.json（枚举只取 report 中存在的 options；行 id = cases.md 的 CASE_ID）
- [ ] 填表字段 = report 中「上下文=当前行」且「必填=是」的全部行
      （选填默认不填；defaults 不得覆盖「必填=是」）
- [ ] 非轴字段取值：defaults ∩ report options；options 空则停、回 explore
- [ ] **取值优先级**：用户指定 / 矩阵行 > defaults（不限）> options[0]；禁止用「优先不限」覆盖 form 已有具体值
- [ ] 负责人/主体等：form 字段用 `owner` / `subject`（选项值，不是「搜索关键字」）
- [ ] locator / 点击只抄 report「操作方式」/控件模式（static vs ep-select-v2 vs filterable 不得混用）
- [ ] 生成 helpers/ + specs/：`test('<CASE_ID>: <短标题>')`；`test.step` 名对齐 cases「怎么操作」
- [ ] README.md（链到 cases.md / matrix / ruleId）
```

## 产出

```text
{root}/matrix.json
{root}/helpers/*.ts
{root}/specs/*.spec.ts
{root}/README.md
```

## 硬约束

- 禁止无本任务 explore / 错配旧 explore 写 spec  
- 禁止无用例说明书（测什么/条件/怎么操作/预期）写 spec  
- 禁止 helper 写死业务枚举；轴字段来自矩阵行  
- 必填与点击路径以 report 为准；用例故事以 cases.md 为准  
- filterable/remote 必须 fill 后再选（仅点开为空时）；`ep-select-v2` 按 form 目标选 option-item，未指定才不限
- 列表定位依赖唯一键（规则名/业务主键等，见 domain）
- 有 `auth.json` 时优先 `storageState`  
- domain 声明的 TODO 步骤可空实现（如造数）；完整造数由 [`ui-flow-db`](../ui-flow-db/SKILL.md) + 其 `domain/<biz>/` 分册驱动，**文档未齐不阻塞生成**，保持 `seedViaDb` TODO 并可由 Step 2b 列缺口  
- 提交后应按 report：等待弹层关闭，失败时暴露校验信息  

## 门禁失败

任务未对齐 / 缺 explore 五件套（含 cases.md）/ 缺必填或操作方式 / 必填 options 未采到 / filterable 无关键字剧本 / cases 与 matrix 不对齐 → **不写 spec**，回 explore。
