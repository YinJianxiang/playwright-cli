import { expect, test } from '@playwright/test';
import { gotoRecordPage, login } from '../helpers/auth';
const RULE_ID = process.env.E2E_VERIFY_RULE_ID ?? '16264';
const CHANNEL_CODE = process.env.E2E_VERIFY_CHANNEL_CODE ?? '6354903952';

test('verify control record by rule ID and channel code', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await gotoRecordPage(page);
  await page.locator('.el-table').first().waitFor({ state: 'visible', timeout: 30_000 });

  const controls = await page.locator('input:visible').evaluateAll((nodes) =>
    nodes.map((node) => ({
      placeholder: node.getAttribute('placeholder'),
      value: (node as HTMLInputElement).value,
      ariaLabel: node.getAttribute('aria-label'),
    })),
  );
  console.log(`RECORD_CONTROLS=${JSON.stringify(controls)}`);

  await page.getByPlaceholder('\u8bf7\u8f93\u5165\u89c4\u5219ID').fill(RULE_ID);
  await page.getByPlaceholder('\u8bf7\u8f93\u5165\u6e20\u9053\u53f7').fill(CHANNEL_CODE);
  const searchButton = page.getByRole('button', { name: /\u67e5\u8be2|\u641c\u7d22/ }).first();
  if (await searchButton.isVisible().catch(() => false)) {
    await searchButton.click();
  } else {
    await page.getByText(/\u67e5\u8be2|\u641c\u7d22/, { exact: true }).first().click();
  }
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const rows = page.locator('.el-table__body-wrapper tbody tr');
  const matching = rows.filter({ hasText: RULE_ID }).filter({ hasText: CHANNEL_CODE });
  console.log(`RECORD_PAGE url=${page.url()} rows=${await rows.count()} ruleId=${RULE_ID} channelCode=${CHANNEL_CODE}`);
  await expect.poll(() => matching.count(), {
    message: `No control record for ruleId=${RULE_ID} and channelCode=${CHANNEL_CODE}`,
    timeout: 15_000,
  }).toBeGreaterThan(0);
  console.log(`RECORD_OK=${JSON.stringify({ ruleId: RULE_ID, channelCode: CHANNEL_CODE, rows: await matching.allInnerTexts() })}`);
});
