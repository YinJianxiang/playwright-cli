import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PlaywrightTestConfig } from '@playwright/test';

/** 保证读 .env 后再解析 headless（各 config import 本模块时也会生效） */
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

/**
 * `E2E_HEADLESS=1|true|yes|on` → 无头；其余 / 未设 → 有头（默认）。
 * CLI `--headed` 仍可强制有头。
 */
export function resolveHeadless(): boolean {
  const v = process.env.E2E_HEADLESS?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** 共用：录屏 + Trace + 多 Reporter（line / HTML / Allure） */
export const evidenceUse: NonNullable<PlaywrightTestConfig['use']> = {
  channel: 'chrome',
  headless: resolveHeadless(),
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
