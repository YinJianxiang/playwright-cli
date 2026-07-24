# 阶段产物交接（handoff）

同一次编排共用根目录：

```text
tests/e2e/generated/{yyyyMMdd-HHmmss}/
  explore/           # Step 1（门禁）
    auth.json
    list-snapshot.md
    form-snapshot.md
    report.md
    cases.md           # 用例说明书（测什么/条件/怎么操作/预期）
  helpers/           # Step 2
  specs/             # Step 2
  matrix.json
  README.md
```

## 门禁（强制）

| 进入阶段 | 必须已有 |
|----------|----------|
| **generate** | 下列**全部**满足，否则**拒绝生成**、回 explore： |
| | - **本任务已探索**：`report.md` 写明的 mode/上下文覆盖本轮生成范围；换维度/业务线/表单面须本批次已探，禁止复用错配旧批次 |
| | - `explore/auth.json`、`list-snapshot.md`、`form-snapshot.md`、`report.md`、**`cases.md`** 均在**同一** `{root}/explore/` |
| | - **`cases.md`**：`matrix` 每一行（或本任务每条将生成的用例）有 `## <CASE_ID>`；含测什么、条件、怎么操作、预期终态（见 [case-spec.md](case-spec.md)） |
| | - `explore/report.md` 含：导航路径、**扩列字段表**、覆盖轴 options、入口按钮确切文案、主键/唯一键 locator 与取法 |
| | - 字段表含列：上下文、字段标签、**必填**、控件、options/placeholder、**操作方式（已验证）**、推荐 locator（推荐含**控件模式**） |
| | - 目标上下文下每个「必填=是」的下拉：options **非**「空/未开/未采到」；`filterable`/`remote` 须写 fill 剧本；`ep-select-v2` 须写 wrapper + option-item（**form 显式值优先**，未指定才不限；易丢值注明末尾再选） |
| | - **禁止** filterable/remote 在 options 为空时只写「选第一项」；**禁止**把 v2 当普通 select / 只数 `role=option`；**禁止**用 defaults「不限」覆盖用户/矩阵已指定值 |
| | - 至少记录：上下文切换控件、典型 combobox、提交按钮 的已验证操作方式（不得全是「未验证」） |
| | - 禁止：必填下拉未采到 options，却指望 generate 用 defaults 猜枚举 |
| | - 禁止：未跑本任务 explore 就生成 / 复制旧 specs / 用旧 helper 硬套新范围 |
| | - 禁止：无 `cases.md` 或 matrix 行与说明书不对齐就生成 |
| **ui-flow-db（Step 2b）** | generate 已产出即可进入；**DB 分册未齐不挡 generate**。本步可只检查文档并在批次根 `README.md` 写造数缺口清单；`seedViaDb` 保持 TODO。禁止臆造表/SQL。文档见 `../ui-flow-db/` |
| validate | `specs/*.spec.ts`；**用户已确认执行** |

**禁止**无 explore 产物凭猜测写 locator/枚举。  
**禁止**未经操作验证的 locator 进入 generate。  
**禁止**跳过探索直接生成用例（含「用户催进度」「只改枚举」「手工脚本代替 explore」）。  
**禁止**无用例说明书（测什么/条件/怎么操作/预期）生成 spec。  
**禁止**无 `ui-flow-db` 分册定稿时假装已完成造数。

覆盖轴具体名称（如维度/业务线/指标）以当前 **domain** 为准，不在本文件写死。

## explore/report.md 最低内容

- **本任务 scope**（mode + 目标维度/业务线等上下文；须与后续 matrix/specs 一致）  
- mode 与范围摘要  
- 导航路径 / 最终 URL  
- 列表 + 表单全字段表（必填、options、已验证操作方式）  
- 覆盖轴 options（与表一致）  
- 入口文案、唯一键取法  
- 推荐默认（options ∩ defaults）  
- 断言终态（见 domain）  
- （建议）试提交是否成功关闭弹层  

## explore/cases.md

见 [case-spec.md](case-spec.md)。matrix 行与 `## CASE_ID` 必须 1:1。

## validate 追加

在 `explore/report.md` 或根 `README.md` 追加「运行与修复记录」。

## 文件交接

禁止只靠聊天记忆；下一阶段只读本时间戳目录内文件 + Skill / domain 资料。
