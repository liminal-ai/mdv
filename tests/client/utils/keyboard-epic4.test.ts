// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { basicFileResponse } from '../../fixtures/file-responses.js';
import { emptySession } from '../../fixtures/session.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

function flushUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function renderApp(sessionOverrides: Partial<typeof emptySession> = {}) {
  const session = {
    ...emptySession,
    ...sessionOverrides,
  };

  const api = {
    bootstrap: vi.fn().mockResolvedValue({
      session,
      availableThemes,
    }),
    setRoot: vi.fn(),
    addWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
    setTheme: vi.fn().mockResolvedValue(session),
    setDefaultMode: vi.fn().mockResolvedValue(session),
    updateSidebar: vi.fn().mockResolvedValue(session),
    getTree: vi.fn().mockResolvedValue({ root: '/root', tree: [] }),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue({ path: '/picked.md' }),
    readFile: vi.fn().mockImplementation(async (path: string) => ({
      ...basicFileResponse,
      path,
      canonicalPath: path,
      filename: path.split('/').filter(Boolean).at(-1) ?? path,
      html: `<h1>${path}</h1>`,
    })),
    openExternal: vi.fn().mockResolvedValue({ ok: true }),
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
    updateTabs: vi
      .fn()
      .mockImplementation(async (openTabs: string[], activeTab: string | null) => ({
        ...session,
        openTabs,
        activeTab,
      })),
    touchRecentFile: vi.fn().mockResolvedValue(session),
    removeRecentFile: vi.fn().mockResolvedValue(session),
    exportDocument: vi.fn().mockResolvedValue({
      status: 'success',
      outputPath: '/Users/test/exports/readme.pdf',
      warnings: [],
    }),
    exportSaveDialog: vi.fn().mockResolvedValue({ path: '/Users/test/exports/readme.pdf' }),
    reveal: vi.fn().mockResolvedValue({ ok: true }),
    setLastExportDir: vi.fn().mockResolvedValue(session),
  };

  document.body.innerHTML = `
    <div id="app">
      <header id="menu-bar"></header>
      <div id="main">
        <aside id="sidebar"></aside>
        <div id="workspace">
          <div id="tab-strip"></div>
          <div id="content-area"></div>
        </div>
      </div>
    </div>
  `;

  window.__MDV_DISABLE_AUTO_BOOTSTRAP__ = true;
  const { bootstrapApp } = await import('../../../src/client/app.js');
  await bootstrapApp(api as Parameters<typeof bootstrapApp>[0], null);
  await flushUi();

  return api;
}

describe('epic 4 keyboard shortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
  });

  it('TC-1.5a: Cmd+Shift+E opens the export dropdown', async () => {
    await renderApp({
      openTabs: ['/Users/test/docs/readme.md'],
      activeTab: '/Users/test/docs/readme.md',
    });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'e', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(document.querySelector('.export-dropdown .dropdown')).not.toBeNull();
  });

  it('Non-TC: Cmd+Shift+E with no tabs is a no-op', async () => {
    await renderApp();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'e', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(document.querySelector('.export-dropdown .dropdown')).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
});
