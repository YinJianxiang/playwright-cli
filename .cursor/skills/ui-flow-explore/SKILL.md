---
name: ui-flow-explore
description: >-
  用有头 playwright-cli 对本任务目标页做探索：先验证点击/填写，再回写全字段清单。
  按 suite=ui|flow 对齐 cases-ui / cases-flow。每次生成自动化前必跑。
---

# UI Flow 探索（Step 1）

**先探索再生成 specs。** 无本阶段完整产物时，禁止进入 `ui-flow-generate`。  
**按任务探索**：范围 = 本轮 **suite** + mode / 维度 / 业务线 / 表单上下文；换任务或扩大范围必须新探或补探。

本 Skill 只规定**通用探索方法**。具体 URL、入口文案、业务 checklist、覆盖轴名称以当前 **domain** 为准（[`../domains/<biz>/ui.md`](../domains/README.md)）。**未指定 domain → 询问后停止。**

执行 suite 未指定 → 询问 `ui` | `flow`（见 [`../ui-flow-codegen/SKILL.md`](../ui-flow-codegen/SKILL.md)）。

## 前置

- 已读 `../ui-flow-codegen/env.md`、指定 **domain** + defaults、[handoff.md](../ui-flow-codegen/references/handoff.md)
- **必读** [control-patterns.md](../ui-flow-codegen/references/control-patterns.md)
- 编排已创建时间戳根目录；`report.md` 开头写明 **suite** + 本任务 scope
- 若已跑 `ui-flow-req-cases`：本 suite 对应 `cases-ui.md` 或 `cases-flow.md` 应已存在
- 工具：`npx @playwright/cli`（有头）；凭据来自项目根 `.env`
- **禁止**浏览器 MCP 替代探索；**禁止**跳过本 Skill 直接写 specs

## 必产文件

```text
{root}/explore/
  auth.json
  list-snapshot.md
  form-snapshot.md
  report.md
  cases-ui.md            # suite=ui 时必齐（或本步补齐骨架）
  cases-flow.md          # suite=flow 时必齐（或 cases.md 兼容）
```

说明书格式见 [case-spec.md](../ui-flow-codegen/references/case-spec.md)。  
matrix 定稿后须与对应 cases 的 `## CASE_ID` **1:1**。  
`list` = 列表/入口；`form` = 表单面。记录页等可在 report 追加小节。

## suite 差异

| suite | 探索重点 | 试提交 |
|-------|----------|--------|
| `ui` | 按 `cases-ui` 选择因切换上下文；**采齐目标下拉完整 options**；与期望清单对照写入 report（匹配/缺失/多余）；**不**要求提交成功 | 禁止以提交成功为门禁；可取消/关闭弹层 |
| `flow` | 目标上下文全字段 + 条件行 options；唯一键、开关、记录页线索 | 建议试提交确认能关弹层 |

同批若 UI 已探过**相同**上下文，flow 可复用 report 中已验证操作方式，但须确认上下文对齐；缺字段仍须补探。

## 登录与导航（读 env + domain）

1. 按 **env.md** 加载凭据并登录；成功 `state-save` → `auth.json`；失败则有头手动登录后再 save  
2. 按 **domain** 进入目标列表页：优先直达 URL/hash，失败再用菜单/文案（**exact**）  
3. **成功标准**以 domain 特征控件为准  
4. 真实路由与资料不符 → 回写 domain / env  

## 操作验证规则（强制，先于 snapshot 回写）

**禁止**只读 aria/DOM 就写入「推荐 locator」。每个要进 report 的控件必须先实操成功一次。

```text
打开表单 / 切到目标上下文
  → 查 domain「已知控件模式」预置（若有）
  → 对每个下拉跑 control-patterns 探针，贴上模式 ID
  → 按该模式剧本验证（filterable 必须 fill 关键字后再选）
  → 写入字段表（含控件模式 + 操作方式）
  → suite=ui：对照 cases-ui 期望 options，记差异
  → 再 snapshot
```

| 模式（详见 control-patterns） | 「操作方式」写法示例 |
|------------------------------|----------------------|
| `static-select` | `combobox(标签) → option exact → 断言回显` |
| `filterable-select` / `remote-select` | `click → fill el-select__input「关键字」→ wait option → option exact` |
| `nameless-combo` | `group(标签) 内触发器 → （再套 static/filterable）` |
| `ep-radio-button` | `click .el-radio-button__inner 文案=…` |
| `plain-input` | `fill placeholder=…` |
| `submit-dialog` | `确认 → wait dialog hidden`（**suite=ui 默认不用**） |

仅出现在 snapshot、从未点选成功 → 标 `未验证`，不得进入 generate。  
**禁止**对 filterable/remote 在 options 为空时只写「选第一项」。  
**禁止**因 explore 多采到选项而改写 `cases-ui` 期望清单（差异只记账，期望以需求/cases 为准）。

### 建议顺序

```text
登录 → 进列表 → 验证筛选项（可选）→ list-snapshot
  → 打开新建/目标表单
  → 按本 suite cases 切到目标上下文并验证
  → 逐字段：定位 → 选值/填值 → 断言生效 → 记入字段表
  → suite=ui：打开目标字段下拉，采完整 options + 对照期望
  → form-snapshot
  → suite=flow：（建议）试提交；探记录页线索
  → 写满 report.md
  → 补齐/核对 cases-ui 或 cases-flow
```

## 全字段回写规则（强制）

1. **列表**：筛选项标签 + options  
2. **表单**：当前目标上下文下所有可见字段写入字段表  
3. **必填判定**：`*` / 校验点名 → 是；不确定 → 待确认  
4. **options**：能点开则记全文；采不到写 `未采到`  
5. **上下文联动**：保留「上下文」列  
6. **覆盖轴**单独一节（flow / full 时尤其需要）  
7. **suite=ui**：增加「期望 vs 实采」对照节  

## 通用 Checklist

```text
- [ ] 确认 suite=ui | flow
- [ ] 登录 + auth.json
- [ ] 进入 domain 指定列表；list-snapshot
- [ ] 打开新建；切换到本 suite cases 目标上下文
- [ ] 全字段验证 → 必填/选填/options/操作方式
- [ ] suite=ui：目标下拉完整 options + 期望对照
- [ ] suite=flow：覆盖轴 options；唯一键/开关/记录页（若需要）
- [ ] form-snapshot
- [ ] 写满 report.md
- [ ] 核对 cases-ui 或 cases-flow（无则写骨架；有 req-cases 则勿无故改期望）
```

领域逐步清单写在 **domain** 包（`domains/<biz>/ui.md`），本 Skill 不复制业务文案。

## report.md 字段表模板

| 区域 | 上下文 | 字段标签 | 必填 | 控件 | 控件模式 | options / placeholder | 操作方式（已验证） | 推荐 locator |
|------|--------|----------|------|------|----------|----------------------|-------------------|--------------|
| 列表/表单 | … | … | 是/否/待确认 | … | static-select / … | … | … | … |

另需：suite、mode、导航路径、入口文案、唯一键取法（flow）、推荐默认、断言终态、期望对照（ui）。

## 定位优先级

1. getByRole / getByLabel / getByPlaceholder  
2. group + 无名 combobox / 表单项容器  
3. getByTestId  
4. 稳定可见文案 / 组件库稳定结构类  
5. 其它 CSS（最后）
