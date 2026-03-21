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

function createWsStub() {
  const handlers = new Map<string, Set<(event: unknown) => void>>();

  return {
    send: vi.fn(),
    connect: vi.fn(),
    on: vi.fn((type: string, handler: (event: unknown) => void) => {
      const nextHandlers = handlers.get(type) ?? new Set();
      nextHandlers.add(handler);
      handlers.set(type, nextHandlers);

      return () => {
        nextHandlers.delete(handler);
      };
    }),
    emit(type: string, event: unknown) {
      for (const handler of handlers.get(type) ?? []) {
        handler(event);
      }
    },
  };
}

async function renderApp(
  sessionOverrides: Partial<typeof emptySession> = {},
  options: {
    exportDocument?: () => Promise<unknown>;
    readFile?: (path: string) => Promise<unknown>;
    ws?: ReturnType<typeof createWsStub>;
  } = {},
) {
  const session = {
    ...emptySession,
    ...sessionOverrides,
  };
  const ws = options.ws ?? createWsStub();

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
    getTree: vi.fn().mockResolvedValue({ root: session.lastRoot ?? '/root', tree: [] }),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue({ path: '/picked.md' }),
    readFile: vi.fn().mockImplementation(
      options.readFile ??
        (async (path: string) => ({
          ...basicFileResponse,
          path,
          canonicalPath: path,
          filename: path.split('/').filter(Boolean).at(-1) ?? path,
          html: `<h1>${path}</h1>`,
        })),
    ),
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
    exportDocument: vi.fn().mockImplementation(
      options.exportDocument ??
        (() =>
          Promise.resolve({
            status: 'success',
            outputPath: '/Users/test/exports/readme.pdf',
            warnings: [],
          })),
    ),
    exportSaveDialog: vi.fn().mockResolvedValue({ path: '/Users/test/exports/readme.pdf' }),
    reveal: vi.fn().mockResolvedValue({ ok: true }),
    setLastExportDir: vi
      .fn()
      .mockImplementation(async (dir: string) => ({ ...session, lastExportDir: dir })),
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
  await bootstrapApp(
    api as Parameters<typeof bootstrapApp>[0],
    ws as Parameters<typeof bootstrapApp>[1],
  );
  await flushUi();

  return { api, ws };
}

function openToolbarExportDropdown() {
  document.querySelector<HTMLButtonElement>('.export-dropdown .content-toolbar__button')?.click();
}

function openMenuBarExportDropdown() {
  Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-bar__trigger'))
    .find((button) => button.textContent === 'Export')
    ?.click();
}

describe('export dropdown activation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
  });

  it('TC-1.1a: Content toolbar Export shows PDF, DOCX, and HTML', async () => {
    await renderApp({
      openTabs: ['/Users/test/docs/readme.md'],
      activeTab: '/Users/test/docs/readme.md',
    });

    openToolbarExportDropdown();

    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.export-dropdown .dropdown__item'),
    );

    expect(items.map((item) => item.textContent)).toEqual(['PDF', 'DOCX', 'HTML']);
    expect(items.every((item) => !item.disabled)).toBe(true);
  });

  it('TC-1.1b: Menu bar Export shows PDF, DOCX, and HTML', async () => {
    await renderApp({
      openTabs: ['/Users/test/docs/readme.md'],
      activeTab: '/Users/test/docs/readme.md',
    });

    openMenuBarExportDropdown();

    const items = Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-bar__item'));

    expect(items.map((item) => item.textContent)).toEqual(['PDF', 'DOCX', 'HTML']);
    expect(items.every((item) => !item.disabled)).toBe(true);
  });

  it('TC-1.1c: Export is disabled with no document', async () => {
    await renderApp();

    openMenuBarExportDropdown();

    const items = Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-bar__item'));

    expect(items).toHaveLength(3);
    expect(items.every((item) => item.disabled)).toBe(true);
  });

  it('TC-1.1d: Export is disabled for a deleted file', async () => {
    const ws = createWsStub();
    await renderApp(
      {
        openTabs: ['/Users/test/docs/deleted.md'],
        activeTab: '/Users/test/docs/deleted.md',
      },
      { ws },
    );

    ws.emit('file-change', {
      type: 'file-change',
      path: '/Users/test/docs/deleted.md',
      event: 'deleted',
    });
    await flushUi();
    openToolbarExportDropdown();

    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.export-dropdown .dropdown__item'),
    );

    expect(items).toHaveLength(3);
    expect(items.every((item) => item.getAttribute('aria-disabled') === 'true')).toBe(true);
  });

  it('TC-1.1e: Export dropdown keyboard navigation moves focus between items', async () => {
    await renderApp({
      openTabs: ['/Users/test/docs/readme.md'],
      activeTab: '/Users/test/docs/readme.md',
    });

    openToolbarExportDropdown();
    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.export-dropdown .dropdown__item'),
    );

    items[0]?.focus();
    items[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(document.activeElement).toBe(items[1]);

    items[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(document.activeElement).toBe(items[0]);
  });

  it('TC-1.1f: Files outside the current root can still export', async () => {
    await renderApp({
      lastRoot: '/Users/test/workspace',
      openTabs: ['/Users/elsewhere/readme.md'],
      activeTab: '/Users/elsewhere/readme.md',
    });

    openToolbarExportDropdown();

    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.export-dropdown .dropdown__item'),
    );

    expect(items.every((item) => !item.disabled)).toBe(true);
  });

  it('TC-1.5a: Cmd+Shift+E opens the Export dropdown', async () => {
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

  it('Non-TC: Export is disabled while an export is in progress', async () => {
    let resolveExport: (() => void) | null = null;
    const exportDocument = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveExport = () =>
            resolve({
              status: 'success',
              outputPath: '/Users/test/exports/readme.pdf',
              warnings: [],
            });
        }),
    );

    await renderApp(
      {
        openTabs: ['/Users/test/docs/readme.md'],
        activeTab: '/Users/test/docs/readme.md',
      },
      { exportDocument },
    );

    openToolbarExportDropdown();
    document.querySelectorAll<HTMLButtonElement>('.export-dropdown .dropdown__item')[0]?.click();
    await flushUi();

    openMenuBarExportDropdown();
    const items = Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-bar__item'));

    expect(items).toHaveLength(3);
    expect(items.every((item) => item.disabled)).toBe(true);

    resolveExport?.();
    await flushUi();
  });
});
