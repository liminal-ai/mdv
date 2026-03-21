// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../src/client/utils/mermaid-renderer.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/client/utils/mermaid-renderer.js')>();
  return {
    ...actual,
    renderMermaidBlocks: vi.fn(actual.renderMermaidBlocks),
  };
});

import { mountContentArea } from '../../../src/client/components/content-area.js';
import { renderMermaidBlocks } from '../../../src/client/utils/mermaid-renderer.js';
import { createStore, getButtonByText } from '../support.js';
import { deletedTab, singleTab } from '../../fixtures/tab-states.js';
import type { RenderWarning } from '../../../src/shared/types.js';

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderContentArea(overrides: Parameters<typeof createStore>[0] = {}) {
  document.body.innerHTML = '<div id="content-area"></div>';

  const store = createStore(overrides);
  const actions = {
    onBrowse: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenRecentFile: vi.fn(),
  };

  const cleanup = mountContentArea(
    document.querySelector<HTMLElement>('#content-area')!,
    store,
    actions,
  );

  return { store, actions, cleanup };
}

describe('content area', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders the empty state with open actions', () => {
    const { actions } = renderContentArea();

    expect(document.body.textContent).toContain('MD Viewer');

    getButtonByText('Open File').click();
    getButtonByText('Open Folder').click();

    expect(actions.onOpenFile).toHaveBeenCalledTimes(1);
    expect(actions.onBrowse).toHaveBeenCalledTimes(1);
  });

  it('renders server-provided HTML for the active tab', () => {
    renderContentArea({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.querySelector('.markdown-body')?.innerHTML).toContain('<h1>README</h1>');
  });

  it('shows a loading state while the active tab is fetching', () => {
    renderContentArea({
      tabs: [{ ...singleTab, loading: true }],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.body.textContent).toContain('Loading readme.md');
    expect(document.querySelector('.content-area__spinner')).not.toBeNull();
  });

  it('replaces the loading state when the tab finishes rendering', () => {
    const { store } = renderContentArea({
      tabs: [{ ...singleTab, loading: true }],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    store.update(
      {
        tabs: [{ ...singleTab, loading: false, html: '<h1>Loaded</h1>' }],
      },
      ['tabs'],
    );

    expect(document.querySelector('.content-area__spinner')).toBeNull();
    expect(document.querySelector('.markdown-body')?.innerHTML).toContain('Loaded');
  });

  it('shows deleted file messaging with last known content', () => {
    renderContentArea({
      tabs: [deletedTab],
      activeTabId: deletedTab.id,
      contentToolbarVisible: true,
    });

    expect(document.body.textContent).toContain('File not found');
    expect(document.querySelector('.markdown-body--muted')?.innerHTML).toContain('<h1>README</h1>');
  });

  it('shows the tab error state when rendering fails', () => {
    renderContentArea({
      tabs: [{ ...singleTab, status: 'error', errorMessage: 'Failed to refresh file' }],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.body.textContent).toContain('Failed to refresh file');
    expect(document.querySelector('.markdown-body')).toBeNull();
  });

  it('renders recent files and opens them from the empty state', () => {
    const { actions } = renderContentArea({
      session: {
        ...createStore().get().session,
        recentFiles: [{ path: '/tmp/docs/guide.md', openedAt: '2026-03-19T00:00:00.000Z' }],
      },
    });

    document.querySelector<HTMLButtonElement>('.content-area__recent-button')?.click();

    expect(actions.onOpenRecentFile).toHaveBeenCalledWith('/tmp/docs/guide.md');
  });

  it('merges server warnings with mermaid warnings instead of replacing or appending stale entries', async () => {
    const existingWarnings: RenderWarning[] = [
      {
        type: 'missing-image',
        source: './missing-one.png',
        message: 'Missing image: ./missing-one.png',
      },
      {
        type: 'missing-image',
        source: './missing-two.png',
        message: 'Missing image: ./missing-two.png',
      },
    ];
    vi.mocked(renderMermaidBlocks).mockResolvedValue({
      warnings: [
        {
          type: 'mermaid-error',
          source: 'graph TD\nA -->',
          message: 'Parse error on line 1',
        },
      ],
    });

    const { store } = renderContentArea({
      tabs: [{ ...singleTab, warnings: existingWarnings }],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    await flushAsyncWork();

    expect(store.get().tabs[0]?.warnings).toEqual([
      existingWarnings[0],
      existingWarnings[1],
      expect.objectContaining({
        type: 'mermaid-error',
        message: 'Parse error on line 1',
      }),
    ]);
  });

  it('ignores stale mermaid warning writes after same-tab content refreshes', async () => {
    const staleRender = createDeferred<{ warnings: RenderWarning[] }>();
    const serverWarnings: RenderWarning[] = [
      {
        type: 'missing-image',
        source: './missing-one.png',
        message: 'Missing image: ./missing-one.png',
      },
      {
        type: 'missing-image',
        source: './missing-two.png',
        message: 'Missing image: ./missing-two.png',
      },
    ];
    const staleWarning: RenderWarning = {
      type: 'mermaid-error',
      source: 'old graph',
      message: 'Old parse error',
    };
    const freshWarning: RenderWarning = {
      type: 'mermaid-error',
      source: 'new graph',
      message: 'Fresh parse error',
    };

    vi.mocked(renderMermaidBlocks)
      .mockImplementationOnce(() => staleRender.promise)
      .mockResolvedValue({ warnings: [freshWarning] });

    const { store } = renderContentArea({
      tabs: [{ ...singleTab, warnings: serverWarnings, renderGeneration: 0 }],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    await flushAsyncWork();

    store.update(
      {
        tabs: [
          {
            ...singleTab,
            html: '<h1>Fresh</h1>',
            warnings: serverWarnings,
            renderGeneration: 1,
          },
        ],
      },
      ['tabs'],
    );

    await flushAsyncWork();
    staleRender.resolve({ warnings: [staleWarning] });
    await flushAsyncWork();

    expect(store.get().tabs[0]?.warnings).toEqual([
      serverWarnings[0],
      serverWarnings[1],
      freshWarning,
    ]);
  });
});
