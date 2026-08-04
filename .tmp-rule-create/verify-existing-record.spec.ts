import { expect, test } from '@playwright/test';
import { login } from '../tests/e2e/helpers/auth';

const RECORD_URL = 'http://192.168.0.215/newdz/home#/newdz/adcreate/projectdeleteout';
const RULE_ID = '16265';
const CHANNEL_CODE = '122956217';

test('verify existing control record without triggering job', async ({ page }) => {
  await login(page);
  await page.goto(RECORD_URL, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await expect(page).toHaveURL(/#\/newdz\/adcreate\/projectdeleteout/, { timeout: 20_000 });
  await page.waitForTimeout(3_000);
  const controls = await page.locator('input:visible').evaluateAll((nodes) => nodes.map((node) => ({
    placeholder: node.getAttribute('placeholder'), ariaLabel: node.getAttribute('aria-label'),
    value: (node as HTMLInputElement).value,
  })));
  console.log(`RECORD_PAGE_STATE=${JSON.stringify({ url: page.url(), title: await page.title(), controls, tables: await page.locator('.el-table:visible').count() })}`);
  const ruleInput = page.getByPlaceholder(/请输入.*规则ID|规则ID/).first();
  const channelInput = page.getByPlaceholder(/请输入.*渠道号|渠道号/).first();
  await expect(ruleInput, '正确页面未发现规则ID查询框').toBeVisible({ timeout: 10_000 });
  await expect(channelInput, '正确页面未发现渠道号查询框').toBeVisible({ timeout: 10_000 });
  await ruleInput.fill(RULE_ID);
  await channelInput.fill(CHANNEL_CODE);
  const search = page.getByRole('button', { name: /查询|搜索/ }).first();
  await expect(search).toBeVisible();
  await search.click();
  await page.waitForTimeout(2_000);
  const rows = page.locator('.el-table__body-wrapper tbody tr');
  const matching = rows.filter({ hasText: RULE_ID }).filter({ hasText: CHANNEL_CODE });
  console.log(`RECORD_VERIFY=${JSON.stringify({ ruleId: RULE_ID, channelCode: CHANNEL_CODE, rowCount: await rows.count(), matching: await matching.allInnerTexts() })}`);
  await expect(matching).toHaveCount(1, { timeout: 15_000 });
  await page.screenshot({ path: '.tmp-rule-create/existing-record-16265-122956217.png', fullPage: true });
});
