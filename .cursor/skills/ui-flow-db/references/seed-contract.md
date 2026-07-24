# seedViaDb 契约（通用）

本文件定 **跨业务接口与语义**。表名、指标列等只来自 `domains/<biz>/db/seed-capability.json`，禁止臆造。

**连接层**：`tests/e2e/helpers/db.ts` + `npm run db:ping`  
**通用引擎**：`tests/e2e/helpers/seed/engine.ts`  
**业务适配**：`tests/e2e/helpers/seed/{biz}.ts`  
**批次契约**：[`seed-spec.md`](seed-spec.md)（本批要造什么）  
**权威**：业务 Job > domain `db/` 分册 > `_inbox` 原稿

## 场景

| scenario | 含义 |
|----------|------|
| `rule_trigger` | 管控规则命中/不命中（本仓库默认；非看板展示灌数） |

## 通用流水线

```text
seed-spec（可选）+ ruleId
  → Capability check（seed-capability.json）
  → rowStrategy: copy-then-patch | synthetic
  → computeHit | computeMiss
  → SeedPlan → formatSeedPlanForm → 确认
  → apply → verify 聚合 → seed-log → cleanup
```

## 签名

```ts
async function planSeedViaDb(ruleId: string, opts?: SeedOpts): Promise<SeedPlan>;
function formatSeedPlanForm(plan: SeedPlan): string;
async function applySeedViaDb(plan: SeedPlan, opts?: { specOutDir?: string }): Promise<SeedResult>;
async function seedViaDb(ruleId: string, opts?: SeedOpts): Promise<SeedResult>;
async function cleanupSeedViaDb(seed: ...): Promise<number>;
async function planFromSeedSpecFile(specPath: string, opts?: SeedOpts): Promise<SeedPlan>;
```

## SeedOpts（要点）

| 项 | 说明 |
|----|------|
| `mode` | `hit` \| `miss`（默认 hit） |
| `spec` | 已有 SeedSpec；可覆盖 mode / pair / strategy |
| `pairId` / `role` | 成对触发组：`trigger` / `non_trigger` |
| `rowStrategy` | 覆盖 capability 默认 |
| `specOutDir` | 写出 `seed-spec-*.json` / `seed-log-*.json` |
| `confirmed` / `plan` | 确认门禁 |

## mode

| mode | 含义 | role 默认 |
|------|------|-----------|
| `hit` | 指标落在比较真侧，Job 应出记录 | `trigger` |
| `miss` | 指标落在假侧，有数但不触发 | `non_trigger` |

成对用法：同一 `pairId`，先 hit 跑 Job 断言有记录，再 miss（新实体）断言无记录。

## rowStrategy

| 策略 | 行为 |
|------|------|
| `copy-then-patch` | 同源表取 1 条骨架列 → 覆盖实体 ID / 时间 / 指标 / statusDefaults；无源行回退 synthetic |
| `synthetic` | 仅用 capability `fixedDefaults` |

## 确认门禁

Agent：plan → format 展示 → 用户确认 → `seedViaDb(..., { confirmed: true, plan })`  
CI：`confirmed: true` 或 `E2E_SEED_AUTO_CONFIRM=1`

## 首版边界

| 情况 | 语义 |
|------|------|
| 单条件 | 矩阵有行且 implemented → 造 |
| 多条件 | 仅 `conditions[0]` |
| 矩阵无行 / spec.blocked | Gap，禁止 INSERT |
| apply 后 verify 失败 | 抛错（聚合未落在 mode 期望侧） |

## 未覆盖时

先加 capability 行；批次 seed-spec 可先写 `blocked`；禁止臆造 INSERT。
