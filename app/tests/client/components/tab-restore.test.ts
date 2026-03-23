// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../src/client/api.js';
import type { PersistedTab } from '../../../src/shared/types.js';
import { basicFileResponse } from '../../fixtures/file-responses.js';
import { LEGACY_TABS_STRINGS, PERSISTED_TABS_CLEAN } from '../../fixtures/persisted-tabs.js';
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

function renderShell(): void {
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
}

function createPersistedTabs(
  count: number,
  options: {
    root?: string;
    modes?: Array<'render' | 'edit'>;
    scrollPositions?: number[];
  } = {},
): PersistedTab[] {
  const root = options.root ?? '/root';

  return Array.from({ length: count }, (_, index) => ({
    path: `${root}/doc-${index + 1}.md`,
    mode: options.modes?.[index] ?? 'render',
    scrollPosition: options.scrollPositions?.[index],
  }));
}

function createFileResponse(path: string, overrides: Partial<typeof basicFileResponse> = {}) {
  const filename = path.split('/').filter(Boolean).at(-1) ?? path;

  return {
    ...basicFileResponse,
    path,
    canonicalPath: path,
    filename,
    content: `# ${filename}`,
    html: `<h1>${filename}</h1>`,
    ...overrides,
  };
}

function flushUi(): Promise<void> {
  return Promise.resolve().then(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

async function bootstrapWithSession(options: {
  openTabs: Array<PersistedTab | string>;
  activeTab: string | null;
  defaultOpenMode?: 'render' | 'edit';
  readFile?: (path: string) => Promise<ReturnType<typeof createFileResponse>>;
}) {
  renderShell();

  const session = {
    ...emptySession,
    lastRoot: '/root',
    defaultOpenMode: options.defaultOpenMode ?? 'render',
    openTabs: options.openTabs,
    activeTab: options.activeTab,
  };

  const readFile = vi.fn().mockImplementation(async (path: string) => {
    if (options.readFile) {
      return options.readFile(path);
    }

    return createFileResponse(path);
  });

  const api = {
    bootstrap: vi.fn().mockResolvedValue({
      session,
      availableThemes,
    }),
    setRoot: vi.fn().mockResolvedValue(session),
    addWorkspace: vi.fn().mockResolvedValue(session),
    removeWorkspace: vi.fn().mockResolvedValue(session),
    setTheme: vi.fn().mockResolvedValue(session),
    setDefaultMode: vi.fn().mockResolvedValue(session),
    updateSidebar: vi.fn().mockResolvedValue(session),
    getTree: vi.fn().mockResolvedValue({ root: '/root', tree: [] }),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue(null),
    readFile,
    render: vi.fn().mockResolvedValue({ html: '<h1>Rendered</h1>', warnings: [] }),
    saveFile: vi.fn(),
    saveDialog: vi.fn().mockResolvedValue(null),
    openExternal: vi.fn().mockResolvedValue({ ok: true }),
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
    updateTabs: vi
      .fn()
      .mockImplementation(
        async (openTabs: Array<PersistedTab | string>, activeTab: string | null) => ({
          ...session,
          openTabs,
          activeTab,
        }),
      ),
    touchRecentFile: vi.fn().mockResolvedValue(session),
    removeRecentFile: vi.fn().mockResolvedValue(session),
    exportDocument: vi.fn(),
    exportSaveDialog: vi.fn(),
    reveal: vi.fn(),
    setLastExportDir: vi.fn().mockResolvedValue(session),
  };

  window.__MDV_DISABLE_AUTO_BOOTSTRAP__ = true;
  vi.resetModules();

  const { bootstrapApp } = await import('../../../src/client/app.js');
  const result = await bootstrapApp(api as never, null);
  await flushUi();

  return {
    api,
    store: result.store,
  };
}

describe('tab restore', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('TC-11.1a: tabs restored from PersistedTab array', async () => {
    const openTabs = createPersistedTabs(5);
    const activeTab = openTabs[2]!.path;
    const { store } = await bootstrapWithSession({ openTabs, activeTab });

    const state = store.get();
    const restoredActiveTab = state.tabs.find((tab) => tab.id === state.activeTabId);

    expect(state.tabs).toHaveLength(5);
    expect(restoredActiveTab?.path).toBe(activeTab);
  });

  it('TC-11.1b: all restored tabs load eagerly', async () => {
    const openTabs = createPersistedTabs(10);
    const activeTab = openTabs[6]!.path;
    const { api, store } = await bootstrapWithSession({ openTabs, activeTab });

    const state = store.get();

    expect(state.tabs).toHaveLength(10);
    expect(state.tabs.every((tab) => tab.loading === false && tab.status === 'ok')).toBe(true);
    expect(api.readFile).toHaveBeenCalledTimes(10);
    expect(new Set(api.readFile.mock.calls.map(([path]) => path))).toEqual(
      new Set(openTabs.map((tab) => tab.path)),
    );
  });

  it('TC-11.1c: per-tab mode restored', async () => {
    const openTabs = [
      { path: '/root/readme.md', mode: 'render' as const },
      { path: '/root/spec.md', mode: 'edit' as const },
      { path: '/root/notes.md', mode: 'render' as const },
      { path: '/root/draft.md', mode: 'edit' as const },
    ];
    const { store } = await bootstrapWithSession({
      openTabs,
      activeTab: '/root/spec.md',
    });

    expect(Object.fromEntries(store.get().tabs.map((tab) => [tab.path, tab.mode]))).toEqual({
      '/root/readme.md': 'render',
      '/root/spec.md': 'edit',
      '/root/notes.md': 'render',
      '/root/draft.md': 'edit',
    });
  });

  it('TC-11.1d: missing file tab shows error state', async () => {
    const missingPath = '/root/deleted.md';
    const { store } = await bootstrapWithSession({
      openTabs: [{ path: missingPath, mode: 'render' }],
      activeTab: missingPath,
      readFile: async (path) => {
        if (path === missingPath) {
          throw new ApiError(404, 'FILE_NOT_FOUND', 'Not found');
        }

        return createFileResponse(path);
      },
    });

    const missingTab = store.get().tabs.find((tab) => tab.path === missingPath);

    expect(missingTab).toMatchObject({
      path: missingPath,
      loading: false,
      status: 'deleted',
    });
    expect(document.querySelector('.content-area__deleted-banner')?.textContent).toContain(
      'File not found',
    );
  });

  it('TC-11.2a: all tabs restored after discard-quit', async () => {
    const openTabs = createPersistedTabs(5);
    const { store } = await bootstrapWithSession({
      openTabs,
      activeTab: openTabs[4]!.path,
    });

    expect(store.get().tabs).toHaveLength(5);
    expect(store.get().tabs.every((tab) => tab.dirty === false)).toBe(true);
  });

  it('TC-11.3b: tabs restored after browser tab close (incremental persistence)', async () => {
    const openTabs = PERSISTED_TABS_CLEAN;
    const { api, store } = await bootstrapWithSession({
      openTabs,
      activeTab: openTabs[1]!.path,
    });

    expect(Object.fromEntries(store.get().tabs.map((tab) => [tab.path, tab.mode]))).toEqual(
      Object.fromEntries(openTabs.map((tab) => [tab.path, tab.mode])),
    );
    expect(api.updateTabs).not.toHaveBeenCalled();
  });

  it('Legacy string tabs normalized to PersistedTab', async () => {
    const { api, store } = await bootstrapWithSession({
      openTabs: LEGACY_TABS_STRINGS,
      activeTab: LEGACY_TABS_STRINGS[0]!,
      defaultOpenMode: 'edit',
    });

    expect(store.get().tabs).toHaveLength(LEGACY_TABS_STRINGS.length);
    expect(store.get().tabs.every((tab) => tab.mode === 'edit')).toBe(true);
    expect(store.get().tabs.map((tab) => tab.path)).toEqual(LEGACY_TABS_STRINGS);
    expect(api.readFile).toHaveBeenCalledTimes(LEGACY_TABS_STRINGS.length);
  });

  it('restores inactive missing tabs as deleted without waiting for first switch', async () => {
    const openTabs = [
      { path: '/root/readme.md', mode: 'render' as const },
      { path: '/root/deleted.md', mode: 'render' as const },
    ];
    const { api, store } = await bootstrapWithSession({
      openTabs,
      activeTab: '/root/readme.md',
      readFile: async (path) => {
        if (path === '/root/deleted.md') {
          throw new ApiError(404, 'FILE_NOT_FOUND', 'Not found');
        }

        return createFileResponse(path);
      },
    });

    const restoredDeletedTab = store.get().tabs.find((tab) => tab.path === '/root/deleted.md');

    expect(api.readFile).toHaveBeenCalledTimes(2);
    expect(restoredDeletedTab).toMatchObject({
      loading: false,
      status: 'deleted',
    });

    document.querySelectorAll<HTMLElement>('.tab')[1]?.click();
    await flushUi();

    const deletedTab = store.get().tabs.find((tab) => tab.path === '/root/deleted.md');

    expect(api.readFile).toHaveBeenCalledTimes(2);
    expect(store.get().activeTabId).toBe(deletedTab?.id);
    expect(deletedTab).toMatchObject({
      loading: false,
      status: 'deleted',
    });
    expect(document.querySelector('.content-area__deleted-banner')?.textContent).toContain(
      'File not found',
    );
  });

  it('collapses restored tabs that resolve to a duplicate canonical path', async () => {
    const openTabs = [
      { path: '/root/real.md', mode: 'render' as const },
      { path: '/root/link.md', mode: 'edit' as const },
    ];
    const { api, store } = await bootstrapWithSession({
      openTabs,
      activeTab: '/root/real.md',
      readFile: async (path) =>
        createFileResponse(path, {
          canonicalPath: path === '/root/link.md' ? '/root/real.md' : path,
        }),
    });

    const state = store.get();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);

    expect(api.readFile).toHaveBeenCalledTimes(2);
    expect(state.tabs).toHaveLength(1);
    expect(activeTab?.path).toBe('/root/real.md');
    expect(api.updateTabs).toHaveBeenCalled();
  });
});
