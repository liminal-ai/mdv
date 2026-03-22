// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../src/client/api.js';
import type { ClientState, TabState } from '../../../src/client/state.js';
import { cleanTab, dirtyRenderTab, dirtyTab, saveResponse } from '../../fixtures/edit-samples.js';
import { emptySession } from '../../fixtures/session.js';

interface MockEditorOptions {
  onContentChange: (content: string) => void;
  onCursorChange: (line: number, column: number) => void;
}

interface MockEditorRecord {
  options: MockEditorOptions;
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
}

class MockWsClient {
  readonly sent = vi.fn<(message: unknown) => void>();

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

  emit(type: string, event: unknown): void {
    for (const handler of this.handlers.get(type) ?? []) {
      handler(event);
    }
  }
}

const editorRecords: MockEditorRecord[] = [];

vi.mock('../../../src/client/components/editor.js', () => ({
  Editor: vi.fn().mockImplementation(function MockEditor(
    _parent: HTMLElement,
    options: MockEditorOptions,
  ) {
    let content = '';
    let scrollTop = 0;
    let scrollPercentage = 0;

    const record: MockEditorRecord = {
      options: {
        onContentChange: (nextContent: string) => {
          content = nextContent;
          options.onContentChange(nextContent);
        },
        onCursorChange: options.onCursorChange,
      },
      setContent: vi.fn((nextContent: string) => {
        content = nextContent;
      }),
      getContent: vi.fn(() => content),
      getSelection: vi.fn(() => ''),
      insertAtCursor: vi.fn(),
      replaceSelection: vi.fn(),
      getScrollTop: vi.fn(() => scrollTop),
      setScrollTop: vi.fn((next: number) => {
        scrollTop = next;
      }),
      scrollToPercentage: vi.fn((next: number) => {
        scrollPercentage = next;
      }),
      getScrollPercentage: vi.fn(() => scrollPercentage),
      focus: vi.fn(),
      destroy: vi.fn(),
    };

    editorRecords.push(record);
    return record;
  }),
}));

vi.mock('../../../src/client/utils/mermaid-renderer.js', () => ({
  renderMermaidBlocks: vi.fn().mockResolvedValue({ warnings: [] }),
  reRenderMermaidDiagrams: vi.fn().mockResolvedValue(undefined),
}));

function flushUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function getLatestEditor(): MockEditorRecord {
  const instance = editorRecords.at(-1);
  if (!instance) {
    throw new Error('Expected an editor instance');
  }
  return instance;
}

type TestState = Pick<ClientState, 'tabs' | 'conflictModal' | 'unsavedModal'>;
type TestStore = {
  get: () => TestState;
  update: (partial: Partial<TestState>, changed: Array<keyof ClientState>) => void;
};

function asTestStore(store: unknown): TestStore {
  return store as TestStore;
}

function updateStoreTabs(store: unknown, updater: (tabs: TabState[]) => TabState[]): void {
  const state = asTestStore(store).get();
  asTestStore(store).update({ tabs: updater(state.tabs) }, ['tabs']);
}

function seedTabState(store: unknown, path: string, partial: Partial<TabState>): void {
  updateStoreTabs(store, (tabs) =>
    tabs.map((tab) => (tab.path === path ? { ...tab, ...partial } : tab)),
  );
}

function createFileResponse(path: string, overrides: Record<string, unknown> = {}) {
  const filename = path.split('/').filter(Boolean).at(-1) ?? path;
  return {
    ...cleanTab,
    path,
    canonicalPath: path,
    filename,
    html: `<h1>${filename}</h1>`,
    content: '# README',
    warnings: [],
    modifiedAt: cleanTab.modifiedAt,
    size: cleanTab.size,
    ...overrides,
  };
}

async function renderApp(
  options: {
    sessionOverrides?: Partial<typeof emptySession>;
    readFileOverrides?: Record<string, Record<string, unknown>>;
    apiOverrides?: Record<string, unknown>;
  } = {},
) {
  const session = {
    ...emptySession,
    ...options.sessionOverrides,
  };

  const readFile = vi.fn().mockImplementation(async (path: string) => {
    return createFileResponse(path, options.readFileOverrides?.[path]);
  });

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
    readFile,
    render: vi.fn().mockResolvedValue({ html: '<h1>Rendered Dirty</h1>', warnings: [] }),
    saveFile: vi.fn().mockResolvedValue(saveResponse),
    saveDialog: vi.fn().mockResolvedValue(null),
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
  const wsClient = new MockWsClient();
  const { bootstrapApp } = await import('../../../src/client/app.js');
  const result = await bootstrapApp(api as never, wsClient as never);
  await flushUi();

  return {
    api,
    wsClient,
    store: (result as { store: unknown }).store,
  };
}

describe('save and dirty state integration', () => {
  beforeEach(() => {
    editorRecords.length = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    vi.restoreAllMocks();
    vi.clearAllMocks();
    editorRecords.length = 0;
  });

  it('TC-3.1a: Save clears dirty state', async () => {
    const { api, store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
      readFileOverrides: { [dirtyTab.path]: { mode: 'edit' } },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
      modifiedAt: dirtyTab.modifiedAt,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveFile).toHaveBeenCalledWith({
      path: dirtyTab.path,
      content: dirtyTab.editContent,
      expectedModifiedAt: dirtyTab.modifiedAt,
    });
    expect(document.querySelector('.tab__dirty-dot')).toBeNull();
    expect(document.body.textContent).not.toContain('Modified');
  });

  it('TC-3.1b: Save from File menu', async () => {
    const { api, store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
      readFileOverrides: { [dirtyTab.path]: { mode: 'edit' } },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'File')
      ?.click();
    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find(
        (button) =>
          button.textContent?.startsWith('Save') && !button.textContent?.includes('Save As'),
      )
      ?.click();
    await flushUi();

    expect(api.saveFile).toHaveBeenCalled();
  });

  it('TC-3.1c: Save when clean is a no-op', async () => {
    const { api } = await renderApp({
      sessionOverrides: { openTabs: [cleanTab.path], activeTab: cleanTab.path },
    });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveFile).not.toHaveBeenCalled();
  });

  it('TC-3.1d: Self-change suppression ignores the watcher event after save', async () => {
    const { api, wsClient, store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
      readFileOverrides: { [dirtyTab.path]: { mode: 'edit' } },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
      modifiedAt: dirtyTab.modifiedAt,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    );
    await flushUi();

    const readsAfterBootstrap = api.readFile.mock.calls.length;
    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'modified',
    });
    await flushUi();

    expect(api.readFile.mock.calls.length).toBe(readsAfterBootstrap);
    expect(asTestStore(store).get().conflictModal).toBeNull();
  });

  it('TC-3.1e: Stale write sets conflict modal state', async () => {
    const { api, store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
      readFileOverrides: { [dirtyTab.path]: { mode: 'edit' } },
      apiOverrides: {
        saveFile: vi
          .fn()
          .mockRejectedValue(new ApiError(409, 'CONFLICT', 'File changed on disk since last load')),
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveFile).toHaveBeenCalled();
    expect(asTestStore(store).get().conflictModal).toEqual({
      tabId: expect.any(String),
      filename: dirtyTab.filename,
    });
  });

  it('TC-3.1f: Save from Render mode uses editContent and keeps render mode', async () => {
    const { api, store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyRenderTab.path], activeTab: dirtyRenderTab.path },
    });
    seedTabState(store, dirtyRenderTab.path, {
      mode: 'render',
      editContent: dirtyRenderTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
      modifiedAt: dirtyRenderTab.modifiedAt,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveFile).toHaveBeenCalledWith({
      path: dirtyRenderTab.path,
      content: dirtyRenderTab.editContent,
      expectedModifiedAt: dirtyRenderTab.modifiedAt,
    });
    expect(asTestStore(store).get().tabs[0]?.mode).toBe('render');
  });

  it('TC-3.2a: Save As opens the dialog', async () => {
    const { api } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
    });

    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'File')
      ?.click();
    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.startsWith('Save As'))
      ?.click();
    await flushUi();

    expect(api.saveDialog).toHaveBeenCalledWith({
      defaultPath: '/Users/leemoore/code/docs',
      defaultFilename: 'spec.md',
      prompt: 'Save',
    });
  });

  it('TC-3.2b: Save As writes to a new path and updates the tab', async () => {
    const saveAsPath = '/Users/leemoore/code/docs/spec-copy.md';
    const { api, store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
      readFileOverrides: { [dirtyTab.path]: { mode: 'edit' } },
      apiOverrides: {
        saveDialog: vi.fn().mockResolvedValue({ path: saveAsPath }),
        saveFile: vi.fn().mockResolvedValue({
          path: saveAsPath,
          modifiedAt: saveResponse.modifiedAt,
          size: saveResponse.size,
        }),
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveFile).toHaveBeenCalledWith({
      path: saveAsPath,
      content: dirtyTab.editContent,
      expectedModifiedAt: null,
    });
    expect(asTestStore(store).get().tabs[0]).toMatchObject({
      path: saveAsPath,
      filename: 'spec-copy.md',
      dirty: false,
    });
  });

  it('TC-3.2c: Save As cancel preserves state', async () => {
    const { api, store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
      readFileOverrides: { [dirtyTab.path]: { mode: 'edit' } },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveDialog).toHaveBeenCalled();
    expect(api.saveFile).not.toHaveBeenCalled();
    expect(asTestStore(store).get().tabs[0]).toMatchObject({
      path: dirtyTab.path,
      dirty: true,
    });
  });

  it('TC-3.2e: Save As to an already-open clean path closes the duplicate tab', async () => {
    const { store } = await renderApp({
      sessionOverrides: {
        openTabs: [cleanTab.path, dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      apiOverrides: {
        saveDialog: vi.fn().mockResolvedValue({ path: cleanTab.path }),
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(asTestStore(store).get().tabs).toHaveLength(1);
    expect(asTestStore(store).get().tabs[0]?.path).toBe(cleanTab.path);
  });

  it('TC-3.2f: Save As to an already-open dirty path opens unsaved modal state', async () => {
    const targetPath = cleanTab.path;
    const { api, store } = await renderApp({
      sessionOverrides: {
        openTabs: [targetPath, dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      apiOverrides: {
        saveDialog: vi.fn().mockResolvedValue({ path: targetPath }),
      },
    });
    seedTabState(store, targetPath, {
      id: 'tab-existing-dirty',
      filename: 'readme.md',
      mode: 'edit',
      editContent: '# Existing dirty',
      dirty: true,
      editedSinceLastSave: true,
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveFile).not.toHaveBeenCalled();
    expect(asTestStore(store).get().unsavedModal).toEqual({
      tabId: 'tab-existing-dirty',
      filenames: ['readme.md'],
      context: 'save-as-replace',
    });
  });

  it('TC-3.2f: Save As continues after saving the conflicting dirty tab', async () => {
    const targetPath = cleanTab.path;
    const { api, store } = await renderApp({
      sessionOverrides: {
        openTabs: [targetPath, dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      apiOverrides: {
        saveDialog: vi.fn().mockResolvedValue({ path: targetPath }),
        saveFile: vi
          .fn()
          .mockResolvedValueOnce({
            path: targetPath,
            modifiedAt: '2026-03-20T10:06:00Z',
            size: 20,
          })
          .mockResolvedValueOnce({
            path: targetPath,
            modifiedAt: '2026-03-20T10:07:00Z',
            size: saveResponse.size,
          }),
      },
    });
    seedTabState(store, targetPath, {
      id: 'tab-existing-dirty',
      filename: 'readme.md',
      mode: 'edit',
      editContent: '# Existing dirty',
      dirty: true,
      editedSinceLastSave: true,
      modifiedAt: cleanTab.modifiedAt,
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Save and Close')
      ?.click();
    await flushUi();
    await flushUi();

    expect(api.saveFile).toHaveBeenNthCalledWith(1, {
      path: targetPath,
      content: '# Existing dirty',
      expectedModifiedAt: cleanTab.modifiedAt,
    });
    expect(api.saveFile).toHaveBeenNthCalledWith(2, {
      path: targetPath,
      content: dirtyTab.editContent,
      expectedModifiedAt: null,
    });
    expect(asTestStore(store).get().unsavedModal).toBeNull();
    expect(asTestStore(store).get().tabs).toHaveLength(1);
    expect(asTestStore(store).get().tabs[0]).toMatchObject({
      path: targetPath,
      dirty: false,
      content: dirtyTab.editContent,
    });
  });

  it('TC-3.2f: Save As continues after discarding the conflicting dirty tab', async () => {
    const targetPath = cleanTab.path;
    const { api, store } = await renderApp({
      sessionOverrides: {
        openTabs: [targetPath, dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      apiOverrides: {
        saveDialog: vi.fn().mockResolvedValue({ path: targetPath }),
      },
    });
    seedTabState(store, targetPath, {
      id: 'tab-existing-dirty',
      filename: 'readme.md',
      mode: 'edit',
      editContent: '# Existing dirty',
      dirty: true,
      editedSinceLastSave: true,
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, bubbles: true }),
    );
    await flushUi();

    Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Discard Changes')
      ?.click();
    await flushUi();
    await flushUi();

    expect(api.saveFile).toHaveBeenCalledTimes(1);
    expect(api.saveFile).toHaveBeenCalledWith({
      path: targetPath,
      content: dirtyTab.editContent,
      expectedModifiedAt: null,
    });
    expect(asTestStore(store).get().unsavedModal).toBeNull();
    expect(asTestStore(store).get().tabs).toHaveLength(1);
    expect(asTestStore(store).get().tabs[0]?.path).toBe(targetPath);
  });

  it('TC-4.1a: Tab dirty dot appears when dirty', async () => {
    const { store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
    });
    seedTabState(store, dirtyTab.path, {
      dirty: true,
      editContent: dirtyTab.editContent,
      editedSinceLastSave: true,
    });
    await flushUi();

    expect(document.querySelector('.tab__dirty-dot')).not.toBeNull();
  });

  it('TC-4.1b: Dirty dot clears on save', async () => {
    const { store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
      readFileOverrides: { [dirtyTab.path]: { mode: 'edit' } },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      dirty: true,
      editContent: dirtyTab.editContent,
      editedSinceLastSave: true,
    });
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(document.querySelector('.tab__dirty-dot')).toBeNull();
  });

  it('TC-4.1c: Dirty dot appears on first edit', async () => {
    const { store } = await renderApp({
      sessionOverrides: { openTabs: [cleanTab.path], activeTab: cleanTab.path },
      readFileOverrides: { [cleanTab.path]: { mode: 'edit' } },
    });
    seedTabState(store, cleanTab.path, {
      mode: 'edit',
      editContent: cleanTab.content,
    });
    await flushUi();

    getLatestEditor().options.onContentChange('# README!');
    await flushUi();

    expect(document.querySelector('.tab__dirty-dot')).not.toBeNull();
  });

  it('TC-4.2a: Toolbar dirty indicator appears in edit mode', async () => {
    const { store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      dirty: true,
      editContent: dirtyTab.editContent,
      editedSinceLastSave: true,
    });
    await flushUi();

    expect(document.body.textContent).toContain('Modified');
  });

  it('TC-4.2b: Toolbar dirty indicator appears in render mode', async () => {
    const { store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyRenderTab.path], activeTab: dirtyRenderTab.path },
    });
    seedTabState(store, dirtyRenderTab.path, {
      mode: 'render',
      dirty: true,
      editContent: dirtyRenderTab.editContent,
      editedSinceLastSave: true,
    });
    await flushUi();

    expect(document.body.textContent).toContain('Modified');
  });

  it('TC-4.3a: Dirty state is tracked independently per tab', async () => {
    const { store } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path, cleanTab.path],
        activeTab: dirtyTab.path,
      },
    });
    seedTabState(store, dirtyTab.path, {
      dirty: true,
      editContent: dirtyTab.editContent,
      editedSinceLastSave: true,
    });
    await flushUi();

    expect(document.querySelectorAll('.tab__dirty-dot')).toHaveLength(1);
    const tabs = asTestStore(store).get().tabs;
    expect(tabs.find((tab) => tab.path === dirtyTab.path)?.dirty).toBe(true);
    expect(tabs.find((tab) => tab.path === cleanTab.path)?.dirty).toBe(false);
  });
});
