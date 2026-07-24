# ui-options.spec 模板（suite=ui）

生成时复制为 `{root}/specs/ui/*.spec.ts`，按 `matrix-ui.json` 一行一个 `test()`。

凭据：项目根 `.env`。有 `{root}/explore/auth.json` 时优先 `storageState`。  
**URL / 文案只抄当前 `domains/<biz>/` 与本批 `explore/report.md`，禁止写死业务枚举。**  
**禁止**：提交保存规则、开开关、造数、调 Job、进记录页断言。

期望 options 来自 `explore/cases-ui.md`（需求抽取），实际打开方式来自 report「操作方式（已验证）」。

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

/**
 * UI options 校验模板（suite=ui）。
 * 落盘：tests/e2e/generated/{yyyyMMdd-HHmmss}/specs/ui/
 * matrix 行字段示例：id, title, dimension, bizLine, targetField, expectedOptions[], assertMode
 */

type UiForm = {
  dimension?: string;
  bizLine?: string;
  targetField?: string;
  expectedOptions: string[];
  assertMode?: 'supset' | 'exact';
};

const AUTH_STATE = path.join(__dirname, '../../explore/auth.json');
const hasAuthState = fs.existsSync(AUTH_STATE);

if (hasAuthState) {
  test.use({ storageState: AUTH_STATE });
}

// TODO: 从 domain + explore 生成 login / gotoRulePage / selectContext / openTargetDropdown / listVisibleOptions

async function selectContext(page: Page, form: UiForm) {
  // TODO explore: 维度 / 业务线等选择因
  void page;
  void form;
}

async function openTargetDropdown(page: Page, targetField: string) {
  // TODO explore: 按 report 控件模式打开「指标」等
  void page;
  void targetField;
}

async function listVisibleOptions(page: Page): Promise<string[]> {
  // TODO explore: 可见 option 文案去重
  void page;
  return [];
}

function assertOptions(actual: string[], expected: string[], mode: 'supset' | 'exact') {
  if (mode === 'exact') {
    expect([...actual].sort()).toEqual([...expected].sort());
    return;
  }
  for (const item of expected) {
    expect(actual, `missing option: ${item}`).toContain(item);
  }
}

test('UI-<CASE_ID>: <短标题>', async ({ page }) => {
  const form: UiForm = {
    dimension: '/* matrix */',
    bizLine: '/* matrix */',
    targetField: '指标',
    expectedOptions: [/* 来自 cases-ui */],
    assertMode: 'supset',
  };

  await test.step('准备', async () => {
    // login + 进列表 + 打开新建（不提交）
  });

  await test.step('交互', async () => {
    await selectContext(page, form);
  });

  await test.step('打开目标下拉', async () => {
    await openTargetDropdown(page, form.targetField ?? '指标');
  });

  await test.step('断言 options', async () => {
    const actual = await listVisibleOptions(page);
    assertOptions(actual, form.expectedOptions, form.assertMode ?? 'supset');
  });
});
```

## 生成约束

- `test.step` 名对齐 `cases-ui`「怎么操作」  
- `expectedOptions` 只来自 cases-ui / req-extract，禁止用 report 全量 options **替换**需求期望（report 用于对照差异时可写入 README，不改断言期望）  
- 关闭弹层用取消/关闭，不用「确认提交」  
