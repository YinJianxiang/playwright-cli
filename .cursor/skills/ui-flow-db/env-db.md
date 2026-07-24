# DB 环境变量约定（Skill 必读）

真实连接信息只放项目根 `.env` / CI secrets，**禁止**提交、**禁止**写入本 Skill 目录。

## 配置落点

| 项 | 路径 |
|----|------|
| 真实连接 | 项目根 `.env`（与 `E2E_USER` 等同文件） |
| 占位示例 | 项目根 `.env.example` |
| 编排侧摘要 | [`../ui-flow-codegen/env.md`](../ui-flow-codegen/env.md)「数据库变量」节 |
| 本文件 | 变量名与探活约定（权威） |

## 变量名

| 变量 | 用途 | 必填（实现连库后） |
|------|------|-------------------|
| `E2E_DB_HOST` | 主机 | 是 |
| `E2E_DB_PORT` | 端口（常见 `3306`） | 是（可默认 3306） |
| `E2E_DB_NAME` | 库名 | 是 |
| `E2E_DB_USER` | 用户名 | 是 |
| `E2E_DB_PASSWORD` | 密码 | 是 |
| `E2E_SEED_AUTO_CONFIRM` | Playwright 无人值守跳过造数确认 | 否（Agent 交互造数禁止依赖此开关绕过确认） |

## `.env` 示例（占位）

```env
E2E_DB_HOST=your_host
E2E_DB_PORT=3306
E2E_DB_NAME=your_database
E2E_DB_USER=your_user
E2E_DB_PASSWORD=your_password
```

## 运行时约定

- 驱动：Node **`mysql2`**（已列入项目根 `package.json` 的 `devDependencies`；新环境执行 `npm install`）  
- 连接代码：[`tests/e2e/helpers/db.ts`](../../../tests/e2e/helpers/db.ts)（`getDbPool` / `query` / `execute` / `pingDb`）  
- CLI 探活：`npm run db:ping`（[`scripts/db-ping.mjs`](../../../scripts/db-ping.mjs)）  
- 与 Playwright 同进程，不经 Python  
- Skill / 生成代码只引用上表变量名，禁止硬编码主机/密码  
- 实现业务造数前：缺任一必填变量则停止并提示补 `.env`；表结构见 `domains/<biz>/db/` 分册  

## 连通性探针（人工 / Agent 排障）

1. 确认项目根 `.env` 已填 `E2E_DB_*`  
2. 确认依赖已装：`npm install`（含 `mysql2`）  
3. 执行：`npm run db:ping`  
4. 成功：打印 `DB_OK { ok: 1, db: '<E2E_DB_NAME>' }`  
5. 失败：检查主机可达、端口、账号权限、库名；看报错 `DB_FAIL` / `ECONNREFUSED` / `ER_ACCESS_DENIED_ERROR`  

## 规则

- 只连测试/约定环境；禁止把生产写库凭据写进仓库  
- 表结构、造数 SQL 不在本文件；见 `domain/<biz>/` 分册  
