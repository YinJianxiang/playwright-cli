---
name: ui-flow-req-cases
description: >-
  从需求 Markdown（含本地配图）一次解析，同时产出 UI 校验与流程校验两套用例说明书。
  不写 Playwright specs、不造数、不调 Job。用于根据需求文档生成用例、UI/流程 cases、MD 含图解析。
---

# 需求 → 双套用例说明书

**生成一块，执行分开。** 本 Skill 只产出说明书；自动化分别走 `ui-flow-explore` → `ui-flow-generate`（按 `suite=ui` | `suite=flow`）。

编排入口见 [`../ui-flow-codegen/SKILL.md`](../ui-flow-codegen/SKILL.md)。说明书格式见 [`../ui-flow-codegen/references/case-spec.md`](../ui-flow-codegen/references/case-spec.md)。

## 触发

- 根据需求文档生成用例 / UI 校验用例 / 流程用例  
- 需求 MD 含图解析 / 从 PRD 拆 cases-ui 与 cases-flow  

## 输入（缺一则询问后停止）

| 项 | 要求 |
|----|------|
| domain | biz id（见 [`../domains/README.md`](../domains/README.md)）；**未指定禁止默认** |
| 需求路径 | 本地 `.md` 文件 |
| 批次根 | 可选；无则 `tests/e2e/generated/{yyyyMMdd-HHmmss}/` |

## 禁止

- 本 Skill 内写 `specs/`、`helpers/`、调 Job、造数、跑测  
- 流程条件不足时编造阈值/运算符  
- 文图冲突时静默采信单边  
- 把 UI 与 flow 揉进同一条「怎么操作」里当一条可执行整链  
- **flow 只写命中、不写不生效对照**（缺 HIT/MISS 成对视为不合格说明书）

## Checklist

```text
Task Progress:
- [ ] 确认 domain + 需求 md 路径；创建或复用批次根
- [ ] 读 MD 正文；收集全部本地图片引用；缺文件则列出并停止
- [ ] Read 逐张读图；与邻近章节合并可测项
- [ ] 写 explore/req-extract.md
- [ ] 写 explore/cases-ui.md（页面交互 → 期望 options）
- [ ] 写 explore/cases-flow.md：每条可跑条件必须 **HIT+MISS 成对**；缺条件则询问，一对均占位 blocked
- [ ] 更新批次 README.md（链到三份文档；注明执行须分别指定 suite；统计 flow 成对数）
```

## 步骤详解

### 1. 解析 Markdown + 图片

1. 读取需求 `.md` 全文  
2. 收集图片：``![...](rel)``、`<img src="rel">`；路径相对 **md 文件所在目录** 解析  
3. 任一本地文件不存在 → 列出缺失路径并 **停止**  
4. 对每张图用 Read 工具多模态查看（**不**依赖独立 OCR 库）  
5. 从正文与图抽取：维度/业务线等**选择因**、字段名、**指标/options 清单**、触发条件（时间/聚合/运算符/阈值，若有）  
6. 绑定规则：图归属于其上方最近的标题/段落上下文（见 [references/image-parse.md](references/image-parse.md)）  

文图冲突 → 在 `req-extract.md` 标 `conflict: true` 与双方内容，**询问用户**后再写入 cases 定稿。

### 2. 写出 `explore/req-extract.md`

模板见 [references/req-extract.md](references/req-extract.md)。每条可测项含：

- 选择因（如维度、业务线）  
- 变更点（新增指标/字段/options）  
- 来源（正文行号或图片相对路径）  
- 建议 suite：`ui` | `flow` | `both`  
- 冲突标记（若有）  

### 3. 同时起草两套说明书

| 文件 | suite | 内容重点 |
|------|-------|----------|
| `explore/cases-ui.md` | ui | 选择因 → 打开目标下拉 → **期望展示的 options**；不提交、不开开关、不 Job |
| `explore/cases-flow.md` | flow | 触发表 + **每条件 HIT（生效）/ MISS（不生效）成对**；step 对齐 domain 整链与 seed `mode` |

UI 块格式以 [case-spec.md](../ui-flow-codegen/references/case-spec.md)「suite=ui」为准。  
Flow 块格式以同文件「suite=flow / HIT+MISS 成对」为准。

**ad-control 示例话术**（仅示例，枚举以需求为准）：

- UI：`广告` × `新媒体-免费短剧` → 指标 options 含需求清单  
- Flow：同上下文 + 阈值条件 → 建规则 → 造数(`hit`/`miss`) → Job → 记录页（有命中 / 无命中）  

### 3b. Flow 成对规则（强制）

对每一个「规则触发」逻辑场景（同一选择因 + 同一条件表）：

1. 写 `<ID>-HIT`：`seed mode=hit`，终态 = 管控**生效**（记录页有命中）  
2. 写 `<ID>-MISS`：同一 `pairId=<ID>`，`seed mode=miss`，终态 = **不生效**（有数但不出该实体命中）  
3. 禁止只产出单条正向 flow；白名单/策略类若无法造 miss，须在备注写明原因并仍给出可替代负向断言，否则 `blocked`  
4. 造数细节对齐 [`ui-flow-db/references/seed-spec.md`](../ui-flow-db/references/seed-spec.md)

### 4. 流程条件不足 → 询问

若某条仅有「指标有哪些 / 枚举变更」，缺少可跑触发的 **时间、聚合、运算符、阈值**（或 domain 要求的等价字段）：

1. `cases-flow.md` 对该逻辑 id 写 **HIT + MISS 两个**占位节，均标注 `blocked: need-conditions`  
2. **在对话中询问用户**补充条件（可一次问齐，供两节共用）  
3. 用户补齐前 **不得**写成可执行定稿，也不得用 defaults 瞎填阈值  
4. 用户补齐后更新两节并去掉 blocked  

UI 用例不依赖触发条件，可照常定稿。

### 5. 批次 README

至少包含：

- domain、需求 md 路径、批次时间戳  
- 链到 `explore/req-extract.md`、`cases-ui.md`、`cases-flow.md`  
- 说明：**说明书已生成；执行自动化须分别触发 `suite=ui` 或 `suite=flow`**（见 ui-flow-codegen）  
- flow 统计：逻辑场景数、HIT/MISS 成对数、blocked 数  

## 产出目录

```text
tests/e2e/generated/{yyyyMMdd-HHmmss}/
  explore/
    req-extract.md
    cases-ui.md
    cases-flow.md
  README.md
```

（`auth.json` / `report.md` 等由后续 `ui-flow-explore` 按执行 suite 补齐。）

## 与后续阶段交接

| 用户意图 | 下一步 |
|----------|--------|
| 跑 / 生成 UI 自动化 | `suite=ui` → explore → generate（`specs/ui`）→ validate；**跳过** ui-flow-db |
| 跑 / 生成流程自动化 | 确认 `cases-flow` 无 `blocked` → `suite=flow` → explore → generate（`specs/flow`）→ ui-flow-db → validate |

本 Skill 结束后停止并提示用户选择执行 suite；**不要**自动连续 generate specs。
