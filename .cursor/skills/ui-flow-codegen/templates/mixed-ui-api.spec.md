# mixed-ui-api.spec 模板（suite=flow）

生成时复制为 `{root}/specs/flow/*.spec.ts`（兼容旧路径 `{root}/specs/*.spec.ts`），按 explore 补齐 locator；按 `matrix-flow.json` 展开多条 `test()`。

凭据：项目根 `.env`。有 `{root}/explore/auth.json` 时优先 `storageState`。  
**URL / Job / 文案只抄当前 `domains/<biz>/`，禁止在本模板写死业务值。**  
**仅 suite=flow 使用本模板**；suite=ui 用 [ui-options.spec.md](ui-options.spec.md)。

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/**
 * UI+API 混合流模板（通用骨架）。
 * 生成时：按 matrix 一行一个 test()；form 来自矩阵；登录/列表/Job URL 来自 domain。
 * 落盘目录：tests/e2e/generated/{yyyyMMdd-HHmmss}/
 */

type RuleForm = Record<string, string | number | undefined>;

const AUTH_STATE = path.join(__dirname, '../explore/auth.json');
const hasAuthState = fs.existsSync(AUTH_STATE);

if (hasAuthState) {
  test.use({ storageState: AUTH_STATE });
}

function loadDotEnvFromRepoRoot() {
  const envPath = path.resolve(__dirname, '../../../../.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function getCredentials() {
  loadDotEnvFromRepoRoot();
  const username = process.env.E2E_USER ?? process.env.MARKET_ADMIN_USER;
  const password = process.env.E2E_PASSWORD ?? process.env.MARKET_ADMIN_PASSWORD;
  const captcha = process.env.E2E_CAPTCHA ?? process.env.MARKET_ADMIN_SMS_CODE;
  if (!username || !password) {
    throw new Error('Set E2E_USER/E2E_PASSWORD in project root .env');
  }
  if (!captcha) {
    throw new Error('Set E2E_CAPTCHA in project root .env (plain text captcha)');
  }
  return { username, password, captcha };
}

/** 登录：URL/文案来自 domain env + explore */
async function login(page: Page) {
  const { username, password, captcha } = getCredentials();
  await page.goto('/* TODO: domains/<biz>/env.md 登录 URL */');
  // TODO: 按 explore 填写账号/密码/验证码并登录
  void username;
  void password;
  void captcha;
}

async function createRule(page: Page, form: RuleForm): Promise<{ ruleId: string; ruleName: string }> {
  await page.goto('/* TODO: domain 规则列表 URL */');
  // TODO explore: 新建 + 按 form 填表 + 确认
  const ruleName = String(form.ruleName ?? `auto_${Date.now()}`);
  const ruleId = ''; // TODO: 列表读取业务主键
  return { ruleId, ruleName };
}

async function setRuleSwitch(page: Page, ruleId: string, on: boolean) {
  // TODO explore: 列表行开关
  void page;
  void ruleId;
  void on;
}

async function seedViaDb(_ruleId: string) {
  // TODO: 引用 tests/e2e/helpers/seed/{biz}.ts；须 confirmed / 用户确认
}

async function triggerJob(request: APIRequestContext, ruleId: string) {
  // TODO: URL 模板来自 domains/<biz>/apis.md
  const url = `/* TODO Job URL */${ruleId}`;
  const res = await request.get(url);
  expect(res.ok()).toBeTruthy();
}

async function expectRecordByRuleId(page: Page, ruleId: string) {
  await page.goto('/* TODO: domain 记录页 URL */');
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const hit = page.getByText(ruleId, { exact: false });
    if (await hit.count()) {
      await expect(hit.first()).toBeVisible();
      return;
    }
    await page.waitForTimeout(10_000);
    await page.reload();
  }
  throw new Error(`Record for ruleId ${ruleId} not found within 120s`);
}

const sampleForm: RuleForm = {
  // TODO: 来自 matrix / domain defaults ∩ explore
  ruleName: `auto_${Date.now()}`,
};

test.describe('mixed ui+api', () => {
  test('smoke: create → job → record', async ({ page, request }) => {
    let ruleId = '';

    await test.step('准备', async () => {
      if (!hasAuthState) await login(page);
    });

    await test.step('建规则', async () => {
      const created = await createRule(page, sampleForm);
      ruleId = created.ruleId;
      expect(ruleId).toBeTruthy();
    });

    await test.step('开开关', async () => {
      await setRuleSwitch(page, ruleId, true);
    });

    await test.step('造数', async () => {
      await seedViaDb(ruleId);
    });

    await test.step('调Job', async () => {
      await triggerJob(request, ruleId);
    });

    await test.step('验记录', async () => {
      await expectRecordByRuleId(page, ruleId);
    });

    await test.step('收尾开关', async () => {
      await setRuleSwitch(page, ruleId, false);
    });
  });
});
```
