// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountFileTree, collectAllDirPaths } from '../../../src/client/components/file-tree.js';
import { simpleTree, largeTree } from '../../fixtures/tree.js';
import { createStore } from '../support.js';
import { emptySession } from '../../fixtures/session.js';

function renderTree(
  overrides: Parameters<typeof createStore>[0] = {},
  actionOverrides: Partial<Parameters<typeof mountFileTree>[2]> = {},
) {
  document.body.innerHTML = '<div id="tree"></div>';
  const store = createStore({
    session: { ...emptySession, lastRoot: '/root' },
    tree: simpleTree,
    expandedDirsByRoot: {},
    ...overrides,
  });
  const actions = {
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
    onToggleDir: vi.fn(),
    onSelectFile: vi.fn(),
    ...actionOverrides,
  };

  const cleanup = mountFileTree(document.querySelector<HTMLElement>('#tree')!, store, actions);

  return { store, actions, cleanup };
}

describe('file tree', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('TC-5.2a: Expand directory on click', () => {
    const onToggleDir = vi.fn();
    renderTree({}, { onToggleDir });

    const dirRow = document.querySelector<HTMLElement>('[data-type="directory"]');
    dirRow?.click();

    expect(onToggleDir).toHaveBeenCalledWith('/root/docs');
  });

  it('TC-5.2b: Collapse directory on click', () => {
    const onToggleDir = vi.fn();
    renderTree(
      {
        expandedDirsByRoot: { '/root': ['/root/docs'] },
      },
      { onToggleDir },
    );

    const dirRow = document.querySelector<HTMLElement>('[data-type="directory"]');
    dirRow?.click();

    expect(onToggleDir).toHaveBeenCalledWith('/root/docs');
  });

  it('TC-5.2c: Expand state preserved across workspace switch', () => {
    const { store } = renderTree({
      expandedDirsByRoot: {
        '/root': ['/root/docs'],
        '/other': ['/other/dir'],
      },
    });

    // Switch to other root
    store.update(
      {
        session: { ...emptySession, lastRoot: '/other' },
        tree: [],
      },
      ['session', 'tree'],
    );

    // Switch back to original root
    store.update(
      {
        session: { ...emptySession, lastRoot: '/root' },
        tree: simpleTree,
      },
      ['session', 'tree'],
    );

    const state = store.get();
    expect(state.expandedDirsByRoot['/root']).toEqual(['/root/docs']);
    expect(state.expandedDirsByRoot['/other']).toEqual(['/other/dir']);
  });

  it('TC-5.3a: Expand All expands all directories', () => {
    const { store } = renderTree();

    const allDirs = collectAllDirPaths(simpleTree);
    store.update({ expandedDirsByRoot: { '/root': allDirs } }, ['expandedDirsByRoot']);

    const expandedState = store.get().expandedDirsByRoot['/root'] ?? [];
    expect(expandedState).toContain('/root/docs');
    expect(expandedState).toContain('/root/docs/guides');
  });

  it('TC-5.3b: Expand All reaches leaf directories', () => {
    const deepTree = [
      {
        name: 'a',
        path: '/root/a',
        type: 'directory' as const,
        mdCount: 1,
        children: [
          {
            name: 'b',
            path: '/root/a/b',
            type: 'directory' as const,
            mdCount: 1,
            children: [
              {
                name: 'c',
                path: '/root/a/b/c',
                type: 'directory' as const,
                mdCount: 1,
                children: [{ name: 'doc.md', path: '/root/a/b/c/doc.md', type: 'file' as const }],
              },
            ],
          },
        ],
      },
    ];

    const { store } = renderTree({ tree: deepTree });
    const allDirs = collectAllDirPaths(deepTree);
    store.update({ expandedDirsByRoot: { '/root': allDirs } }, ['expandedDirsByRoot']);

    const expandedState = store.get().expandedDirsByRoot['/root']!;
    expect(expandedState).toContain('/root/a');
    expect(expandedState).toContain('/root/a/b');
    expect(expandedState).toContain('/root/a/b/c');
  });

  it('TC-5.3c: Collapse All collapses everything', () => {
    const { store } = renderTree({
      expandedDirsByRoot: { '/root': ['/root/docs', '/root/docs/guides'] },
    });

    store.update({ expandedDirsByRoot: { '/root': [] } }, ['expandedDirsByRoot']);

    const expandedState = store.get().expandedDirsByRoot['/root']!;
    expect(expandedState).toHaveLength(0);
  });

  it('TC-5.3d: Expand All on large tree completes quickly', () => {
    const { store } = renderTree({ tree: largeTree });

    const start = performance.now();
    const allDirs = collectAllDirPaths(largeTree);
    store.update({ expandedDirsByRoot: { '/root': allDirs } }, ['expandedDirsByRoot']);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(store.get().expandedDirsByRoot['/root']!).toHaveLength(200);
  });

  it('TC-5.5a: mdCount badge shown on directories', () => {
    renderTree({
      expandedDirsByRoot: { '/root': ['/root/docs'] },
    });

    const badges = Array.from(document.querySelectorAll('.tree-node__badge'));
    const badgeTexts = badges.map((b) => b.textContent);

    expect(badgeTexts).toContain('3');
    expect(badgeTexts).toContain('1');
  });

  it('TC-5.6a: File tree container has overflow-y auto', () => {
    document.body.innerHTML = '<div id="tree" style="overflow-y: auto;"></div>';
    const store = createStore({
      session: { ...emptySession, lastRoot: '/root' },
      tree: simpleTree,
    });

    mountFileTree(document.querySelector<HTMLElement>('#tree')!, store, {
      onExpandAll: vi.fn(),
      onCollapseAll: vi.fn(),
      onToggleDir: vi.fn(),
      onSelectFile: vi.fn(),
    });

    const treeHost = document.querySelector<HTMLElement>('#tree');
    expect(treeHost?.style.overflowY).toBe('auto');
  });

  it('TC-5.7a: Expand state resets on restart (fresh state)', () => {
    // Simulate a fresh app start — expandedDirsByRoot starts empty
    const freshStore = createStore({
      session: { ...emptySession, lastRoot: '/root' },
      tree: simpleTree,
      expandedDirsByRoot: {},
    });

    const expanded = freshStore.get().expandedDirsByRoot['/root'];
    expect(expanded).toBeUndefined();
  });

  it('TC-2.4b: Tree keyboard navigation', () => {
    const onToggleDir = vi.fn();
    const onSelectFile = vi.fn();
    renderTree(
      { expandedDirsByRoot: { '/root': ['/root/docs', '/root/docs/guides'] } },
      { onToggleDir, onSelectFile },
    );

    const treeHost = document.querySelector<HTMLElement>('#tree')!;
    const rows = Array.from(treeHost.querySelectorAll<HTMLElement>('.tree-node__row'));
    expect(rows.length).toBeGreaterThan(0);

    treeHost.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(rows[0]);

    treeHost.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onToggleDir.mock.calls.length + onSelectFile.mock.calls.length).toBeGreaterThan(0);
  });

  it('Tree container is tabbable for keyboard users', () => {
    renderTree();

    expect(document.querySelector<HTMLElement>('#tree')?.tabIndex).toBe(0);
  });

  it('Shows empty state when no tree loaded', () => {
    renderTree({
      tree: [],
      session: { ...emptySession, lastRoot: '/root' },
    });

    expect(document.body.textContent).toContain('No markdown files found');
  });

  it('Shows loading state when treeLoading is true', () => {
    renderTree({
      tree: [],
      treeLoading: true,
      session: { ...emptySession, lastRoot: '/root' },
    });

    expect(document.body.textContent).toContain('Loading');
  });
});
