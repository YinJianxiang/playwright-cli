import type { APIRequestContext } from '@playwright/test';
import { buildJobTriggerUrl } from './environment';

export async function triggerDataControlJob(request: APIRequestContext, ruleId: string) {
  const url = buildJobTriggerUrl(ruleId);
  const response = await request.get(url, { timeout: 30_000 });
  const contentType = response.headers()['content-type'] ?? '';
  const body = await response.text();
  if (!response.ok()) {
    throw new Error(`Job trigger failed: HTTP ${response.status()} body=${body.slice(0, 500)}`);
  }
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`Job trigger returned non-JSON content-type: ${contentType}`);
  }
  if (body.trim().startsWith('<')) {
    throw new Error('Job trigger returned HTML instead of the market-job response');
  }
  return { url, status: response.status(), body };
}
