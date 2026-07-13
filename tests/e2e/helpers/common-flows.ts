import { expect, type Locator, type Page } from 'playwright/test';

export async function clickIfVisible(locator: Locator, timeout = 2000) {
  if (await locator.isVisible({ timeout }).catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

export type OverlayCleanupOptions = {
  timeout?: number;
  closeButtonNames?: Array<string | RegExp>;
  blockingTextPatterns?: Array<string | RegExp>;
};

export async function closeCommonOverlays(page: Page, options: OverlayCleanupOptions = {}) {
  const timeout = options.timeout ?? 2500;
  const closeButtonNames = options.closeButtonNames ?? [/^(OK|确定|知道了|我知道了|Got it|Close|关闭|跳过|Skip|Done)$/i];
  const blockingTextPatterns = options.blockingTextPatterns ?? [];
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    let clicked = false;

    for (const name of closeButtonNames) {
      clicked ||= await clickIfVisible(page.getByRole('button', { name }).first(), 100);
      clicked ||= await clickIfVisible(page.getByText(name).first(), 100);
      if (clicked) break;
    }

    const blockerVisible = await Promise.any(
      blockingTextPatterns.map((pattern) =>
        page.getByText(pattern).first().isVisible({ timeout: 50 }).catch(() => false),
      ),
    ).catch(() => false);

    if (!clicked && !blockerVisible) return;

    await page.waitForTimeout(clicked ? 250 : 150);
  }
}

export async function expectCurrentPage(page: Page, pattern: RegExp, visibleText?: string | RegExp) {
  await expect(page).toHaveURL(pattern);
  if (visibleText) await expect(page.getByText(visibleText).first()).toBeVisible();
}

export async function openLinkByExactText(page: Page, text: string) {
  await page.getByRole('link', { name: text, exact: true }).click();
}

export async function selectOption(page: Page, comboboxName: string | RegExp, optionName: string | RegExp) {
  await page.getByRole('combobox', { name: comboboxName }).click();
  await page.getByRole('option', { name: optionName }).click();
}

export async function verifyTableRow(page: Page, rowText: string | RegExp) {
  await expect(page.getByText(rowText).first()).toBeVisible();
}

export async function openNamedRow(page: Page, rowName: string, options: { searchFieldName?: string; searchButtonName?: string } = {}) {
  const commonRow = page.getByRole('listitem').filter({ hasText: rowName }).first();
  if (await commonRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await commonRow.click();
    return;
  }

  const searchFieldName = options.searchFieldName ?? '名称';
  const searchButtonName = options.searchButtonName ?? '查询';

  await page.getByRole('textbox', { name: searchFieldName }).fill(rowName);
  await page.getByRole('button', { name: searchButtonName }).click();
  await page.getByRole('row').filter({ hasText: rowName }).first().click();
}

export async function openSection(page: Page, sectionName: string) {
  await page.getByText(sectionName, { exact: true }).click();
  await expect(page.getByRole('navigation').getByText(sectionName).or(page.getByText(sectionName).first())).toBeVisible();
}

export type CreateNamedRecordOptions = {
  openButtonName?: string | RegExp;
  nameFieldName?: string | RegExp;
  descriptionFieldName?: string | RegExp;
  confirmButtonName?: string | RegExp;
  expected?: 'success' | 'duplicate';
  duplicateMessage?: string | RegExp;
};

export async function createNamedRecord(
  page: Page,
  data: { name: string; description?: string },
  options: CreateNamedRecordOptions = {},
) {
  const openButtonName = options.openButtonName ?? /新建|创建|新增|Add|New|Create/i;
  const nameFieldName = options.nameFieldName ?? '名称*';
  const descriptionFieldName = options.descriptionFieldName ?? '描述';
  const confirmButtonName = options.confirmButtonName ?? /确定|保存|提交|Create|Save|Submit/i;
  const expected = options.expected ?? 'success';
  const duplicateMessage = options.duplicateMessage ?? /已存在|重复|重名|already exists|duplicate/i;

  await page.getByRole('button', { name: openButtonName }).first().click();
  await page.getByRole('textbox', { name: nameFieldName }).fill(data.name);
  if (data.description !== undefined) {
    await page.getByRole('textbox', { name: descriptionFieldName }).fill(data.description);
  }
  await page.getByRole('button', { name: confirmButtonName }).click();

  if (expected === 'duplicate') {
    await expect(page.getByText(duplicateMessage).first()).toBeVisible();
    return;
  }

  await verifyTableRow(page, data.name);
}

export type FormField = {
  label: string | RegExp;
  value: string;
  kind?: 'textbox' | 'combobox';
};

export type DateRangeValue = {
  start: string;
  end?: string;
};

type ParsedDate = {
  year: number;
  month: number;
  day: number;
};

function parseIsoDate(value: string): ParsedDate {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date value "${value}", expected YYYY-MM-DD`);
  }
  return { year, month, day };
}

function monthValue(date: ParsedDate) {
  return date.year * 12 + date.month;
}

async function readPanelMonth(panel: Locator, panelIndex: number) {
  const content = panel.locator('.el-date-range-picker__content').nth(panelIndex);
  const headerText = (await content.locator('.el-date-range-picker__header div').innerText()).replace(/\s+/g, '');
  const match = headerText.match(/(\d{4})年(\d{1,2})月/);
  if (!match) {
    throw new Error(`Unable to parse date picker header: "${headerText}"`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

async function navigateRangePanelToMonth(panel: Locator, panelIndex: number, target: ParsedDate) {
  const content = panel.locator('.el-date-range-picker__content').nth(panelIndex);
  const prevButton = content.getByRole('button', { name: '上个月' });
  const nextButton = content.getByRole('button', { name: '下个月' });

  for (let step = 0; step < 24; step += 1) {
    const current = await readPanelMonth(panel, panelIndex);
    const currentValue = monthValue(current);
    const targetValue = monthValue(target);

    if (currentValue === targetValue) return;

    if (currentValue > targetValue) {
      await prevButton.click();
    } else {
      await nextButton.click();
    }
  }

  throw new Error(`Unable to navigate date picker to ${target.year}-${target.month}`);
}

async function clickAvailableDay(panel: Locator, panelIndex: number, day: number) {
  const content = panel.locator('.el-date-range-picker__content').nth(panelIndex);
  const table = content.locator('.el-date-table');
  const cell = table
    .locator('td.available:not(.disabled)')
    .filter({ has: table.locator('span', { hasText: new RegExp(`^${day}$`) }) })
    .first();

  await expect(cell).toBeVisible({ timeout: 5000 });
  await cell.click();
}

function formatIsoDate(date: ParsedDate) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export async function selectLabeledDateRange(
  page: Page,
  fieldLabel: string | RegExp,
  range: DateRangeValue,
  options: { startPlaceholder?: string; endPlaceholder?: string } = {},
) {
  const startPlaceholder = options.startPlaceholder ?? '开始日期';
  const endPlaceholder = options.endPlaceholder ?? '结束日期';
  const startDate = parseIsoDate(range.start);
  const endDate = parseIsoDate(range.end ?? range.start);

  const field = page.getByLabel(fieldLabel);
  const startInput = field.getByPlaceholder(startPlaceholder);
  const endInput = field.getByPlaceholder(endPlaceholder);

  await startInput.click();

  const panel = page.locator('.el-picker-panel:visible').last();
  await expect(panel).toBeVisible({ timeout: 5000 });

  const endPanelIndex =
    monthValue(endDate) === monthValue(startDate)
      ? 0
      : monthValue(endDate) === monthValue(startDate) + 1
        ? 1
        : 0;

  await navigateRangePanelToMonth(panel, 0, startDate);
  await clickAvailableDay(panel, 0, startDate.day);

  if (endDate.year !== startDate.year || endDate.month !== startDate.month || endDate.day !== startDate.day) {
    await navigateRangePanelToMonth(panel, endPanelIndex, endDate);
    await clickAvailableDay(panel, endPanelIndex, endDate.day);
  } else {
    await clickAvailableDay(panel, 0, endDate.day);
  }

  await expect(startInput).toHaveValue(formatIsoDate(startDate));
  await expect(endInput).toHaveValue(formatIsoDate(endDate));
}

export async function submitLabeledForm(
  page: Page,
  fields: FormField[],
  submitButtonName: string | RegExp = /确定|保存|提交|Create|Save|Submit/i,
) {
  for (const field of fields) {
    if (field.kind === 'combobox') {
      await selectOption(page, field.label, field.value);
      continue;
    }
    await page.getByRole('textbox', { name: field.label }).fill(field.value);
  }

  await page.getByRole('button', { name: submitButtonName }).click();
}

export type CurrentPageItemData = {
  name: string;
  category?: string;
  owner?: string;
  status?: string;
};

export async function createItemFromCurrentPage(page: Page, data: CurrentPageItemData) {
  await page.getByRole('button', { name: /创建|新增|Add|New|Create/i }).first().click();
  await page.getByRole('textbox', { name: /名称|Name/ }).fill(data.name);

  if (data.category) {
    await selectOption(page, /分类|Category/, data.category);
  }

  if (data.owner) {
    await selectOption(page, /负责人|Owner/, data.owner);
  }

  if (data.status) {
    await selectOption(page, /状态|Status/, data.status);
  }

  const popupPromise = page.waitForEvent('popup', { timeout: 12000 }).catch(() => null);
  await page.getByRole('button', { name: /确定|保存|提交|Create|Save|Submit/i }).click();
  const popup = await popupPromise;

  if (popup) {
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
  }

  await verifyTableRow(page, data.name);
  return popup;
}
