import type { PlaywrightTestConfig } from '@playwright/test';

/** 共用：录屏 + Trace + 多 Reporter（line / HTML / Allure） */
export const evidenceUse: NonNullable<PlaywrightTestConfig['use']> = {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1440, height: 900 },
  actionTimeout: 15_000,
  navigationTimeout: 30_000,
  /** 每次跑测录屏，便于完整回放 */
  video: 'on',
  /** 失败保留 Trace；需要全量可改 'on' */
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
};

export const evidenceReporter: NonNullable<PlaywrightTestConfig['reporter']> = [
  ['list'],
  ['html', { open: 'never', outputFolder: 'playwright-report' }],
  [
    'allure-playwright',
    {
      detail: true,
      suiteTitle: true,
      resultsDir: 'allure-results',
    },
  ],
];
