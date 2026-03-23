import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Sets the workspace root via API and navigates to the app.
 * Waits for the sidebar file tree to populate.
 *
 * Covers: AC-10.1a (workspace setup helper)
 * Used by: All test files
 */
export async function setWorkspaceAndNavigate(
  page: Page,
  baseURL: string,
  workspacePath: string,
): Promise<void> {
  const response = await fetch(new URL('/api/session/root', baseURL), {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ root: workspacePath }),
  });
  expect(response.ok).toBe(true);

  await page.goto(baseURL);
  await page.locator('#sidebar .tree-node__row[data-path]').first().waitFor({ state: 'visible' });
}

/**
 * Opens a file by clicking its entry in the sidebar file tree.
 * Waits for the tab to appear and content to render.
 *
 * Covers: AC-10.1b (file opening helper)
 * Used by: rendering.spec.ts, interaction.spec.ts
 */
export async function openFile(page: Page, filename: string): Promise<void> {
  const fileNode = page.locator('.tree-node--file').filter({ hasText: filename }).first();
  await expect(fileNode).toBeVisible();
  await fileNode.click();
  await expect(page.locator('.tab__label').filter({ hasText: filename }).first()).toBeVisible();
  await expect(page.locator('.markdown-body').first()).toBeVisible();
}

/**
 * Waits for Mermaid SVG rendering to complete inside .markdown-body.
 * Uses auto-waiting locator with configurable timeout.
 *
 * Covers: AC-10.1c (async rendering wait helper)
 * Used by: rendering.spec.ts
 */
export async function waitForMermaid(page: Page, timeout = 10_000): Promise<void> {
  await page.locator('.markdown-body svg').first().waitFor({ state: 'visible', timeout });
}

/**
 * Switches to edit mode by clicking the Edit button in mode-toggle.
 * Waits for the CodeMirror editor to appear.
 */
export async function enterEditMode(page: Page): Promise<void> {
  await page.locator('.mode-toggle button').filter({ hasText: 'Edit' }).click();
  await page.locator('.cm-editor').waitFor({ state: 'visible' });
}

/**
 * Switches to render mode by clicking the Render button in mode-toggle.
 * Waits for rendered content to appear.
 */
export async function enterRenderMode(page: Page): Promise<void> {
  await page.locator('.mode-toggle button').filter({ hasText: 'Render' }).click();
  await page.locator('.markdown-body').first().waitFor({ state: 'visible' });
}

/**
 * Expands a directory in the sidebar tree by clicking it.
 * Waits for child entries to appear.
 */
export async function expandDirectory(page: Page, dirName: string): Promise<void> {
  const visibleRows = page.locator('.tree-node__row:visible');
  const rowCountBefore = await visibleRows.count();
  const dirNode = page.locator('.tree-node--directory').filter({ hasText: dirName }).first();
  await expect(dirNode).toBeVisible();
  await dirNode.click();
  await expect(dirNode).toHaveAttribute('aria-expanded', 'true');
  await expect(visibleRows).toHaveCount(rowCountBefore + 1);
}

/**
 * Gets the text content of the currently rendered document.
 */
export async function getRenderedContent(page: Page): Promise<string> {
  const markdownBody = page.locator('.markdown-body').first();
  if ((await markdownBody.count()) > 0) {
    return (await markdownBody.textContent()) ?? '';
  }

  return (await page.locator('#content-area').textContent()) ?? '';
}
