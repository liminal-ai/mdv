// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        onCursorChange: (line: number, column: number) => {
          options.onCursorChange(line, column);
        },
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
      setScrollTop: vi.fn((nextScrollTop: number) => {
        scrollTop = nextScrollTop;
      }),
      scrollToPercentage: vi.fn((nextPercentage: number) => {
        scrollPercentage = nextPercentage;
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

import { mountContentArea } from '../../../src/client/components/content-area.js';
import { mountContentToolbar } from '../../../src/client/components/content-toolbar.js';
import { createStore } from '../support.js';
import { cleanTab } from '../../fixtures/edit-samples.js';

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

function renderEditorApp(overrides: Parameters<typeof createStore>[0] = {}) {
  document.body.innerHTML = `
    <div id="content-toolbar"></div>
    <div id="content-area"></div>
  `;

  const store = createStore({
    tabs: [{ ...cleanTab, mode: 'edit' as const }],
    activeTabId: cleanTab.id,
    contentToolbarVisible: true,
    ...overrides,
  });

  const toolbarActions = {
    onSetDefaultMode: vi.fn(),
    onExportFormat: vi.fn(),
  };

  const contentAreaActions = {
    onBrowse: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenRecentFile: vi.fn(),
    onRenderContent: vi.fn(async (content: string) => ({
      html: `<p>${content}</p>`,
      warnings: [],
    })),
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

  return {
    store,
    toolbarActions,
    contentAreaActions,
    cleanup: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

describe('editor integration', () => {
  beforeEach(() => {
    editorRecords.length = 0;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    editorRecords.length = 0;
  });

  it('TC-2.1a: displays the editor with markdown content in edit mode', async () => {
    renderEditorApp({
      tabs: [
        {
          ...cleanTab,
          mode: 'edit',
          content: '# Heading\n\nParagraph with **bold** text.',
        },
      ],
      activeTabId: cleanTab.id,
    });

    await flushUi();

    const editor = getLatestEditor();
    const editorContainer = document.querySelector<HTMLElement>('.editor-container');

    expect(editor.setContent).toHaveBeenCalledWith('# Heading\n\nParagraph with **bold** text.');
    expect(editorContainer?.hidden).toBe(false);
  });

  it('TC-2.1b: creates the editor in edit mode so line numbers can render', async () => {
    renderEditorApp();

    await flushUi();

    expect(editorRecords).toHaveLength(1);
  });

  it('TC-2.1c: shows the cursor position in the toolbar status area', async () => {
    renderEditorApp({
      tabs: [{ ...cleanTab, mode: 'edit', cursorPosition: { line: 42, column: 15 } }],
      activeTabId: cleanTab.id,
    });

    await flushUi();

    expect(document.querySelector('.cursor-position')?.textContent).toBe('Ln 42, Col 15');
  });

  it('TC-2.1d: updates the cursor position display when the cursor moves', async () => {
    const { store } = renderEditorApp();

    await flushUi();

    getLatestEditor().options.onCursorChange(7, 9);
    await flushUi();

    expect(store.get().tabs[0]?.cursorPosition).toEqual({ line: 7, column: 9 });
    expect(document.querySelector('.cursor-position')?.textContent).toBe('Ln 7, Col 9');
  });

  it('TC-2.2a: marks the tab dirty after typing in the editor', async () => {
    const { store } = renderEditorApp();

    await flushUi();

    getLatestEditor().options.onContentChange('# README\n\nUpdated content.');
    await flushUi();

    expect(store.get().tabs[0]).toMatchObject({
      editContent: '# README\n\nUpdated content.',
      dirty: true,
      editedSinceLastSave: true,
    });
  });

  it('TC-2.2e: clears dirty state when content returns to the saved version', async () => {
    const { store } = renderEditorApp({
      tabs: [
        {
          ...cleanTab,
          mode: 'edit',
          content: '# README',
          editContent: '# README\n\nChanged',
          dirty: true,
          editedSinceLastSave: true,
        },
      ],
      activeTabId: cleanTab.id,
    });

    await flushUi();

    getLatestEditor().options.onContentChange('# README');
    await flushUi();

    expect(store.get().tabs[0]).toMatchObject({
      editContent: '# README',
      dirty: false,
      editedSinceLastSave: false,
    });
  });

  it('TC-2.3a: creates the editor when a light theme is active', async () => {
    renderEditorApp({
      session: {
        ...createStore().get().session,
        theme: 'light-default',
      },
    });

    await flushUi();

    expect(editorRecords).toHaveLength(1);
  });

  it('TC-2.3b: creates the editor when a dark theme is active', async () => {
    renderEditorApp({
      session: {
        ...createStore().get().session,
        theme: 'dark-default',
      },
    });

    await flushUi();

    expect(editorRecords).toHaveLength(1);
  });

  it('TC-2.3c: preserves content and cursor state across theme switches', async () => {
    const { store } = renderEditorApp();

    await flushUi();

    const editor = getLatestEditor();
    editor.options.onContentChange('# README\n\nEditing in progress.');
    editor.options.onCursorChange(12, 4);
    await flushUi();

    store.update(
      {
        session: {
          ...store.get().session,
          theme: 'dark-default',
        },
      },
      ['session'],
    );
    await flushUi();

    expect(store.get().tabs[0]?.editContent).toBe('# README\n\nEditing in progress.');
    expect(store.get().tabs[0]?.cursorPosition).toEqual({ line: 12, column: 4 });
    expect(document.querySelector('.cursor-position')?.textContent).toBe('Ln 12, Col 4');
  });

  it('TC-2.4a: restores the saved edit scroll position when returning to a tab', async () => {
    const firstTab = { ...cleanTab, id: 'tab-a', mode: 'edit' as const };
    const secondTab = { ...cleanTab, id: 'tab-b', filename: 'other.md', path: '/other.md' };
    const { store } = renderEditorApp({
      tabs: [firstTab, secondTab],
      activeTabId: firstTab.id,
    });

    await flushUi();

    const firstEditor = getLatestEditor();
    firstEditor.getScrollTop.mockReturnValue(240);

    store.update({ activeTabId: secondTab.id }, ['activeTabId']);
    await flushUi();

    expect(store.get().tabs.find((tab) => tab.id === firstTab.id)?.editScrollPosition).toBe(240);

    store.update({ activeTabId: firstTab.id }, ['activeTabId']);
    await flushUi();

    expect(getLatestEditor().setScrollTop).toHaveBeenCalledWith(240);
  });

  it('TC-2.4b: maps render scroll to editor scroll on mode switch and bumps render generation', async () => {
    const { store } = renderEditorApp({
      tabs: [{ ...cleanTab, mode: 'render', renderGeneration: 2 }],
      activeTabId: cleanTab.id,
    });

    await flushUi();

    const contentBody = document.querySelector<HTMLElement>('.content-area__body');
    if (!contentBody) {
      throw new Error('Expected content body');
    }

    Object.defineProperty(contentBody, 'clientHeight', {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(contentBody, 'scrollHeight', {
      configurable: true,
      value: 1200,
    });
    contentBody.scrollTop = 400;

    const editButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.mode-toggle button'),
    ).find((button) => button.textContent === 'Edit');
    editButton?.click();
    await flushUi();

    expect(store.get().tabs[0]?.renderGeneration).toBe(3);
    expect(getLatestEditor().scrollToPercentage).toHaveBeenCalledWith(0.5);
  });
});
