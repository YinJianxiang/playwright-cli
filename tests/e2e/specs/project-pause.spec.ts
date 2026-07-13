import { test, type Page } from '@playwright/test';
import { loginMarketAdmin, openNewdzFromMarketAdmin } from '../helpers/market-admin-auth';
import {
  prepareProjectPauseDialog,
  PROJECT_PAUSE_BUSINESS_LINE_CASES,
  selectBusinessLineInPauseDialog,
  verifyPauseRecentDaysLabel,
  verifyPauseThresholdLabel,
} from '../helpers/project-delete-out';

test.describe.configure({ mode: 'serial' });

test.describe('项目暂停', () => {
  let newdzPage: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginMarketAdmin(page);
    newdzPage = await openNewdzFromMarketAdmin(page, context);
    await prepareProjectPauseDialog(newdzPage);
  });

  for (const businessLineCase of PROJECT_PAUSE_BUSINESS_LINE_CASES) {
    test.describe(businessLineCase.businessLine, () => {
      for (const label of businessLineCase.labels) {
        test(`展示${label}`, async () => {
          await selectBusinessLineInPauseDialog(newdzPage, businessLineCase.businessLine);
          await verifyPauseThresholdLabel(newdzPage, label);
        });
      }

      if (businessLineCase.recentDaysLabel) {
        test(`展示近N${businessLineCase.recentDaysLabel}`, async () => {
          await selectBusinessLineInPauseDialog(newdzPage, businessLineCase.businessLine);
          await verifyPauseRecentDaysLabel(newdzPage, businessLineCase.recentDaysLabel!);
        });
      }
    });
  }
});
