import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  enterEditMode,
  enterRenderMode,
  getRenderedContent,
  openFile,
  setWorkspaceAndNavigate,
} from '../utils/e2e/helpers.js';
import { readE2EState } from '../utils/e2e/state.js';

const state = readE2EState();

function tabByLabel(page: Page, filename: string) {
  return page.locator('.tab[data-tab-id]').filter({
    has: page.locator('.tab__label', { hasText: filename }),
  });
}

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

async function resetDefaultMode(baseURL: string): Promise<void> {
  const response = await fetch(new URL('/api/session/default-mode', baseURL), {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'render',
    }),
  });

  expect(response.ok).toBe(true);
}

async function moveCursorToDocumentEnd(page: Page): Promise<void> {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
}

async function resetWorkspace(page: Page): Promise<void> {
  await resetOpenTabs(state.baseURL);
  await resetDefaultMode(state.baseURL);
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
}

test('TC-4.1a: second file opens in new tab', async ({ page }) => {
  await resetWorkspace(page);
  await openFile(page, 'kitchen-sink.md');
  await openFile(page, 'simple.md');

  const tabs = page.locator('.tab[data-tab-id]');

  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(1)).toHaveClass(/tab--active/);
  await expect(await getRenderedContent(page)).toContain('Simple Document');
});

test('TC-4.1b: re-clicking open file switches to existing tab (no duplicate)', async ({ page }) => {
  await resetWorkspace(page);
  await openFile(page, 'kitchen-sink.md');
  await openFile(page, 'simple.md');

  const kitchenSinkFile = page
    .locator('.tree-node--file')
    .filter({ hasText: 'kitchen-sink.md' })
    .first();
  await kitchenSinkFile.click();

  await expect(page.locator('.tab[data-tab-id]')).toHaveCount(2);
  await expect(tabByLabel(page, 'kitchen-sink.md')).toHaveClass(/tab--active/);
  await expect(await getRenderedContent(page)).toContain('Kitchen Sink');
});

test('TC-4.2a: tab switch changes content', async ({ page }) => {
  await resetWorkspace(page);
  await openFile(page, 'kitchen-sink.md');
  await openFile(page, 'simple.md');

  await tabByLabel(page, 'kitchen-sink.md').click();

  await expect(tabByLabel(page, 'kitchen-sink.md')).toHaveClass(/tab--active/);
  await expect(tabByLabel(page, 'simple.md')).not.toHaveClass(/tab--active/);
  await expect(await getRenderedContent(page)).toContain('Kitchen Sink');
});

test('TC-4.3a: close active tab activates adjacent', async ({ page }) => {
  await resetWorkspace(page);
  await openFile(page, 'kitchen-sink.md');
  await openFile(page, 'simple.md');
  await openFile(page, 'invalid-mermaid.md');

  await tabByLabel(page, 'simple.md').click();
  await expect(tabByLabel(page, 'simple.md')).toHaveClass(/tab--active/);

  await tabByLabel(page, 'simple.md').locator('.tab__close').click();

  await expect(page.locator('.tab[data-tab-id]')).toHaveCount(2);
  await expect(tabByLabel(page, 'invalid-mermaid.md')).toHaveClass(/tab--active/);
  await expect(await getRenderedContent(page)).toContain('Broken Mermaid');
});

test('TC-4.3b: close last remaining tab shows empty state', async ({ page }) => {
  await resetWorkspace(page);
  await openFile(page, 'simple.md');

  await tabByLabel(page, 'simple.md').locator('.tab__close').click();

  await expect(page.locator('.tab[data-tab-id]')).toHaveCount(0);
  await expect(page.locator('.markdown-body')).toHaveCount(0);
  await expect(page.locator('#content-area')).toContainText('Open a markdown file to begin.');
});

test('TC-5.1a: enter edit mode', async ({ page }) => {
  await resetWorkspace(page);
  await openFile(page, 'simple.md');

  await enterEditMode(page);

  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.markdown-body').first()).not.toBeVisible();
  await expect(page.locator('.cm-editor .cm-content')).toContainText('# Simple Document');
});

test('TC-5.1b: exit edit mode (with saved content, no unsaved changes)', async ({ page }) => {
  await resetWorkspace(page);
  await openFile(page, 'simple.md');
  await enterEditMode(page);

  await expect(page.locator('.cm-editor')).toBeVisible();

  await enterRenderMode(page);

  await expect(page.locator('.markdown-body').first()).toBeVisible();
  await expect(page.locator('.cm-editor')).toHaveCount(0);
  await expect(await getRenderedContent(page)).toContain('Simple Document');
});

test('TC-5.2a: edit, save, verify file on disk', async ({ page }) => {
  const originalContent = readFileSync(state.files.simple, 'utf8');

  try {
    await resetWorkspace(page);
    await openFile(page, 'simple.md');
    await enterEditMode(page);

    const editorContent = page.locator('.cm-editor .cm-content');
    await editorContent.click();
    await moveCursorToDocumentEnd(page);
    await editorContent.pressSequentially('\n\n## Added Section');
    await page.keyboard.press('Meta+s');

    await expect(tabByLabel(page, 'simple.md').locator('.tab__dirty-dot')).toHaveCount(0);
    expect(readFileSync(state.files.simple, 'utf8')).toContain('## Added Section');
  } finally {
    writeFileSync(state.files.simple, originalContent, 'utf8');
  }
});

test('TC-5.2b: dirty indicator appears on edit', async ({ page }) => {
  await resetWorkspace(page);
  await openFile(page, 'simple.md');
  await enterEditMode(page);

  const dirtyDot = tabByLabel(page, 'simple.md').locator('.tab__dirty-dot');
  const editorContent = page.locator('.cm-editor .cm-content');

  await expect(dirtyDot).toHaveCount(0);

  await editorContent.click();
  await editorContent.pressSequentially('\n');

  await expect(dirtyDot).toBeVisible();
});

test('TC-5.2c: saved changes render correctly in view mode', async ({ page }) => {
  const originalContent = readFileSync(state.files.simple, 'utf8');

  try {
    await resetWorkspace(page);
    await openFile(page, 'simple.md');
    await enterEditMode(page);

    const editorContent = page.locator('.cm-editor .cm-content');
    await editorContent.click();
    await moveCursorToDocumentEnd(page);
    await editorContent.pressSequentially('\n\n## Render Check');
    await page.keyboard.press('Meta+s');

    await expect(tabByLabel(page, 'simple.md').locator('.tab__dirty-dot')).toHaveCount(0);
    expect(readFileSync(state.files.simple, 'utf8')).toContain('## Render Check');

    await enterRenderMode(page);

    await expect(page.locator('.markdown-body').first()).toContainText('Render Check');
    await expect(
      page.locator('.markdown-body h2').filter({ hasText: 'Render Check' }),
    ).toBeVisible();
  } finally {
    writeFileSync(state.files.simple, originalContent, 'utf8');
  }
});

test('TC-6.1a: HTML export produces file', async ({ page }) => {
  const exportPath = join(state.exportDir, 'export-test.html');

  if (existsSync(exportPath)) {
    writeFileSync(exportPath, '', 'utf8');
  }

  await page.route('**/api/save-dialog', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ path: exportPath }),
    });
  });

  await resetWorkspace(page);
  await openFile(page, 'simple.md');

  await page.locator('[data-export-trigger]').click();
  await expect(page.locator('.dropdown[role="menu"]')).toBeVisible();
  await page.locator('.dropdown [role="menuitem"]').filter({ hasText: 'HTML' }).click();

  await expect(page.locator('.export-result--success')).toBeVisible();
  expect(existsSync(exportPath)).toBe(true);
  expect(readFileSync(exportPath, 'utf8')).toContain('<html');
});

test('TC-6.1b: export unavailable when no document is open', async ({ page }) => {
  await resetWorkspace(page);

  await expect(page.locator('[data-export-trigger]')).toHaveCount(0);
});
