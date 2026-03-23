import { expect, test } from '@playwright/test';
import { openFile, setWorkspaceAndNavigate, waitForMermaid } from '../utils/e2e/helpers.js';
import { readE2EState } from '../utils/e2e/state.js';

const state = readE2EState();

test('TC-3.1a: heading elements are present', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await openFile(page, 'kitchen-sink.md');

  const markdownBody = page.locator('.markdown-body').first();

  await expect(markdownBody.locator('h1')).toHaveText('Kitchen Sink');
  await expect(markdownBody.locator('h2').filter({ hasText: 'Code Sample' })).toBeVisible();
  await expect(markdownBody.locator('h3')).toHaveText('Third Level');
});

test('TC-3.2a: code block is rendered with highlighting', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await openFile(page, 'kitchen-sink.md');

  const codeBlock = page.locator('.markdown-body pre.shiki').first();

  await expect(codeBlock).toBeVisible();
  await expect(codeBlock).toHaveClass(/shiki/);
  await expect(codeBlock).not.toHaveClass(/hljs/);
  await expect(codeBlock.locator('code')).toContainText('export function greet(name)');
  await expect(codeBlock.locator('span').first()).toBeVisible();
  await expect(codeBlock.locator('span[style*="--shiki"]').first()).toBeVisible();
});

test('TC-3.3a: table elements are present', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await openFile(page, 'kitchen-sink.md');

  const table = page.locator('.markdown-body table').first();
  const bodyRows = table.locator('tbody tr');

  await expect(table).toBeVisible();
  await expect(table.locator('thead')).toBeVisible();
  await expect(table.locator('tbody')).toBeVisible();
  await expect(table.locator('thead tr th')).toHaveText(['Name', 'Value']);
  await expect(bodyRows).toHaveCount(2);
  await expect(bodyRows.nth(0).locator('td')).toHaveText(['Alpha', '1']);
  await expect(bodyRows.nth(1).locator('td')).toHaveText(['Beta', '2']);
});

test('TC-3.4a: links are rendered as anchor elements', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await openFile(page, 'kitchen-sink.md');

  const markdownBody = page.locator('.markdown-body').first();
  const link = page.locator('.markdown-body a[href="https://example.com/md-viewer"]').first();

  await expect(link).toBeVisible();
  await expect(link).toHaveText('MD Viewer');
  await expect(link).toHaveAttribute('href', 'https://example.com/md-viewer');
  await expect(markdownBody.locator('a').filter({ hasText: 'Nested Doc' })).toBeVisible();
});

test('TC-3.5a: Mermaid diagram renders as SVG', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await openFile(page, 'kitchen-sink.md');

  await waitForMermaid(page);

  await expect(page.locator('.markdown-body svg').first()).toBeVisible();
});

test('TC-3.5b: invalid Mermaid shows error indicator', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await openFile(page, 'invalid-mermaid.md');

  const markdownBody = page.locator('.markdown-body').first();
  const mermaidError = markdownBody.locator('.mermaid-error').first();

  await expect(mermaidError).toBeVisible({ timeout: 10_000 });
  await expect(markdownBody.locator('[class*="error"]').first()).toContainText(/Mermaid error/i);
  await expect(markdownBody.locator('svg')).toHaveCount(0);
});

test('TC-3.6a: image renders from relative path', async ({ page }) => {
  await setWorkspaceAndNavigate(page, state.baseURL, state.fixtureDir);
  await openFile(page, 'kitchen-sink.md');

  const image = page.locator('.markdown-body img').first();

  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', /\/api\/image\?path=.*test-image\.png/);
  await expect(image).toHaveJSProperty('naturalWidth', 1);
  await expect(image).toHaveJSProperty('naturalHeight', 1);
});
