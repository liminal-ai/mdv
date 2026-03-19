import type { StateStore } from '../state.js';
import { collectAllDirPaths, mountFileTree } from './file-tree.js';
import { mountRootLine, type RootLineActions } from './root-line.js';
import { mountWorkspaces, type WorkspacesActions } from './workspaces.js';
import { createElement } from '../utils/dom.js';

export interface SidebarActions
  extends RootLineActions, Omit<WorkspacesActions, 'onToggleCollapsed'> {
  onToggleWorkspacesCollapsed: () => void;
}

export function mountSidebar(
  container: HTMLElement,
  store: StateStore,
  actions: SidebarActions,
): () => void {
  const workspacesHost = createElement('div', { className: 'sidebar__workspaces' });
  const rootLineHost = createElement('div', { className: 'sidebar__root-line' });

  const expandAllBtn = createElement('button', {
    className: 'sidebar__files-action',
    text: 'Expand All',
    attrs: { type: 'button', title: 'Expand all directories' },
    on: {
      click: () => {
        const state = store.get();
        const root = state.session.lastRoot;
        if (!root || !state.tree.length) return;
        const allDirs = collectAllDirPaths(state.tree);
        store.update(
          {
            expandedDirsByRoot: {
              ...state.expandedDirsByRoot,
              [root]: allDirs,
            },
          },
          ['expandedDirsByRoot'],
        );
      },
    },
  });

  const collapseAllBtn = createElement('button', {
    className: 'sidebar__files-action',
    text: 'Collapse All',
    attrs: { type: 'button', title: 'Collapse all directories' },
    on: {
      click: () => {
        const state = store.get();
        const root = state.session.lastRoot;
        if (!root) return;
        store.update(
          {
            expandedDirsByRoot: {
              ...state.expandedDirsByRoot,
              [root]: [],
            },
          },
          ['expandedDirsByRoot'],
        );
      },
    },
  });

  const filesHeader = createElement('div', {
    className: 'sidebar__files-header',
    children: [
      createElement('span', { text: 'FILES' }),
      createElement('div', {
        className: 'sidebar__files-actions',
        children: [expandAllBtn, collapseAllBtn],
      }),
    ],
  });

  const treeHost = createElement('div', { className: 'sidebar__tree' });

  container.replaceChildren(workspacesHost, rootLineHost, filesHeader, treeHost);

  const cleanupWorkspaces = mountWorkspaces(workspacesHost, store, {
    onToggleCollapsed: actions.onToggleWorkspacesCollapsed,
    onSwitchRoot: actions.onSwitchRoot,
    onRemoveWorkspace: actions.onRemoveWorkspace,
  });
  const cleanupRootLine = mountRootLine(rootLineHost, store, {
    onBrowse: actions.onBrowse,
    onPin: actions.onPin,
    onCopy: actions.onCopy,
    onRefresh: actions.onRefresh,
  });

  const onToggleDir = (dirPath: string) => {
    const state = store.get();
    const root = state.session.lastRoot;
    if (!root) return;
    const expandedArr = state.expandedDirsByRoot[root] ?? [];
    const expandedSet = new Set(expandedArr);
    if (expandedSet.has(dirPath)) {
      expandedSet.delete(dirPath);
    } else {
      expandedSet.add(dirPath);
    }
    store.update(
      {
        expandedDirsByRoot: {
          ...state.expandedDirsByRoot,
          [root]: Array.from(expandedSet),
        },
      },
      ['expandedDirsByRoot'],
    );
  };

  const cleanupTree = mountFileTree(treeHost, store, {
    onExpandAll: () => expandAllBtn.click(),
    onCollapseAll: () => collapseAllBtn.click(),
    onToggleDir,
    onSelectFile: () => {
      // File opening is Epic 2 — no-op for now
    },
  });

  const render = () => {
    const { sidebarVisible } = store.get();
    container.hidden = !sidebarVisible;
    container.setAttribute('aria-hidden', String(!sidebarVisible));
    container.dataset.visible = String(sidebarVisible);
    container.parentElement?.setAttribute('data-sidebar-visible', String(sidebarVisible));
  };

  render();
  const unsubscribe = store.subscribe(render);

  return () => {
    cleanupWorkspaces();
    cleanupRootLine();
    cleanupTree();
    unsubscribe();
    container.replaceChildren();
  };
}
