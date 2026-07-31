import { expect, test } from '@playwright/test';
import {
  acquireSeedRunLease,
  assertMetaSchema,
  assertRunNotCancelled,
  closeMetaPool,
  createSeedRun,
  getSeedRunSnapshot,
  hasValidSeedApproval,
  newRunId,
  releaseSeedRunLease,
  requestRunCancel,
  revokeSeedApproval,
  transitionSeedRun,
  upsertSeedApproval,
} from '../e2e/helpers/seed/meta-db-v3';
import { finalizeSeedRun } from '../e2e/helpers/seed/ad-control-v3';

test.describe('Seed V3 meta database', () => {
  test.afterAll(async () => {
    await closeMetaPool();
  });

  test('schema, CAS transitions, lease, cancellation and approval lifecycle', async () => {
    await assertMetaSchema();
    const runId = newRunId();
    const ruleId = `meta-test-${runId}`;
    await createSeedRun({
      runId,
      ruleId,
      mode: 'hit',
      status: 'created',
      configVersion: 'meta-test-v1',
    });

    await transitionSeedRun(runId, 'created', 'compiling');
    await expect(
      transitionSeedRun(runId, 'compiling', 'applying'),
    ).rejects.toThrow('SEED_RUN_TRANSITION_NOT_ALLOWED');
    await expect(
      transitionSeedRun(runId, 'created', 'compiling'),
    ).rejects.toThrow('SEED_RUN_INVALID_TRANSITION');

    await acquireSeedRunLease(runId, 'worker-a', 30_000);
    await expect(
      acquireSeedRunLease(runId, 'worker-b', 30_000),
    ).rejects.toThrow('SEED_RUN_LEASE_CONFLICT');
    await releaseSeedRunLease(runId, 'worker-a');

    await requestRunCancel(runId, 'integration test');
    await expect(assertRunNotCancelled(runId)).rejects.toMatchObject({
      code: 'SEED_RUN_CANCELLED',
    });
    const snapshot = await getSeedRunSnapshot(runId);
    expect(snapshot.cancelReason).toBe('integration test');
    await transitionSeedRun(runId, 'compiling', 'cancelled');

    const fingerprint = `sha256:${runId.replaceAll('-', '').padEnd(64, '0').slice(0, 64)}`;
    await upsertSeedApproval({
      fingerprint,
      configVersion: 'meta-test-v1',
      riskLevel: 'high',
      approvedBy: 'seed-v3-meta-test',
      reason: 'approval lifecycle integration test',
      validDays: 1,
    });
    await expect(
      hasValidSeedApproval({ fingerprint, configVersion: 'meta-test-v1' }),
    ).resolves.toBe(true);
    await revokeSeedApproval({
      fingerprint,
      configVersion: 'meta-test-v1',
      revokedBy: 'seed-v3-meta-test',
      reason: 'integration test complete',
    });
    await expect(
      hasValidSeedApproval({ fingerprint, configVersion: 'meta-test-v1' }),
    ).resolves.toBe(false);
  });

  test('manual policy retains a committed run until explicit cleanup', async () => {
    const runId = newRunId();
    await createSeedRun({
      runId,
      ruleId: `manual-policy-${runId}`,
      mode: 'hit',
      status: 'created',
      configVersion: 'meta-test-v2',
    });
    await transitionSeedRun(runId, 'created', 'compiling');
    await transitionSeedRun(runId, 'compiling', 'preflighting');
    await transitionSeedRun(runId, 'preflighting', 'ready');
    await transitionSeedRun(runId, 'ready', 'applying', {
      cleanupPolicy: 'manual',
    });
    await transitionSeedRun(runId, 'applying', 'committed');

    const result = await finalizeSeedRun(runId);
    expect(result).toMatchObject({
      policy: 'manual',
      runId,
      cleanupCommand: `npm run seed:cleanup -- --runId=${runId}`,
    });
    await expect(getSeedRunSnapshot(runId)).resolves.toMatchObject({
      status: 'retained',
    });

    // No business manifest is created in this metadata-only test, so finish
    // the state path directly after proving retained -> cleaning is allowed.
    await transitionSeedRun(runId, 'retained', 'cleaning');
    await transitionSeedRun(runId, 'cleaning', 'succeeded');
  });
});
