---
name: ui-flow-validate
description: >-
  在用户确认后按 suite=ui|flow 运行已生成的 Playwright 用例；失败先询问再 heal（最多 2 轮）；
  flow 可询问是否清理本批测试数据。用于跑测、验证 ui-flow，或 ui-flow-codegen 验证步。
---

# UI Flow 验证（Step 3）

## 前置

- 已确认 **suite=`ui` | `flow`**（未指定则询问）  
- 对应 specs 已存在：
  - `ui` → `{root}/specs/ui/*.spec.ts`
  - `flow` → `{root}/specs/flow/*.spec.ts`（兼容旧 `{root}/specs/*.spec.ts`）
- **必须先询问用户是否执行测试**；未确认 → 停止，不得 `playwright test`

## Checklist

```text
- [ ] 确认 suite
- [ ] 询问：是否运行本 suite 对应 specs？
- [ ] 用户确认后只跑该目录（禁止一次混跑 ui+flow，除非用户明确要求两者）
- [ ] 全部通过 → suite=flow 时按 domain 询问是否删除/清理；suite=ui 通常无需删规则
- [ ] 有失败 → 询问是否自动 heal（最多 2 轮）
- [ ] 用户拒绝 heal → 输出失败摘要并结束
- [ ] 用户同意 heal → 对照 report 修 locator/等待后重跑；仍失败再问或结束
- [ ] 追加「运行与修复记录」到 explore/report.md 或 README.md（注明 suite）
```

## 运行命令（示例）

```bash
# 分开执行
npx playwright test tests/e2e/generated/{yyyyMMdd-HHmmss}/specs/ui --headed
npx playwright test tests/e2e/generated/{yyyyMMdd-HHmmss}/specs/flow --headed

# 或仓库脚本（若配置指向 generated）
npm run test:generated
```

跑测后产物：

| 产物 | 路径 / 命令 |
|------|-------------|
| 录屏 / Trace / 截图 | `test-results/` |
| Playwright HTML | `npm run report:html` → `playwright-report/` |
| Allure | `npm run report:allure` |

凭据来自项目根 `.env`；有 `explore/auth.json` 时用 `storageState`。

Checklist 追加：

```text
- [ ] 跑测结束后提醒：report:html / report:allure；失败可看 test-results 录屏与 Trace
```

## Heal 规则

- **先问再修**；同意后最多 2 轮  
- 对照 `explore/report.md` 的操作方式与必填表，避免盲改  
- `suite=ui`：优先核对照期望 options 与实采、下拉打开方式；**不要**为「让用例过」而改成 Job 流  
- `suite=flow`：若含 API/异步断言，先核接口与唯一键，再改页面 locator  

## 清理

- **suite=flow**：跑完询问是否删除本批数据（文案随 domain）  
- **suite=ui**：默认不清理（通常未创建持久规则）；若误提交了规则再询问  
- CI 非交互：可用 env 开关（见 env.md，如 `E2E_DELETE_RULE=1`）
