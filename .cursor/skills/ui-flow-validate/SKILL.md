---
name: ui-flow-validate
description: >-
  在用户确认后运行已生成的 Playwright 用例；失败先询问再 heal（最多 2 轮）；
  并询问是否清理本批测试数据。用于跑测、验证 ui-flow，或 ui-flow-codegen 第 3 步。
---

# UI Flow 验证（Step 3）

## 前置

- `{root}/specs/*.spec.ts` 已存在
- **必须先询问用户是否执行测试**；未确认 → 停止，不得 `playwright test`

## Checklist

```text
- [ ] 询问：是否运行 {root}/specs 下用例？
- [ ] 用户确认后执行测试（可用仓库内 generated 配置或直接指 specs 目录）
- [ ] 全部通过 → 按 domain 询问是否删除/清理本批数据 → 记录结果
- [ ] 有失败 → 询问是否自动 heal（最多 2 轮）
- [ ] 用户拒绝 heal → 输出失败摘要并结束
- [ ] 用户同意 heal → 对照 report 修 locator/等待后重跑；仍失败再问或结束
- [ ] 追加「运行与修复记录」到 explore/report.md 或 README.md
```

## 运行命令（示例）

```bash
npm run test:generated
# 或
npx playwright test --config=playwright.generated.config.ts --headed
```

跑测后产物：

| 产物 | 路径 / 命令 |
|------|-------------|
| 录屏 / Trace / 截图 | `test-results/`（`video: on`，`trace: retain-on-failure`） |
| Playwright HTML | `npm run report:html` → `playwright-report/` |
| Allure | `npm run report:allure`（先有 `allure-results/`） |

凭据来自项目根 `.env`；有 `explore/auth.json` 时用 `storageState`。

Checklist 追加：

```text
- [ ] 跑测结束后提醒：report:html / report:allure；失败可看 test-results 录屏与 Trace
```

## Heal 规则

- **先问再修**；同意后最多 2 轮  
- 对照 `explore/report.md` 的操作方式与必填表，避免盲改  
- 若 domain 含 API/异步断言：先核对接口结果与唯一键，再改页面 locator  

## 清理

- 跑完询问是否删除本批数据（文案随 domain，如测试规则）  
- CI 非交互：可用 env 开关（见 env.md，如 `E2E_DELETE_RULE=1`）
