import { expect, type Page } from '@playwright/test';
import { loadDotEnvFromRepoRoot, requireE2eUrl } from './environment';

export { loadDotEnvFromRepoRoot } from './environment';

export async function login(page: Page) {
  loadDotEnvFromRepoRoot();
  await page.goto(requireE2eUrl('E2E_LOGIN_URL'), { waitUntil: 'domcontentloaded' });

  const accountTab = page.getByText('\u8d26\u6237\u767b\u5f55', { exact: true });
  if (await accountTab.isVisible().catch(() => false)) await accountTab.click();

  const username = process.env.E2E_USER;
  const password = process.env.E2E_PASSWORD;
  const captcha = process.env.E2E_CAPTCHA ?? '123456';
  if (!username || !password) throw new Error('Missing E2E_USER or E2E_PASSWORD');

  await page.getByPlaceholder(/\u90ae\u7bb1|\u7528\u6237\u540d|\u8d26\u53f7/).first().fill(username);
  await page.locator('input[type="password"]').first().fill(password);
  const captchaInput = page.getByPlaceholder(/\u9a8c\u8bc1\u7801/).first();
  if (await captchaInput.isVisible().catch(() => false)) await captchaInput.fill(captcha);

  const loginButton = page.getByRole('button', { name: /\u767b\u5f55/ });
  if (await loginButton.isVisible().catch(() => false)) await loginButton.click();
  else {
    await page
      .getByText('\u767b\u5f55', { exact: true })
      .last()
      .click({ force: true, noWaitAfter: true });
  }
  await expect(page).not.toHaveURL(/login/, { timeout: 30_000 });
}

export async function gotoRulePage(page: Page) {
  await page.goto(requireE2eUrl('E2E_RULE_URL'), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

export async function gotoRecordPage(page: Page) {
  await page.goto(requireE2eUrl('E2E_HOME_URL'), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const recordUrl = requireE2eUrl('E2E_RECORD_URL');
  await page.goto(recordUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  if (
    page.url() === recordUrl &&
    await page.locator('.el-table').first().isVisible().catch(() => false)
  ) {
    return;
  }

  const controlMenu = page.getByRole('menuitem', { name: '\u5e7f\u544a\u7ba1\u63a7', exact: true });
  if (await controlMenu.isVisible().catch(() => false)) await controlMenu.click();
  const recordMenu = page.getByRole('menuitem', {
    name: '\u5e7f\u544a\u7ba1\u63a7\u8bb0\u5f55',
    exact: true,
  });
  if (await recordMenu.isVisible().catch(() => false)) await recordMenu.click();
  else await page.getByText('\u5e7f\u544a\u7ba1\u63a7\u8bb0\u5f55', { exact: true }).last().click();
  await page.waitForLoadState('networkidle').catch(() => undefined);
}
