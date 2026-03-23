import { expect, test } from '@playwright/test';
import {
  expandDirectory,
  getRenderedContent,
  installConsoleErrorMonitoring,
  loadE2EState,
  openFile,
  setWorkspaceAndNavigate,
} from '../utils/e2e/helpers.js';
import type { E2EState } from '../utils/e2e/state.js';

let state: E2EState;

installConsoleErrorMonitoring(test);

test.beforeAll(async () => {
  state = await loadE2EState();
});

test('TC-1.1a: server is reachable and app shell renders', async ({ page }) => {
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
  await expect(page.locator('.content-area__actions')).toContainText('Open File');
  await expect(page.locator('.content-area__actions')).toContainText('Open Folder');
});

test('TC-2.2a: file tree shows markdown files', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);

  await expect(
    page.locator('.tree-node--file').filter({ hasText: 'kitchen-sink.md' }),
  ).toBeVisible();
  await expect(page.locator('.tree-node--file').filter({ hasText: 'simple.md' })).toBeVisible();
  await expect(
    page.locator('.tree-node--file').filter({ hasText: 'invalid-mermaid.md' }),
  ).toBeVisible();
});

test('TC-2.2b: non-markdown files are filtered out', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);

  await expect(page.locator('.tree-node__row').filter({ hasText: 'notes.txt' })).toHaveCount(0);
  await expect(page.locator('.tree-node__row').filter({ hasText: 'data.json' })).toHaveCount(0);
});

test('TC-2.2c: nested directories are displayed with expansion', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await expandDirectory(page, 'subdir');

  await expect(page.locator('.tree-node--file').filter({ hasText: 'nested.md' })).toBeVisible();
});

test('TC-2.3a: clicking a file renders its content', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await openFile(page, 'kitchen-sink.md');

  await expect(page.locator('.markdown-body h1')).toContainText('Kitchen Sink');
  await expect(await getRenderedContent(page)).toContain('Kitchen Sink');
});

test('TC-2.3b: opening a file creates a tab', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await openFile(page, 'simple.md');

  await expect(page.locator('.tab[data-tab-id]').first()).toBeVisible();
  await expect(page.locator('.tab__label').filter({ hasText: 'simple.md' })).toBeVisible();
});
