import { expect, type Locator, type Page } from '@playwright/test';
import type { PlannedField, RuleCreatePlan, RuleCreateResult } from './types';

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FIELD_LABEL_ALIASES: Record<string, string[]> = {
  管控维度: ['管控维度', '维度'],
  业务线: ['业务线'],
  创建时间: ['创建时间', '广告创建时间', '项目创建时间'],
  自投: ['自投', '自投/代理'],
  是否漫画: ['是否漫画', '是否漫剧'],
  投放方式: ['投放方式', '投放模式'],
  渠道: ['渠道'],
};

function dialog(page: Page) {
  return page.getByRole('dialog')
    .filter({ has: page.getByRole('textbox', { name: /规则名称/ }) })
    .last();
}

async function labelOf(item: Locator) {
  return normalize(await item.locator('.el-form-item__label').innerText().catch(() => ''))
    .replace(/^[*＊]\s*/, '');
}

type VisibleFieldState = {
  label: string;
  required: boolean;
  empty: boolean;
  controlType: 'select' | 'radio' | 'input' | 'unknown';
};

export type RuleCreateVisibleFieldState = VisibleFieldState;

async function visibleFormState(page: Page): Promise<VisibleFieldState[]> {
  const items = dialog(page).locator('.el-form-item:visible');
  const states: VisibleFieldState[] = [];
  const count = await items.count();
  for (let index = 0; index < count; index++) {
    const item = items.nth(index);
    const state = await item.evaluate((node) => {
      const rawLabel = node.querySelector('.el-form-item__label')?.textContent ?? '';
      const label = rawLabel.replace(/^[\s*＊]+/, '').trim();
      const required = node.classList.contains('is-required') || /[*＊]/.test(rawLabel);
      const combos = [...node.querySelectorAll('[role="combobox"]')] as HTMLInputElement[];
      const radios = [...node.querySelectorAll('input[type="radio"], input[type="checkbox"]')] as HTMLInputElement[];
      const inputs = [...node.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea')] as HTMLInputElement[];
      const selectedText = [
        ...node.querySelectorAll('.el-select__selected-item, .el-select__tags-text, .el-tag, .el-radio.is-checked, .el-radio-button.is-active'),
      ].map((element) => element.textContent?.trim() ?? '').filter(Boolean);
      const hasValue = combos.some((input) => Boolean(input.value?.trim()))
        || inputs.some((input) => Boolean(input.value?.trim()))
        || radios.some((input) => input.checked)
        || selectedText.length > 0;
      const controlType = combos.length ? 'select' : radios.length ? 'radio' : inputs.length ? 'input' : 'unknown';
      return { label, required, empty: !hasValue, controlType };
    });
    if (state.label) states.push(state);
  }
  return states;
}

async function waitForFormStability(page: Page) {
  let previous = '';
  let stableReads = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const signature = JSON.stringify(await visibleFormState(page));
    if (signature === previous) stableReads += 1;
    else stableReads = 0;
    if (stableReads >= 2) return;
    previous = signature;
    await page.waitForTimeout(150);
  }
  throw new Error('UI_FORM_LINKAGE_UNSTABLE');
}

export async function inspectRuleCreateForm(page: Page): Promise<RuleCreateVisibleFieldState[]> {
  await waitForFormStability(page);
  return visibleFormState(page);
}

const VISIBLE_OPTION_SELECTOR = [
  '.el-select__popper:visible [role="option"]',
  '.el-select-v2__popper:visible [role="option"]',
  '.el-select-v2__popper:visible .el-select-dropdown__option-item',
  '.el-popper:visible [role="option"]',
  '[role="listbox"]:visible [role="option"]',
].join(', ');

async function visibleOptions(page: Page) {
  return (await page.locator(VISIBLE_OPTION_SELECTOR).allTextContents())
    .map(normalize).filter(Boolean);
}

async function selectOption(page: Page, combo: Locator, expected: string, fieldLabel = 'unknown') {
  await combo.click({ force: true });
  const controlledId = await combo.getAttribute('aria-controls');
  const optionRoot = controlledId
    ? page.locator(`[id="${controlledId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`)
    : page.locator('body');
  const optionSelector = controlledId
    ? '[role="option"]:visible, .el-select-dropdown__option-item:visible'
    : VISIBLE_OPTION_SELECTOR;
  const exactOption = optionRoot.locator(optionSelector)
    .filter({ hasText: new RegExp(`^${escapeRe(expected)}$`) });
  await exactOption.first().waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  let options = (await optionRoot.locator(optionSelector).allTextContents()).map(normalize).filter(Boolean);
  let picked = options.find((option) => option === expected);
  if (!picked && controlledId) {
    const discovered = new Set(options);
    for (let index = 0; index < 20 && !picked; index++) {
      await combo.press('ArrowDown');
      const rendered = (await optionRoot.locator(optionSelector).allTextContents()).map(normalize).filter(Boolean);
      rendered.forEach((option) => discovered.add(option));
      picked = rendered.find((option) => option === expected);
    }
    options = [...discovered];
  }
  if (!picked) throw new Error(`UI_OPTION_NOT_FOUND: field=${fieldLabel}; expected=${expected}; available=${JSON.stringify(options.slice(0, 30))}`);
  await exactOption.first().click({ timeout: 3_000 });
  const actual = normalize(await combo.inputValue().catch(() => ''));
  const containerText = normalize(await combo.evaluate((element) =>
    element.closest('.el-form-item__content')?.textContent ?? element.parentElement?.parentElement?.textContent ?? '',
  ).catch(() => ''));
  if (actual !== expected && !containerText.includes(expected)) {
    throw new Error(`UI_FIELD_READBACK_MISMATCH: field=${fieldLabel}; expected=${expected}; actual=${actual || containerText}`);
  }
}

async function fillVisibleField(page: Page, field: PlannedField, onlyWhenRequired = false) {
  const root = dialog(page);
  const aliases = FIELD_LABEL_ALIASES[field.label] ?? [field.label];
  const candidates = root.locator('.el-form-item:visible').filter({
    has: root.locator('.el-form-item__label').filter({
      hasText: new RegExp(`^\\s*[＊*]?\\s*(?:${aliases.map(escapeRe).join('|')})\\s*$`),
    }),
  });
  const candidateCount = await candidates.count();
  if (!candidateCount) {
    const accessibleName = new RegExp(`^\\s*\\*?\\s*(?:${aliases.map(escapeRe).join('|')})\\s*$`);
    const radioGroup = root.getByRole('radiogroup', { name: accessibleName });
    const radioGroupCount = await radioGroup.count();
    if (radioGroupCount === 1) {
      const radio = radioGroup.getByRole('radio', { name: String(field.value), exact: true });
      if (await radio.count() !== 1) throw new Error(`UI_OPTION_NOT_FOUND: ${field.label}=${String(field.value)}`);
      await radio.check({ force: true }).catch(async () => {
        const visibleControl = radioGroup.locator('.el-radio__label, .el-radio-button__inner')
          .filter({ hasText: new RegExp(`^\\s*${escapeRe(String(field.value))}\\s*$`) });
        if (await visibleControl.count() !== 1) throw new Error(`UI_OPTION_NOT_FOUND: ${field.label}=${String(field.value)}`);
        await visibleControl.click({ force: true });
      });
      await page.waitForTimeout(100);
      if (!(await radio.isChecked())) {
        const selectedText = normalize(await radioGroup.innerText().catch(() => ''));
        if (!selectedText.includes(String(field.value))) throw new Error(`UI_FIELD_READBACK_MISMATCH: ${field.label}=${String(field.value)}`);
      }
      return true;
    }
    const labelledGroup = root.getByRole('group', { name: accessibleName });
    const labelledGroupCount = await labelledGroup.count();
    if (labelledGroupCount === 1) {
      const groupedCombos = labelledGroup.getByRole('combobox');
      const groupedComboCount = await groupedCombos.count();
      if (groupedComboCount === 1) {
        await selectOption(page, groupedCombos.first(), String(field.value), field.label);
        return true;
      }
      if (groupedComboCount > 1) {
        throw new Error(`UI_CONTROL_AMBIGUOUS: ${field.label}; groupedComboboxes=${groupedComboCount}`);
      }
    }
    const combo = root.getByRole('combobox', { name: accessibleName });
    const comboCount = await combo.count();
    if (comboCount === 1) {
      await selectOption(page, combo, String(field.value), field.label);
      return true;
    }
    if (field.source === 'user') throw new Error(`UI_FIELD_NOT_FOUND: ${field.label}`);
    return false;
  }
  if (candidateCount > 1) throw new Error(`UI_FIELD_AMBIGUOUS: ${field.label}; count=${candidateCount}`);
  const item = candidates.first();
  const required = await item.evaluate((node) => node.classList.contains('is-required') || /[*＊]/.test(node.querySelector('.el-form-item__label')?.textContent ?? '')).catch(() => false);
  if (onlyWhenRequired && !required) return false;
  const accessibleName = new RegExp(`^\\s*\\*?\\s*(?:${aliases.map(escapeRe).join('|')})\\s*$`);
  const namedCombos = item.getByRole('combobox', { name: accessibleName });
  const namedComboCount = await namedCombos.count();
  const allCombos = item.getByRole('combobox');
  const allComboCount = await allCombos.count();
  if (namedComboCount > 1) throw new Error(`UI_CONTROL_AMBIGUOUS: ${field.label}; namedComboboxes=${namedComboCount}`);
  if (!namedComboCount && allComboCount > 1) {
    throw new Error(`UI_CONTROL_AMBIGUOUS: ${field.label}; comboboxes=${allComboCount}; no label-bound control`);
  }
  const combo = namedComboCount === 1 ? namedCombos.first() : allCombos.first();
  if ((namedComboCount === 1 || allComboCount === 1) && await combo.isVisible().catch(() => false)) {
    await selectOption(page, combo, String(field.value), field.label);
  }
  else {
    const radio = item.locator('.el-radio-button__inner, .el-radio__label').filter({ hasText: new RegExp(`^${escapeRe(String(field.value))}$`) }).first();
    if (await radio.isVisible().catch(() => false)) await radio.click();
    else {
      const input = item.locator('input:not([type=hidden]), textarea').first();
      if (!(await input.isVisible().catch(() => false))) throw new Error(`UI_CONTROL_UNSUPPORTED: ${field.label}`);
      await input.fill(String(field.value));
    }
  }
  await page.waitForTimeout(200);
  const actual = normalize(await item.locator('.el-form-item__content').innerText().catch(() => ''));
  const inputValue = await item.locator('input:not([type=hidden]), textarea').first().inputValue().catch(() => '');
  if (!actual.includes(String(field.value)) && inputValue !== String(field.value)) {
    throw new Error(`UI_FIELD_READBACK_MISMATCH: ${field.label}; expected=${String(field.value)}; actual=${actual || inputValue}`);
  }
  return true;
}

export async function fillRuleCreateField(page: Page, field: PlannedField) {
  const filled = await fillVisibleField(page, field);
  await waitForFormStability(page);
  return filled;
}

async function fillPlannedRequiredFieldsToConvergence(page: Page, fields: PlannedField[]) {
  const planned = new Map(fields.map((field) => [field.label, field]));
  for (let pass = 0; pass < 20; pass++) {
    await waitForFormStability(page);
    const state = await visibleFormState(page);
    const next = state.find((visible) => visible.required && visible.empty && [...planned.keys()].some((label) =>
      (FIELD_LABEL_ALIASES[label] ?? [label]).includes(visible.label),
    ));
    if (!next) return;
    const entry = [...planned.entries()].find(([label]) => (FIELD_LABEL_ALIASES[label] ?? [label]).includes(next.label));
    if (!entry) return;
    await fillVisibleField(page, entry[1], true);
  }
  throw new Error('UI_REQUIRED_FIELD_FILL_DID_NOT_CONVERGE: planned fields keep being reset by linkage');
}

async function addCondition(page: Page) {
  const root = dialog(page);
  const timeRanges = root.getByRole('combobox', { name: /时间范围|时间周期/ });
  const before = await timeRanges.count();
  let button = root.getByRole('button', { name: /添加条件|新增条件|添加规则/ }).first();
  if (!(await button.isVisible().catch(() => false))) {
    const row = timeRanges.last().locator('xpath=ancestor::*[count(.//*[@role="combobox"]) >= 4][1]');
    button = row.getByRole('button').last();
  }
  if (!(await button.isVisible().catch(() => false))) throw new Error('ADD_CONDITION_NOT_FOUND');
  await button.click();
  await expect.poll(() => timeRanges.count(), { timeout: 5_000 }).toBe(before + 1);
}

async function fillCondition(page: Page, index: number, condition: RuleCreatePlan['request']['conditions'][number]) {
  const root = dialog(page);
  const timeRangeCombo = root.getByRole('combobox', { name: /时间范围|时间周期/ }).nth(index);
  const combos = {
    timeRange: timeRangeCombo,
    aggregate: root.getByRole('combobox', { name: /^条件$|聚合方式/ }).nth(index),
    metric: root.getByRole('combobox', { name: /指标/ }).nth(index),
    compare: root.getByRole('combobox', { name: /运算符|比较符/ }).nth(index),
  };
  await selectOption(page, combos.timeRange, condition.timeRange, `condition[${index}].timeRange`);
  if (condition.aggregateType) await selectOption(page, combos.aggregate, condition.aggregateType, `condition[${index}].aggregateType`);
  await selectOption(page, combos.metric, condition.metric, `condition[${index}].metric`);
  await selectOption(page, combos.compare, condition.compareType, `condition[${index}].compareType`);
  const conditionRow = timeRangeCombo.locator('xpath=ancestor::*[count(.//*[@role="combobox"]) >= 4][1]');
  const threshold = conditionRow.locator('input[type="number"], [role="spinbutton"]').last();
  if (!(await threshold.isVisible().catch(() => false))) {
    throw new Error(`CONDITION_THRESHOLD_NOT_FOUND: row=${index}`);
  }
  await threshold.fill(String(condition.val1));
  const readback = [
    await combos.timeRange.inputValue().catch(() => ''),
    await combos.metric.inputValue().catch(() => ''),
    await combos.compare.inputValue().catch(() => ''),
    await threshold.inputValue(),
  ].join('|');
  for (const expected of [condition.timeRange, condition.metric, condition.compareType, String(condition.val1)]) {
    if (!readback.includes(expected)) throw new Error(`CONDITION_READBACK_MISMATCH: row=${index}; expected=${expected}; actual=${readback}`);
  }
}

async function assertNoUnknownRequiredFields(page: Page) {
  await waitForFormStability(page);
  const missing = (await visibleFormState(page)).filter((field) => field.required && field.empty);
  if (missing.length) {
    throw new Error(`UNKNOWN_REQUIRED_FIELDS: ${missing.map((field) => `${field.label}(${field.controlType})`).join(',')}`);
  }
}

export async function createRuleFromConfirmedPlan(page: Page, plan: RuleCreatePlan, outputDir: string): Promise<RuleCreateResult> {
  if (plan.status !== 'confirmed') throw new Error('RULE_CREATE_CONFIRMATION_REQUIRED');
  const screenshots: string[] = [];
  try {
    await page.getByRole('button', { name: '新建规则管控', exact: true }).click();
    await expect(dialog(page)).toBeVisible({ timeout: 15_000 });
    const root = dialog(page);
    const ruleName = plan.request.ruleName ?? `auto_dc_${Date.now()}`;
    await root.getByPlaceholder('请输入规则名称').fill(ruleName);
    for (const field of plan.explicitFields) {
      if (field.label === '规则名称') continue;
      await fillVisibleField(page, field);
      await waitForFormStability(page);
    }
    await fillPlannedRequiredFieldsToConvergence(page, [...plan.explicitFields, ...plan.supplementedFields]);
    for (let index = 0; index < plan.request.conditions.length; index++) {
      if (index > 0) await addCondition(page);
      await fillCondition(page, index, plan.request.conditions[index]);
    }
    for (const [label, value] of Object.entries(plan.request.actions ?? {})) {
      await fillVisibleField(page, { label, value, source: 'user' });
    }
    await assertNoUnknownRequiredFields(page);
    const before = `${outputDir}/rule-create-before-submit.png`;
    await page.screenshot({ path: before, fullPage: true }); screenshots.push(before);
    const submitRejected = page.waitForResponse(
      (response) => response.request().method() !== 'GET' && response.status() >= 400,
      { timeout: 30_000 },
    ).then(async (response) => {
      const body = await response.text().catch(() => '');
      let message = body;
      try { message = JSON.parse(body)?.message ?? body; } catch { /* retain response text */ }
      throw new Error(`RULE_CREATE_SUBMIT_REJECTED: status=${response.status()}; message=${message.slice(0, 500)}`);
    });
    await root.getByRole('button', { name: '确认' }).click();
    const confirmation = page.getByRole('dialog').filter({ hasText: /确认提交/ });
    if (await confirmation.isVisible({ timeout: 2_000 }).catch(() => false)) await confirmation.getByRole('button', { name: /确定|确认|是/ }).click();
    await Promise.race([expect(root).toBeHidden({ timeout: 30_000 }), submitRejected]);
    const search = page.getByPlaceholder('请输入广告规则名称');
    if (await search.isVisible().catch(() => false)) await search.fill(ruleName);
    const searchButton = page.getByRole('button', { name: '搜索' });
    if (await searchButton.isVisible().catch(() => false)) await searchButton.click();
    const row = page.locator('.el-table__body tr').filter({ hasText: ruleName }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    const rowText = normalize(await row.innerText());
    const match = rowText.match(/\b(\d{4,})\b/);
    if (!match) throw new Error(`RULE_ID_NOT_FOUND: ${rowText}`);
    const after = `${outputDir}/rule-create-created.png`;
    await page.screenshot({ path: after, fullPage: true }); screenshots.push(after);
    return {
      status: 'created', ruleId: match[1], ruleName, projectName: plan.request.projectName,
      channel: plan.request.channel, businessLine: plan.request.businessLine,
      controlDimension: plan.request.controlDimension,
      actualFields: Object.fromEntries([...plan.explicitFields, ...plan.supplementedFields].map((field) => [field.label, field.value])),
      conditions: plan.request.conditions, actions: plan.request.actions ?? {}, createdAt: new Date().toISOString(),
      evidence: { screenshotPaths: screenshots, pageUrl: page.url() },
      handoff: { nextSkill: 'ui-flow-db', ruleId: match[1], suggestedModes: ['hit', 'miss'] }, issues: [],
    };
  } catch (error) {
    return {
      status: 'failed', projectName: plan.request.projectName, channel: plan.request.channel,
      businessLine: plan.request.businessLine, controlDimension: plan.request.controlDimension,
      actualFields: {}, conditions: plan.request.conditions, actions: plan.request.actions ?? {},
      evidence: { screenshotPaths: screenshots, pageUrl: page.url() },
      issues: [{ code: 'RULE_CREATE_FAILED', message: error instanceof Error ? error.message : String(error) }],
    };
  }
}
