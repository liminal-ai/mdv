// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountContentArea } from '../../../src/client/components/content-area.js';
import { createStore, getButtonByText } from '../support.js';
import { deletedTab, singleTab } from '../../fixtures/tab-states.js';

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
});
