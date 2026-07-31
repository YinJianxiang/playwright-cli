import { expect, test } from '@playwright/test';
import type { RowDataPacket } from 'mysql2';
import { closeDbPool, getDbConfig, query } from '../e2e/helpers/db';
import {
  allocateNumericEntityId,
  isNumericEntityIdColumn,
  loadCapabilityFile,
} from '../e2e/helpers/seed/engine';

const TABLE = 'ad_advertiser_online_pay_book_project_hour';

test.describe('cpsfree project consume config evidence', () => {
  test.afterAll(async () => {
    await closeDbPool();
  });

  test('Job-mapped table has required columns and a copy source', async () => {
    getDbConfig();
    test.skip(process.env.E2E_DB_ENV !== 'test', 'test database only');
    const columns = await query<Array<RowDataPacket & { Field: string }>>(
      `SHOW COLUMNS FROM \`${TABLE}\``,
    );
    const names = columns.map((row) => row.Field);
    for (const required of [
      'cdate',
      'hour',
      'pline_form',
      'project_id',
      'consume',
      'account',
    ]) {
      expect(names, `missing ${required}`).toContain(required);
    }

    const rows = await query<Array<RowDataPacket & {
      source_id: string | number;
      cdate: string;
      hour: string;
      has_project_name: number;
      has_project_status: number;
    }>>(
      `SELECT id AS source_id, cdate, hour,
              project_name IS NOT NULL AS has_project_name,
              project_status IS NOT NULL AS has_project_status
         FROM \`${TABLE}\`
        WHERE pline_form = ? AND consume > 0
        ORDER BY cdate DESC, hour DESC, id DESC
        LIMIT 1`,
      ['cpsfree'],
    );
    expect(rows.length, 'SOURCE_ROW_NOT_FOUND').toBe(1);
    console.log(JSON.stringify({
      table: TABLE,
      schemaColumnCount: names.length,
      source: rows[0],
    }));
  });

  test('HIT and MISS channel codes use table MAX+1 and MAX+2', async () => {
    getDbConfig();
    test.skip(process.env.E2E_DB_ENV !== 'test', 'test database only');
    const registry = loadCapabilityFile('ad-control');
    const rows = await query<Array<RowDataPacket & { max_channel: string | null }>>(
      `SELECT CAST(MAX(CAST(channel_code AS DECIMAL(20,0))) AS CHAR) AS max_channel
         FROM \`${TABLE}\`
        WHERE channel_code REGEXP '^[0-9]+$'`,
    );
    const maximum = BigInt(rows[0]?.max_channel ?? '0');
    await expect(
      allocateNumericEntityId({
        table: TABLE,
        column: 'channel_code',
        registry,
        offset: 1,
      }),
    ).resolves.toBe((maximum + 1n).toString());
    await expect(
      allocateNumericEntityId({
        table: TABLE,
        column: 'channel_code',
        registry,
        offset: 2,
      }),
    ).resolves.toBe((maximum + 2n).toString());
  });

  test('all business entity identifiers use numeric allocation', async () => {
    expect(isNumericEntityIdColumn('channel_code')).toBe(true);
    expect(isNumericEntityIdColumn('promotion_id')).toBe(true);
    expect(isNumericEntityIdColumn('project_id')).toBe(true);
    expect(isNumericEntityIdColumn('promotion_name')).toBe(false);
  });
});
