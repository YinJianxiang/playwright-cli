# 仓库落盘约定（repo-layout）

## 本项目约定（E21）

生成与探索产物统一：

```text
tests/e2e/generated/{yyyyMMdd-HHmmss}/
  explore/
  helpers/
  specs/
  matrix.json
  README.md
```

不要写入旧的共享 `tests/e2e/specs` 以免覆盖历史；每次编排新目录。

## 探测（其它仓库若复用本 Skill）

若无 `tests/e2e`，则退化为：

```text
tests/generated/{yyyyMMdd-HHmmss}/
```

并在 README 写明实际路径。

## Helper 拆分建议（批次内通名）

批次目录已隔离一次编排；helpers **用通名**，勿把 biz 写进文件名：

- `auth.ts` — 登录（读项目根 `.env`；优先 `explore/auth.json` + storageState）  
- `rule.ts` — 建规则、取主键、开关（文案抄 domain）  
- `job.ts` — 调 Job / API；引用共享 `seedViaDb`  
- `records.ts` — 记录页轮询断言（可选）  
- `cleanup.ts` — 删除（经询问或 `E2E_DELETE_RULE`）  

共享（仓库级）：

- `tests/e2e/helpers/db.ts` — `E2E_DB_*` + mysql2；`pingDb` / `query` / `execute`  
- `tests/e2e/helpers/seed/{biz}.ts` — 业务造数（plan / confirm / apply）  
- CLI：`npm run db:ping`  

## 环境变量文件

- 登录 + DB 均在项目根 `.env`；占位见 `.env.example`  
- DB 变量权威说明：`../ui-flow-db/env-db.md`  
- 业务站点 URL：`domains/<biz>/env.md`  

## Playwright 配置

沿用仓库 `playwright.config.ts` / `playwright.generated.config.ts`（含录屏、HTML、Allure）：

```bash
npm run test:generated
npm run report:html
npm run report:allure
```
