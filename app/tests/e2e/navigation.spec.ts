import { expect, test } from '@playwright/test';
import { readE2EState } from '../utils/e2e/state.js';

const state = readE2EState();

test('smoke: app loads and #app renders', async ({ page }) => {
  await page.goto(state.baseURL);
  await expect(page.locator('#app')).toBeVisible();
});

test('TC-2.1a: shell elements are present', async ({ page }) => {
  await page.goto(state.baseURL);
  await expect(page.locator('#menu-bar')).toBeVisible();
  await expect(page.locator('#sidebar')).toBeVisible();
  await expect(page.locator('#tab-strip')).toBeVisible();
  await expect(page.locator('#content-area')).toBeVisible();
});

test('TC-2.1b: empty state displayed without workspace', async ({ page }) => {
  // Intercept /api/session to simulate no workspace set
  await page.route(
    (url) => url.pathname === '/api/session',
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      await route.fulfill({
        response,
        json: {
          ...body,
          session: {
            ...body.session,
            lastRoot: null,
            workspaces: [],
            openTabs: [],
            activeTab: null,
            recentFiles: [],
          },
        },
      });
    },
  );

  await page.goto(state.baseURL);

  // Wait for app bootstrap to complete and render the empty state
  await expect(page.locator('.content-area__empty-state')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.content-area__title')).toContainText(
    'Open a markdown file to begin.',
  );
});
