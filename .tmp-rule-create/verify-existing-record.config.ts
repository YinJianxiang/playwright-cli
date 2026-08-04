import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: /verify-existing-record\.spec\.ts/, timeout: 120_000,
  outputDir: 'test-results/verify-existing-record-output',
  use: { headless: false, viewport: { width: 1440, height: 900 } },
});
