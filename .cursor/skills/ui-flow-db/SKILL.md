---
name: ui-flow-db
description: >-
  为 UI+API 混合流准备数据库造数：检查 domains/<biz>/db 分册、列出缺口、驱动 seedViaDb。
  用于 ui-flow-codegen 第 2b 步、Job 前造数、连库/seed、DB 文档迭代。
---

# UI Flow DB（Step 2b）

在 `ui-flow-generate` 之后执行。本 Skill **只消费** `domains/<biz>/db` 分册，禁止臆造表名/字段/INSERT。  
文档未齐时 **不阻塞** generate，保持造数 TODO 并列出缺册。

`<skill-root>` = 本目录（`ui-flow-db/`）。

## 触发

- ui-flow-codegen Step 2b / 造数 / seed / 连库 / DB 文档  
- 用户向 `domains/<biz>/db/_inbox/` 补充资料后要求消化进分册  

## 开始前必读

1. [env-db.md](env-db.md)（变量名约定；真实值只在项目根 `.env`）  
2. [references/docs-index.md](references/docs-index.md) → [`../domains/README.md`](../domains/README.md)  
3. **当前业务**须已由编排指定；未指定 → 询问后停止  
4. 读 `domains/<biz>/db/README.md` 及读序 `01`–`06`  
5. [references/seed-contract.md](references/seed-contract.md)  

业务 UI 链路以 `domains/<biz>/ui.md` 与批次 `explore/report.md` 为准。

## Checklist

```text
Task Progress:
- [ ] 确认 domain 已指定（否则询问并停止）
- [ ] 读 env-db（确认变量名已约定；本步不强制 .env 已配齐）
- [ ] 读 domains/<biz>/db/README → 按读序检查 01–06
- [ ] 检查 domains/<biz>/db/_inbox/：有未消化文件则列入缺口，不擅自归并业务结论
- [ ] 分册未齐 → 保持 seedViaDb TODO；在批次 README（或对话）列出缺册
- [ ] 分册已齐 → 按 seed-contract 实现/调用 helpers/seed/{biz}.ts
- [ ] 造数前：planSeedViaDb → formatSeedPlanForm **表单展示** → 等用户确认 → 再 INSERT
- [ ] 禁止猜测表名 / 字段 / INSERT；禁止未确认写库
```

## 硬约束

- 凭据只进项目根 `.env`；禁止写入本 Skill 任何文件  
- 禁止写生产库；造数目标以文档与测试环境为准  
- 字段取值优先 explore 已验证 options ∩ domain defaults，不猜枚举  
- 文档未齐：**允许**空实现 + 缺口清单；**禁止**假装已造数  
- **INSERT 前必须**把拟写入行以表单（Markdown 表）展示并获用户确认  
- 原始资料先入 `domains/<biz>/db/_inbox/`，消化后写入 `01`–`06` 并记该包 `changelog.md`  

## 与编排关系

- 上一阶段：`../ui-flow-generate/SKILL.md`  
- 下一阶段：询问跑测 → `../ui-flow-validate/SKILL.md`  
- 编排入口：`../ui-flow-codegen/SKILL.md`  
