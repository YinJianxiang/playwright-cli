# seedViaDb 契约

本文件定 **接口与语义**；表结构、SQL、码值见 `domains/<biz>/db/` 分册。

**连接层已实现**：`tests/e2e/helpers/db.ts` + `npm run db:ping`。  
**业务造数**：`tests/e2e/helpers/seed/{biz}.ts`（由当前 domain 指定 biz）。  
**权威**：业务 Job 实现 > domain `db/` 分册 > `_inbox` 原稿。

## 签名

```ts
async function planSeedViaDb(ruleId: string, opts?: SeedOpts): Promise<SeedPlan>;
function formatSeedPlanForm(plan: SeedPlan): string; // Markdown 表单
async function applySeedViaDb(plan: SeedPlan): Promise<SeedResult>;
/** 须 confirmed=true 或 E2E_SEED_AUTO_CONFIRM=1，否则抛错 */
async function seedViaDb(ruleId: string, opts?: SeedOpts & { confirmed?: boolean; plan?: SeedPlan }): Promise<SeedResult>;
```

## 确认门禁（强制）

| 场景 | 流程 |
|------|------|
| Agent / 对话造数 | ① `planSeedViaDb` ② `formatSeedPlanForm` 展示 ③ 用户确认 ④ `seedViaDb(id, { confirmed: true, plan })` |
| Playwright 无人值守 | `seedViaDb(id, { confirmed: true })` 或 `E2E_SEED_AUTO_CONFIRM=1` |

**未确认禁止 INSERT。** 确认后务必传入同一次 `plan`。

## 入参

| 项 | 说明 |
|----|------|
| `ruleId` | 业务主键（见 domain UI） |
| `opts.mode` | `'hit' \| 'miss'`（默认 `hit`） |
| `opts.confirmed` | 用户已确认拟插入表单 |
| `opts.plan` | 已展示并确认过的 `SeedPlan` |

## 语义

| mode | 含义 |
|------|------|
| `hit`（默认） | 造数应使后续 Job/流程对该 `ruleId` 能产生预期记录 |
| `miss` | 造数存在但不命中（负向；分册未定义前不做） |

## 调用时机

以当前 `domains/<biz>/ui.md` / `apis.md` 为准（常见：开开关 → 确认造数 → 调 Job → 验记录）。

## 未齐文档时

- 保持空实现 / TODO  
- 在批次 `README.md` 列出缺册  
- **禁止**臆造 INSERT  
