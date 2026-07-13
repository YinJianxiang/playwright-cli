import { expect, type BrowserContext, type Page } from '@playwright/test';
import { closeCommonOverlays } from './common-flows';

export const MARKET_ADMIN_LOGIN_URL = 'http://192.168.0.215/market-admin/login';

export type MarketAdminLoginOptions = {
  username?: string;
  password?: string;
  smsCode?: string;
};

export async function dismissMarketAdminDialogs(page: Page) {
  await closeCommonOverlays(page, {
    closeButtonNames: ['取消', '确定', /^(OK|确定|知道了|我知道了|Close|关闭)$/i],
  });
}

export async function loginMarketAdmin(page: Page, options: MarketAdminLoginOptions = {}) {
  const username = options.username ?? process.env.MARKET_ADMIN_USER;
  const password = options.password ?? process.env.MARKET_ADMIN_PASSWORD;
  const smsCode = options.smsCode ?? process.env.MARKET_ADMIN_SMS_CODE ?? '123';

  if (!username || !password) {
    throw new Error('Set MARKET_ADMIN_USER and MARKET_ADMIN_PASSWORD before running login flow.');
  }

  await page.goto(MARKET_ADMIN_LOGIN_URL);
  await page.getByPlaceholder('邮箱/用户名').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByPlaceholder('请输入手机验证码').fill(smsCode);
  await page.getByText('登录', { exact: true }).click();
  await dismissMarketAdminDialogs(page);
}

export async function openNewdzFromMarketAdmin(page: Page, context: BrowserContext) {
  await dismissMarketAdminDialogs(page);

  const link = page.getByRole('link', { name: '大圣投放系统' });
  const href = (await link.getAttribute('href'))?.replace(/\s+/g, '');

  if (href?.startsWith('http')) {
    await page.goto(href);
    return finishNewdzNavigation(page);
  }

  const newPagePromise = context.waitForEvent('page', { timeout: 15000 });
  await link.click();
  const newPage = await newPagePromise;
  await newPage.waitForLoadState('domcontentloaded');
  return finishNewdzNavigation(newPage);
}

async function finishNewdzNavigation(page: Page) {
  await page.waitForURL(/\/newdz\/home/, { timeout: 30000 });
  await expect(page.getByText('点众智投系统')).toBeVisible({ timeout: 30000 });
  return page;
}
