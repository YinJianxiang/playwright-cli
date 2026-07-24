/**
 * 手工建规则：渠道 · 客户端-免费短剧
 * 条件1：当天 · 累计 · 整体ROI · ≤ 10
 * 条件2：近3日 · 连续 · CPA · ≥ 10
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import {
  login,
  loadDotEnvFromRepoRoot,
  gotoRulePage,
} from '../generated/20260722-140935/helpers/auth';

const RULE_NAME = `auto_dc_ch_syh_${Date.now()}`;

function dialog(page: Page) {
  return page.getByRole('dialog').first();
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function clickRadioInner(scope: Locator, text: string) {
  const inner = scope
    .locator('.el-radio-button__inner, .el-radio__label')
    .filter({ hasText: new RegExp(`^${escapeRe(text)}$`) })
    .first();
  if (await inner.isVisible().catch(() => false)) {
    await inner.click();
    return;
  }
  await scope.getByText(text, { exact: true }).first().click();
}

async function dismissPopper(page: Page) {
  const nameBox = dialog(page).getByPlaceholder('请输入规则名称');
  if (await nameBox.isVisible().catch(() => false)) {
    await nameBox.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

async function openNamedCombo(page: Page, name: RegExp, row?: Locator) {
  const root = row ?? dialog(page);
  const combo = root.getByRole('combobox', { name }).first();
  const v2Wrap = combo
    .locator(
      'xpath=ancestor::*[contains(@class,"el-select-v2")][1]//*[contains(@class,"el-select-v2__wrapper")]',
    )
    .first();
  if ((await v2Wrap.count()) > 0) {
    await v2Wrap.click({ force: true });
    await page.waitForTimeout(350);
    return;
  }
  const wrap = combo
    .locator('xpath=ancestor::*[contains(@class,"el-select")][1]//*[contains(@class,"el-select__wrapper")]')
    .first();
  if ((await wrap.count()) > 0) await wrap.click({ force: true });
  else await combo.click({ force: true });
  await page.waitForTimeout(350);
}

async function listVisibleOptions(page: Page): Promise<string[]> {
  const opts = page.locator(
    '.el-select__popper:visible [role="option"], .el-select-v2__popper:visible .el-select-dropdown__option-item, .el-popper:visible [role="option"]',
  );
  const n = await opts.count();
  const texts: string[] = [];
  for (let i = 0; i < Math.min(n, 80); i++) {
    const t = ((await opts.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    if (t) texts.push(t);
  }
  return texts;
}

async function clickOptionExact(page: Page, optionText: string) {
  const re = new RegExp(`^${escapeRe(optionText)}$`);
  const v2 = page
    .locator('.el-select-v2__popper:visible .el-select-dropdown__option-item')
    .filter({ hasText: re })
    .first();
  if (await v2.isVisible().catch(() => false)) {
    await v2.click({ timeout: 8_000 });
    return;
  }
  const classic = page
    .locator('.el-select__popper:visible [role="option"], .el-popper:visible [role="option"]')
    .filter({ hasText: re })
    .first()
    .or(page.getByRole('option', { name: optionText, exact: true }).first());
  await classic.click({ timeout: 10_000 });
}

async function selectExactIn(
  page: Page,
  name: RegExp,
  candidates: string[],
  row?: Locator,
): Promise<string> {
  await dismissPopper(page);
  await openNamedCombo(page, name, row);
  const available = await listVisibleOptions(page);
  for (const c of candidates) {
    if (available.some((a) => a === c)) {
      await clickOptionExact(page, c);
      await page.waitForTimeout(200);
      return c;
    }
  }
  // fuzzy contains
  for (const c of candidates) {
    const hit = available.find((a) => a.includes(c) || c.includes(a));
    if (hit) {
      await clickOptionExact(page, hit);
      await page.waitForTimeout(200);
      return hit;
    }
  }
  throw new Error(
    `select ${name} 未找到候选 ${JSON.stringify(candidates)}；可选=${JSON.stringify(available)}`,
  );
}

async function selectExact(page: Page, name: RegExp, optionText: string) {
  await selectExactIn(page, name, [optionText]);
}

async function selectLooksEmpty(scope: Locator) {
  if ((await scope.locator('.el-select-v2__placeholder, .el-select__placeholder').count()) > 0) {
    const visible = await scope
      .locator('.el-select-v2__placeholder, .el-select__placeholder')
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return true;
  }
  const t = ((await scope.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  if (!t || t.includes('请选择')) return true;
  return false;
}

async function selectFilterableUnlimited(page: Page, scope: Locator) {
  const wrap = scope.locator('.el-select-v2__wrapper, .el-select__wrapper').first();
  await wrap.click();
  await page.waitForTimeout(400);
  const unlimited = page
    .locator('.el-select-v2__popper:visible .el-select-dropdown__option-item, .el-select__popper:visible [role="option"]')
    .filter({ hasText: /^不限$/ })
    .first();
  if (await unlimited.isVisible().catch(() => false)) {
    await unlimited.click();
    return;
  }
  await clickOptionExact(page, '不限').catch(async () => {
    const first = page
      .locator('.el-select-v2__popper:visible .el-select-dropdown__option-item, .el-select__popper:visible [role="option"]')
      .first();
    await first.click();
  });
}

/** 条件行容器：尽量按「时间范围」combobox 所在行拆分 */
async function conditionRows(page: Page): Promise<Locator[]> {
  const root = dialog(page);
  const periodCombos = root.getByRole('combobox', { name: /时间范围|时间周期/ });
  const n = await periodCombos.count();
  const rows: Locator[] = [];
  for (let i = 0; i < n; i++) {
    const combo = periodCombos.nth(i);
    const row = combo.locator(
      'xpath=ancestor::*[contains(@class,"el-form-item") or contains(@class,"condition") or contains(@class,"el-row")][1]',
    );
    // climb to a wider row that also has 指标
    const wide = combo.locator(
      'xpath=ancestor::*[.//*[@role="combobox" and (contains(@aria-label,"指标") or contains(@name,"指标") or contains(.,"指标"))]][1]',
    );
    if ((await wide.count()) > 0) rows.push(wide.first());
    else if ((await row.count()) > 0) rows.push(row.first());
    else rows.push(combo.locator('xpath=ancestor::div[3]'));
  }
  return rows;
}

async function addConditionRow(page: Page) {
  const root = dialog(page);
  const before = await root.getByRole('combobox', { name: /时间范围|时间周期/ }).count();
  const candidates = [
    root.getByRole('button', { name: /添加条件|新增条件|添加规则|加条件/ }),
    root.locator('button, a, span').filter({ hasText: /添加条件|新增条件|\+\s*条件/ }),
    root.locator('.el-icon-plus, .el-icon--plus').locator('xpath=ancestor::button[1]'),
  ];
  let clicked = false;
  for (const c of candidates) {
    if ((await c.count()) > 0 && (await c.first().isVisible().catch(() => false))) {
      await c.first().click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    // 条件区附近的 +
    const plus = root.locator('button').filter({ hasText: /^\+$|^添加$/ }).first();
    if (await plus.isVisible().catch(() => false)) {
      await plus.click();
      clicked = true;
    }
  }
  if (!clicked) throw new Error('未找到「添加条件」按钮');
  await expect
    .poll(async () => root.getByRole('combobox', { name: /时间范围|时间周期/ }).count(), {
      timeout: 8_000,
    })
    .toBeGreaterThan(before);
}

async function fillConditionRow(
  page: Page,
  rowIndex: number,
  cfg: {
    period: string[];
    reduce: string[];
    metric: string[];
    operator: string[];
    threshold: number;
  },
) {
  const root = dialog(page);
  // 用全局 nth combobox 更稳（行容器 xpath 不稳定）
  const periodCombo = root.getByRole('combobox', { name: /时间范围|时间周期/ }).nth(rowIndex);
  const reduceCombo = root.getByRole('combobox', { name: /^条件$/ }).nth(rowIndex);
  const metricCombo = root.getByRole('combobox', { name: /指标/ }).nth(rowIndex);
  const opCombo = root.getByRole('combobox', { name: /运算符/ }).nth(rowIndex);
  const spin = root.getByRole('spinbutton').nth(rowIndex);

  const pickOn = async (combo: Locator, candidates: string[]) => {
    await dismissPopper(page);
    const v2Wrap = combo
      .locator(
        'xpath=ancestor::*[contains(@class,"el-select-v2")][1]//*[contains(@class,"el-select-v2__wrapper")]',
      )
      .first();
    if ((await v2Wrap.count()) > 0) await v2Wrap.click({ force: true });
    else {
      const wrap = combo
        .locator(
          'xpath=ancestor::*[contains(@class,"el-select")][1]//*[contains(@class,"el-select__wrapper")]',
        )
        .first();
      if ((await wrap.count()) > 0) await wrap.click({ force: true });
      else await combo.click({ force: true });
    }
    await page.waitForTimeout(350);
    const available = await listVisibleOptions(page);
    for (const c of candidates) {
      if (available.some((a) => a === c)) {
        await clickOptionExact(page, c);
        await page.waitForTimeout(200);
        return c;
      }
    }
    for (const c of candidates) {
      const hit = available.find((a) => a.includes(c));
      if (hit) {
        await clickOptionExact(page, hit);
        await page.waitForTimeout(200);
        return hit;
      }
    }
    throw new Error(
      `row${rowIndex} 未匹配 ${JSON.stringify(candidates)}；可选=${JSON.stringify(available)}`,
    );
  };

  const picked = {
    period: await pickOn(periodCombo, cfg.period),
    reduce: await pickOn(reduceCombo, cfg.reduce),
    metric: await pickOn(metricCombo, cfg.metric),
    operator: await pickOn(opCombo, cfg.operator),
  };
  await spin.fill(String(cfg.threshold));
  return picked;
}

test('创建渠道维度客户端-免费短剧双条件规则', async ({ page }) => {
  loadDotEnvFromRepoRoot();
  test.setTimeout(300_000);

  await login(page);
  await gotoRulePage(page);
  await page.getByRole('button', { name: '新建规则管控', exact: true }).click();
  const root = dialog(page);
  await expect(root).toBeVisible({ timeout: 15_000 });

  await clickRadioInner(root, '渠道');
  await page.waitForTimeout(600);

  const ta = root.locator('textarea[placeholder="请输入规则名称"]');
  if ((await ta.count()) > 0) await ta.fill(RULE_NAME);
  else await root.getByPlaceholder('请输入规则名称').fill(RULE_NAME);

  const biz = await selectExactIn(page, /业务线/, ['客户端-免费短剧']);
  console.log(`BUSINESS_LINE=${biz}`);

  // 小程序类型 / 媒体 / 主体 / 创建时间 / 自投 — 有则填不限
  if (await root.getByRole('combobox', { name: /小程序类型/ }).first().isVisible().catch(() => false)) {
    await selectExact(page, /小程序类型/, '不限').catch(() => undefined);
  }
  const media = root.getByRole('combobox', { name: /媒体/ });
  if (await media.first().isVisible().catch(() => false)) {
    const mediaText = ((await media.first().innerText().catch(() => '')) || '').trim();
    if (!mediaText || mediaText.includes('请选择')) {
      await selectExactIn(page, /媒体/, ['头条媒体', '不限']).catch(() => undefined);
    }
  }
  const subjectCombo = root.getByRole('combobox', { name: /主体/ }).first();
  if (await subjectCombo.isVisible().catch(() => false)) {
    const subjectScope = subjectCombo.locator('xpath=ancestor::*[contains(@class,"el-form-item")][1]');
    if (await selectLooksEmpty(subjectScope)) {
      await selectExact(page, /主体/, '不限').catch(async () => {
        await selectFilterableUnlimited(page, subjectScope);
      });
    }
  }
  for (const name of [/渠道创建时间/, /广告创建时间/, /项目创建时间/] as const) {
    if (await root.getByRole('combobox', { name }).first().isVisible().catch(() => false)) {
      await selectExact(page, name, '不限').catch(() => undefined);
    }
  }
  if (await root.getByRole('combobox', { name: /自投/ }).first().isVisible().catch(() => false)) {
    await selectExact(page, /自投/, '不限').catch(() => undefined);
  }
  for (const [group, value] of [
    ['短剧上架时间', '不限'],
    ['广告状态', '开启'],
    ['项目状态', '不限'],
    ['渠道状态', '不限'],
    ['单书/剧数据筛选', '关闭'],
  ] as const) {
    const g = root.getByRole('radiogroup', { name: new RegExp(group) });
    if (await g.isVisible().catch(() => false)) await clickRadioInner(g, value).catch(() => undefined);
  }

  // 条件1
  const c1 = await fillConditionRow(page, 0, {
    period: ['当天'],
    reduce: ['累计', '累加'],
    metric: ['整体ROI'],
    operator: ['小于等于', '≤', '<='],
    threshold: 10,
  });
  console.log('COND1', c1);

  // 条件2
  await addConditionRow(page);
  const c2 = await fillConditionRow(page, 1, {
    period: ['近3日', '近三日', '近3天', '近三天'],
    reduce: ['连续', '所有/连续', '所有'],
    metric: ['CPA'],
    operator: ['大于等于', '≥', '>='],
    threshold: 10,
  });
  console.log('COND2', c2);

  // 动作
  if (await root.getByText('预警', { exact: true }).first().isVisible().catch(() => false)) {
    await clickRadioInner(root, '预警').catch(() => undefined);
  }
  if (await root.getByText('每30分钟', { exact: true }).first().isVisible().catch(() => false)) {
    await clickRadioInner(root, '每30分钟').catch(() => undefined);
  }

  // 负责人末尾
  const ownerGroup = root.getByRole('group', { name: /负责人/ });
  if ((await ownerGroup.count()) > 0 && (await selectLooksEmpty(ownerGroup))) {
    await selectFilterableUnlimited(page, ownerGroup).catch(() => undefined);
  }

  await root.getByRole('button', { name: '确认' }).click();
  const submitConfirm = page.getByRole('dialog').filter({ hasText: '确认提交吗' });
  if (await submitConfirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await submitConfirm.getByRole('button', { name: /确定|确认|是/ }).click();
  }
  await expect(root).toBeHidden({ timeout: 30_000 });

  await gotoRulePage(page);
  await page.getByPlaceholder('请输入广告规则名称').fill(RULE_NAME);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.waitForTimeout(1500);
  const row = page.locator('.el-table__body tr').filter({ hasText: RULE_NAME }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  const text = (await row.innerText()).replace(/\s+/g, ' ');
  const match = text.match(/\b(\d{4,})\b/);
  if (!match) throw new Error(`无法解析 ruleId: ${text}`);
  console.log(`CREATED ruleId=${match[1]} ruleName=${RULE_NAME}`);
  console.log(`ROW=${text}`);
});
