---
name: ui-flow-codegen
description: >-
  编排 Playwright UI+API 流程：每次生成用例前必须先对本任务探索，再生成 → 造数 → 验证。
  支持冒烟/全量/scoped。用于 ui-flow-codegen、生成端到端自动化；业务细节只来自 domains/<biz>/。
---

# UI Flow Codegen（编排入口）

总编排。子 Skill：`ui-flow-explore` → `ui-flow-generate` → `ui-flow-db` → `ui-flow-validate`。  
`<skill-root>` = 本目录（`ui-flow-codegen/`）。

**分层：**

| 层 | 内容 |
|----|------|
| 通用 | 子 Skill、handoff 门禁、操作验证、字段表、scope 模式、默认偏好、本目录 `env.md`（鉴权变量） |
| 领域 | [`../domains/<biz>/`](../domains/)：UI、defaults、apis、业务 env、DB 分册 |

## 触发

- 按资料生成自动化 / 冒烟 / 全量 / scoped / ui-flow-codegen  
- 可只跑单阶段：只探索 / 只生成 / 只验证（**「只生成」仍须本任务已有合格 explore，否则先探索**）  

## 任务级探索（强制，禁止捷径）

**每次生成用例前，必须先对本任务做探索。** 不得因「以前探过广告维度 / 已有 helper / 用户只想快点出规则」而跳过。

| 规则 | 要求 |
|------|------|
| 一任务一批次 | 每个生成任务新建（或明确复用且上下文一致的）`tests/e2e/generated/{yyyyMMdd-HHmmss}/`，先跑 `ui-flow-explore` |
| 上下文对齐 | explore 的 mode / 维度 / 业务线 / 表单面必须覆盖**本任务要生成的用例范围**；缺任一目标上下文 → 补探，禁止用其它上下文 report 顶替 |
| 禁止复用错配 | 禁止拿旧批次 explore（例如仅「广告 · 新媒体-免费短剧」）直接生成「渠道 · 客户端-免费短剧」等用例 |
| 禁止凭记忆写码 | 禁止只靠聊天、旧 helper、domain 默认值猜测 locator/options 后写 `specs/` |
| 用户催生成 | 仍先 explore → handoff 门禁 → 再 generate；可向用户说明卡在探索，**不得**改走捷径 |

判定：「本任务」= 用户本轮指定的 domain + mode + 覆盖轴/点名条件（维度、业务线、指标等）。范围变化即新任务，须重新探索或补探后更新本批次 `explore/`。

## 开始前必读

1. [env.md](env.md)（通用凭据与登录策略；**无业务 URL**）  
2. **指定 domain**：用户须给出 biz id（见 [`../domains/README.md`](../domains/README.md)）。**未指定 → 询问后停止，禁止默认业务**  
3. 读该业务包 `README.md` 及读序文件（`ui.md` / `ui.defaults.md` / `apis.md` / `env.md` / `db/`）  
4. [references/default-preferences.md](references/default-preferences.md)  
5. [references/scope-modes.md](references/scope-modes.md)  
6. [references/handoff.md](references/handoff.md)  
7. [references/case-spec.md](references/case-spec.md)（用例说明书：测什么 / 条件 / 怎么操作 / 预期）  
8. [references/control-patterns.md](references/control-patterns.md)  
9. [references/repo-layout.md](references/repo-layout.md)  

## 工作流 Checklist

```text
Task Progress:
- [ ] Step 0: 解析 mode；确认 domain（未指定则询问并停止）
- [ ] Step 0b: 创建 tests/e2e/generated/{yyyyMMdd-HHmmss}/
- [ ] Step 1: ui-flow-explore（通用方法 + domain 探索清单；产出含 cases.md）
- [ ] Step 1b: handoff 门禁（含 cases.md）；未过不得 Step2
- [ ] Step 2: ui-flow-generate（只抄 report + cases + domain 链路/模板）
- [ ] Step 2b: ui-flow-db（读 domains/<biz>/db；plan→表单确认→再 INSERT；未齐则 TODO）
- [ ] Step 3: 询问是否跑测
- [ ] Step 4: 确认后 ui-flow-validate
```

## 硬约束

- **先探索再生成**：每个生成任务必须有**对本任务**合格的 `explore/`（含 `cases.md`）；门禁未过禁止生成  
- 禁止跳过探索直接点页面写 spec / 直接套旧 helper 生成用例  
- 禁止无用例说明书（测什么/条件/怎么操作/预期）生成 spec  
- 业务文案与 URL **只**来自 `domains/<biz>/` 与**本任务** explore，不写进通用子 Skill 正文  
- 凭据只从项目根 `.env` 读；禁止提交密钥  
- 同一次编排共用一个时间戳根目录  
- 阻塞即停并报告  

## 子 Skill

- 探索：`../ui-flow-explore/SKILL.md`  
- 生成：`../ui-flow-generate/SKILL.md`  
- 造数/DB：`../ui-flow-db/SKILL.md`  
- 验证：`../ui-flow-validate/SKILL.md`  

## 模板

- [templates/mixed-ui-api.spec.md](templates/mixed-ui-api.spec.md)
