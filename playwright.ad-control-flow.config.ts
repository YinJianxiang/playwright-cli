import { defineConfig } from '@playwright/test';
import { evidenceUse } from './playwright.evidence';

export default defineConfig({
  testDir: 'tests/e2e/manual',
  testMatch: /ad-control-seed-v3-flow\.spec\.ts/,
  timeout: 420_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: evidenceUse,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-flow' }],
    ['allure-playwright', {
      // 仅保留业务 test.step，避免底层 fill("secret") 进入 Allure 步骤名。
      detail: false,
      suiteTitle: true,
      resultsDir: 'allure-results-flow',
    }],
  ],
  outputDir: 'test-results-flow',
});
