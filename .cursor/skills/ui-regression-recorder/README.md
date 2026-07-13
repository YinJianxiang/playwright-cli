# UI 回归自动化 Skill

把一次人工 UI 操作沉淀成可复用的自动化能力，再基于这些能力组装新的测试流程，而不是每来一个需求就重录一遍。

## 核心思路

不是「录一次，以后一直重放」，而是：

1. 先录一条完整业务流程
2. 拆成可复用的业务能力（capability）
3. 把脚本分成原始录制、整理后的用例、公共步骤封装（helper）
4. 登记到 `flows.json`
5. 后续优先用已有能力拼出新流程

## 目录结构

```text
.cursor/skills/ui-regression-recorder/
├── SKILL.md                              # Agent 执行指引
├── README.md                             # 使用说明
└── assets/
    ├── flows.template.json               # flows.json 模板
    └── playwright-common-flows.template.ts  # 公共 helper 模板
```

项目里初始化后会生成测试目录：

```text
tests/e2e/
├── raw/          # codegen 原始录制，只存不改
├── specs/        # 整理后可执行的测试用例
├── helpers/      # 可复用的步骤封装
├── fixtures/     # 测试数据
├── .generated/   # 运行时临时文件
└── flows.json    # 流程与能力清单
```

## 安装

复制到 Cursor 个人 skill 目录：

```powershell
Copy-Item -Recurse -Force ".cursor\skills\ui-regression-recorder" "$env:USERPROFILE\.cursor\skills\ui-regression-recorder"
```

也可以只放在当前项目里（本仓库即如此）：

```text
.cursor/skills/ui-regression-recorder/
```

装好后 **重启 Cursor**，或新开一个 Agent 会话。

## 环境要求

- Node.js 18+
- `playwright`（支持 codegen、test、install）
- 可选：`@playwright/mcp`（从当前页继续、复用 Chrome 登录态）
- 可选：Playwright Chrome 扩展（直接复用已登录的 Chrome）

```powershell
npm install -g playwright @playwright/mcp
playwright install chromium
```

## 快速开始

### 1. 初始化工程

```text
使用 ui-regression-recorder。初始化当前工程的 UI 回归目录。
```

### 2. 录制操作

```text
使用 ui-regression-recorder。我要录制「创建记录」操作，目标 URL：https://你的站点
```

录制时注意：**保持 Record 开启，关闭 Pick locator**。

### 3. 整理录制

```text
录完了，帮我整理录制脚本。操作名称：创建记录
```

### 4. 执行回归

```text
使用 ui-regression-recorder。执行「配置书剧暂停」回归，默认打开可见浏览器。
```

## 工作模式

| 模式 | 你可以这样说 |
|------|-------------|
| 初始化工程 | 初始化当前工程 / 初始化 UI 回归 |
| 录制操作 | 录制某某操作 / 我要录制 |
| 整理录制 | 整理录制脚本 / 转成回归测试 |
| 执行操作 | 执行某某操作 / 跑某某回归 |
| 当前页模式 | 我已经在这个页面 / 不要重新登录 |
| 组合流程 | 用已有能力拼新流程 |
| 更新重录 | 页面改版了 / 重新录制 |

## 录制和 AI 各做什么

| 环节 | 谁来做 |
|------|--------|
| 在浏览器里操作并录制 | 你 + Playwright codegen |
| 整理 raw、抽 helper、维护 flows.json | AI + 本 skill |
| 组合新用例、修失败步骤、跑回归 | AI + 本 skill |

## 常用命令

项目内录制：

```bash
playwright codegen --channel=chrome --target=playwright-test -o tests/e2e/raw/<slug>.raw.spec.ts <url>
```

查看有哪些用例：

```bash
npx playwright test tests/e2e/specs --list
```

打开可见浏览器运行：

```bash
npx playwright test tests/e2e/specs/<slug>.spec.ts --headed --reporter=line
```

## 注意事项

- 原始录制（raw）保留不覆盖；账号密码放 `.env`，不要提交到 Git
- 单点登录（SSO）场景优先用「当前页模式」
- 默认打开可见浏览器；只有跑 CI 或你明确要求时才用无界面模式
- 某一步失败时，先检查上一步是否真的完成，再改当前步骤的定位
