import { expect, test } from '@playwright/test';
import {
  acquireSeedRunLease,
  assertMetaSchema,
  assertRunNotCancelled,
  createSeedRun,
  findRecoverableRuns,
  getSeedRunSnapshot,
  hasValidSeedApproval,
  heartbeatSeedRunLease,
  newRunId,
  releaseSeedRunLease,
  requestRunCancel,
  revokeSeedApproval,
  transitionSeedRun,
  upsertSeedApproval,
} from '../e2e/helpers/seed/meta-db-v3';

test.describe('Seed V3 file metadata store', () => {
  test.beforeEach(async ({}, testInfo) => {
    process.env.E2E_META_STORE = 'file';
    process.env.E2E_META_DIR = testInfo.outputPath('seed-meta');
    process.env.E2E_DB_ENV = 'test';
    await assertMetaSchema();
  });

  test.afterEach(() => {
    delete process.env.E2E_META_STORE;
    delete process.env.E2E_META_DIR;
  });

  test('supports CAS, active-run conflict, lease and cancellation', async () => {
    const runId = newRunId();
    await createSeedRun({ runId, ruleId: 'file-rule', mode: 'hit', status: 'created' });
    await expect(createSeedRun({
      runId: newRunId(), ruleId: 'file-rule', mode: 'hit', status: 'created',
    })).rejects.toThrow('SEED_RUN_ACTIVE_CONFLICT');

    await transitionSeedRun(runId, 'created', 'compiling');
    await expect(transitionSeedRun(runId, 'created', 'compiling'))
      .rejects.toThrow('SEED_RUN_INVALID_TRANSITION');
    await acquireSeedRunLease(runId, 'worker-a', 30_000);
    await heartbeatSeedRunLease(runId, 'worker-a', 30_000);
    await expect(acquireSeedRunLease(runId, 'worker-b', 30_000))
      .rejects.toThrow('SEED_RUN_LEASE_CONFLICT');
    await releaseSeedRunLease(runId, 'worker-a');
    await requestRunCancel(runId, 'file store test');
    await expect(assertRunNotCancelled(runId)).rejects.toMatchObject({
      code: 'SEED_RUN_CANCELLED',
    });
    await transitionSeedRun(runId, 'compiling', 'cancelled');
    await expect(getSeedRunSnapshot(runId)).resolves.toMatchObject({
      status: 'cancelled', cancelReason: 'file store test',
    });
  });

  test('supports approval lifecycle and recovery scan', async () => {
    const fingerprint = `sha256:${'a'.repeat(64)}`;
    await upsertSeedApproval({
      fingerprint,
      configVersion: 'file-v1',
      riskLevel: 'high',
      approvedBy: 'file-test',
      reason: 'test',
      validDays: 1,
    });
    await expect(hasValidSeedApproval({ fingerprint, configVersion: 'file-v1' }))
      .resolves.toBe(true);
    await revokeSeedApproval({
      fingerprint,
      configVersion: 'file-v1',
      revokedBy: 'file-test',
      reason: 'done',
    });
    await expect(hasValidSeedApproval({ fingerprint, configVersion: 'file-v1' }))
      .resolves.toBe(false);

    const runId = newRunId();
    await createSeedRun({ runId, ruleId: 'recover-file-rule', mode: 'miss', status: 'created' });
    await transitionSeedRun(runId, 'created', 'compiling');
    await transitionSeedRun(runId, 'compiling', 'preflighting');
    await transitionSeedRun(runId, 'preflighting', 'ready');
    await transitionSeedRun(runId, 'ready', 'applying');
    await expect(findRecoverableRuns()).resolves.toEqual([
      expect.objectContaining({ runId, status: 'applying' }),
    ]);
  });
});
