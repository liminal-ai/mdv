import type { FolderNode, PinnedFolder, TabsStatePayload, DocumentTabSession } from '../core/types';

export type TabMode = 'render' | 'edit';

export interface ClientTab extends DocumentTabSession {
  mode: TabMode;
}

export interface RendererState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  activeRootPath: string | null;
  pinnedFolders: PinnedFolder[];
  tree: FolderNode[];
  loadedDirs: Set<string>;
  expandedDirs: Set<string>;
  tabsById: Map<string, ClientTab>;
  tabOrder: string[];
  activeTabId: string | null;
  previewRequestId: number;
  isPreviewBusy: boolean;
}

export function createRendererState(): RendererState {
  return {
    sidebarCollapsed: false,
    sidebarWidth: 300,
    activeRootPath: null,
    pinnedFolders: [],
    tree: [],
    loadedDirs: new Set<string>(),
    expandedDirs: new Set<string>(),
    tabsById: new Map<string, ClientTab>(),
    tabOrder: [],
    activeTabId: null,
    previewRequestId: 0,
    isPreviewBusy: false
  };
}

export function getActiveTab(state: RendererState): ClientTab | null {
  if (!state.activeTabId) {
    return null;
  }

  return state.tabsById.get(state.activeTabId) ?? null;
}

export function mergeTabsState(state: RendererState, payload: TabsStatePayload): void {
  const previousTabs = state.tabsById;
  const nextTabs = new Map<string, ClientTab>();

  for (const session of payload.tabs) {
    const previous = previousTabs.get(session.tabId);
    const preserveActiveDraft =
      previous &&
      session.tabId === state.activeTabId &&
      previous.isDirty &&
      previous.currentMarkdown !== session.currentMarkdown;

    const currentMarkdown = preserveActiveDraft ? previous.currentMarkdown : session.currentMarkdown;

    nextTabs.set(session.tabId, {
      ...session,
      currentMarkdown,
      isDirty: currentMarkdown !== session.savedMarkdown,
      mode: previous?.mode ?? 'render'
    });
  }

  state.tabsById = nextTabs;
  state.tabOrder = payload.tabs.map((tab) => tab.tabId);

  if (payload.activeTabId && nextTabs.has(payload.activeTabId)) {
    state.activeTabId = payload.activeTabId;
  } else {
    state.activeTabId = state.tabOrder[0] ?? null;
  }
}

export function setChildrenForPath(nodes: FolderNode[], targetPath: string, children: FolderNode[]): boolean {
  for (const node of nodes) {
    if (node.type === 'dir' && node.path === targetPath) {
      node.children = children;
      return true;
    }

    if (node.type === 'dir' && Array.isArray(node.children) && setChildrenForPath(node.children, targetPath, children)) {
      return true;
    }
  }

  return false;
}

export function clampSidebarWidth(width: number, min: number, max: number): number {
  if (!Number.isFinite(width)) {
    return 300;
  }

  return Math.min(max, Math.max(min, Math.round(width)));
}
