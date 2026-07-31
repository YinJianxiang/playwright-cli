import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import {
  approveSeedRun,
  cleanupSeedRun,
  compileSeedRun,
  getSeedRun,
  preflightSeedRun,
  recoverOrphanSeedRuns,
  resolveSeedCleanupPolicy,
  requestSeedRunCancel,
  startSeedRun,
  type CompiledSeedRunV3,
  type SeedPlanV3,
} from '../e2e/helpers/seed/ad-control-v3';
import { closeDbPool } from '../e2e/helpers/db';
import { closeMetaPool } from '../e2e/helpers/seed/meta-db-v3';

function writeJson(outputDir: string, name: string, value: unknown): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

test('seed v3 CLI', async () => {
  test.skip(!process.env.E2E_SEED_CLI_COMMAND, 'V3 CLI transport only');
  const command = process.env.E2E_SEED_CLI_COMMAND!;
  const args = JSON.parse(process.env.E2E_SEED_CLI_ARGS || '{}') as Record<string, string>;
  const outputDir = path.resolve(
    args.out || 'tests/e2e/generated/20260728-181405/explore',
  );
  try {
    if (command === 'status') {
      console.log(JSON.stringify(await getSeedRun(args.runId), null, 2));
      return;
    }
    if (command === 'cancel') {
      await requestSeedRunCancel(args.runId, args.reason || 'CLI cancellation');
      return;
    }
    if (command === 'cleanup') {
      console.log(JSON.stringify(await cleanupSeedRun(args.runId), null, 2));
      return;
    }
    if (command === 'recover') {
      console.log(JSON.stringify({ recovered: await recoverOrphanSeedRuns() }, null, 2));
      return;
    }
    if (command === 'approve') {
      const plan = JSON.parse(fs.readFileSync(path.resolve(args.plan), 'utf8')) as SeedPlanV3;
      await approveSeedRun(plan, {
        approvedBy: args.approvedBy,
        reason: args.reason,
        validDays: args.validDays ? Number(args.validDays) : undefined,
      });
      return;
    }
    if (command === 'apply') {
      const plan = JSON.parse(fs.readFileSync(path.resolve(args.plan), 'utf8')) as SeedPlanV3;
      const cleanupPolicy = resolveSeedCleanupPolicy(args.cleanupPolicy);
      console.log(`cleanupPolicy=${cleanupPolicy}`);
      console.log(JSON.stringify(await startSeedRun(plan, {
        confirmed: args.confirmed === '1',
        approvalFingerprint: args.approvalFingerprint,
        outputDir,
        timeoutMs: args.timeoutMs ? Number(args.timeoutMs) : undefined,
        cleanupPolicy,
      }), null, 2));
      return;
    }
    if (!args.ruleId && !args.compiled) {
      throw new Error(`${command} requires --ruleId or --compiled`);
    }
    const compiled = args.compiled
      ? JSON.parse(
          fs.readFileSync(path.resolve(args.compiled), 'utf8'),
        ) as CompiledSeedRunV3
      : await compileSeedRun(args.ruleId, {
          mode: (args.mode || 'hit') as 'hit' | 'miss',
          pairId: args.pairId,
          hitNodeId: args.hitNodeId,
          missNodeId: args.missNodeId,
          legacyMissConditionIndex:
            args.legacyMissConditionIndex == null
              ? undefined
              : Number(args.legacyMissConditionIndex),
        });
    const compiledFile = args.compiled
      ? path.resolve(args.compiled)
      : writeJson(
          outputDir,
          `seed-compiled-v3-${compiled.runId}.json`,
          compiled,
        );
    if (command === 'compile') {
      console.log(`SEED_V3_COMPILED ${compiledFile}`);
      return;
    }
    const plan = await preflightSeedRun(
      JSON.parse(fs.readFileSync(compiledFile, 'utf8')) as CompiledSeedRunV3,
    );
    const planFile = writeJson(outputDir, `seed-plan-v3-${plan.runId}.json`, plan);
    console.log(`runId=${plan.runId}`);
    console.log(`status=${(await getSeedRun(plan.runId)).status}`);
    console.log(`approvalRisk=${plan.approvalRisk}`);
    console.log(`approvalFingerprint=${plan.approvalFingerprint}`);
    console.log(`SEED_V3_PLAN ${planFile}`);
  } finally {
    await closeDbPool();
    await closeMetaPool();
  }
});
