import fs from 'node:fs';
import path from 'node:path';

export type E2eUrlName =
  | 'E2E_LOGIN_URL'
  | 'E2E_HOME_URL'
  | 'E2E_RULE_URL'
  | 'E2E_RECORD_URL'
  | 'E2E_JOB_TRIGGER_URL_TEMPLATE';

export function loadDotEnvFromRepoRoot() {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

export function requireE2eUrl(name: E2eUrlName): string {
  loadDotEnvFromRepoRoot();
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required URL environment variable: ${name}`);
  try {
    new URL(value.replace('{{rule_id}}', '1'));
  } catch {
    throw new Error(`${name} must be a complete http(s) URL, received: ${value}`);
  }
  return value;
}

export function buildJobTriggerUrl(ruleId: string): string {
  const template = requireE2eUrl('E2E_JOB_TRIGGER_URL_TEMPLATE');
  if (!template.includes('{{rule_id}}')) {
    throw new Error('E2E_JOB_TRIGGER_URL_TEMPLATE must contain {{rule_id}}');
  }
  return template.replace('{{rule_id}}', encodeURIComponent(ruleId));
}
