import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const ROOT = path.resolve('.');
const ACTIVE_ROOTS = ['tests/e2e/helpers', 'tests/seed', 'scripts'];
const TEXT_EXTENSIONS = new Set(['.ts', '.mjs', '.js']);

function activeFiles(): string[] {
  const files: string[] = [];
  const visit = (absolute: string) => {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = path.join(absolute, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) files.push(child);
    }
  };
  for (const root of ACTIVE_ROOTS) visit(path.join(ROOT, root));
  return files;
}

test('active code exposes only Seed V3', () => {
  const forbidden = [
    new RegExp(['ad-control', 'v2'].join('-')),
    new RegExp(['seed', 'v2'].join('-')),
    new RegExp(['SeedPlan', 'V2'].join('')),
    new RegExp(['planSeed', 'ViaDb'].join('')),
    new RegExp(['applySeed', 'ViaDb'].join('')),
    new RegExp(['seed', 'ViaDb'].join('')),
    new RegExp(['compiled', 'V2'].join('')),
  ];
  const violations: string[] = [];
  for (const file of activeFiles()) {
    if (file.endsWith('seed-v3-only-policy.spec.ts')) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(source)) {
        violations.push(`${path.relative(ROOT, file)} matches ${pattern}`);
      }
    }
  }
  expect(violations).toEqual([]);
});

test('scripts cannot write business fact tables directly', () => {
  const violations: string[] = [];
  for (const file of activeFiles().filter((item) =>
    path.relative(ROOT, item).startsWith('scripts'),
  )) {
    const source = fs.readFileSync(file, 'utf8');
    if (/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:`?market`?\.)?`?ad_/i.test(source)) {
      violations.push(path.relative(ROOT, file));
    }
  }
  expect(violations).toEqual([]);
});

test('only the V3 transaction module contains fact-table write templates', () => {
  const violations: string[] = [];
  for (const file of activeFiles().filter((item) =>
    path.relative(ROOT, item).startsWith('tests/e2e/helpers/seed'),
  )) {
    if (file.endsWith('execution-plan-v3.ts') || file.endsWith('meta-db-v3.ts')) {
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    if (/\b(?:INSERT\s+INTO|DELETE\s+FROM)\b/i.test(source)) {
      violations.push(path.relative(ROOT, file));
    }
  }
  expect(violations).toEqual([]);
});
