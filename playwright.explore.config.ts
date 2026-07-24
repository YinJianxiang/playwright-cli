import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(__dirname, '.env'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([^#][^=]*?)=(.*)$/);
      if (match && process.env[match[1].trim()] === undefined) {
        process.env[match[1].trim()] = match[2].trim();
      }
    }
  } catch {
    /* optional */
  }
}

loadEnvFile();

export default defineConfig({
  testDir: 'tests/e2e/generated/20260722-111234/explore',
  testMatch: 'run-explore.spec.ts',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  use: {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  reporter: [['line']],
});
