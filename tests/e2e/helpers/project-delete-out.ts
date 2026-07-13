import { expect, type Page } from '@playwright/test';

export type BusinessLineThresholdExpectation = {
  businessLine: string;
  labels: string[];
  recentDaysLabel?: string;
};

export const PROJECT_PAUSE_BUSINESS_LINE_CASES: BusinessLineThresholdExpectation[] = [
  {
    businessLine: '新媒体-短篇',
    labels: ['当日累计项目消耗', '当日ROI_H12', '近3天累计ROI_H12'],
    recentDaysLabel: '天，累计消耗',
  },
  {
    businessLine: '新媒体-短剧',
    labels: ['近3日连续分日项目消耗', '当日ROI_H12', '近3天累计ROI_H12'],
    recentDaysLabel: '天，累计消耗',
  },
  {
    businessLine: '新媒体-免费短剧',
    labels: ['近3日连续分日项目消耗', '当日预估ROI', '近3天累计预估ROI'],
    recentDaysLabel: '天，累计消耗',
  },
  {
    businessLine: '头条端原生-付费',
    labels: ['近3日连续分日项目消耗', '当日激活后24小时付费ROI', '近3天累计激活后24小时付费ROI'],
    recentDaysLabel: '天，累计消耗',
  },
  {
    businessLine: '头条端原生-免费',
    labels: ['近3日连续分日项目消耗', '当日广告变现ROI', '近3天累计广告变现ROI'],
    recentDaysLabel: '天，累计消耗',
  },
  {
    businessLine: '客户端-免费短剧',
    labels: ['消耗', '整体 ROI', '当日ARPU'],
  },
  {
    businessLine: '客户端-付费短剧',
    labels: ['消耗', '预估ROI'],
  },
  {
    businessLine: '客户端-付费小说',
    labels: ['消耗', '预估ROI'],
  },
];

const TOUTIAO_DELETE_TOOL_URL = 'http://192.168.0.215/newdz/home#/newdz/adcreate/projectdeleteout';
const TOUTIAO_DELETE_TOOL_HASH = '#/newdz/adcreate/projectdeleteout';

async function waitForPausePage(page: Page) {
  await expect(page.getByRole('button', { name: '配置书剧暂停' })).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveURL(/projectdeleteout/);
}

export async function openToutiaoDeleteTool(page: Page) {
  await expect(page.getByText('点众智投系统')).toBeVisible({ timeout: 30000 });

  const pauseButton = page.getByRole('button', { name: '配置书剧暂停' });

  await page.goto(TOUTIAO_DELETE_TOOL_URL);
  if (await pauseButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await waitForPausePage(page);
    return;
  }

  await page.getByRole('menuitem', { name: '广告管控' }).click();
  await page.waitForFunction(
    (hash) => window.location.hash.includes('admonitor') || document.body.innerText.includes('头条删除工具'),
    TOUTIAO_DELETE_TOOL_HASH,
    { timeout: 15000 },
  ).catch(() => {});

  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, TOUTIAO_DELETE_TOOL_HASH);

  if (await pauseButton.isVisible({ timeout: 8000 }).catch(() => false)) {
    await waitForPausePage(page);
    return;
  }

  const deleteTool = page.locator('.el-menu-item').filter({ hasText: '头条删除工具' });
  if (await deleteTool.isVisible({ timeout: 5000 }).catch(() => false)) {
    await deleteTool.click();
  } else {
    await page.locator('.el-sub-menu__title').filter({ hasText: '头条媒体' }).click();
    await page.locator('.el-menu-item').filter({ hasText: '头条删除工具' }).click({ timeout: 10000 });
  }

  await waitForPausePage(page);
}

export async function openBookDramaPauseDialog(page: Page) {
  await page.getByRole('button', { name: '配置书剧暂停' }).click();
  await expect(page.getByLabel('发起暂停任务')).toBeVisible({ timeout: 15000 });
}

export async function selectSpecifiedBookAccountPauseMode(page: Page) {
  const dialog = page.getByLabel('发起暂停任务');
  await dialog.locator('label').filter({ hasText: '指定剧目和账户暂停' }).locator('span').nth(1).click();
}

export async function selectBusinessLineInPauseDialog(page: Page, businessLine: string) {
  const dialog = page.getByLabel('发起暂停任务');
  await dialog.getByPlaceholder('请选择业务线').click();

  const option = page.getByRole('option', { name: businessLine });
  if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
    await option.click();
    return;
  }

  await page.getByText(businessLine, { exact: true }).click();
}

export async function verifyPauseThresholdLabel(page: Page, label: string) {
  const dialog = page.getByLabel('发起暂停任务');
  await expect(dialog.getByText(label).first()).toBeVisible();
}

export async function verifyPauseRecentDaysLabel(page: Page, recentDaysLabel: string) {
  const dialog = page.getByLabel('发起暂停任务');
  await expect(dialog.getByLabel('近', { exact: true })).toContainText(recentDaysLabel);
}

export async function prepareProjectPauseDialog(page: Page) {
  await openToutiaoDeleteTool(page);
  await openBookDramaPauseDialog(page);
  await selectSpecifiedBookAccountPauseMode(page);
}

export async function verifyPauseThresholdLabels(page: Page, expectation: BusinessLineThresholdExpectation) {
  for (const label of expectation.labels) {
    await verifyPauseThresholdLabel(page, label);
  }

  if (expectation.recentDaysLabel) {
    await verifyPauseRecentDaysLabel(page, expectation.recentDaysLabel);
  }
}
