// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

type TestState = Pick<ClientState, 'tabs' | 'error' | 'unsavedModal'>;
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

function getModalTitle(): HTMLElement | null {
  return document.querySelector('.modal__title');
}

function getButtonByText(text: string): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  const match = buttons.find((button) => button.textContent?.includes(text));

  if (!match) {
    throw new Error(`Button not found: ${text}`);
  }

  return match;
}

function getTabLabels(): string[] {
  return Array.from(document.querySelectorAll('.tab__label')).map(
    (element) => element.textContent ?? '',
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

function tabButtonLabel(filename: string): string {
  return `Close ${filename}`;
}

function getTabCloseButton(filename: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${tabButtonLabel(filename)}"]`,
  );

  if (!button) {
    throw new Error(`Close button not found for ${filename}`);
  }

  return button;
}

function getTabElementByFilename(filename: string): HTMLElement {
  const element = Array.from(document.querySelectorAll<HTMLElement>('.tab')).find((candidate) =>
    candidate.querySelector('.tab__label')?.textContent?.includes(filename),
  );
  if (!element) {
    throw new Error(`Tab not found for ${filename}`);
  }

  return element;
}

function getContextMenuButton(text: string): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.context-menu__item'));
  const match = buttons.find((button) => button.textContent?.includes(text));

  if (!match) {
    throw new Error(`Context menu item not found: ${text}`);
  }

  return match;
}

describe('unsaved changes protection', () => {
  beforeEach(() => {
    editorRecords.length = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-5.1a: Close dirty tab shows modal', async () => {
    const { store } = await renderApp({
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

    getTabCloseButton(dirtyTab.filename).click();
    await flushUi();

    expect(getModalTitle()).not.toBeNull();
    expect(getModalTitle()?.textContent ?? '').toContain('Unsaved changes');
    expect(document.body.textContent).toContain(
      `You have unsaved changes in ${dirtyTab.filename}.`,
    );
    expect(getButtonByText('Save and Close')).toBeDefined();
    expect(getButtonByText('Discard Changes')).toBeDefined();
    expect(getButtonByText('Cancel')).toBeDefined();
  });

  it('TC-5.1b: Save and Close saves then closes the tab', async () => {
    const { api, store } = await renderApp({
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

    getTabCloseButton(dirtyTab.filename).click();
    await flushUi();
    getButtonByText('Save and Close').click();
    await flushUi();

    expect(api.saveFile).toHaveBeenCalledTimes(1);
    expect(getTabLabels()).toEqual([]);
  });

  it('TC-5.1c: Discard Changes closes without saving', async () => {
    const { api, store } = await renderApp({
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

    getTabCloseButton(dirtyTab.filename).click();
    await flushUi();
    getButtonByText('Discard Changes').click();
    await flushUi();

    expect(api.saveFile).not.toHaveBeenCalled();
    expect(getTabLabels()).toEqual([]);
  });

  it('TC-5.1d: Cancel keeps the dirty tab open', async () => {
    const { store } = await renderApp({
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

    getTabCloseButton(dirtyTab.filename).click();
    await flushUi();
    getButtonByText('Cancel').click();
    await flushUi();

    expect(getModalTitle()).toBeNull();
    expect(getTabLabels()).toEqual([dirtyTab.filename]);
  });

  it('TC-5.1e: Close clean tab skips the modal', async () => {
    await renderApp({
      sessionOverrides: {
        openTabs: [cleanTab.path],
        activeTab: cleanTab.path,
      },
    });

    getTabCloseButton(cleanTab.filename).click();
    await flushUi();

    expect(getModalTitle()).toBeNull();
    expect(getTabLabels()).toEqual([]);
  });

  it('TC-5.1f: Cmd+W on dirty tab shows modal', async () => {
    const { store } = await renderApp({
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

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'w', metaKey: true, bubbles: true }),
    );
    await flushUi();

    expect(getModalTitle()).not.toBeNull();
    expect(getModalTitle()?.textContent ?? '').toContain('Unsaved changes');
  });

  it('TC-5.2a: Close Others prompts sequentially for dirty tabs', async () => {
    const tabA = {
      ...dirtyTab,
      id: 'tab-a',
      path: '/a.md',
      canonicalPath: '/a.md',
      filename: 'a.md',
    };
    const tabB = {
      ...cleanTab,
      id: 'tab-b',
      path: '/b.md',
      canonicalPath: '/b.md',
      filename: 'b.md',
    };
    const tabC = {
      ...dirtyTab,
      id: 'tab-c',
      path: '/c.md',
      canonicalPath: '/c.md',
      filename: 'c.md',
    };
    const { store } = await renderApp({
      sessionOverrides: {
        openTabs: [tabA.path, tabB.path, tabC.path],
        activeTab: tabB.path,
      },
      readFileOverrides: {
        [tabA.path]: tabA,
        [tabB.path]: tabB,
        [tabC.path]: tabC,
      },
    });
    seedTabState(store, tabA.path, {
      mode: 'edit',
      editContent: tabA.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    seedTabState(store, tabC.path, {
      mode: 'edit',
      editContent: tabC.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    getTabElementByFilename(tabB.filename).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }),
    );
    await flushUi();
    getContextMenuButton('Close Others').click();
    await flushUi();

    expect(document.body.textContent).toContain('a.md');
    getButtonByText('Discard Changes').click();
    await flushUi();

    expect(document.body.textContent).toContain('c.md');
    getButtonByText('Discard Changes').click();
    await flushUi();

    expect(getTabLabels()).toEqual(['b.md']);
  });

  it('TC-5.2b: Close Tabs to the Right prompts for dirty tabs', async () => {
    const tabA = {
      ...cleanTab,
      id: 'tab-a',
      path: '/a.md',
      canonicalPath: '/a.md',
      filename: 'a.md',
    };
    const tabB = {
      ...dirtyTab,
      id: 'tab-b',
      path: '/b.md',
      canonicalPath: '/b.md',
      filename: 'b.md',
    };
    const tabC = {
      ...cleanTab,
      id: 'tab-c',
      path: '/c.md',
      canonicalPath: '/c.md',
      filename: 'c.md',
    };
    const { store } = await renderApp({
      sessionOverrides: {
        openTabs: [tabA.path, tabB.path, tabC.path],
        activeTab: tabA.path,
      },
      readFileOverrides: {
        [tabA.path]: tabA,
        [tabB.path]: tabB,
        [tabC.path]: tabC,
      },
    });
    seedTabState(store, tabB.path, {
      mode: 'edit',
      editContent: tabB.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    getTabElementByFilename(tabA.filename).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }),
    );
    await flushUi();
    getContextMenuButton('Close Tabs to the Right').click();
    await flushUi();

    expect(document.body.textContent).toContain('b.md');
    getButtonByText('Discard Changes').click();
    await flushUi();

    expect(getTabLabels()).toEqual(['a.md']);
  });

  it('TC-5.3e: Dirty tabs register beforeunload protection', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const { store } = await renderApp({
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

    expect(addEventListenerSpy.mock.calls.some(([eventName]) => eventName === 'beforeunload')).toBe(
      true,
    );
  });

  it('TC-5.3f: Clean tabs do not register beforeunload protection', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    await renderApp({
      sessionOverrides: {
        openTabs: [cleanTab.path],
        activeTab: cleanTab.path,
      },
    });

    expect(addEventListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('Non-TC: Cancel during Close Others stops remaining tab closes', async () => {
    const tabA = {
      ...dirtyTab,
      id: 'tab-a',
      path: '/a.md',
      canonicalPath: '/a.md',
      filename: 'a.md',
    };
    const tabB = {
      ...cleanTab,
      id: 'tab-b',
      path: '/b.md',
      canonicalPath: '/b.md',
      filename: 'b.md',
    };
    const tabC = {
      ...dirtyTab,
      id: 'tab-c',
      path: '/c.md',
      canonicalPath: '/c.md',
      filename: 'c.md',
    };
    const { store } = await renderApp({
      sessionOverrides: {
        openTabs: [tabA.path, tabB.path, tabC.path],
        activeTab: tabB.path,
      },
      readFileOverrides: {
        [tabA.path]: tabA,
        [tabB.path]: tabB,
        [tabC.path]: tabC,
      },
    });
    seedTabState(store, tabA.path, {
      mode: 'edit',
      editContent: tabA.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    seedTabState(store, tabC.path, {
      mode: 'edit',
      editContent: tabC.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    getTabElementByFilename(tabB.filename).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }),
    );
    await flushUi();
    getContextMenuButton('Close Others').click();
    await flushUi();
    getButtonByText('Cancel').click();
    await flushUi();

    expect(getTabLabels()).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('Non-TC: Save failure during close keeps the tab open and shows an error', async () => {
    const saveError = new Error('Save failed');
    const { api, store } = await renderApp({
      sessionOverrides: {
        openTabs: [dirtyTab.path],
        activeTab: dirtyTab.path,
      },
      readFileOverrides: {
        [dirtyTab.path]: dirtyTab,
      },
      apiOverrides: {
        saveFile: vi.fn().mockRejectedValue(saveError),
      },
    });
    seedTabState(store, dirtyTab.path, {
      mode: 'edit',
      editContent: dirtyTab.editContent,
      dirty: true,
      editedSinceLastSave: true,
    });
    await flushUi();

    getTabCloseButton(dirtyTab.filename).click();
    await flushUi();
    getButtonByText('Save and Close').click();
    await flushUi();

    expect(api.saveFile).toHaveBeenCalledTimes(1);
    expect(getTabLabels()).toEqual([dirtyTab.filename]);
    expect(document.body.textContent).toContain('Save failed');
  });
});
