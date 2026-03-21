// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientState, TabState } from '../../../src/client/state.js';
import { cleanTab, dirtyTab } from '../../fixtures/edit-samples.js';
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

vi.mock('../../../src/client/utils/mermaid-renderer.js', () => ({
  renderMermaidBlocks: vi.fn().mockResolvedValue({ warnings: [] }),
  reRenderMermaidDiagrams: vi.fn().mockResolvedValue(undefined),
}));

function flushUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

class MockWsClient {
  readonly sent = vi.fn();
  readonly connect = vi.fn();
  private readonly handlers = new Map<string, Set<(event: unknown) => void>>();

  on(type: string, handler: (event: unknown) => void): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  send(message: unknown): void {
    this.sent(message);
  }
}

type TestState = Pick<ClientState, 'tabs'>;
type TestStore = {
  get: () => TestState;
  update: (partial: Partial<TestState>, changed: Array<keyof ClientState>) => void;
};

function asTestStore(store: unknown): TestStore {
  return store as TestStore;
}

function updateTabs(store: unknown, updater: (tabs: TabState[]) => TabState[]): void {
  const state = asTestStore(store).get();
  asTestStore(store).update({ tabs: updater(state.tabs) }, ['tabs']);
}

async function renderApp(
  options: {
    sessionOverrides?: Partial<typeof emptySession>;
    readFileOverrides?: Record<string, Partial<typeof cleanTab>>;
    apiOverrides?: Record<string, unknown>;
  } = {},
) {
  const session = {
    ...emptySession,
    ...options.sessionOverrides,
  };

  const api = {
    bootstrap: vi.fn().mockResolvedValue({
      session,
      availableThemes: [
        { id: 'light-default', label: 'Light Default', variant: 'light' as const },
        { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
        { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
        { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
      ],
    }),
    setRoot: vi.fn(),
    addWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
    setTheme: vi.fn().mockResolvedValue(session),
    setDefaultMode: vi.fn().mockResolvedValue(session),
    updateSidebar: vi.fn().mockResolvedValue(session),
    getTree: vi.fn().mockResolvedValue({ root: '/root', tree: [] }),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue(null),
    readFile: vi.fn().mockImplementation(async (path: string) => {
      const override = options.readFileOverrides?.[path] ?? {};
      const filename = path.split('/').filter(Boolean).at(-1) ?? path;
      return {
        ...cleanTab,
        ...override,
        path,
        canonicalPath: path,
        filename,
        html: `<h1>${filename}</h1>`,
      };
    }),
    render: vi.fn().mockResolvedValue({ html: '<h1>Rendered</h1>', warnings: [] }),
    saveFile: vi.fn().mockResolvedValue({
      path: dirtyTab.path,
      modifiedAt: '2026-03-20T10:05:00Z',
      size: 35,
    }),
    saveDialog: vi.fn().mockResolvedValue({ path: '/Users/leemoore/code/docs/spec-copy.md' }),
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
    exportSaveDialog: vi.fn(),
    reveal: vi.fn(),
    setLastExportDir: vi.fn().mockResolvedValue(session),
    ...options.apiOverrides,
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
  vi.resetModules();
  const { bootstrapApp } = await import('../../../src/client/app.js');
  const result = await bootstrapApp(api as never, new MockWsClient() as never);
  await flushUi();

  return {
    api,
    store: (result as { store?: unknown } | void as { store?: unknown } | undefined)?.store,
  };
}

describe('epic 5 keyboard shortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-3.1a: Cmd+S triggers save', async () => {
    const { api, store } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: { ...cleanTab, mode: 'edit' },
      },
    });

    updateTabs(store, (tabs) =>
      tabs.map((tab) =>
        tab.path === dirtyTab.path
          ? {
              ...tab,
              mode: 'edit',
              editContent: dirtyTab.editContent,
              dirty: true,
              editedSinceLastSave: true,
            }
          : tab,
      ),
    );

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveFile).toHaveBeenCalledTimes(1);
  });

  it('TC-3.2a: Cmd+Shift+S opens Save As', async () => {
    const { api } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: dirtyTab,
      },
    });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveDialog).toHaveBeenCalledTimes(1);
  });

  it('TC-1.1c: Cmd+Shift+M toggles mode', async () => {
    const { store } = await renderApp({
      sessionOverrides: {
        openTabs: [cleanTab.path],
        activeTab: cleanTab.path,
      },
      readFileOverrides: {
        [cleanTab.path]: cleanTab,
      },
    });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'm', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(asTestStore(store).get().tabs[0]?.mode).toBe('edit');
  });

  it('TC-9.1a: Cmd+K dispatches insert-link while editing', async () => {
    const handler = vi.fn();
    document.addEventListener('mdv:insert-link', handler as EventListener);
    const { store } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: { ...cleanTab, mode: 'edit' },
      },
    });

    updateTabs(store, (tabs) =>
      tabs.map((tab) => (tab.path === dirtyTab.path ? { ...tab, mode: 'edit' } : tab)),
    );

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(handler).toHaveBeenCalled();
    document.removeEventListener('mdv:insert-link', handler as EventListener);
  });

  it('Non-TC: Cmd+S prevents the browser default', async () => {
    const { store } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: { ...cleanTab, mode: 'edit' },
      },
    });

    updateTabs(store, (tabs) =>
      tabs.map((tab) =>
        tab.path === dirtyTab.path
          ? {
              ...tab,
              mode: 'edit',
              editContent: dirtyTab.editContent,
              dirty: true,
              editedSinceLastSave: true,
            }
          : tab,
      ),
    );

    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    await flushUi();

    expect(preventDefault).toHaveBeenCalled();
  });

  it('Non-TC: Cmd+S with no active tab is a no-op', async () => {
    const { api } = await renderApp();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveFile).not.toHaveBeenCalled();
  });
});
