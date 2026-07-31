import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/seed',
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
  reporter: [['line']],
});
