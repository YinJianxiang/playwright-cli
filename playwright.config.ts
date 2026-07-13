import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

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
    // .env is optional; credentials can also be exported in the shell.
  }
}

loadEnvFile();

export default defineConfig({
  testDir: 'tests/e2e/specs',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
  },
  reporter: [['line']],
});
