# 广告管控 · Domain 包

biz id：`ad-control`  
编排须用户**显式指定**本业务后，再读本包。

## 读序

1. [ui.md](ui.md) — 页面、链路、探索清单、控件预置  
2. [ui.defaults.md](ui.defaults.md) — 填表默认偏好  
3. [apis.md](apis.md) — Job URL、记录页轮询  
4. [env.md](env.md) — 本业务站点 URL / 菜单文案  
5. [db/README.md](db/README.md) — DB 分册、`seed-capability.json`、造数方法、`_inbox`  

通用方法：`ui-flow-req-cases`（需求→双套说明书）→ 按 suite 执行 `ui-flow-explore` / `ui-flow-generate` /（仅 flow）`ui-flow-db` / `ui-flow-validate`。  
- **suite=ui**：页面交互，断言 options（如维度×业务线→指标清单）  
- **suite=flow**：建规则→造数→Job→记录页（本包 ui.md / apis.md / db）

## 权威优先级（DB）

1. market-job DataControl 实现  
2. 本包 `db/` 分册  
3. `db/_inbox/` 测试 SQL 原稿  

## 代码落点

- 造数引擎：`tests/e2e/helpers/seed/engine.ts`  
- 业务适配：`tests/e2e/helpers/seed/ad-control.ts`（读 `db/seed-capability.json`）  
- 连接：`tests/e2e/helpers/db.ts`  
- 批次 helpers 通名：`auth.ts` / `rule.ts` / `job.ts`  
