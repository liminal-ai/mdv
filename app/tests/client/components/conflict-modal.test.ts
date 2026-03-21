// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountConflictModal } from '../../../src/client/components/conflict-modal.js';
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

type TestState = Pick<ClientState, 'tabs' | 'error' | 'conflictModal'>;
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

function getButtonByText(text: string): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  const match = buttons.find((button) => button.textContent?.includes(text));

  if (!match) {
    throw new Error(`Button not found: ${text}`);
  }

  return match;
}

function getModalTitle(): HTMLElement | null {
  return document.querySelector('.modal__title');
}

function getModalMessage(): HTMLElement | null {
  return document.querySelector('.modal__message');
}

describe('external change conflict resolution', () => {
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
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    vi.restoreAllMocks();
    vi.clearAllMocks();
    editorRecords.length = 0;
  });

  it('TC-6.1a: Conflict modal appears on external change with dirty tab', async () => {
    const { store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: dirtyTab,
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'modified',
    });
    await flushUi();

    expect(typeof mountConflictModal).toBe('function');
    expect(asTestStore(store).get().conflictModal).toEqual({
      tabId: expect.any(String),
      filename: dirtyTab.filename,
    });
    expect(getModalTitle()?.textContent).toBe('File changed externally');
    expect(getModalMessage()?.textContent).toBe(
      `${dirtyTab.filename} has been modified externally.`,
    );
    expect(getButtonByText('Keep My Changes')).toBeInstanceOf(HTMLButtonElement);
    expect(getButtonByText('Reload from Disk')).toBeInstanceOf(HTMLButtonElement);
    expect(getButtonByText('Save Copy')).toBeInstanceOf(HTMLButtonElement);
  });

  it('TC-6.1b: Keep My Changes dismisses modal', async () => {
    const { store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: dirtyTab,
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'modified',
    });
    await flushUi();

    getButtonByText('Keep My Changes').click();
    await flushUi();

    const tab = asTestStore(store)
      .get()
      .tabs.find((candidate) => candidate.path === dirtyTab.path);
    expect(asTestStore(store).get().conflictModal).toBeNull();
    expect(tab?.dirty).toBe(true);
    expect(tab?.editContent).toBe(dirtyTab.editContent);
  });

  it('TC-6.1c: Reload from Disk replaces content', async () => {
    const freshDiskResponse = createFileResponse(dirtyTab.path, {
      content: '# Spec\n\nReloaded from disk.',
      html: '<h1>Spec</h1><p>Reloaded from disk.</p>',
      modifiedAt: '2026-03-20T10:15:00Z',
      size: 28,
    });
    const readFile = vi
      .fn()
      .mockResolvedValueOnce(dirtyTab)
      .mockResolvedValueOnce(freshDiskResponse);
    const { api, store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      apiOverrides: { readFile },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'modified',
    });
    await flushUi();

    getButtonByText('Reload from Disk').click();
    await flushUi();

    const tab = asTestStore(store)
      .get()
      .tabs.find((candidate) => candidate.path === dirtyTab.path);
    expect(api.readFile).toHaveBeenCalledTimes(2);
    expect(tab).toMatchObject({
      content: freshDiskResponse.content,
      html: freshDiskResponse.html,
      editContent: freshDiskResponse.content,
      modifiedAt: freshDiskResponse.modifiedAt,
      dirty: false,
      editedSinceLastSave: false,
    });
    expect(asTestStore(store).get().conflictModal).toBeNull();
  });

  it('TC-6.1d: Save Copy then reloads original', async () => {
    const freshDiskResponse = createFileResponse(dirtyTab.path, {
      content: '# Spec\n\nExternal version.',
      html: '<h1>Spec</h1><p>External version.</p>',
      modifiedAt: '2026-03-20T10:20:00Z',
      size: 25,
    });
    const readFile = vi
      .fn()
      .mockResolvedValueOnce(dirtyTab)
      .mockResolvedValueOnce(freshDiskResponse);
    const saveDialog = vi
      .fn()
      .mockResolvedValue({ path: '/Users/leemoore/code/docs/copy-of-spec.md' });
    const { api, store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      apiOverrides: {
        readFile,
        saveDialog,
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'modified',
    });
    await flushUi();

    getButtonByText('Save Copy').click();
    await flushUi();

    const tab = asTestStore(store)
      .get()
      .tabs.find((candidate) => candidate.path === dirtyTab.path);
    expect(api.saveDialog).toHaveBeenCalledWith({
      defaultPath: '/Users/leemoore/code/docs',
      defaultFilename: 'copy-of-spec.md',
    });
    expect(api.saveFile).toHaveBeenCalledWith({
      path: '/Users/leemoore/code/docs/copy-of-spec.md',
      content: dirtyTab.editContent,
      expectedModifiedAt: undefined,
    });
    expect(api.readFile).toHaveBeenCalledTimes(2);
    expect(tab).toMatchObject({
      content: freshDiskResponse.content,
      editContent: freshDiskResponse.content,
      dirty: false,
      editedSinceLastSave: false,
    });
    expect(asTestStore(store).get().conflictModal).toBeNull();
  });

  it('TC-6.1e: Save Copy cancel returns to modal', async () => {
    const { api, store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: dirtyTab,
      },
      apiOverrides: {
        saveDialog: vi.fn().mockResolvedValue(null),
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'modified',
    });
    await flushUi();

    getButtonByText('Save Copy').click();
    await flushUi();

    expect(api.saveDialog).toHaveBeenCalled();
    expect(api.saveFile).not.toHaveBeenCalled();
    expect(asTestStore(store).get().conflictModal).not.toBeNull();
    expect(getModalTitle()?.textContent).toBe('File changed externally');
  });

  it('TC-6.1f: Save Copy failure returns to modal', async () => {
    const { api, store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: dirtyTab,
      },
      apiOverrides: {
        saveDialog: vi
          .fn()
          .mockResolvedValue({ path: '/Users/leemoore/code/docs/copy-of-spec.md' }),
        saveFile: vi
          .fn()
          .mockRejectedValue(new Error('Could not save copy. Try a different location.')),
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'modified',
    });
    await flushUi();

    getButtonByText('Save Copy').click();
    await flushUi();

    expect(api.saveFile).toHaveBeenCalled();
    expect(asTestStore(store).get().error?.message).toBe(
      'Could not save copy. Try a different location.',
    );
    expect(asTestStore(store).get().conflictModal).not.toBeNull();
    expect(getModalTitle()?.textContent).toBe('File changed externally');
  });

  it('Non-TC: Save Copy aborts if the conflict is dismissed before the dialog resolves', async () => {
    let resolveSaveDialog: ((value: { path: string } | null) => void) | null = null;
    const saveDialog = vi.fn(
      () =>
        new Promise<{ path: string } | null>((resolve) => {
          resolveSaveDialog = resolve;
        }),
    );
    const { api, store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: dirtyTab,
      },
      apiOverrides: {
        saveDialog,
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'modified',
    });
    await flushUi();

    getButtonByText('Save Copy').click();
    await flushUi();

    asTestStore(store).update({ conflictModal: null }, ['conflictModal']);
    resolveSaveDialog?.({ path: '/Users/leemoore/code/docs/copy-of-spec.md' });
    await flushUi();

    expect(api.saveDialog).toHaveBeenCalledTimes(1);
    expect(api.saveFile).not.toHaveBeenCalled();
    expect(api.readFile).toHaveBeenCalledTimes(1);
  });

  it('TC-6.1g: Conflict while in Render mode still shows modal', async () => {
    const { store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyRenderTab.path],
        activeTab: dirtyRenderTab.path,
      },
      readFileOverrides: {
        [dirtyRenderTab.path]: dirtyRenderTab,
      },
    });
    seedTabState(store, dirtyRenderTab.path, {
      mode: 'render',
      editContent: dirtyRenderTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyRenderTab.path,
      event: 'modified',
    });
    await flushUi();

    expect(asTestStore(store).get().conflictModal).toEqual({
      tabId: expect.any(String),
      filename: dirtyRenderTab.filename,
    });
    expect(getModalTitle()?.textContent).toBe('File changed externally');
  });

  it('TC-6.2a: Clean tab auto-reloads without showing a modal', async () => {
    const freshDiskResponse = createFileResponse(cleanTab.path, {
      content: '# README\n\nUpdated externally.',
      html: '<h1>README</h1><p>Updated externally.</p>',
      modifiedAt: '2026-03-20T10:30:00Z',
      size: 30,
    });
    const readFile = vi
      .fn()
      .mockResolvedValueOnce(cleanTab)
      .mockResolvedValueOnce(freshDiskResponse);
    const { api, store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [cleanTab.path],
        activeTab: cleanTab.path,
      },
      apiOverrides: { readFile },
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: cleanTab.path,
      event: 'modified',
    });
    await flushUi();

    const tab = asTestStore(store)
      .get()
      .tabs.find((candidate) => candidate.path === cleanTab.path);
    expect(api.readFile).toHaveBeenCalledTimes(2);
    expect(asTestStore(store).get().conflictModal).toBeNull();
    expect(tab?.content).toBe(freshDiskResponse.content);
  });

  it('TC-6.3a: File deleted while editing preserves local edits', async () => {
    const { store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: dirtyTab,
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'deleted',
    });
    await flushUi();

    const tab = asTestStore(store)
      .get()
      .tabs.find((candidate) => candidate.path === dirtyTab.path);
    expect(tab).toMatchObject({
      status: 'deleted',
      editContent: dirtyTab.editContent,
      dirty: true,
    });
  });

  it('Non-TC: savePending suppresses self-change without modal or reload', async () => {
    const { api, store, wsClient } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: dirtyTab,
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    const wsModule = await import('../../../src/client/utils/ws.js');
    wsModule.markSavePending(dirtyTab.path);
    const readsAfterBootstrap = api.readFile.mock.calls.length;

    wsClient.emit('file-change', {
      type: 'file-change',
      path: dirtyTab.path,
      event: 'modified',
    });
    await flushUi();
    wsModule.clearSavePending(dirtyTab.path);

    expect(api.readFile.mock.calls.length).toBe(readsAfterBootstrap);
    expect(asTestStore(store).get().conflictModal).toBeNull();
    expect(getModalTitle()).toBeNull();
  });
});
