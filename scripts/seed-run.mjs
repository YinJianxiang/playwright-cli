/** Thin transport for the single TypeScript Seed V3 CLI implementation. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command = 'preflight', ...args] = process.argv.slice(2);
const allowed = new Set([
  'compile',
  'preflight',
  'approve',
  'apply',
  'cancel',
  'status',
  'cleanup',
  'recover',
]);
if (!allowed.has(command)) {
  console.error(`Unknown seed command: ${command}`);
  process.exit(2);
}

const cliArgs = Object.fromEntries(
  args
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, ...value] = arg.slice(2).split('=');
      return [key, value.length ? value.join('=') : '1'];
    }),
);

const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
    'test',
    '--config=playwright.seed.config.ts',
    'seed-v3-cli.spec.ts',
    '--workers=1',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_SEED_CLI_COMMAND: command,
      E2E_SEED_CLI_ARGS: JSON.stringify(cliArgs),
    },
  },
);

if (result.error) {
  console.error(result.error);
}
process.exit(result.status ?? 1);
