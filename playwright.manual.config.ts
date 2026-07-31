import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
import { evidenceUse, evidenceReporter } from './playwright.evidence';

function loadEnvFile() {
  try {
    const envPath = resolve(__dirname, '.env');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([^#][^=]*?)=(.*)$/);
      if (match && process.env[match[1].trim()] === undefined) {
        process.env[match[1].trim()] = match[2].trim();
      }
    }
  } catch {
    // optional
  }
}

loadEnvFile();

export default defineConfig({
  testDir: 'tests/e2e/manual',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  use: {
    ...evidenceUse,
    // 跟随 E2E_HEADLESS；勿再写死 headless:false
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
  },
  reporter: [['line'], ...evidenceReporter],
  outputDir: 'test-results',
});
