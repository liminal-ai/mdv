import type { StateStore } from '../state.js';
import { mountRootLine, type RootLineActions } from './root-line.js';
import { mountWorkspaces, type WorkspacesActions } from './workspaces.js';
import { createElement } from '../utils/dom.js';

export interface SidebarActions
  extends RootLineActions,
    Omit<WorkspacesActions, 'onToggleCollapsed'> {
  onToggleWorkspacesCollapsed: () => void;
}

export function mountSidebar(
  container: HTMLElement,
  store: StateStore,
  actions: SidebarActions,
): () => void {
  const workspacesHost = createElement('div', { className: 'sidebar__workspaces' });
  const rootLineHost = createElement('div', { className: 'sidebar__root-line' });
  const filesHeader = createElement('div', {
    className: 'sidebar__files-header',
    text: 'FILES',
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
    unsubscribe();
    container.replaceChildren();
  };
}
