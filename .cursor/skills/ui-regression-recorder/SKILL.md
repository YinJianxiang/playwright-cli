---
name: ui-regression-recorder
description: 当用户要求初始化 UI 回归工程、录制操作、整理 Playwright codegen 脚本、抽取共享 helper、从已有能力组合新流程、执行具名 UI 操作，或从当前 Chrome/Playwright MCP 页面执行回归时使用。
---

# UI 回归录制器

用这个 skill 把人工 UI 流程变成可复用的回归体系。默认用中文回复，除非仓库文档明确要求英文。

## 工作方式

这个 skill 不只是「帮你录脚本」，而是 **流程规划 + 能力登记 + 脚本组装** 三合一。

可以这样理解：

1. 用户说出业务目标。
2. skill 拆成有序的业务步骤。
3. 逐步匹配已有的 capability、helper、spec 和 raw 录制。
4. 用可复用片段拼出最短可运行流程。
5. 只有缺了或过期了，才补录。

三层结构：

- **业务层**：要验证什么
- **能力层**：可复用动作，如打开页面、创建记录、编辑记录、校验列表行
- **脚本层**：raw 录制、整理后的 spec、helper、运行命令

一次完整录制，通常应同时产出：

- 一条完整 operation（操作流程）
- 多个可复用 capability（能力）

以后有新需求，优先 **组合已有 capability**，不要整段复制历史脚本。

## 环境要求

除非用户另有说明，默认环境如下：

- Node.js 18+
- 已安装 `playwright`，可用于 `codegen`、`test`、`install`
- 需要当前 Chrome 或 MCP 页面时，可用 `@playwright/mcp`
- `@playwright/cli` 可选
- 需要复用 Chrome 登录态时，优先 Playwright Chrome 扩展 + MCP `--extension`

缺依赖时先补环境，或明确告诉用户卡在哪。

## 组装原则

核心做法：

1. 把完整业务流程拆成有序的 capability
2. 把脚本拆成 raw 录制、整理后的 spec、共享 helper
3. 在 `flows.json` 里登记能力清单
4. 后续优先用已有 capability 组装
5. 只补录缺失或过期的部分

思考顺序：

- 业务目标是什么
- 哪些 capability 已有覆盖
- 怎样组合最短、最稳
- 怎样少录新脚本

## 速度策略

自动化如果比人工还慢，就没有意义。流程一旦明确，默认走快路径。

- 已知 operation 直接读 `flows.json` 调 helper，不要重新分析整页或重录。
- 已有 `spec` 或 `runCommand` 时，优先改参数回放；用 env 或 fixture 换数据，不要用 MCP 一步步点同一流程。
- 不要每步都 `browser_snapshot`；当前页模式开头 snapshot 一次，失败或有歧义时再 snapshot。
- 避免长时间 sleep；优先等事件或控件；不得不用固定等待时，尽量小于 1 秒。
- 已知步骤序列优先写成 Playwright 代码或 spec，不要拆成很多次单点点击。
- 默认 **headed** 可见浏览器；只有用户明确要求 CI、批量、无人值守或无界面时才 headless。
- 先用 `--list` 验证，再跑最小相关 spec 或当前页 helper。
- 当前页模式不要为了凑完整 E2E 而回到登录页，从用户当前位置开始。
- 登录后先看有没有弹窗遮罩；没有就继续，有就用 overlay helper 关掉。
- 失败时先回溯：验证上一步 capability 的完成条件，再改当前 selector。

## 工作模式

根据用户说法选择模式：

- **初始化工程**：「初始化当前工程」「初始化 UI 回归」「建立回归测试目录」
- **录制操作**：「录制某某操作」「我要录制」「从登录开始录制」
- **整理录制**：「整理录制脚本」「转成回归测试」，或提供了 raw spec 路径
- **执行操作**：「执行某某操作」「跑某某回归」「验证某某操作」
- **当前页模式**：「我已经在这个页面」「从当前页面开始」「不要重新登录」
- **组合已有流程**：用户要的新操作，可能由已有 capability 拼出来
- **重录或更新**：「需求变了」「重新录制」「更新某某操作」「页面改版了」「用新录制更新历史流程」

## 先规划，再选脚本

选代码前，先按业务目标规划。已有脚本只是候选实现，不是唯一依据。

稍复杂一点的任务，内部可按下面结构组织，并向用户简要说明：

```text
目标：验证列表页重名拒绝
启动模式：完整 E2E 或当前页
数据：recordName, pageName, moduleName
计划步骤：
1. 如需则确保已登录
2. 打开目标模块
3. 打开列表页
4. 用名称 X 创建记录，期望成功
5. 再次用名称 X 创建，期望重复拒绝
能力覆盖：
1. login-if-needed -> 已有
2. open-module -> 已有
3. open-list-page -> 已有
4. create-record -> 已有，重复两次、期望不同
缺失：无
执行方式：组合复用已有 helper
```

规则：

- 不要先找「最像的完整 spec」，先定义必须发生什么。
- 完整 spec 里虽然有相关动作，但 operation 不同，只复用 capability，不要整段搬 spec。
- 同一步要执行两次，优先 loop 或重复调用 helper。
- helper 只差期望结果，就扩展 helper，不要复制一份。
- 规划确认缺失或过期后再录。
- 最终脚本和计划步骤对齐，方便失败时回溯。

## 初始化工程

用户说「初始化当前工程」时：

1. 扫描项目是否已有 Playwright/E2E 结构：
   - `playwright.config.*`
   - `tests/e2e`、`e2e`、`tests/playwright`、`specs`
   - 已有 `helpers`、`fixtures`、`storageState`、`auth`
2. 没有合适结构时创建：

```text
tests/e2e/
  raw/
  specs/
  helpers/
  fixtures/
  .generated/
  flows.json
```

3. 若没有类似 helper，复制 `assets/playwright-common-flows.template.ts` 到 `tests/e2e/helpers/common-flows.ts`。
4. 若没有 `flows.json`，从 `assets/flows.template.json` 复制到 `tests/e2e/flows.json`。
5. 若 `flows.json` 已存在，**禁止清空**；只合并缺失的顶层字段，保留 operation 和 capability 历史。
6. 没有 Playwright 配置时不要过度设计；只有用户要跑项目级测试时，才加最小配置，否则产物放在 `tests/e2e` 即可。
7. 初始化后，建议从完整业务流程的第一个稳定页面开始首次录制。

## 录制操作

用户说「录制某某操作」时：

1. 询问或推断 operation slug，如 `create-record`、`search-order`、`edit-profile`。
2. raw 保存到 `tests/e2e/raw/<slug>.raw.spec.ts`。
3. 用户要真实录制时用 codegen：

```bash
playwright codegen --channel=chrome --target=playwright-test -o tests/e2e/raw/<slug>.raw.spec.ts <url>
```

4. 提醒用户：**Record 开着，Pick locator 关着**。
5. 录制结束后创建或更新：
   - `tests/e2e/specs/<slug>.spec.ts`
   - 发现共享流程时 `tests/e2e/helpers/<module>.ts`
   - `tests/e2e/flows.json`（operation 名称、文件、启动模式、capability、运行命令）
6. 即使用户只说了完整 operation，也要抽取 capability。常见示例：
   - `login-if-needed`
   - `open-module`
   - `open-list-page`
   - `create-record`
   - `edit-record`
   - `delete-record`
   - `verify-row`

## 整理录制

用户要求整理录制时：

1. **先保留 raw**；非空 raw 无备份前禁止覆盖。
2. 按业务步骤拆分，并去掉试错动作：
   - 重复导航
   - 填错又改
   - 重复按 Enter
   - 重复点击
   - 只为「回到干净状态」的无效导航
3. raw 不动，新建整理后的 spec。
4. 同时抽取：
   - 完整 operation
   - 可复用的子 capability
5. 稳定 selector 的优先级：
   - `getByRole`
   - `getByLabel`
   - `getByPlaceholder`
   - 精确可见文本
   - 稳定的 URL 断言
6. 关键跳转后加断言。
7. 要产出多个整理后的测试时，先抽共享 helper。

## 从已有能力组合

用户要的新操作，可能由已有片段拼出来时：

1. 解析意图：模块/页面、动作、目标数据、启动模式。
2. 读 `tests/e2e/flows.json`。
3. 注册表不完整时，搜索 helper 和 spec：

```bash
rg -n "创建|编辑|删除|列表|详情|保存|提交|查询" tests/e2e
```

4. 列出 capability 覆盖情况：
   - 已有，可直接复用
   - 已有，但要改参数
   - 缺失，需要补录
5. 组最短、最稳的计划，不重复写已有 helper。
6. 只缺一部分时，只录缺的部分，不要整条重录。

## 执行操作

用户说「执行某某操作」时：

1. 选脚本前先规划目标业务流程。
2. 读 `tests/e2e/flows.json`。
3. 每一步匹配已有 operation、capability、helper export、整理后的 spec 或 raw spec。
4. 优先最短复用路径：
   - 已登记 operation，只改数据
   - 重复调用已有 capability
   - 多个 capability 拼成 spec
   - 只补一条缺失 capability 的录制
5. 计划能映射到带 `spec` 或 `runCommand` 的 operation 时，视为可执行。
6. 重复动作时，用同一 helper 多次调用、换数据或期望，不要另起一条无关 flow。
7. 已规划且已登记的 flow，不要用 MCP 一步步点，除非用户要求当前页模式，或脚本已经失败。
8. 某步没有匹配 capability 时，明确说缺哪一个，并建议只录这部分。

运行前确认浏览器是否可见：

- 给人看的回归，默认 headed。
- 用户明确要求 CI、批量、最快无人值守、headless 或无界面时，才 headless。
- 逐步调试时用 `PWDEBUG=1`。

## 重复调用同一能力

重名校验、重复提交、批量创建、「同一动作做两次」这类需求，优先重复已有 capability 并改期望，不要另写一条大流程。

推荐做法：

1. 在 `flows.json` 找到 capability，如 `create-record`。
2. 导航和前置步骤只做一次。
3. 重复调用同一 helper：
   - 第一次：期望成功
   - 第二次：期望重复或拒绝
4. helper 只支持「成功」时，给它加 `expected` 选项。
5. 新 operation 登记为同一 capability 的组合或重复。
6. 汇报时写清楚：复用了同一 helper 两次，只改了期望结果。

示例：

```ts
await openListPage(page, 'Example List');
await createNamedRecord(page, { name: recordName }, { expected: 'success' });
await createNamedRecord(page, { name: recordName }, { expected: 'duplicate', duplicateMessage: /already exists|duplicate/i });
```

## 失败回溯

第 N 步卡住时，不要先认定第 N 步 selector 错了，先确认第 N-1 步是否真的完成。

按这个顺序查：

1. 从 test step、堆栈、locator 或 `flows.json` 顺序，定位失败的 capability。
2. 在 `dependsOn` 或 `capabilities` 里找上一步。
3. 验证上一步完成条件（postcondition）：
   - URL/标题是否到了预期页面
   - 预期文本或列表行是否出现
   - 弹窗/新标签是否处理正确
   - 有没有遮罩挡住下一步点击
   - 异步跳转或列表刷新是否结束
4. 上一步没完成，就修上一步 helper 或补断言，先别改当前 selector。
5. 上一步确认完成后，再查当前步的 selector、数据、权限、网络或 UI 变更。

## 当前页模式

用户要从已打开页面开始时：

1. 用 MCP snapshot 或浏览器状态查看当前 URL、标题、可见控件。
2. 确认起始页和请求的 flow 一致。
3. 只执行从当前页开始的局部动作。
4. 把动作沉淀成接收 `page` 和测试数据的 helper。
5. 当前页动作和完整登录测试分开写，避免容易失效的登录会话被踢掉。

## 重录或更新流程

页面改了，或用户要重录时：

1. 先确定范围：
   - 单个 capability
   - 单个 operation
   - 一条包含多个 capability 的大录制
2. 新版本不要覆盖旧版本：

```text
tests/e2e/raw/<slug>.v<next>.raw.spec.ts
```

3. 新版本验证通过前，保留旧的整理 spec 和 helper。
4. 对比新旧 raw/整理 spec 与旧 helper/spec：
   - selector 是否变了
   - 导航是否变了
   - 是否新增必填项
   - 是否删了字段
   - 断言是否变了
5. 尽量只改最小可复用 helper。
6. 遍历 `flows.json` 依赖，标记受影响的 operation。
7. 对受影响的 spec 先跑 `--list`，再跑最小代表性真实 flow。
8. 更新 `flows.json` 的版本和历史记录。

## 流程注册表

维护 `tests/e2e/flows.json`，让用户以后可以直接说「执行某某操作」。内容要精简、机器可读。

推荐 operation 字段：

- `slug`
- `name`
- `aliases`
- `mode`
- `rawSpec`
- `spec`
- `helpers`
- `capabilities`
- `dependsOn`
- `version`
- `startPage`
- `preconditions`
- `postconditions`
- `runCommand`
- `history`

推荐 capability 字段：

- `slug`
- `name`
- `aliases`
- `helper`
- `export`
- `sourceOperations`
- `parameters`
- `version`
- `startPage`
- `endPage`
- `preconditions`
- `postconditions`

## 常用命令

临时直接录制：

```bash
playwright codegen --channel=chrome --target=playwright-test -o outputs/recorded-direct.spec.ts <url>
```

项目内录制：

```bash
playwright codegen --channel=chrome --target=playwright-test -o tests/e2e/raw/<slug>.raw.spec.ts <url>
```

只列出测试，不执行：

```bash
NODE_PATH=$(npm root -g) playwright test tests/e2e/specs/<slug>.spec.ts --list
```

可见浏览器运行：

```bash
NODE_PATH=$(npm root -g) playwright test tests/e2e/specs/<slug>.spec.ts --headed --reporter=line
```

无界面模式运行（适合 CI）：

```bash
NODE_PATH=$(npm root -g) playwright test tests/e2e/specs/<slug>.spec.ts --reporter=line
```

调试运行：

```bash
PWDEBUG=1 NODE_PATH=$(npm root -g) playwright test tests/e2e/specs/<slug>.spec.ts --debug --reporter=line
```

初始化当前工程：

```text
使用 ui-regression-recorder。初始化当前工程。
```

录制具名操作：

```text
使用 ui-regression-recorder。我要录制一个「创建记录」操作，从第一个稳定页面开始录。
```

执行具名操作：

```text
使用 ui-regression-recorder。验证列表页上的重名拒绝。先规划流程，再复用已有 helper，默认打开可见浏览器。
```

从当前页执行：

```text
使用 ui-regression-recorder。我已经在目标页面上了，从当前页面继续，不要重新登录。
```

## 新会话提示词模板

新开 Agent 会话时可以直接用：

```text
使用 ui-regression-recorder。

目标：把我刚录制的 Playwright codegen 脚本整理成可复用回归测试，并在必要时用 Playwright MCP 或 Chrome 当前登录态执行验证。

输入：
- 原始录制文件：<填 raw spec 路径>
- 目标业务流程：<例如 登录 -> 打开模块 -> 打开列表页 -> 创建记录>
- 期望结果：<例如 列表里出现新记录，或重复名称被拒绝>
- 是否允许自动登录：<允许/不允许；单会话 SSO 默认不允许>
- 测试数据策略：<固定名称/时间戳唯一名称/从环境变量读取>
- 是否从当前页面开始：<是/否；如果是，不要生成登录和前置导航>

要求：
1. 不要覆盖原始录制文件，先备份。
2. 产出整理后的 spec。
3. 清理试错步骤、重复点击、错误填值和无意义导航。
4. 抽取公共流程 helper，避免每个脚本重复登录、重复导航、重复关弹窗。
5. selector 优先用 role、label、placeholder 和精确文本。
6. 用 `test.step` 分业务步骤，并在关键跳转后加断言。
7. 先执行 `--list` 验证脚本能被识别。
8. 如果需要跑真实创建动作，先确认是否会重复登录踢掉会话；能用 Chrome 当前登录态就不要自动登录。
9. 如果我说从当前页面开始，只写或只跑后半段动作，并把它沉淀成可复用 helper。
10. 最后告诉我：原始脚本路径、整理后脚本路径、公共 helper 路径、验证结果、以及后续回归执行命令。
```

## 实践建议

- 单会话 SSO 系统，把「整理脚本」和「实跑验证」分开处理。
- 不要把 codegen 录制和 MCP 观察混进同一份产物；codegen 是原始素材，MCP 观察是验证依据。
- 录制时按钮点不动，先检查是否误开了 Pick locator，再改脚本。
- 第二次录制如果重复了已知前置路径，先重构第一条整理脚本，再加第二条。
- 当前页已经满足前置条件时，不要为了让脚本「看起来像完整 E2E」而离开当前页。
- 文档或公共模板里的示例名保持通用，如 `open-list-page`、`create-record`、`verify-row`。

## 资源

- `assets/playwright-common-flows.template.ts`：公共 Playwright helper 初始模板
- `assets/flows.template.json`：operation 与 capability 初始注册表
