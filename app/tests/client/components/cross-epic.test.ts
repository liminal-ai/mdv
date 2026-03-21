// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../src/client/api.js';
import type { ClientState, TabState } from '../../../src/client/state.js';
import { cleanTab, dirtyTab, saveResponse } from '../../fixtures/edit-samples.js';
import { emptySession } from '../../fixtures/session.js';

interface MockEditorOptions {
  onContentChange: (content: string) => void;
  onCursorChange: (line: number, column: number) => void;
  shouldSuppressUpdates: () => boolean;
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
        shouldSuppressUpdates: options.shouldSuppressUpdates,
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
  const editor = editorRecords.at(-1);
  if (!editor) {
    throw new Error('Expected an editor instance');
  }
  return editor;
}

type TestState = Pick<ClientState, 'tabs' | 'error' | 'exportDirtyWarning'>;
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
    exportDocument: vi.fn().mockResolvedValue({
      status: 'success',
      outputPath: '/Users/leemoore/code/exports/spec.pdf',
      warnings: [],
    }),
    exportSaveDialog: vi.fn().mockResolvedValue({ path: '/Users/leemoore/code/exports/spec.pdf' }),
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

function openToolbarExportMenu(): void {
  document.querySelector<HTMLButtonElement>('.export-dropdown .content-toolbar__button')?.click();
}

describe('cross-epic integration', () => {
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

  it('TC-8.1a: Export with dirty tab shows warning', async () => {
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

    openToolbarExportMenu();
    getButtonByText('PDF').click();
    await flushUi();

    expect(asTestStore(store).get().exportDirtyWarning).toEqual({
      tabId: expect.any(String),
      format: 'pdf',
    });
    expect(api.exportSaveDialog).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('This file has unsaved changes.');
    expect(document.body.textContent).toContain('Save and Export');
    expect(document.body.textContent).toContain('Export Anyway');
  });

  it('TC-8.1b: Save and Export', async () => {
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

    openToolbarExportMenu();
    getButtonByText('PDF').click();
    await flushUi();

    getButtonByText('Save and Export').click();
    await flushUi();
    await flushUi();

    expect(api.saveFile).toHaveBeenCalledWith({
      path: dirtyTab.path,
      content: dirtyTab.editContent,
      expectedModifiedAt: dirtyTab.modifiedAt,
    });
    expect(api.exportSaveDialog).toHaveBeenCalled();
    expect(api.exportDocument).toHaveBeenCalledTimes(1);
    expect(asTestStore(store).get().exportDirtyWarning).toBeNull();
  });

  it('TC-8.1c: Export Anyway', async () => {
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

    openToolbarExportMenu();
    getButtonByText('PDF').click();
    await flushUi();

    getButtonByText('Export Anyway').click();
    await flushUi();
    await flushUi();

    expect(api.saveFile).not.toHaveBeenCalled();
    expect(api.exportSaveDialog).toHaveBeenCalled();
    expect(api.exportDocument).toHaveBeenCalledTimes(1);
    expect(asTestStore(store).get().tabs[0]?.dirty).toBe(true);
    expect(asTestStore(store).get().exportDirtyWarning).toBeNull();
  });

  it('TC-8.2a: File menu has Save with shortcut', async () => {
    await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
      readFileOverrides: { [dirtyTab.path]: { mode: 'edit' } },
    });

    getButtonByText('File').click();

    const saveButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Save') && !button.textContent?.includes('Save As'),
    );

    expect(saveButton).toBeDefined();
    expect(saveButton?.textContent).toContain('Cmd+S');
  });

  it('TC-8.2b: Save As always enabled', async () => {
    await renderApp({
      sessionOverrides: { openTabs: [cleanTab.path], activeTab: cleanTab.path },
    });

    getButtonByText('File').click();
    const saveAsButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Save As'),
    );

    expect(saveAsButton).toBeDefined();
    expect(saveAsButton?.disabled).toBe(false);
    expect(saveAsButton?.textContent).toContain('Cmd+Shift+S');
  });

  it('TC-10.1a: Save failure preserves editor content', async () => {
    const saveError = new ApiError(403, 'PERMISSION_DENIED', 'Permission denied');
    const { api, store } = await renderApp({
      sessionOverrides: { openTabs: [dirtyTab.path], activeTab: dirtyTab.path },
      readFileOverrides: { [dirtyTab.path]: { mode: 'edit' } },
      apiOverrides: {
        saveFile: vi.fn().mockRejectedValue(saveError),
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
      modifiedAt: dirtyTab.modifiedAt,
    });
    await flushUi();

    const editor = getLatestEditor();
    editor.options.onContentChange(dirtyTab.editContent!);
    await flushUi();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(api.saveFile).toHaveBeenCalledTimes(1);
    expect(asTestStore(store).get().tabs[0]).toMatchObject({
      editContent: dirtyTab.editContent,
      dirty: true,
    });
    expect(editor.getContent()).toBe(dirtyTab.editContent);
  });

  it('TC-10.2a: Large file in editor', async () => {
    const largeMarkdown = Array.from({ length: 10_000 }, (_, index) => `Line ${index + 1}`).join(
      '\n',
    );

    await renderApp({
      sessionOverrides: {
        defaultOpenMode: 'edit',
        openTabs: ['/Users/leemoore/code/docs/large.md'],
        activeTab: '/Users/leemoore/code/docs/large.md',
      },
      readFileOverrides: {
        '/Users/leemoore/code/docs/large.md': {
          mode: 'edit',
          content: largeMarkdown,
          html: '<p>Large</p>',
        },
      },
    });
    await flushUi();

    const editor = getLatestEditor();
    expect(editor.setContent).toHaveBeenCalledWith(largeMarkdown);
    expect(document.querySelector('.editor-container')).not.toBeNull();
  });

  it('TC-10.2b: Binary content in editor', async () => {
    const { store } = await renderApp({
      sessionOverrides: {
        openTabs: ['/Users/leemoore/code/docs/binary.md'],
        activeTab: '/Users/leemoore/code/docs/binary.md',
      },
    });
    seedTabState(store, '/Users/leemoore/code/docs/binary.md', {
      status: 'error',
      errorMessage: 'This file does not contain valid markdown text.',
      mode: 'edit',
    });
    await flushUi();

    expect(document.querySelector('.content-area__error')?.textContent ?? '').toContain(
      'This file does not contain valid markdown text.',
    );
    expect(document.querySelector('.editor-container')).toBeNull();
  });
});
