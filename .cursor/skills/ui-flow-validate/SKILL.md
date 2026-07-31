---
name: ui-flow-validate
description: >-
  在用户确认后按 suite=ui|flow 运行已生成的 Playwright 用例；
  失败则自动 heal（最多 2 轮），穷尽后记彻底失败并继续下一条；
  flow 可询问是否清理本批测试数据。用于跑测、验证已有 specs。
---

# UI Flow 验证（Step 3）

## 前置

- 已确认 **suite=`ui` | `flow`**（未指定则询问）  
- 对应 specs 已存在：
  - `ui` → `{root}/specs/ui/{CASE_ID}.spec.ts`（一 CASE 一文件；兼容旧多 CASE 单文件）
  - `flow` → `{root}/specs/flow/{CASE_ID}.spec.ts`（HIT/MISS 各一文件；兼容旧路径）
- **必须先询问用户是否执行测试**；未确认 → 停止，不得 `playwright test`  
- 用户确认跑测后：**失败默认自动 heal**，不必再问「是否 heal」（除非用户明确说「不要自动 heal / 先问再修」）

## Checklist

```text
- [ ] 确认 suite
- [ ] 询问：是否运行本 suite 对应 specs？
- [ ] 用户确认后只跑该目录（禁止一次混跑 ui+flow，除非用户明确要求两者）
- [ ] suite=flow：建规则路径须 `createRule(page, form, { log })`，并有 `form.applied` + `form.clicks`/`ui.click`；提交前空值允许 heal 1 次并记 baseline.heal
- [ ] 按 CASE（或失败原因簇）处理失败：自动 heal ≤2 轮 → 通过则继续；穷尽则记 exhausted_fail 并下一条
- [ ] 建规则失败且报「请选择」：优先补 baseline-fill / fill-guard，勿只改测试轴
- [ ] 不得因单条彻底失败而停止整批
- [ ] 全部跑完 → 输出 passed / healed_pass / exhausted_fail 汇总
- [ ] suite=flow 时按 domain 询问是否删除/清理；suite=ui 通常无需删规则
- [ ] 追加「运行与修复记录」到 explore/report.md 或 README.md（注明 suite + heal 统计）
```

## 运行与失败处理（默认）

```text
用户确认跑测
  → 执行 specs（可整目录或按文件）
  → 每条（或每簇）失败：
       heal 轮次 1..2：
         对照 report/logs 修 helper 或该 CASE 期望（ui：options/文案/locator）
         只重跑该 CASE_ID（或同因簇）
         通过 → 记 healed_pass，继续
       仍失败 → 记 exhausted_fail（彻底失败），继续下一条
  → 整批结束输出汇总；提醒 HTML / Allure / logs
```

### 同因簇（允许，避免 200 条各修 2 轮）

若多条失败为**同一根因**（如全部「近N小时」文案、端付指标别名）：

1. 一轮内修共享 `_gen_cases_ui.py` / `helpers/ui.ts` / 生成器  
2. 重生受影响 specs（或只改 helper）  
3. **批量重跑该簇**  
4. 此共享修复计为 **1 轮 heal**；该簇内仍失败者可再 1 轮，穷尽则逐条标 `exhausted_fail` 并继续  

## 运行命令（示例）

```bash
# 分开执行（有头/无头见 env.md：E2E_HEADLESS / test:generated:headless）
npx playwright test tests/e2e/generated/{yyyyMMdd-HHmmss}/specs/ui
npx playwright test tests/e2e/generated/{yyyyMMdd-HHmmss}/specs/flow

# 定点重跑（heal 后）
npx playwright test --config=playwright.generated.config.ts specs/ui/MET/{CASE_ID}.spec.ts

# 或仓库脚本
npm run test:generated            # 默认跟 .env（默认有头）
npm run test:generated:headless   # 强制无头
npm run test:generated:headed     # 强制有头
```
跑测后产物：

| 产物 | 路径 / 命令 |
|------|-------------|
| 录屏 / Trace / 截图 | `test-results/` |
| 每用例步骤/校验 JSONL | `{batch}/logs/{CASE_ID}.jsonl`（`createCaseLog`；同 case 重跑覆盖） |
| 每用例人读操作记录 MD | `{batch}/logs/{CASE_ID}.md`（步骤 / **规则选取值含逐项点击** / 造数 INSERT SQL / Job / 触发记录） |
| Playwright HTML | `npm run report:html` → `playwright-report/` |
| Allure | `npm run report:allure`（含 attach 的 jsonl + md） |

凭据来自项目根 `.env`；有 `explore/auth.json` 时用 `storageState`。

Checklist 追加：

```text
- [ ] 跑测结束后提醒：report:html / report:allure；按用例看 `logs/*.md`（人读）与 `logs/*.jsonl`（机读）；失败可看 test-results 录屏与 Trace
- [ ] 汇总至少含：passed / healed_pass / exhausted_fail（含 CASE_ID + 最后错误摘要）
```

flow 操作 MD 章节（`createCaseLog` 自动生成）：

1. **操作步骤**
2. **规则选取值**
   - 2.1 用例意图（`case.meta.规则条件`）
   - 2.2 **逐项点击**（`ui.click` / `form.clicks`：建规则时每个 radio/select/input/spin）
   - 2.3 实际提交值（`form.applied`：A⊕B⊕defaults）
   - 2.4 heal 补全（`baseline.heal`，若有）
3. **造数(SQL)**（依赖 `log.info('seed.result', { table, rows, … })`）
4. **触发 Job**
5. **触发记录**

建规则必须 `createRule(page, form, { log })`，否则 MD 无逐项点击。

## Heal 规则（自动，最多 2 轮）

1. **默认自动 heal**，无需在每条失败后再问「是否修」  
2. 每 CASE（或同因簇）最多 **2 轮**；第 2 轮后仍失败 → `exhausted_fail`，**继续下一条**，禁止停整批  
3. 对照 `explore/report.md` 的操作方式与必填表 / 实采 options，避免盲改  
4. `suite=ui`：优先核对照期望 options 与实采、下拉打开方式、文案别名；**不要**为「让用例过」而改成 Job 流  
5. `suite=flow`：若含 API/异步断言，先核接口与唯一键，再改页面 locator  
6. **例外**：用户明确「不要自动 heal / 先问再修」→ 恢复询问模式；拒绝修则只汇总失败不改代码  
7. 本 Skill **不**依赖 Playwright `retries`（那是 flaky 原样重跑）；heal = 改期望/locator 后再跑  

### 下拉 click Timeout / `getByRole('option')` 分流（强制先看 jsonl `actual`）

表面是 `locator.click: Timeout … getByRole('option', { name: 'X' })`，**禁止**一上来改业务期望。先看 `logs/{CASE_ID}.jsonl` 断言里的 `actual`：

| `actual` 信号 | 归因 | Heal 动作 |
|---------------|------|-----------|
| 很长（经验：>40）且混有业务线/公司/预警关停等**其它字段**文案 | **采集污染**：扫到历史/隐藏 popper 或全页 option | 修 `listVisibleOptions`（仅当前打开 popper）+ 点选前复核；同因簇 **1 轮共享修 helper** |
| 干净且**无**目标 `X` | 产品无此项 / 期望文案错 | 改 cases 期望或删/skip CASE（对齐 UI 实采） |
| 干净且**有** `X`，仍点超时 | 虚拟列表 / locator / 未 scroll | 加强 `clickOptionExact`（过滤 fill、scrollIntoView、open-popper 内 evaluate）；**勿**改期望 |

同因簇：多条「点某指标/ROI 超时」且 `actual` 爆炸 → 只修 helper，不要逐条改 `expectedOptions`。  
记忆点：**含集假绿 + 随后 click 超时 ≈ 采到 ≠ 当前打开下拉里的可点项**。

## 清理

- **suite=flow**：跑完询问是否删除本批数据（文案随 domain）  
- **suite=ui**：默认不清理（通常未创建持久规则）；若误提交了规则再询问  
- CI 非交互：可用 env 开关（见 env.md，如 `E2E_DELETE_RULE=1`）
