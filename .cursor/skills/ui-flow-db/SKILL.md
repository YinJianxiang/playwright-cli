---
name: ui-flow-db
description: >-
  为 UI+API 混合流准备数据库造数：seed-spec + capability resolve +
  copy-then-patch / hit·miss → plan→confirm→apply→verify。
  用于 ui-flow-codegen 第 2b 步、Job 前造数、连库/seed、DB 文档迭代。
---

# UI Flow DB（Step 2b）

在 `ui-flow-generate`（**suite=flow**）之后执行。  
本 Skill 定义 **通用造数生产方法**（场景默认 `rule_trigger`）；业务差异在 `domains/<biz>/db/`。

**禁止**臆造表名/字段/INSERT。文档或 capability 未齐时 **不阻塞** generate，保持 TODO / 缺口。

**`suite=ui` 禁止进入本步**。

`<skill-root>` = 本目录（`ui-flow-db/`）。

## 触发

- ui-flow-codegen Step 2b / 造数 / seed / 连库 / DB 文档  
- 扩展可造条件：改 `seed-capability.json`  
- 本批契约：批次 `explore/seed-spec-*.json`

## 开始前必读

1. [env-db.md](env-db.md)  
2. [references/docs-index.md](references/docs-index.md) → domains  
3. **当前业务**须已指定；未指定 → 询问后停止  
4. `domains/<biz>/db/README`、`01`–`06`、**`seed-capability.json`**  
5. [references/seed-contract.md](references/seed-contract.md) + [seed-spec.md](references/seed-spec.md)  

## 通用流水线（必须按序）

```text
1. 本批 seed-spec（手写或 plan 时 specOutDir 生成）
   - scenario=rule_trigger；mode=hit|miss；可选 pairId
   - recipeKey 对不上 capability → blocked，停止
2. Capability check → Resolve
3. Plan（rowStrategy: copy-then-patch | synthetic + hit|miss 算法）
4. formatSeedPlanForm 展示（含 strategy / source / mode）→ 用户确认
5. Apply → verify 聚合 → 可选 seed-log → Job / Cleanup
```

成对负向：同一 `pairId`，`mode=hit` 与 `mode=miss` 各造一次（不同实体 ID）。  
与说明书对齐：`cases-flow` 的 `-HIT`/`-MISS` ↔ 两次 plan/apply；缺成对则回 req-cases / generate，不单造 hit。

扩展覆盖面 = **加 capability 行**，不是加专用 Recipe 分支。

## Checklist

```text
Task Progress:
- [ ] 确认 domain 已指定
- [ ] 读 env-db / db 分册 / seed-capability.json
- [ ] 检查 _inbox；缺册列入缺口
- [ ] 写出或核对批次 seed-spec（mode / pairId / recipeKey）
- [ ] Capability check：key implemented（否则 Gap）
- [ ] planSeedViaDb → format 表单 → 确认 → seedViaDb
- [ ] 确认 apply 日志 SEED_VERIFY ok
- [ ] 禁止手写 INSERT；禁止未确认写库
```

## 硬约束

- 凭据只进项目根 `.env`  
- 禁止写生产库  
- 管控造数默认 `rule_trigger`（精确阈值），禁止套用看板「±15% 浮动灌数」  
- INSERT 前必须表单确认  
- 引擎：`tests/e2e/helpers/seed/engine.ts`；适配：`seed/{biz}.ts`

## 与编排关系

- 上一阶段：`../ui-flow-generate/SKILL.md`  
- 下一阶段：`../ui-flow-validate/SKILL.md`  
- 编排入口：`../ui-flow-codegen/SKILL.md`  
