import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext, type TestInfo } from '@playwright/test';
import { login } from '../helpers/auth';
import { expectControlRecordHit, expectControlRecordMiss } from '../helpers/control-record';
import { buildJobTriggerUrl, loadDotEnvFromRepoRoot } from '../helpers/environment';
import {
  compileSeedRun,
  finalizeSeedRun,
  markSeedRunAsserting,
  markSeedRunJobRunning,
  preflightSeedRun,
  startSeedRun,
  type SeedPlanV3,
} from '../helpers/seed/ad-control-v3';

loadDotEnvFromRepoRoot();

const RULE_ID = process.env.E2E_FLOW_RULE_ID ?? '16265';
const MISS_CONDITION_INDEX = Number(process.env.E2E_FLOW_MISS_CONDITION_INDEX ?? '0');
const MISS_OBSERVE_MS = Number(process.env.E2E_FLOW_MISS_OBSERVE_MS ?? '120000');

async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(value, null, 2)}\n`),
    contentType: 'application/json',
  });
}

async function triggerJob(request: APIRequestContext, ruleId: string, testInfo: TestInfo) {
  const url = buildJobTriggerUrl(ruleId);
  const startedAt = Date.now();
  const response = await request.get(url, { timeout: 60_000 });
  const body = await response.text();
  await attachJson(testInfo, 'job-response', {
    url: url.replace(/([?&](?:token|authorization)=)[^&]+/gi, '$1[REDACTED]'),
    status: response.status(),
    durationMs: Date.now() - startedAt,
    body,
  });
  expect(response.ok(), `Job failed: HTTP ${response.status()} ${body}`).toBeTruthy();
}

async function persistAndAttachPlan(plan: SeedPlanV3, outputDir: string, testInfo: TestInfo) {
  fs.mkdirSync(outputDir, { recursive: true });
  const planPath = path.join(outputDir, `seed-plan-v3-${plan.runId}.json`);
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  await testInfo.attach('seed-plan', { path: planPath, contentType: 'application/json' });
}

for (const mode of ['hit', 'miss'] as const) {
  test(`Seed V3 ${mode.toUpperCase()} -> Job -> UI record -> cleanup`, async ({ page, request }, testInfo) => {
    test.setTimeout(mode === 'miss' ? 420_000 : 300_000);
    const outputDir = testInfo.outputPath(`seed-${RULE_ID}-${mode}`);
    let runId: string | undefined;
    let primaryError: unknown;

    await login(page);
    try {
      const compiled = await test.step('Compile Seed V3', () =>
        compileSeedRun(RULE_ID, mode === 'hit'
          ? { mode }
          : { mode, legacyMissConditionIndex: MISS_CONDITION_INDEX }),
      );
      runId = compiled.runId;

      const plan = await test.step('Preflight and verify plan', () => preflightSeedRun(compiled));
      await persistAndAttachPlan(plan, outputDir, testInfo);
      await attachJson(testInfo, 'seed-preflight-summary', {
        runId: plan.runId,
        mode,
        status: plan.executionPlan.status,
        issues: plan.issues,
        witnessLeaves: plan.witnessLeaves,
        flippedLeaves: plan.flippedLeaves,
      });
      expect(plan.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
      expect(plan.approvalRisk, 'This reusable flow does not auto-approve risky plans').toBe('none');

      const applied = await test.step('Apply facts transactionally', () =>
        startSeedRun(plan, { confirmed: true, outputDir, cleanupPolicy: 'always' }),
      );
      const channelCodes = [...new Set(applied.cleanupManifest.targets
        .map((target) => target.channelCode)
        .filter((value): value is string => Boolean(value)))];
      expect(channelCodes, 'Expected one shared channelCode in cleanup manifest').toHaveLength(1);
      const channelCode = channelCodes[0];
      await attachJson(testInfo, 'seed-apply-result', {
        runId,
        channelCode,
        manifestPath: applied.manifestPath,
        auditPath: applied.auditPath,
      });
      await testInfo.attach('seed-audit', { path: applied.auditPath, contentType: 'application/json' });
      await testInfo.attach('cleanup-manifest', { path: applied.manifestPath, contentType: 'application/json' });

      await test.step('Trigger Job API', async () => {
        await markSeedRunJobRunning(runId!);
        await triggerJob(request, RULE_ID, testInfo);
      });
      await markSeedRunAsserting(runId);

      await test.step(`Validate ${mode.toUpperCase()} by ruleId + channelCode`, async () => {
        if (mode === 'hit') {
          const rows = await expectControlRecordHit(page, { ruleId: RULE_ID, channelCode });
          await attachJson(testInfo, 'matched-control-records', rows);
        } else {
          await expectControlRecordMiss(page, { ruleId: RULE_ID, channelCode }, MISS_OBSERVE_MS);
          await attachJson(testInfo, 'miss-observation', {
            ruleId: RULE_ID,
            channelCode,
            observationMs: MISS_OBSERVE_MS,
            matched: false,
          });
        }
        await page.screenshot({ path: testInfo.outputPath(`record-${mode}.png`), fullPage: true });
      });
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      if (runId) {
        try {
          const cleanup = await test.step('Finalize and cleanup facts', () =>
            finalizeSeedRun(runId!, { cleanupPolicy: 'always' }),
          );
          await attachJson(testInfo, 'cleanup-result', cleanup);
        } catch (cleanupError) {
          await attachJson(testInfo, 'cleanup-error', {
            message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
          if (!primaryError) throw cleanupError;
        }
      }
    }
  });
}
