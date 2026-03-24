import type { StateStore } from '../state.js';
import { collectAllDirPaths, mountFileTree } from './file-tree.js';
import { mountPackageSidebar } from './package-sidebar.js';
import { mountRootLine, type RootLineActions } from './root-line.js';
import { mountWorkspaces, type WorkspacesActions } from './workspaces.js';
import { createElement } from '../utils/dom.js';

export interface SidebarActions
  extends RootLineActions, Omit<WorkspacesActions, 'onToggleCollapsed'> {
  onToggleWorkspacesCollapsed: () => void;
  onOpenFile: (path: string) => void | Promise<void>;
  onEditManifest?: () => void | Promise<void>;
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

  const contentHost = createElement('div', { className: 'sidebar__content' });

  container.replaceChildren(workspacesHost, rootLineHost, filesHeader, contentHost);

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

  let cleanupContent: (() => void) | null = null;
  let currentMode: string | null = null;

  const mountFilesystemTree = (label: string) => {
    const treeHost = createElement('div', { className: 'sidebar__tree' });
    contentHost.replaceChildren(
      createElement('div', {
        className: 'sidebar__mode-indicator',
        text: label,
      }),
      treeHost,
    );

    return mountFileTree(treeHost, store, {
      onExpandAll: () => expandAllBtn.click(),
      onCollapseAll: () => collapseAllBtn.click(),
      onToggleDir,
      onSelectFile: (path) => {
        void actions.onOpenFile(path);
      },
    });
  };

  const renderMode = () => {
    const mode = store.get().packageState.sidebarMode;
    if (mode === currentMode && cleanupContent) {
      return;
    }

    cleanupContent?.();
    cleanupContent = null;
    currentMode = mode;

    filesHeader.hidden = mode !== 'filesystem';

    if (mode === 'package') {
      contentHost.replaceChildren();
      cleanupContent = mountPackageSidebar(contentHost, store, {
        onOpenFile: actions.onOpenFile,
        onEditManifest: actions.onEditManifest ?? (() => undefined),
      });
      return;
    }

    if (mode === 'fallback') {
      const pkgState = store.get().packageState;
      const indicatorText =
        pkgState.manifestStatus === 'unreadable'
          ? 'Manifest could not be parsed — showing filesystem view'
          : 'No manifest — showing filesystem view';

      const fallbackIndicator = createElement('div', {
        className: 'sidebar__fallback-indicator',
        text: indicatorText,
      });

      contentHost.replaceChildren(
        createElement('div', {
          className: 'sidebar__mode-indicator sidebar__mode-indicator--fallback',
          text: 'Package (fallback)',
        }),
        fallbackIndicator,
      );

      const treeHost = createElement('div', { className: 'sidebar__tree' });
      contentHost.appendChild(treeHost);

      cleanupContent = mountFileTree(treeHost, store, {
        onExpandAll: () => expandAllBtn.click(),
        onCollapseAll: () => collapseAllBtn.click(),
        onToggleDir,
        onSelectFile: (path) => {
          void actions.onOpenFile(path);
        },
      });
      return;
    }

    cleanupContent = mountFilesystemTree('Folder');
  };

  const render = () => {
    const { sidebarVisible } = store.get();
    container.hidden = !sidebarVisible;
    container.setAttribute('aria-hidden', String(!sidebarVisible));
    container.dataset.visible = String(sidebarVisible);
    container.parentElement?.setAttribute('data-sidebar-visible', String(sidebarVisible));
  };

  renderMode();
  render();
  const unsubscribe = store.subscribe((_state, changed) => {
    if (changed.includes('packageState')) {
      renderMode();
    }

    render();
  });

  return () => {
    cleanupWorkspaces();
    cleanupRootLine();
    cleanupContent?.();
    unsubscribe();
    container.replaceChildren();
  };
}
