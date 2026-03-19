// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSidebar } from '../../../src/client/components/sidebar.js';
import { simpleTree } from '../../fixtures/tree.js';
import { emptySession } from '../../fixtures/session.js';
import { createStore, getButtonByText } from '../support.js';

function renderSidebar(overrides: Parameters<typeof createStore>[0] = {}) {
  document.body.innerHTML = '<div id="sidebar"></div>';
  const store = createStore({
    session: { ...emptySession, lastRoot: '/root' },
    tree: simpleTree,
    expandedDirsByRoot: {},
    ...overrides,
  });
  const actions = {
    onToggleWorkspacesCollapsed: vi.fn(),
    onSwitchRoot: vi.fn(),
    onRemoveWorkspace: vi.fn(),
    onBrowse: vi.fn(),
    onPin: vi.fn(),
    onCopy: vi.fn(),
    onRefresh: vi.fn(),
  };

  const cleanup = mountSidebar(document.querySelector<HTMLElement>('#sidebar')!, store, actions);

  return { store, actions, cleanup };
}

describe('sidebar tree integration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Expand All button expands all directories', () => {
    const { store } = renderSidebar();

    const expandBtn = getButtonByText('Expand All');
    expandBtn.click();

    const expanded = store.get().expandedDirsByRoot['/root'] ?? [];
    expect(expanded).toContain('/root/docs');
    expect(expanded).toContain('/root/docs/guides');
  });

  it('Collapse All button collapses all directories', () => {
    const { store } = renderSidebar({
      expandedDirsByRoot: { '/root': ['/root/docs', '/root/docs/guides'] },
    });

    const collapseBtn = getButtonByText('Collapse All');
    collapseBtn.click();

    const expanded = store.get().expandedDirsByRoot['/root'] ?? [];
    expect(expanded).toHaveLength(0);
  });

  it('Clicking directory toggles expand state', () => {
    const { store } = renderSidebar();

    const dirRow = document.querySelector<HTMLElement>('[data-type="directory"]');
    dirRow?.click();

    const expanded = store.get().expandedDirsByRoot['/root'] ?? [];
    expect(expanded).toContain('/root/docs');
  });

  it('FILES header and buttons are present', () => {
    renderSidebar();

    expect(document.body.textContent).toContain('FILES');
    expect(document.querySelector('.sidebar__files-action')).not.toBeNull();
  });

  it('TC-9.1a: Sidebar browse icon triggers root update', () => {
    const { actions } = renderSidebar();

    document.querySelector<HTMLButtonElement>('.root-line__browse')?.click();

    expect(actions.onBrowse).toHaveBeenCalledTimes(1);
  });
});
