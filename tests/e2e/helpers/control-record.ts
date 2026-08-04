import { expect, type Page } from '@playwright/test';
import { gotoRecordPage } from './auth';

export type ControlRecordKey = {
  ruleId: string;
  channelCode: string;
};

async function queryRecord(page: Page, key: ControlRecordKey) {
  await gotoRecordPage(page);
  await page.locator('.el-table').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByPlaceholder('\u8bf7\u8f93\u5165\u89c4\u5219ID').fill(key.ruleId);
  await page.getByPlaceholder('\u8bf7\u8f93\u5165\u6e20\u9053\u53f7').fill(key.channelCode);
  const search = page.getByRole('button', { name: /\u67e5\u8be2|\u641c\u7d22/ }).first();
  await expect(search).toBeVisible();
  await search.click();
  const rows = page.locator('.el-table__body-wrapper tbody tr');
  return rows.filter({ hasText: key.ruleId }).filter({ hasText: key.channelCode });
}

export async function expectControlRecordHit(page: Page, key: ControlRecordKey) {
  const matching = await queryRecord(page, key);
  await expect.poll(() => matching.count(), {
    message: `No control record for ruleId=${key.ruleId}, channelCode=${key.channelCode}`,
    timeout: 120_000,
    intervals: [2_000, 5_000, 10_000],
  }).toBeGreaterThan(0);
  return matching.allInnerTexts();
}

export async function expectControlRecordMiss(
  page: Page,
  key: ControlRecordKey,
  observationMs = 120_000,
) {
  const deadline = Date.now() + observationMs;
  do {
    const matching = await queryRecord(page, key);
    expect(await matching.count(),
      `Unexpected control record for ruleId=${key.ruleId}, channelCode=${key.channelCode}`,
    ).toBe(0);
    if (Date.now() >= deadline) break;
    await page.waitForTimeout(Math.min(10_000, deadline - Date.now()));
  } while (Date.now() < deadline);
}
