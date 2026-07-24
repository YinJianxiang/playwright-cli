---
name: ui-flow-explore
description: >-
  用有头 playwright-cli 对本任务目标页做探索：先验证点击/填写，再回写全字段清单。
  每次生成用例前必跑；用于 ui-flow-codegen 第 1 步、采集 locator、冒烟探活、补探新维度/业务线。
---

# UI Flow 探索（Step 1）

**先探索再生成。** 无本阶段完整产物时，禁止进入 `ui-flow-generate`。  
**按任务探索**：探索范围 = 本轮要生成的 mode / 维度 / 业务线 / 表单上下文；换任务或扩大范围必须新探或补探，禁止沿用错配旧 report。

本 Skill 只规定**通用探索方法**。具体 URL、入口文案、业务 checklist、覆盖轴名称以当前 **domain** 为准（[`../domains/<biz>/ui.md`](../domains/README.md)）。**未指定 domain → 询问后停止。**

## 前置

- 已读 `../ui-flow-codegen/env.md`、指定 **domain** + defaults、[handoff.md](../ui-flow-codegen/references/handoff.md)
- **必读** [control-patterns.md](../ui-flow-codegen/references/control-patterns.md)（控件模式库）
- 编排已创建时间戳根目录；`report.md` 开头写明本任务 scope（mode + 目标上下文）
- 工具：`npx @playwright/cli`（有头）；凭据来自项目根 `.env`（变量名见 env.md）
- **禁止**浏览器 MCP 替代探索；**禁止**图形 OCR / 短信验证码（除非 domain 明确要求且用户确认）
- **禁止**跳过本 Skill、直接用旧 helper / 手工脚本去「生成用例」或代替本任务实操验证

## 必产文件（缺一不可）

```text
{root}/explore/
  auth.json              # storageState
  list-snapshot.md       # 列表/入口页（操作验证后再拍）
  form-snapshot.md       # 目标上下文下的新建/编辑表单（操作验证后再拍）
  report.md              # 全字段表：必填/选填 + options + 已验证操作方式
  cases.md               # 用例说明书：每条用例的测什么 / 条件 / 怎么操作 / 预期
```

用例说明书格式见 [case-spec.md](../ui-flow-codegen/references/case-spec.md)。  
探索结束时至少写出本任务已知用例骨架；matrix 定稿后须与 `cases.md` 的 `## CASE_ID` **1:1**。  
文件名语义通用：`list` = 列表或主入口页，`form` = 待自动化的表单面。若 domain 另有页面（如「记录页」），在 report 中追加对应小节，不必强制改文件名。

## 登录与导航（读 env + domain）

1. 按 **env.md** 加载凭据并登录；成功 `state-save` → `auth.json`；失败则有头手动登录后再 save  
2. 按 **domain** 进入目标列表页：优先直达 URL/hash，失败再用菜单/文案（**exact**，避免模糊匹配多条）  
3. **成功标准**以 domain 写明的特征控件为准（按钮文案、placeholder 等），不以 URL 单独判定  
4. 真实路由与资料不符 → 回写 domain / env  

## 操作验证规则（强制，先于 snapshot 回写）

**禁止**只读 aria/DOM 就写入「推荐 locator」。每个要进 report 的控件必须先实操成功一次。

### 流程：分类 → 查经验 → 按剧本验证

```text
打开表单 / 切到目标上下文
  → 查 domain「已知控件模式」预置（若有）
  → 对每个下拉跑 control-patterns 探针，贴上模式 ID
  → 按该模式剧本验证（filterable 必须 fill 关键字后再选）
  → 写入字段表（含控件模式 + 操作方式）
  → 再 snapshot
```

| 模式（详见 control-patterns） | 「操作方式」写法示例 |
|------------------------------|----------------------|
| `static-select` | `combobox(标签) → option exact → 断言回显` |
| `filterable-select` / `remote-select` | `click → fill el-select__input「关键字」→ wait option → option exact` |
| `nameless-combo` | `group(标签) 内触发器 → （再套 static/filterable）` |
| `ep-radio-button` | `click .el-radio-button__inner 文案=…` |
| `plain-input` | `fill placeholder=…` |
| `submit-dialog` | `确认 → wait dialog hidden` |

仅出现在 snapshot、从未点选成功 → 标 `未验证`，**不得**当作可生成 locator；门禁不合格。  
**禁止**对 filterable/remote 在 options 为空时只写「选第一项」。

### 建议顺序

```text
登录 → 进列表 → 验证筛选项（可选）→ list-snapshot
  → 打开新建/目标表单
  → 切到 mode 要求的上下文（如某「维度」）并验证切换生效
  → 逐字段：定位 → 选值/填值 → 断言生效 → 记入字段表
  → form-snapshot
  → （建议）填满必填后试提交，确认能关弹层或列表可见唯一键
  → 写满 report.md → 按 domain 探关联页（如记录页）
```

## 全字段回写规则（强制）

1. **列表**：所有筛选项标签 + 点开后 options（过长可全文附件 + 表内摘要）  
2. **表单**：在 **当前 mode 目标上下文**下，表单内 **所有可见字段** 写入字段表；禁止只写覆盖轴  
3. **必填判定**：标签带 `*` /「必填」→ 是；提交校验点名 → 是；其余否；不确定 → 待确认（生成不得当选填跳过）  
4. **options**：能点开则记全文；采不到写 `未采到`（必填下拉时禁止 generate 猜值）  
5. **上下文联动**：字段随 Tab/维度等变化时，表内保留「上下文」列（或按上下文分表）  
6. **覆盖轴**（名称以 domain 的「全量覆盖轴」为准）单独一节，且与字段表一致  

## 通用 Checklist

```text
- [ ] 登录 + auth.json
- [ ] 进入 domain 指定列表；筛选项验证后 list-snapshot
- [ ] 打开新建/目标表单；切换到目标上下文并验证操作方式
- [ ] 目标上下文下：全字段验证 → 必填/选填/options/操作方式
- [ ] 覆盖轴相关下拉 options 采齐（不得长期「空/未开」）
- [ ] form-snapshot（验证之后）
- [ ] 记录唯一键（如 ID）列、行内开关/操作文案（若有）
- [ ] domain 要求的关联页（过滤方式 + 断言线索）
- [ ] 写满 report.md 后结束
- [ ] 写出/补齐 explore/cases.md（每条目标用例：测什么、条件、怎么操作、预期）
```

领域逐步清单写在 **domain** 包（`domains/<biz>/ui.md`「探索清单」），本 Skill 不复制业务文案。

## report.md 字段表模板

| 区域 | 上下文 | 字段标签 | 必填 | 控件 | 控件模式 | options / placeholder | 操作方式（已验证） | 推荐 locator |
|------|--------|----------|------|------|----------|----------------------|-------------------|--------------|
| 列表/表单 | … | … | 是/否/待确认 | … | static-select / filterable-select / … | … | … | … |

另需：mode 摘要、导航路径、入口按钮确切文案、唯一键取法、推荐默认（options ∩ defaults）、断言终态、试提交结果（若有）。

## 定位优先级

1. getByRole / getByLabel / getByPlaceholder（以验证通过为准）  
2. group + 无名 combobox / 表单项容器  
3. getByTestId  
4. 稳定可见文案 / 组件库稳定结构类  
5. 其它 CSS（最后）
