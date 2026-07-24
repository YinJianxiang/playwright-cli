# 05 · 造数剧本（通用方法 + 本业务矩阵）

实现：

- 引擎：`tests/e2e/helpers/seed/engine.ts`（resolve / hit·miss / copy-then-patch / verify / seed-spec）
- 适配：`tests/e2e/helpers/seed/ad-control.ts`
- 矩阵：[`seed-capability.json`](seed-capability.json)
- 批次契约：[seed-spec.md](../../../ui-flow-db/references/seed-spec.md)

契约：[seed-contract.md](../../../ui-flow-db/references/seed-contract.md)。

## 场景

默认 **`rule_trigger`**：让 Job 对规则命中或不命中。  
（非 `dashboard_display` 看板灌数。）

## 总原则

1. 读规则 → 拼 `pline|dataType|timeType|column` → 查 capability  
2. 无行 / `implemented≠true` / `seed-spec.blocked` → **Gap，禁止 INSERT**  
3. `rowStrategy`：优先 `copy-then-patch`（骨架列），无源行回退 `synthetic`  
4. `mode=hit|miss` → 算指标列 → plan → 确认 → apply → **verify**  
5. 标记 `e2e_dc_*`；可选 `specOutDir` 写 seed-spec / seed-log  

## 本业务可执行矩阵

| key | strategy | mode | code |
|-----|----------|------|------|
| `cpsvideomf\|promotion\|0\|consume` | copy-then-patch | hit / miss | ✅ |

## 流程

| 步骤 | 动作 |
|------|------|
| 1 | `pingDb()` |
| 2 | `planSeedViaDb(ruleId, { mode, pairId, specOutDir })` |
| 3 | `formatSeedPlanForm(plan)` → **确认** |
| 4 | `seedViaDb(ruleId, { confirmed: true, plan, specOutDir })` |
| 5 | 看 `SEED_VERIFY`；调 Job；可选 `cleanupSeedViaDb` |

### 成对 hit / miss

```ts
await planSeedViaDb(id, { mode: 'hit', pairId: 'c1', specOutDir });
// 确认后 apply…
await planSeedViaDb(id, { mode: 'miss', pairId: 'c1', specOutDir });
```

## 验证

1. `npm run db:ping`  
2. apply 日志 `SEED_VERIFY ok`  
3. Job + 记录页（hit 有 / miss 无）  
