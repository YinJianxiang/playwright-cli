# 控件操作模式库（探索前置）

通用交互经验。探索时：**先分类 → 查本库/domain 映射 → 按剧本验证 → 写入 report「控件模式」列**。  
生成时：只抄 report 的模式与操作方式，禁止对所有 combobox 共用一种点法。

相关：`ui-flow-explore`、`ui-flow-generate`、各 `domains/<biz>/ui.md`「已知控件模式」。

## 模式一览

| 模式 ID | 识别信号（点开后 300～800ms） | 标准操作剧本 |
|---------|------------------------------|--------------|
| `static-select` | 未输入即出现 ≥1 条 `role=option`；多为 `.el-select` + `.el-select__wrapper` | click 触发器 → option exact → 断言回显 |
| `ep-select-v2` | DOM 有 `.el-select-v2` / `input.el-select-v2__combobox-input`；**无** `.el-select__wrapper`；选项在 `.el-select-dropdown__option-item`，常 **无** `role=option` | click **`.el-select-v2__wrapper`** → 在 `.el-select-v2__popper:visible` 内点 option-item exact → 断言 group/表单项回显 |
| `filterable-select` | 存在 `input.el-select__input`；点开 option 为空或极少；**输入关键字后**才出列表 | click → **fill 关键字到 el-select__input** → wait option → option exact |
| `remote-select` | 同 filterable，且输入后明显延迟 | fill → waitFor option（可加长等待）→ click |
| `nameless-combo` | combobox 无 accessible name，落在 `group` / `.el-form-item` | 用 group/表单项定位触发器，再套 static / ep-select-v2 / filterable / remote |
| `ep-radio-button` | 点 `role=radio` input 被挡 | click `.el-radio-button__inner` 或可见文案 |
| `plain-input` | textbox / textarea | fill + 断言值仍在 |
| `submit-dialog` | 确认/提交 | click → 若出现 MessageBox（如「确认提交吗」）再点确定 → wait dialog/drawer hidden；失败读 `.el-form-item__error` |

同一外观（都像下拉）**不能**推断同一模式；必须以探针结果为准。`el-select` 与 `el-select-v2` 必须分开识别。

## `ep-select-v2` 踩坑（强制）

- **禁止**用普通 select 的 `.el-select__wrapper` / `input.el-select__input` / `getByRole('option')` 套 v2 → 常出现 `aria-expanded=true` 但无可见 popper，或读到页面其它隐藏下拉的 option。
- **禁止**只点 `[role=combobox]`（v2 上往往是窄 input）代替 `.el-select-v2__wrapper`。
- 选项计数用 `.el-select-v2__popper:visible .el-select-dropdown__option-item`，不要只数 `role=option`。
- **值易被冲掉**：选中后立刻对其它下拉 click/fill，v2 回显可能变回「请选择」。易丢值字段（如负责人）应在 **填表末尾** 再选；选后若再操作其它下拉须复查回显。
- 界面显示「不限」≠ 校验失败。确认时报「请选择 xxx」时，先查是否被后续操作清空，再判断「不限」是否无效。
- **取值**：用户/矩阵显式目标优先；仅未指定时才「有不限则选不限」。禁止用 defaults 的不限覆盖已指定人名。
- **禁止**用 `Escape` 关下拉（可能关掉整个 dialog）；用点击规则名等失焦关闭 popper。
- 业务选项名（人名/主体名）**不要**塞进 `.env`（易乱码）；来自用户指定 / explore report / domain defaults。

## 探索探针（强制）

```text
定位触发器并 click
  → 若存在 .el-select-v2 → 记 ep-select-v2
       → 统计 .el-select-v2__popper:visible .el-select-dropdown__option-item
       → 有「不限」→ 可验证点不限并断言回显（作 default 探针）
       → 再点其它字段后复查该值是否仍在；若被清空 → report 写「须填表末尾再选」
       → 生成时：form.owner / 矩阵值非空且非「不限」→ 点该选项，勿先点不限
  → 否则等待 300～800ms，统计 role=option 数量
  → 若 option≥1 且未输入 → static-select
  → 若存在 el-select__input 且 option=0
       → fill 短关键字（domain 默认或「测」）
       → 再等 500～1500ms
       → 有 option → filterable-select 或 remote-select
  → 写入 report：控件模式 + 操作方式（含关键字来源 / 末尾再选）
```

**禁止**：对 filterable/remote 只写「选第一项」且 options 为空 → 门禁不合格。  
**禁止**：把 `ep-select-v2` 误判成必须 fill 的 `filterable-select`（点开已有「不限」+列表时）。

## report 建议列

在字段表中增加 **控件模式**（或写入操作方式前缀），例如：

```text
ep-select-v2 + nameless-combo | group(负责人) → wrapper → option-item（form.owner 或 default「不限」）| 填表末尾执行
static-select | combobox(/业务线/) → option exact「新媒体-免费短剧」
filterable-select | group(…) → fill「关键字」→ option exact   # 仅点开后列表为空时
```

## 生成映射

| 模式 | helper 行为 |
|------|-------------|
| static-select | `selectExact(label, option)`；选项用 `role=option` / `.el-select__popper:visible` |
| ep-select-v2 | click `.el-select-v2__wrapper` → option-item：**显式 target 优先**，否则「不限」；易丢值字段放 fill **末尾** |
| filterable-select / remote-select | `selectFilterable(scope, target)`（仅普通 el-select + 需 fill） |
| nameless-combo | 先解析 scope（group/item），再按上表 |
| ep-radio-button | `clickRadioInner(text)` |
| submit-dialog | confirm → 处理二次 MessageBox → wait hidden |

## 经验回流

跑测/heal 发现新行为 → 归入本文件或 domain 映射 → 下次探索优先按预置模式验证。
