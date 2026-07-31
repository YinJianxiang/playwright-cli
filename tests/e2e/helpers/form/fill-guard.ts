/**
 * 提交前空值守卫：仅补 B 层空 combobox / 未勾选 radiogroup，绝不改 A 测试轴。
 * 禁止 Escape（会关掉 el-dialog）。
 */
import type { Page, Locator } from '@playwright/test';

export type HealLogFn = (name: string, detail?: unknown) => void;

export type HealResult = {
  healed: Array<{ label: string; picked: string }>;
};

/** 测试轴 / 条件行 / 动作：heal 禁止改动 */
const AXIS_LABEL_RE =
  /^(维度|业务线|投放版本|投放方式|规则名称|时间范围|时间周期|条件|指标|运算符|执行动作|执行周期)$/;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dialog(page: Page) {
  const named = page
    .locator('.el-dialog:visible, [role="dialog"]:visible')
    .filter({ has: page.getByPlaceholder('请输入规则名称') })
    .first();
  return named;
}

/** 关下拉：点规则名称，绝不 Escape（Escape 会关 dialog） */
async function dismissSelectPopper(page: Page) {
  const root = dialog(page);
  const nameBox = root.getByPlaceholder('请输入规则名称');
  if (await nameBox.isVisible().catch(() => false)) {
    await nameBox.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(120);
  }
}

async function listVisibleOptions(page: Page): Promise<string[]> {
  const opts = page.locator(
    '.el-select__popper[aria-hidden="false"] [role="option"], .el-select-v2__popper[aria-hidden="false"] .el-select-dropdown__option-item, .el-select__popper:visible [role="option"], .el-select-v2__popper:visible .el-select-dropdown__option-item',
  );
  const n = await opts.count();
  const texts: string[] = [];
  for (let i = 0; i < Math.min(n, 40); i++) {
    const t = ((await opts.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    if (t) texts.push(t);
  }
  return texts;
}

async function clickOption(page: Page, text: string) {
  const re = new RegExp(`^${escapeRe(text)}$`);
  const v2 = page
    .locator(
      '.el-select-v2__popper[aria-hidden="false"] .el-select-dropdown__option-item, .el-select-v2__popper:visible .el-select-dropdown__option-item',
    )
    .filter({ hasText: re })
    .first();
  if (await v2.isVisible().catch(() => false)) {
    await v2.click({ timeout: 8_000 });
    return;
  }
  await page
    .locator(
      '.el-select__popper[aria-hidden="false"] [role="option"], .el-select__popper:visible [role="option"]',
    )
    .filter({ hasText: re })
    .first()
    .click({ timeout: 8_000 });
}

function formItemLabel(item: Locator): Promise<string> {
  return item
    .locator('.el-form-item__label')
    .innerText()
    .then((t) => (t || '').replace(/\s+/g, ' ').replace(/^[＊*]\s*/, '').trim())
    .catch(() => '');
}

/** combobox 节点常为空；看整个 form-item 内容区是否已有非 placeholder 文案 */
async function looksEmptyCombo(item: Locator, combo: Locator): Promise<boolean> {
  const content = item.locator('.el-form-item__content').first();
  const contentText = ((await content.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  if (contentText && !/请选择/.test(contentText)) return false;

  const selected = item.locator(
    '.el-select__selected-item, .el-select-v2__selected-item, .el-tag, .el-select__tags-text',
  );
  if ((await selected.count()) > 0) {
    const st = ((await selected.first().innerText().catch(() => '')) || '').trim();
    if (st && !st.includes('请选择')) return false;
  }

  const ph = item.locator('.el-select__placeholder, .el-select-v2__placeholder');
  if ((await ph.count()) > 0) {
    const visiblePh = await ph.first().isVisible().catch(() => false);
    if (!visiblePh) return false;
  }

  const text = ((await combo.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  return !text || text.includes('请选择');
}

async function radioHasSelection(g: Locator): Promise<boolean> {
  const n = await g
    .locator('.is-checked, .is-active, [aria-checked="true"], .el-radio-button.is-active')
    .count();
  return n > 0;
}

async function healRadiogroup(item: Locator): Promise<string | null> {
  const g = item.getByRole('radiogroup').first();
  if (!(await g.count()) || !(await g.isVisible().catch(() => false))) return null;
  if (await radioHasSelection(g)) return null;
  const unlimited = g
    .locator('.el-radio-button__inner, .el-radio__label')
    .filter({ hasText: /^不限$/ })
    .first();
  if (await unlimited.isVisible().catch(() => false)) {
    await unlimited.click();
    return '不限';
  }
  const first = g.locator('.el-radio-button__inner, .el-radio__label').first();
  if (await first.isVisible().catch(() => false)) {
    const t = ((await first.innerText().catch(() => '')) || '').trim() || 'first';
    await first.click();
    return t;
  }
  return null;
}

/**
 * 仅补 B 层空控件；跳过 A 轴标签。一轮。
 */
export async function healEmptyRequiredCombos(
  page: Page,
  opts?: { log?: HealLogFn },
): Promise<HealResult> {
  const root = dialog(page);
  const healed: HealResult['healed'] = [];
  if (!(await root.isVisible().catch(() => false))) {
    opts?.log?.('baseline.heal.skip', { reason: 'dialog-not-visible' });
    return { healed };
  }

  const items = root.locator('.el-form-item');
  const n = await items.count();

  for (let i = 0; i < n; i++) {
    const item = items.nth(i);
    if (!(await item.isVisible().catch(() => false))) continue;
    const label = (await formItemLabel(item)) || `item#${i}`;
    if (AXIS_LABEL_RE.test(label)) continue;

    const radioPick = await healRadiogroup(item);
    if (radioPick) {
      healed.push({ label, picked: radioPick });
      opts?.log?.('baseline.heal', { label, picked: radioPick, kind: 'radio' });
      opts?.log?.('ui.click', {
        field: label,
        value: radioPick,
        control: 'radio',
        source: 'heal',
      });
      continue;
    }

    const combo = item.getByRole('combobox').first();
    if (!(await combo.count()) || !(await combo.isVisible().catch(() => false))) continue;
    if (!(await looksEmptyCombo(item, combo))) continue;

    try {
      await combo.click({ force: true });
      await page.waitForTimeout(350);
      const options = await listVisibleOptions(page);
      if (!options.length) {
        await dismissSelectPopper(page);
        continue;
      }
      const picked = options.includes('不限') ? '不限' : options[0];
      await clickOption(page, picked);
      await page.waitForTimeout(150);
      await dismissSelectPopper(page);
      healed.push({ label, picked });
      opts?.log?.('baseline.heal', { label, picked, optionsPreview: options.slice(0, 8) });
      opts?.log?.('ui.click', {
        field: label,
        value: picked,
        control: 'select',
        source: 'heal',
      });
    } catch {
      await dismissSelectPopper(page);
    }
  }

  return { healed };
}

export async function collectFormErrors(page: Page): Promise<string[]> {
  const root = dialog(page);
  const errs = await root.locator('.el-form-item__error').allTextContents().catch(() => []);
  return errs.map((e) => e.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
