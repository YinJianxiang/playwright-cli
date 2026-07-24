# 环境资料（通用）

通用约定。**具体页面 URL / 入口文案 / Job Host** 只在当前业务包：  
[`../domains/<biz>/env.md`](../domains/README.md)（及该包 `apis.md`）。

## 导航约定（通用）

1. **优先直达**：domain `env.md` / `ui.md` 给出的 URL / hash  
2. **成功标准**：domain 写明的特征控件，不以 URL 单独判定  
3. **直达失败**：按 domain 菜单文案 **exact** 点击  
4. 真实路由不符 → 回写 **domain 包**，不写回本文件业务表  

可选：`E2E_BASE_HOST` 用于拼接相对路径。

## `.env` 路径

| 形式 | 路径 |
|------|------|
| 绝对路径 | `d:\Project\playwright-ui\.env` |
| 相对仓库根 | `.env` |
| 示例占位 | `.env.example` |

- 真实账号只放本地 `.env` / CI secrets，**禁止提交** `.env`  
- 生成代码只读变量名，禁止硬编码密码/验证码  

## 鉴权变量（通用名）

| 变量 | 用途 |
|------|------|
| `E2E_USER` | 用户名（别名 `MARKET_ADMIN_USER`） |
| `E2E_PASSWORD` | 密码（别名 `MARKET_ADMIN_PASSWORD`） |
| `E2E_CAPTCHA` | 登录验证码**文本**（别名 `MARKET_ADMIN_SMS_CODE`，兼容旧名，**不是**短信流程） |
| `E2E_DELETE_RULE` | 可选。非交互是否删除本批测试数据（`1`=删；语义随 domain） |

```env
E2E_USER=your_username
E2E_PASSWORD=your_password
E2E_CAPTCHA=123456
```

## 数据库变量（造数 / ui-flow-db）

完整约定见 [`../ui-flow-db/env-db.md`](../ui-flow-db/env-db.md)。

| 变量 | 用途 |
|------|------|
| `E2E_DB_HOST` | MySQL 主机 |
| `E2E_DB_PORT` | 端口（默认 `3306`） |
| `E2E_DB_NAME` | 库名 |
| `E2E_DB_USER` | 用户名 |
| `E2E_DB_PASSWORD` | 密码 |
| `E2E_SEED_AUTO_CONFIRM` | 可选；`1`/`true` 时 Playwright 可跳过造数表单确认（仅 CI/无人值守） |

- 造数流程：[`../ui-flow-db/SKILL.md`](../ui-flow-db/SKILL.md)；表结构见 `domains/<biz>/db/`  
- 连库：Node + `mysql2`；`tests/e2e/helpers/db.ts`；`npm run db:ping`  

## 登录策略（通用）

1. 有头打开 **domain env** 中的登录页 → 按页面实际 Tab/表单填写 → 登录  
2. 成功 → `state-save` 到 `{root}/explore/auth.json`  
3. 失败 → 有头手动登录后 `state-save`  
4. **禁止**图形验证码 OCR；**禁止**短信流程（除非 domain 与用户明确要求）  
5. 正式用例优先 `storageState`  

## 外部服务

- Job / API：当前业务包 `apis.md`  
- DB：`ui-flow-db` + `domains/<biz>/db/`  

## 生成落盘

```text
tests/e2e/generated/{yyyyMMdd-HHmmss}/
```

见 [references/repo-layout.md](references/repo-layout.md)。
