import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { RowDataPacket } from 'mysql2';
import { closeDbPool, query } from '../e2e/helpers/db';
import type { SeedCleanupManifest } from '../e2e/helpers/seed/execution-plan-v3';

const OUTPUT_DIR = path.resolve(
  'tests/e2e/generated/20260728-181405/explore',
);
const MANIFESTS = [
  'seed-cleanup-16214-hit.json',
  'seed-cleanup-16214-miss.json',
  'seed-cleanup-16238-hit.json',
  'seed-cleanup-16242-hit.json',
  'seed-cleanup-16256-hit.json',
];

function identifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe identifier in cleanup manifest: ${value}`);
  }
  return `\`${value}\``;
}

test.afterAll(closeDbPool);

test('cutover manifests are cleaned and have no residual primary IDs', async () => {
  for (const name of MANIFESTS) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(OUTPUT_DIR, name), 'utf8'),
    ) as SeedCleanupManifest;
    expect(manifest.status, name).toBe('cleaned');
    for (const target of manifest.targets) {
      for (const id of target.primaryInsertIds) {
        const rows = await query<Array<RowDataPacket & { count: number }>>(
          `SELECT COUNT(*) AS count
             FROM ${identifier(target.table)}
            WHERE \`id\` = ?
              AND ${identifier(target.entityIdColumn)} = ?
              AND \`cdate\` = ?`,
          [id, target.entityId, target.cdate],
        );
        expect(Number(rows[0]?.count), `${name}:${target.table}:${id}`).toBe(0);
      }
    }
  }
});
