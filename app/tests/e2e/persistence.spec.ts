import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { openFile, setWorkspaceAndNavigate } from '../utils/e2e/helpers.js';
import { ServerManager } from '../utils/e2e/server-manager.js';
import { readE2EState } from '../utils/e2e/state.js';

const state = readE2EState();

const DEFAULT_THEME = 'light-default';
const THEME_LABELS = {
  'light-default': 'Light Default',
  'light-warm': 'Light Warm',
  'dark-default': 'Dark Default',
  'dark-cool': 'Dark Cool',
} as const;
const TREE_ROW_SELECTOR = '#sidebar .tree-node__row[data-path]';

test.describe.configure({ mode: 'serial' });

test.afterEach(async () => {
  await resetOpenTabs(state.baseURL);
  await setTheme(state.baseURL, DEFAULT_THEME);
});

async function resetOpenTabs(baseURL: string): Promise<void> {
  const response = await fetch(new URL('/api/session/tabs', baseURL), {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      openTabs: [],
      activeTab: null,
    }),
  });

  expect(response.ok).toBe(true);
}

async function setTheme(baseURL: string, theme: string): Promise<void> {
  const response = await fetch(new URL('/api/session/theme', baseURL), {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ theme }),
  });

  expect(response.ok).toBe(true);
}

async function prepareWorkspace(page: Page, baseURL: string): Promise<void> {
  await resetOpenTabs(baseURL);
  await setTheme(baseURL, DEFAULT_THEME);
  await setWorkspaceAndNavigate(page, baseURL, state.fixtureDir);
}

async function openViewMenu(page: Page): Promise<void> {
  await page.locator('[data-menu-trigger="view"]').click();
  await expect(page.locator('.menu-bar__submenu')).toBeVisible();
}

function themeOptions(page: Page) {
  return page.locator('.menu-bar__submenu .menu-bar__item');
}

function themeIdFromMenuText(text: string): string | null {
  const normalizedLabel = text.replace(/\s*✓\s*$/, '').trim();

  for (const [themeId, label] of Object.entries(THEME_LABELS)) {
    if (label === normalizedLabel) {
      return themeId;
    }
  }

  return null;
}

async function selectDifferentTheme(
  page: Page,
): Promise<{ previousTheme: string; nextTheme: string }> {
  const html = page.locator('html');
  const previousTheme = await html.getAttribute('data-theme');

  if (!previousTheme) {
    throw new Error('Expected html[data-theme] to be present before switching themes.');
  }

  await openViewMenu(page);

  const options = themeOptions(page);
  const optionCount = await options.count();

  for (let index = 0; index < optionCount; index += 1) {
    const option = options.nth(index);
    const optionText = (await option.textContent()) ?? '';
    const nextTheme = themeIdFromMenuText(optionText);

    if (!nextTheme || nextTheme === previousTheme) {
      continue;
    }

    await option.focus();
    await option.press('Enter');
    await expect(html).toHaveAttribute('data-theme', nextTheme);

    return { previousTheme, nextTheme };
  }

  throw new Error(`Unable to find a theme option different from "${previousTheme}".`);
}

async function selectTheme(page: Page, themeId: keyof typeof THEME_LABELS): Promise<void> {
  await openViewMenu(page);
  const option = themeOptions(page).filter({ hasText: THEME_LABELS[themeId] }).first();
  await option.focus();
  await option.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', themeId);
}

async function getVisibleTreePaths(page: Page): Promise<string[]> {
  return page
    .locator(TREE_ROW_SELECTOR)
    .evaluateAll((rows) =>
      rows
        .map((row) => row.getAttribute('data-path'))
        .filter((path): path is string => Boolean(path)),
    );
}

test('TC-7.1a: theme change applies', async ({ page }) => {
  await prepareWorkspace(page, state.baseURL);

  const { previousTheme, nextTheme } = await selectDifferentTheme(page);

  expect(nextTheme).not.toBe(previousTheme);
  await expect(page.locator('html')).toHaveAttribute('data-theme', nextTheme);
});

test('TC-7.1b: multiple themes available', async ({ page }) => {
  await prepareWorkspace(page, state.baseURL);
  await openViewMenu(page);

  const options = themeOptions(page);

  expect(await options.count()).toBeGreaterThanOrEqual(2);
  await expect(options.first()).toBeVisible();
  await expect(options.nth(1)).toBeVisible();
});

test('TC-7.2a: theme survives restart', async ({ page }) => {
  const serverManager = new ServerManager();

  try {
    const { baseURL } = await serverManager.start({ sessionDir: state.sessionDir });

    await prepareWorkspace(page, baseURL);
    await selectTheme(page, 'dark-default');

    await serverManager.restart();
    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark-default');
  } finally {
    try {
      const { baseURL } = serverManager.getState();
      await resetOpenTabs(baseURL);
      await setTheme(baseURL, DEFAULT_THEME);
    } catch {
      // Ignore cleanup if the dedicated server never started.
    }

    await serverManager.stop();
  }
});

test('TC-8.1a: workspace restored after restart', async ({ page }) => {
  const serverManager = new ServerManager();

  try {
    const { baseURL } = await serverManager.start({ sessionDir: state.sessionDir });

    await prepareWorkspace(page, baseURL);
    const treeBeforeRestart = await getVisibleTreePaths(page);

    expect(treeBeforeRestart).toContain(state.files.kitchenSink);
    expect(treeBeforeRestart).toContain(state.files.invalidMermaid);
    expect(treeBeforeRestart).toContain(state.files.simple);

    await serverManager.restart();
    await page.reload();
    await page.locator(TREE_ROW_SELECTOR).first().waitFor({ state: 'visible' });

    await expect(
      page.locator('.tree-node--file').filter({ hasText: 'kitchen-sink.md' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('.tree-node--file').filter({ hasText: 'invalid-mermaid.md' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('.tree-node--file').filter({ hasText: 'simple.md' }).first(),
    ).toBeVisible();
    expect(await getVisibleTreePaths(page)).toEqual(treeBeforeRestart);
  } finally {
    try {
      const { baseURL } = serverManager.getState();
      await resetOpenTabs(baseURL);
      await setTheme(baseURL, DEFAULT_THEME);
    } catch {
      // Ignore cleanup if the dedicated server never started.
    }

    await serverManager.stop();
  }
});

test('TC-8.2a: theme and workspace both restored', async ({ page }) => {
  const serverManager = new ServerManager();

  try {
    const { baseURL } = await serverManager.start({ sessionDir: state.sessionDir });

    await prepareWorkspace(page, baseURL);
    await selectTheme(page, 'dark-cool');
    const treeBeforeRestart = await getVisibleTreePaths(page);

    await serverManager.restart();
    await page.reload();
    await page.locator(TREE_ROW_SELECTOR).first().waitFor({ state: 'visible' });

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark-cool');
    expect(await getVisibleTreePaths(page)).toEqual(treeBeforeRestart);
  } finally {
    try {
      const { baseURL } = serverManager.getState();
      await resetOpenTabs(baseURL);
      await setTheme(baseURL, DEFAULT_THEME);
    } catch {
      // Ignore cleanup if the dedicated server never started.
    }

    await serverManager.stop();
  }
});

test('TC-9.1a: file change updates rendered content', async ({ page }) => {
  const originalContent = readFileSync(state.files.simple, 'utf8');

  try {
    await prepareWorkspace(page, state.baseURL);
    await openFile(page, 'simple.md');

    await expect(page.locator('.markdown-body')).toContainText('Simple Document');

    writeFileSync(state.files.simple, '# Updated Heading\n\nNew content here.\n', 'utf8');

    await expect(page.locator('.markdown-body')).toContainText('Updated Heading');
    await expect(page.locator('.markdown-body')).toContainText('New content here.');
  } finally {
    writeFileSync(state.files.simple, originalContent, 'utf8');
  }
});

test('TC-9.1b: file change detected within 5 seconds', async ({ page }) => {
  const originalContent = readFileSync(state.files.simple, 'utf8');

  try {
    await prepareWorkspace(page, state.baseURL);
    await openFile(page, 'simple.md');

    writeFileSync(state.files.simple, '# Timed Update\n\nDetected quickly.\n', 'utf8');

    await expect(page.locator('.markdown-body')).toContainText('Timed Update', { timeout: 5000 });
    await expect(page.locator('.markdown-body')).toContainText('Detected quickly.', {
      timeout: 5000,
    });
  } finally {
    writeFileSync(state.files.simple, originalContent, 'utf8');
  }
});
