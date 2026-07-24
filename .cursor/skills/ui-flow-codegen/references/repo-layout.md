# 仓库落盘约定（repo-layout）

## 本项目约定（E21）

生成与探索产物统一：

```text
tests/e2e/generated/{yyyyMMdd-HHmmss}/
  explore/
    req-extract.md      # 可选：需求抽取
    cases-ui.md         # UI 说明书
    cases-flow.md       # 流程说明书
    cases.md            # 兼容旧批次
  helpers/
  specs/
    ui/
    flow/
  matrix-ui.json
  matrix-flow.json
  matrix.json           # 兼容旧批次
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
- `rule.ts` — 建规则、取主键、开关（文案抄 domain；**suite=ui 可不生成提交/开关**）  
- `options.ts` — 可选：打开目标下拉、列举 options（suite=ui）  
- `job.ts` — 调 Job / API；引用共享 `seedViaDb`（**仅 suite=flow**）  
- `records.ts` — 记录页轮询断言（仅 flow）  
- `cleanup.ts` — 删除（经询问或 `E2E_DELETE_RULE`；仅 flow 常用）  

共享（仓库级）：

- `tests/e2e/helpers/db.ts` — `E2E_DB_*` + mysql2；`pingDb` / `query` / `execute`  
- `tests/e2e/helpers/seed/engine.ts` — 通用造数引擎（resolve / hit / INSERT）
- `tests/e2e/helpers/seed/{biz}.ts` — 业务适配（读 `domains/<biz>/db/seed-capability.json`）
- `domains/<biz>/db/seed-capability.json` — 可执行矩阵（代码权威）  
- CLI：`npm run db:ping`  

## 环境变量文件

- 登录 + DB 均在项目根 `.env`；占位见 `.env.example`  
- DB 变量权威说明：`../ui-flow-db/env-db.md`  
- 业务站点 URL：`domains/<biz>/env.md`  

## Playwright 配置

沿用仓库 `playwright.config.ts` / `playwright.generated.config.ts`（含录屏、HTML、Allure）：

```bash
# 按 suite 分开跑（示例）
npx playwright test tests/e2e/generated/{ts}/specs/ui --headed
npx playwright test tests/e2e/generated/{ts}/specs/flow --headed

npm run test:generated
npm run report:html
npm run report:allure
```
