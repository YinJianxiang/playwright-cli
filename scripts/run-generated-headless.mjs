/**
 * 强制无头跑 Playwright（设 E2E_HEADLESS=1，不传 --headed）。
 *
 * 用法:
 *   node scripts/run-generated-headless.mjs
 *   node scripts/run-generated-headless.mjs --workers=1 FLOW-GL-SPEND-FREE-PJ-HIT.spec.ts
 *   node scripts/run-generated-headless.mjs --config=playwright.config.ts
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const hasConfig = args.some((a) => a === '--config' || a.startsWith('--config='));
const finalArgs = hasConfig
  ? ['playwright', 'test', ...args]
  : ['playwright', 'test', '--config=playwright.generated.config.ts', ...args];

const r = spawnSync('npx', finalArgs, {
  stdio: 'inherit',
  env: { ...process.env, E2E_HEADLESS: '1' },
  shell: true,
  cwd: root,
});

process.exit(r.status ?? 1);
