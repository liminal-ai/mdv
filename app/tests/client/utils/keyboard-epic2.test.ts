// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { basicFileResponse } from '../../fixtures/file-responses.js';
import { emptySession } from '../../fixtures/session.js';

vi.mock('../../../src/client/components/editor.js', () => ({
  Editor: vi.fn().mockImplementation(function MockEditor() {
    return {
      setContent: vi.fn(),
      getContent: vi.fn(() => ''),
      getSelection: vi.fn(() => ''),
      insertAtCursor: vi.fn(),
      replaceSelection: vi.fn(),
      getScrollTop: vi.fn(() => 0),
      setScrollTop: vi.fn(),
      scrollToPercentage: vi.fn(),
      getScrollPercentage: vi.fn(() => 0),
      focus: vi.fn(),
      destroy: vi.fn(),
    };
  }),
}));

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

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
    render: vi.fn().mockImplementation(async ({ content }: { content: string }) => ({
      html: `<p>${content}</p>`,
      warnings: [],
    })),
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
    exportDocument: vi.fn(),
    exportSaveDialog: vi.fn().mockResolvedValue(null),
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
  await bootstrapApp(api as Parameters<typeof bootstrapApp>[0]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  return api;
}

describe('epic 2 keyboard shortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
  });

  it('Cmd+O opens the file picker', async () => {
    const api = await renderApp();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'o', metaKey: true, bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.pickFile).toHaveBeenCalledTimes(1);
  });

  it('Cmd+W closes the active tab', async () => {
    await renderApp({
      openTabs: ['/a.md'],
      activeTab: '/a.md',
    });

    expect(document.querySelectorAll('.tab')).toHaveLength(1);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'w', metaKey: true, bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelectorAll('.tab')).toHaveLength(0);
    expect(document.body.textContent).toContain('No documents open');
  });

  it('Cmd+Shift+] activates the next tab with wrapping', async () => {
    await renderApp({
      openTabs: ['/a.md', '/b.md'],
      activeTab: '/b.md',
    });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: ']', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.tab--active')?.getAttribute('title')).toBe('/a.md');
  });

  it('Cmd+Shift+[ activates the previous tab with wrapping', async () => {
    await renderApp({
      openTabs: ['/a.md', '/b.md'],
      activeTab: '/a.md',
    });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '[', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.tab--active')?.getAttribute('title')).toBe('/b.md');
  });

  it('Cmd+W with no open tabs is a no-op', async () => {
    await renderApp();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'w', metaKey: true, bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.body.textContent).toContain('No documents open');
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('Cmd+Shift+M toggles the active document into edit mode', async () => {
    await renderApp({
      openTabs: ['/a.md'],
      activeTab: '/a.md',
    });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'm', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-toggle button')).find(
        (button) => button.textContent === 'Edit',
      )?.className,
    ).toContain('mode-toggle--active');
  });
});
