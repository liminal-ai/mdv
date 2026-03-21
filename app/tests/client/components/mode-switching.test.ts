// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const editorInstances: Array<{
  setContent: ReturnType<typeof vi.fn>;
  getContent: ReturnType<typeof vi.fn>;
  getSelection: ReturnType<typeof vi.fn>;
  insertAtCursor: ReturnType<typeof vi.fn>;
  replaceSelection: ReturnType<typeof vi.fn>;
  getScrollTop: ReturnType<typeof vi.fn>;
  setScrollTop: ReturnType<typeof vi.fn>;
  scrollToPercentage: ReturnType<typeof vi.fn>;
  getScrollPercentage: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('../../../src/client/components/editor.js', () => ({
  Editor: vi.fn().mockImplementation(function MockEditor() {
    let content = '';

    const instance = {
      setContent: vi.fn((nextContent: string) => {
        content = nextContent;
      }),
      getContent: vi.fn(() => content),
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
    editorInstances.push(instance);
    return instance;
  }),
}));

vi.mock('../../../src/client/utils/mermaid-renderer.js', () => ({
  renderMermaidBlocks: vi.fn().mockResolvedValue({ warnings: [] }),
  reRenderMermaidDiagrams: vi.fn().mockResolvedValue(undefined),
}));

import { mountContentArea } from '../../../src/client/components/content-area.js';
import { mountContentToolbar } from '../../../src/client/components/content-toolbar.js';
import { mountTabStrip } from '../../../src/client/components/tab-strip.js';
import { createStore } from '../support.js';
import { cleanTab, dirtyTab, threeTabs } from '../../fixtures/edit-samples.js';
import { emptySession } from '../../fixtures/session.js';
import { basicFileResponse } from '../../fixtures/file-responses.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

function flushUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function getModeButton(label: 'Render' | 'Edit'): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-toggle button'));
  const match = buttons.find((button) => button.textContent === label);
  if (!match) {
    throw new Error(`Mode button not found: ${label}`);
  }
  return match;
}

function openDefaultModeDropdown(): void {
  document
    .querySelector<HTMLButtonElement>('.default-mode-picker .content-toolbar__button')
    ?.click();
}

function getDefaultModeItem(label: 'Render' | 'Edit'): HTMLButtonElement {
  const items = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.default-mode-picker .dropdown__item'),
  );
  const match = items.find((button) => button.textContent?.includes(label));
  if (!match) {
    throw new Error(`Default mode item not found: ${label}`);
  }
  return match;
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
  };
}

function renderModeComponents(
  overrides: Parameters<typeof createStore>[0] = {},
  options: {
    includeTabStrip?: boolean;
    onRenderContent?: (
      content: string,
      documentPath: string,
    ) => Promise<{
      html: string;
      warnings: Array<{ type: string; source: string; message: string; line?: number }>;
    }>;
  } = {},
) {
  document.body.innerHTML = `
    <div id="tab-strip"></div>
    <div id="content-toolbar"></div>
    <div id="content-area"></div>
  `;

  const store = createStore({
    tabs: [cleanTab],
    activeTabId: cleanTab.id,
    contentToolbarVisible: true,
    ...overrides,
  });

  const toolbarActions = {
    onSetDefaultMode: vi.fn(async (mode: 'render' | 'edit') => {
      store.update(
        {
          session: {
            ...store.get().session,
            defaultOpenMode: mode,
          },
        },
        ['session'],
      );
    }),
    onExportFormat: vi.fn(),
  };

  const contentAreaActions = {
    onBrowse: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenRecentFile: vi.fn(),
    onRenderContent: vi.fn(
      options.onRenderContent ??
        (async (content: string) => ({
          html: `<p>${content}</p>`,
          warnings: [],
        })),
    ),
  };

  const cleanups = [
    mountContentToolbar(
      document.querySelector<HTMLElement>('#content-toolbar')!,
      store,
      toolbarActions,
    ),
    mountContentArea(
      document.querySelector<HTMLElement>('#content-area')!,
      store,
      contentAreaActions,
    ),
  ];

  if (options.includeTabStrip) {
    cleanups.push(
      mountTabStrip(document.querySelector<HTMLElement>('#tab-strip')!, store, {
        onActivateTab: (tabId: string) => {
          store.update({ activeTabId: tabId }, ['activeTabId']);
        },
        onCloseTab: vi.fn(),
        onCloseOtherTabs: vi.fn(),
        onCloseTabsToRight: vi.fn(),
        onCopyTabPath: vi.fn(),
      }),
    );
  }

  return {
    store,
    toolbarActions,
    contentAreaActions,
    cleanup: () => cleanups.forEach((fn) => fn()),
  };
}

async function renderApp(
  sessionOverrides: Partial<typeof emptySession> = {},
  options: {
    getTree?: (root: string) => Promise<unknown>;
    readFile?: (path: string) => Promise<unknown>;
    render?: (request: { content: string; documentPath: string }) => Promise<unknown>;
  } = {},
) {
  const session = {
    ...emptySession,
    ...sessionOverrides,
  };
  const ws = createWsStub();

  const api = {
    bootstrap: vi.fn().mockResolvedValue({
      session,
      availableThemes,
    }),
    setRoot: vi.fn(),
    addWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
    setTheme: vi.fn().mockResolvedValue(session),
    setDefaultMode: vi.fn().mockImplementation(async (mode: 'render' | 'edit') => ({
      ...session,
      defaultOpenMode: mode,
    })),
    updateSidebar: vi.fn().mockResolvedValue(session),
    getTree: vi.fn().mockImplementation(
      options.getTree ??
        (async (root: string) => ({
          root,
          tree: [{ name: 'readme.md', path: `${root}/readme.md`, type: 'file' as const }],
        })),
    ),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue(null),
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
    render: vi.fn().mockImplementation(
      options.render ??
        (async ({ content }: { content: string }) => ({
          html: `<p>${content}</p>`,
          warnings: [],
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
  await bootstrapApp(
    api as Parameters<typeof bootstrapApp>[0],
    ws as Parameters<typeof bootstrapApp>[1],
  );
  await flushUi();

  return { api, ws };
}

describe('mode switching and default mode', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    editorInstances.splice(0, editorInstances.length);
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-1.1a: Switch to Edit mode', async () => {
    renderModeComponents({
      tabs: [cleanTab],
      activeTabId: cleanTab.id,
    });

    getModeButton('Edit').click();
    await flushUi();

    expect(document.querySelector<HTMLElement>('.editor-container')?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.markdown-body')?.hidden).toBe(true);
    expect(getModeButton('Edit').className).toContain('mode-toggle--active');
  });

  it('TC-1.1b: Switch to Render mode', async () => {
    renderModeComponents({
      tabs: [dirtyTab],
      activeTabId: dirtyTab.id,
    });

    getModeButton('Render').click();
    await flushUi();

    expect(document.querySelector<HTMLElement>('.editor-container')?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.markdown-body')?.hidden).toBe(false);
    expect(getModeButton('Render').className).toContain('mode-toggle--active');
  });

  it('TC-1.1c: Cmd+Shift+M toggles mode', async () => {
    await renderApp({
      openTabs: ['/root/readme.md'],
      activeTab: '/root/readme.md',
    });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'm', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(getModeButton('Edit').className).toContain('mode-toggle--active');

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'm', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(getModeButton('Render').className).toContain('mode-toggle--active');
  });

  it('TC-1.1d: Dirty state preserved across mode switch', async () => {
    const { store } = renderModeComponents({
      tabs: [dirtyTab],
      activeTabId: dirtyTab.id,
    });

    getModeButton('Render').click();
    await flushUi();
    getModeButton('Edit').click();
    await flushUi();

    expect(store.get().tabs[0]?.editContent).toBe(dirtyTab.editContent);
    expect(store.get().tabs[0]?.dirty).toBe(true);
    expect(document.body.textContent).toContain('Modified');
  });

  it('TC-1.1e: Render mode shows unsaved edits', async () => {
    const { contentAreaActions } = renderModeComponents(
      {
        tabs: [dirtyTab],
        activeTabId: dirtyTab.id,
      },
      {
        onRenderContent: async (content: string, documentPath: string) => ({
          html: `<p>${content}:${documentPath}</p>`,
          warnings: [],
        }),
      },
    );

    getModeButton('Render').click();
    await flushUi();

    expect(contentAreaActions.onRenderContent).toHaveBeenCalledWith(
      dirtyTab.editContent,
      dirtyTab.path,
    );
  });

  it('TC-1.1f: Mode per tab', async () => {
    const editTab = {
      ...cleanTab,
      id: 'tab-a',
      path: '/a.md',
      canonicalPath: '/a.md',
      filename: 'a.md',
      mode: 'edit' as const,
      editContent: '# A',
    };
    const renderTab = {
      ...cleanTab,
      id: 'tab-b',
      path: '/b.md',
      canonicalPath: '/b.md',
      filename: 'b.md',
      mode: 'render' as const,
    };

    renderModeComponents(
      {
        tabs: [editTab, renderTab],
        activeTabId: editTab.id,
      },
      { includeTabStrip: true },
    );

    await flushUi();
    expect(getModeButton('Edit').className).toContain('mode-toggle--active');

    document.querySelectorAll<HTMLElement>('.tab')[1]?.click();
    await flushUi();
    expect(getModeButton('Render').className).toContain('mode-toggle--active');

    document.querySelectorAll<HTMLElement>('.tab')[0]?.click();
    await flushUi();
    expect(getModeButton('Edit').className).toContain('mode-toggle--active');
  });

  it('TC-1.2a: Edit mode toolbar: cursor position shown', async () => {
    renderModeComponents({
      tabs: [dirtyTab],
      activeTabId: dirtyTab.id,
    });

    await flushUi();

    expect(document.body.textContent).toContain('Ln 3, Col 18');
    expect(document.body.textContent).not.toContain('warning');
  });

  it('TC-1.2b: Render mode toolbar: warnings shown', async () => {
    renderModeComponents({
      tabs: [
        {
          ...cleanTab,
          warnings: [
            {
              type: 'missing-image',
              source: './missing.png',
              message: 'Missing image',
            },
          ],
        },
      ],
      activeTabId: cleanTab.id,
    });

    await flushUi();

    expect(document.body.textContent).toContain('⚠ 1 warning');
    expect(document.body.textContent).not.toContain('Ln ');
  });

  it('TC-7.1a: Default mode Edit enabled', async () => {
    renderModeComponents({
      tabs: [cleanTab],
      activeTabId: cleanTab.id,
    });

    openDefaultModeDropdown();

    const editItem = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.default-mode-picker .dropdown__item'),
    ).find((button) => button.textContent?.includes('Edit'));

    expect(editItem?.disabled).toBe(false);
    expect(editItem?.textContent).toBe('Edit');
  });

  it('TC-7.1b: New tab opens in Edit when default is Edit', async () => {
    await renderApp(
      {
        defaultOpenMode: 'edit',
        lastRoot: '/root',
      },
      {
        getTree: async () => ({
          root: '/root',
          tree: [{ name: 'guide.md', path: '/root/guide.md', type: 'file' as const }],
        }),
      },
    );

    document.querySelector<HTMLElement>('[data-type="file"]')?.click();
    await flushUi();

    expect(getModeButton('Edit').className).toContain('mode-toggle--active');
    expect(document.querySelector<HTMLElement>('.editor-container')?.hidden).toBe(false);
  });

  it('TC-7.1c: Default mode persists', async () => {
    const { api } = await renderApp({
      openTabs: ['/root/readme.md'],
      activeTab: '/root/readme.md',
    });

    openDefaultModeDropdown();
    getDefaultModeItem('Edit').click();
    await flushUi();

    expect(api.setDefaultMode).toHaveBeenCalledWith('edit');
  });

  it('TC-7.1d: Direct open in Edit (no Render flash)', async () => {
    const readFile = createDeferred({
      ...basicFileResponse,
      path: '/root/guide.md',
      canonicalPath: '/root/guide.md',
      filename: 'guide.md',
      html: '<h1>Guide</h1>',
    });

    await renderApp(
      {
        defaultOpenMode: 'edit',
        lastRoot: '/root',
      },
      {
        getTree: async () => ({
          root: '/root',
          tree: [{ name: 'guide.md', path: '/root/guide.md', type: 'file' as const }],
        }),
        readFile: () => readFile.promise,
      },
    );

    document.querySelector<HTMLElement>('[data-type="file"]')?.click();
    await flushUi();
    expect(document.body.textContent).toContain('Loading guide.md');

    readFile.resolve({
      ...basicFileResponse,
      path: '/root/guide.md',
      canonicalPath: '/root/guide.md',
      filename: 'guide.md',
      html: '<h1>Guide</h1>',
    });
    await flushUi();

    expect(getModeButton('Edit').className).toContain('mode-toggle--active');
    expect(document.querySelector<HTMLElement>('.editor-container')?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.markdown-body')?.hidden).toBe(true);
  });

  it('TC-7.2a: Existing tabs unaffected by default change', async () => {
    const renderTabs = threeTabs.map((tab) => ({
      ...tab,
      mode: 'render' as const,
      dirty: false,
      editContent: null,
    }));
    const { store } = renderModeComponents({
      tabs: renderTabs,
      activeTabId: renderTabs[0]?.id ?? null,
    });

    openDefaultModeDropdown();
    getDefaultModeItem('Edit').click();
    await flushUi();

    expect(store.get().tabs).toHaveLength(3);
    expect(store.get().tabs.every((tab) => tab.mode === 'render')).toBe(true);
  });
});
