import type { FileReadResponse, SessionState, ThemeInfo } from '../shared/types.js';
import { ApiClient, ApiError } from './api.js';
import { mountContentArea } from './components/content-area.js';
import {
  mountContentToolbar,
  showEditModeComingSoonTooltip,
} from './components/content-toolbar.js';
import { mountContextMenu } from './components/context-menu.js';
import { mountErrorNotification } from './components/error-notification.js';
import { mountMenuBar } from './components/menu-bar.js';
import { mountSidebar } from './components/sidebar.js';
import { mountTabStrip } from './components/tab-strip.js';
import { mountWarningPanel } from './components/warning-panel.js';
import { StateStore, type ClientState, type TabState } from './state.js';
import { copyTextToClipboard } from './utils/clipboard.js';
import { KeyboardManager } from './utils/keyboard.js';
import { WsClient } from './utils/ws.js';

declare global {
  interface Window {
    __MDV_DISABLE_AUTO_BOOTSTRAP__?: boolean;
  }
}

const FALLBACK_SESSION: SessionState = {
  workspaces: [],
  lastRoot: null,
  recentFiles: [],
  theme: 'light-default',
  sidebarState: { workspacesCollapsed: false },
  defaultOpenMode: 'render',
  openTabs: [],
  activeTab: null,
};

const FALLBACK_THEMES: ThemeInfo[] = [
  { id: 'light-default', label: 'Light Default', variant: 'light' },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' },
];

const DELETED_FILE_REWATCH_INTERVAL_MS = 2_000;
const MAX_DELETED_FILE_REWATCH_ATTEMPTS = 5;
const WS_DISCONNECTED_ERROR_CODE = 'WS_DISCONNECTED';
const WS_SERVER_ERROR_CODE = 'WS_SERVER_ERROR';

let tabSequence = 0;

interface ScrollSnapshot {
  offset: number;
  ratio: number;
}

function createFallbackBootstrap(): Pick<ClientState, 'session' | 'availableThemes'> {
  return {
    session: structuredClone(FALLBACK_SESSION),
    availableThemes: structuredClone(FALLBACK_THEMES),
  };
}

function shouldAutoBootstrap(): boolean {
  return typeof window !== 'undefined' && !window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
}

function readCachedTheme(): string | null {
  try {
    return localStorage.getItem('mdv-theme');
  } catch {
    return null;
  }
}

function applyTheme(themeId: string, options: { persist?: boolean } = {}): void {
  document.documentElement.dataset.theme = themeId;

  if (options.persist !== false) {
    try {
      localStorage.setItem('mdv-theme', themeId);
    } catch {
      // Ignore storage failures in privacy-restricted environments.
    }
  }
}

function fileName(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  return parts.at(-1) ?? filePath;
}

function createTabId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  tabSequence += 1;
  return `tab-${Date.now()}-${tabSequence}`;
}

function createLoadingTab(path: string): TabState {
  return {
    id: createTabId(),
    path,
    canonicalPath: path,
    filename: fileName(path),
    html: '',
    content: '',
    warnings: [],
    scrollPosition: 0,
    loading: true,
    modifiedAt: '',
    size: 0,
    status: 'ok',
  };
}

function buildLoadedTab(response: FileReadResponse, existing?: TabState): TabState {
  return {
    id: existing?.id ?? createTabId(),
    path: existing?.path ?? response.path,
    canonicalPath: response.canonicalPath,
    filename: existing?.filename ?? response.filename,
    html: response.html,
    content: response.content,
    warnings: response.warnings,
    scrollPosition: existing?.scrollPosition ?? 0,
    loading: false,
    modifiedAt: response.modifiedAt,
    size: response.size,
    status: 'ok',
  };
}

function disambiguateDisplayNames(tabs: TabState[]): TabState[] {
  const nextTabs = tabs.map((tab) => ({ ...tab }));
  const groups = new Map<string, TabState[]>();

  for (const tab of nextTabs) {
    const base = fileName(tab.path);
    if (!groups.has(base)) {
      groups.set(base, []);
    }
    groups.get(base)?.push(tab);
  }

  for (const [base, group] of groups) {
    if (group.length === 1) {
      group[0]!.filename = base;
      continue;
    }

    const segments = group.map((tab) => tab.path.split('/').filter(Boolean));
    const maxDepth = Math.max(...segments.map((parts) => parts.length));

    for (let depth = 2; depth <= maxDepth; depth += 1) {
      const names = segments.map((parts) => parts.slice(-depth).join('/'));
      if (new Set(names).size === names.length) {
        group.forEach((tab, index) => {
          tab.filename = names[index] ?? tab.path;
        });
        break;
      }

      if (depth === maxDepth) {
        group.forEach((tab) => {
          tab.filename = tab.path;
        });
      }
    }
  }

  return nextTabs;
}

function getContentBody(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.content-area__body');
}

function saveScrollPosition(tabs: TabState[], activeTabId: string | null): TabState[] {
  if (!activeTabId) {
    return tabs;
  }

  const scrollTop = getContentBody()?.scrollTop ?? 0;
  return tabs.map((tab) => (tab.id === activeTabId ? { ...tab, scrollPosition: scrollTop } : tab));
}

function restoreScrollPosition(scrollPosition: number): void {
  const applyScroll = () => {
    const body = getContentBody();
    if (body) {
      body.scrollTop = scrollPosition;
    }
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(applyScroll);
    return;
  }

  queueMicrotask(applyScroll);
}

function captureScrollSnapshot(): ScrollSnapshot {
  const body = getContentBody();
  if (!body) {
    return { offset: 0, ratio: 0 };
  }

  const scrollableHeight = Math.max(body.scrollHeight - body.clientHeight, 0);
  return {
    offset: body.scrollTop,
    ratio: scrollableHeight > 0 ? body.scrollTop / scrollableHeight : 0,
  };
}

function restoreScrollSnapshot(snapshot: ScrollSnapshot): void {
  const applyScroll = () => {
    const body = getContentBody();
    if (!body) {
      return;
    }

    const scrollableHeight = Math.max(body.scrollHeight - body.clientHeight, 0);
    body.scrollTop =
      scrollableHeight > 0 ? Math.round(scrollableHeight * snapshot.ratio) : snapshot.offset;
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(applyScroll);
    return;
  }

  queueMicrotask(applyScroll);
}

function scrollToHeading(anchor: string): void {
  const scroll = () => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(scroll);
    return;
  }

  queueMicrotask(scroll);
}

function getErrorMessage(error: unknown): { code: string; message: string } {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'Something went wrong.',
  };
}

export async function bootstrapApp(
  api = new ApiClient(),
  wsClient: WsClient | null = shouldAutoBootstrap() ? new WsClient() : null,
): Promise<void> {
  const cachedTheme = readCachedTheme();
  let bootstrap = createFallbackBootstrap();
  let bootstrapError: unknown = null;

  try {
    bootstrap = await api.bootstrap();
  } catch (error) {
    bootstrapError = error;
    if (cachedTheme) {
      bootstrap = {
        ...bootstrap,
        session: {
          ...bootstrap.session,
          theme: cachedTheme,
        },
      };
    }
  }

  applyTheme(bootstrap.session.theme, { persist: bootstrapError === null });

  const initialState: ClientState = {
    session: bootstrap.session,
    availableThemes: bootstrap.availableThemes,
    tree: [],
    treeLoading: false,
    invalidRoot: false,
    activeMenuId: null,
    contextMenu: null,
    sidebarVisible: true,
    expandedDirsByRoot: {},
    error: null,
    tabs: [],
    activeTabId: null,
    tabContextMenu: null,
    contentToolbarVisible: false,
  };

  const store = new StateStore(initialState);
  const deletedFileRewatchTimers = new Map<string, number>();

  const applySession = (
    session: ClientState['session'],
    options: { clearInvalidRoot?: boolean } = {},
  ) => {
    applyTheme(session.theme);
    store.update(
      {
        session,
        ...(options.clearInvalidRoot ? { invalidRoot: false } : {}),
        error: null,
      },
      options.clearInvalidRoot ? ['session', 'invalidRoot', 'error'] : ['session', 'error'],
    );
  };

  const applyTree = (tree: ClientState['tree']) => {
    store.update(
      {
        tree,
        treeLoading: false,
        invalidRoot: false,
        error: null,
      },
      ['tree', 'treeLoading', 'invalidRoot', 'error'],
    );
  };

  const setTreeLoading = (treeLoading: boolean) => {
    store.update({ treeLoading }, ['treeLoading']);
  };

  const setError = (error: unknown) => {
    store.update({ error: getErrorMessage(error) }, ['error']);
  };

  const setClientError = (code: string, message: string) => {
    store.update({ error: { code, message } }, ['error']);
  };

  const setInvalidRoot = (error: unknown) => {
    store.update(
      {
        invalidRoot: true,
        tree: [],
        treeLoading: false,
        error: getErrorMessage(error),
      },
      ['invalidRoot', 'tree', 'treeLoading', 'error'],
    );
  };

  const clearDeletedFileRetry = (path: string) => {
    const timer = deletedFileRewatchTimers.get(path);
    if (timer !== undefined) {
      window.clearInterval(timer);
      deletedFileRewatchTimers.delete(path);
    }
  };

  const watchPath = (path: string) => {
    wsClient?.send({ type: 'watch', path });
  };

  const unwatchPath = (path: string) => {
    clearDeletedFileRetry(path);
    wsClient?.send({ type: 'unwatch', path });
  };

  const rewatchAllOpenTabs = () => {
    for (const path of new Set(store.get().tabs.map((tab) => tab.path))) {
      watchPath(path);
    }
  };

  const scheduleDeletedFileRetry = (path: string) => {
    if (!wsClient) {
      return;
    }

    clearDeletedFileRetry(path);
    let attempts = 0;

    const timer = window.setInterval(() => {
      if (!store.get().tabs.some((tab) => tab.path === path)) {
        clearDeletedFileRetry(path);
        return;
      }

      attempts += 1;
      watchPath(path);

      if (attempts >= MAX_DELETED_FILE_REWATCH_ATTEMPTS) {
        clearDeletedFileRetry(path);
      }
    }, DELETED_FILE_REWATCH_INTERVAL_MS);

    deletedFileRewatchTimers.set(path, timer);
  };

  const updateTabsState = (
    tabs: TabState[],
    activeTabId: string | null,
    options: { closeContextMenu?: boolean } = {},
  ) => {
    const nextState: Partial<ClientState> = {
      tabs,
      activeTabId,
      contentToolbarVisible: tabs.length > 0,
    };
    const changedKeys: Array<keyof ClientState> = ['tabs', 'activeTabId', 'contentToolbarVisible'];

    if (options.closeContextMenu || tabs.length === 0) {
      nextState.tabContextMenu = null;
      changedKeys.push('tabContextMenu');
    }

    store.update(nextState, changedKeys);
  };

  const syncTabsToSession = async () => {
    const { tabs, activeTabId } = store.get();
    const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

    try {
      applySession(
        await api.updateTabs(
          tabs.map((tab) => tab.path),
          activeTab?.path ?? null,
        ),
      );
    } catch (error) {
      setError(error);
    }
  };

  const touchRecentFile = async (path: string) => {
    try {
      applySession(await api.touchRecentFile(path));
    } catch (error) {
      setError(error);
    }
  };

  const switchRoot = async (path: string) => {
    setTreeLoading(true);

    try {
      const session = await api.setRoot(path);
      applySession(session, { clearInvalidRoot: true });

      try {
        const treeResponse = await api.getTree(path);
        applyTree(treeResponse.tree);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'PATH_NOT_FOUND') {
          setInvalidRoot(error);
          return;
        }

        setTreeLoading(false);
        setError(error);
      }
    } catch (error) {
      setTreeLoading(false);
      setError(error);
    }
  };

  const browseForFolder = async () => {
    try {
      const selection = await api.browse();
      if (!selection) {
        return;
      }

      await switchRoot(selection.path);
    } catch (error) {
      setError(error);
    }
  };

  const pickAndOpenFile = async () => {
    try {
      const selection = await api.pickFile();
      if (!selection) {
        return;
      }

      await openFile(selection.path);
    } catch (error) {
      setError(error);
    }
  };

  const toggleSidebar = () => {
    const { sidebarVisible } = store.get();
    store.update({ sidebarVisible: !sidebarVisible }, ['sidebarVisible']);
  };

  const toggleWorkspacesCollapsed = async () => {
    try {
      const collapsed = store.get().session.sidebarState.workspacesCollapsed;
      applySession(await api.updateSidebar(!collapsed));
    } catch (error) {
      setError(error);
    }
  };

  const setTheme = async (themeId: string) => {
    applyTheme(themeId);
    try {
      applySession(await api.setTheme(themeId));
    } catch (error) {
      applyTheme(store.get().session.theme);
      setError(error);
    }
  };

  const setDefaultMode = async (mode: ClientState['session']['defaultOpenMode']) => {
    try {
      applySession(await api.setDefaultMode(mode));
    } catch (error) {
      setError(error);
    }
  };

  const pinWorkspace = async () => {
    const root = store.get().session.lastRoot;
    if (!root) {
      return;
    }

    try {
      applySession(await api.addWorkspace(root));
    } catch (error) {
      setError(error);
    }
  };

  const removeWorkspace = async (path: string) => {
    try {
      applySession(await api.removeWorkspace(path));
    } catch (error) {
      setError(error);
    }
  };

  const refreshTree = async () => {
    const root = store.get().session.lastRoot;
    if (!root) {
      return;
    }

    setTreeLoading(true);

    try {
      const treeResponse = await api.getTree(root);
      applyTree(treeResponse.tree);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PATH_NOT_FOUND') {
        setInvalidRoot(error);
        return;
      }

      setTreeLoading(false);
      setError(error);
    }
  };

  const copyRootPath = async () => {
    const root = store.get().session.lastRoot;
    if (!root) {
      return;
    }

    try {
      await copyTextToClipboard(root, api);
    } catch (error) {
      setError(error);
    }
  };

  const switchTab = async (tabId: string) => {
    const state = store.get();
    if (state.activeTabId === tabId) {
      return;
    }

    const nextTabs = saveScrollPosition(state.tabs, state.activeTabId);
    const targetTab = nextTabs.find((tab) => tab.id === tabId) ?? null;
    if (!targetTab) {
      return;
    }

    updateTabsState(nextTabs, tabId, { closeContextMenu: true });
    restoreScrollPosition(targetTab.scrollPosition);
    await syncTabsToSession();
  };

  const closeTab = async (tabId: string) => {
    const state = store.get();
    const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) {
      return;
    }

    const closingTab = state.tabs[tabIndex] ?? null;
    if (closingTab) {
      unwatchPath(closingTab.path);
    }

    const nextTabsWithScroll = saveScrollPosition(state.tabs, state.activeTabId);
    const remainingTabs = disambiguateDisplayNames(
      nextTabsWithScroll.filter((tab) => tab.id !== tabId),
    );

    let nextActiveTabId = state.activeTabId;
    if (state.activeTabId === tabId) {
      nextActiveTabId =
        remainingTabs[tabIndex]?.id ??
        remainingTabs[tabIndex - 1]?.id ??
        remainingTabs[0]?.id ??
        null;
    }

    updateTabsState(remainingTabs, nextActiveTabId, { closeContextMenu: true });
    const nextActiveTab = remainingTabs.find((tab) => tab.id === nextActiveTabId) ?? null;
    restoreScrollPosition(nextActiveTab?.scrollPosition ?? 0);
    await syncTabsToSession();
  };

  const closeOtherTabs = async (tabId: string) => {
    const state = store.get();
    const tabsWithScroll = saveScrollPosition(state.tabs, state.activeTabId);
    const targetTab = tabsWithScroll.find((tab) => tab.id === tabId) ?? null;
    if (!targetTab) {
      return;
    }

    for (const tab of tabsWithScroll) {
      if (tab.id !== tabId) {
        unwatchPath(tab.path);
      }
    }

    updateTabsState(disambiguateDisplayNames([targetTab]), tabId, { closeContextMenu: true });
    restoreScrollPosition(targetTab.scrollPosition);
    await syncTabsToSession();
  };

  const closeTabsToRight = async (tabId: string) => {
    const state = store.get();
    const targetIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    if (targetIndex === -1) {
      return;
    }

    const tabsWithScroll = saveScrollPosition(state.tabs, state.activeTabId);
    for (const tab of tabsWithScroll.slice(targetIndex + 1)) {
      unwatchPath(tab.path);
    }
    const remainingTabs = disambiguateDisplayNames(tabsWithScroll.slice(0, targetIndex + 1));
    const targetTab = remainingTabs.find((tab) => tab.id === tabId) ?? null;

    updateTabsState(remainingTabs, tabId, { closeContextMenu: true });
    restoreScrollPosition(targetTab?.scrollPosition ?? 0);
    await syncTabsToSession();
  };

  const copyTabPath = async (tabId: string) => {
    const tab = store.get().tabs.find((candidate) => candidate.id === tabId) ?? null;
    if (!tab) {
      return;
    }

    try {
      await copyTextToClipboard(tab.path, api);
    } catch (error) {
      setError(error);
    }
  };

  const markTabDeleted = (path: string) => {
    const state = store.get();
    if (!state.tabs.some((tab) => tab.path === path)) {
      return;
    }

    updateTabsState(
      state.tabs.map((tab) =>
        tab.path === path
          ? { ...tab, loading: false, status: 'deleted', errorMessage: undefined }
          : tab,
      ),
      state.activeTabId,
    );
    scheduleDeletedFileRetry(path);
  };

  const refreshWatchedFile = async (path: string) => {
    const state = store.get();
    const targetTab = state.tabs.find((tab) => tab.path === path) ?? null;
    if (!targetTab) {
      return;
    }

    const isActiveTab = state.activeTabId === targetTab.id;
    const scrollSnapshot = isActiveTab ? captureScrollSnapshot() : null;

    try {
      const response = await api.readFile(path);
      const latestState = store.get();
      const latestTab = latestState.tabs.find((tab) => tab.path === path) ?? null;
      if (!latestTab) {
        return;
      }

      clearDeletedFileRetry(path);

      const nextTabs = disambiguateDisplayNames(
        latestState.tabs.map((tab) =>
          tab.path === path
            ? { ...buildLoadedTab(response, tab), status: 'ok', errorMessage: undefined }
            : tab,
        ),
      );

      updateTabsState(nextTabs, latestState.activeTabId);
      if (isActiveTab && scrollSnapshot) {
        restoreScrollSnapshot(scrollSnapshot);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'FILE_NOT_FOUND') {
        markTabDeleted(path);
        return;
      }

      const latestState = store.get();
      if (!latestState.tabs.some((tab) => tab.path === path)) {
        return;
      }

      updateTabsState(
        latestState.tabs.map((tab) =>
          tab.path === path
            ? {
                ...tab,
                loading: false,
                status: 'error',
                errorMessage: getErrorMessage(error).message,
              }
            : tab,
        ),
        latestState.activeTabId,
      );
      setError(error);
    }
  };

  async function openFile(path: string, anchor?: string): Promise<void> {
    const state = store.get();
    const knownTab = state.tabs.find((tab) => tab.path === path || tab.canonicalPath === path);

    if (knownTab) {
      if (state.activeTabId !== knownTab.id) {
        await switchTab(knownTab.id);
      }
      if (anchor) {
        scrollToHeading(anchor);
      }
      await touchRecentFile(path);
      return;
    }

    const previousActiveTabId = state.activeTabId;
    const loadingTab = createLoadingTab(path);
    const nextTabs = disambiguateDisplayNames([
      ...saveScrollPosition(state.tabs, state.activeTabId),
      loadingTab,
    ]);

    updateTabsState(nextTabs, loadingTab.id, { closeContextMenu: true });
    restoreScrollPosition(0);

    try {
      const response = await api.readFile(path);
      const currentState = store.get();
      if (!currentState.tabs.some((tab) => tab.id === loadingTab.id)) {
        return;
      }

      const existingTab = currentState.tabs.find(
        (tab) => tab.id !== loadingTab.id && tab.canonicalPath === response.canonicalPath,
      );

      if (existingTab) {
        const mergedTabs = disambiguateDisplayNames(
          currentState.tabs
            .filter((tab) => tab.id !== loadingTab.id)
            .map((tab) => (tab.id === existingTab.id ? buildLoadedTab(response, tab) : tab)),
        );

        updateTabsState(mergedTabs, existingTab.id, { closeContextMenu: true });
        restoreScrollPosition(
          mergedTabs.find((tab) => tab.id === existingTab.id)?.scrollPosition ?? 0,
        );
        if (anchor) {
          scrollToHeading(anchor);
        }
        watchPath(existingTab.path);
        await touchRecentFile(response.path);
        await syncTabsToSession();
        return;
      }

      const hydratedTabs = disambiguateDisplayNames(
        currentState.tabs.map((tab) =>
          tab.id === loadingTab.id ? buildLoadedTab(response, tab) : tab,
        ),
      );

      updateTabsState(hydratedTabs, loadingTab.id, { closeContextMenu: true });
      restoreScrollPosition(0);
      if (anchor) {
        scrollToHeading(anchor);
      }
      watchPath(response.path);
      await touchRecentFile(response.path);
      await syncTabsToSession();
    } catch (error) {
      const currentState = store.get();
      if (currentState.tabs.some((tab) => tab.id === loadingTab.id)) {
        const remainingTabs = disambiguateDisplayNames(
          currentState.tabs.filter((tab) => tab.id !== loadingTab.id),
        );
        const fallbackActiveTabId =
          remainingTabs.find((tab) => tab.id === previousActiveTabId)?.id ??
          remainingTabs.at(-1)?.id ??
          null;

        updateTabsState(remainingTabs, fallbackActiveTabId, { closeContextMenu: true });
        restoreScrollPosition(
          remainingTabs.find((tab) => tab.id === fallbackActiveTabId)?.scrollPosition ?? 0,
        );
      }

      setError(error);
    }
  }

  const activateRelativeTab = async (direction: 1 | -1) => {
    const state = store.get();
    if (!state.tabs.length || !state.activeTabId) {
      return;
    }

    const currentIndex = state.tabs.findIndex((tab) => tab.id === state.activeTabId);
    if (currentIndex === -1) {
      return;
    }

    const nextIndex = (currentIndex + direction + state.tabs.length) % state.tabs.length;
    await switchTab(state.tabs[nextIndex]!.id);
  };

  const restoreTabsFromSession = async () => {
    const { openTabs, activeTab } = bootstrap.session;
    if (!openTabs.length) {
      return;
    }

    const loadingTabs = disambiguateDisplayNames(openTabs.map((path) => createLoadingTab(path)));
    const initialActiveTabId =
      loadingTabs.find((tab) => tab.path === activeTab)?.id ?? loadingTabs.at(-1)?.id ?? null;

    updateTabsState(loadingTabs, initialActiveTabId);

    const restoredTabs: TabState[] = [];
    let restoredActiveTabId: string | null = null;
    let needsSync = false;

    for (const loadingTab of loadingTabs) {
      try {
        const response = await api.readFile(loadingTab.path);
        const duplicateTab = restoredTabs.find(
          (tab) => tab.canonicalPath === response.canonicalPath,
        );

        if (duplicateTab) {
          needsSync = true;
          if (loadingTab.path === activeTab) {
            restoredActiveTabId = duplicateTab.id;
          }
          continue;
        }

        const restoredTab = buildLoadedTab(response, loadingTab);
        restoredTabs.push(restoredTab);

        if (loadingTab.path === activeTab || response.path === activeTab) {
          restoredActiveTabId = restoredTab.id;
        }
      } catch (error) {
        needsSync = true;
        setError(error);
      }
    }

    const nextTabs = disambiguateDisplayNames(restoredTabs);
    const nextActiveTabId =
      nextTabs.find((tab) => tab.id === restoredActiveTabId)?.id ?? nextTabs.at(-1)?.id ?? null;

    updateTabsState(nextTabs, nextActiveTabId);
    restoreScrollPosition(0);
    for (const tab of nextTabs) {
      watchPath(tab.path);
    }

    if (needsSync) {
      await syncTabsToSession();
    }
  };

  const menuBarHost = document.querySelector<HTMLElement>('#menu-bar');
  const sidebarHost = document.querySelector<HTMLElement>('#sidebar');
  const workspaceHost = document.querySelector<HTMLElement>('#workspace');
  const tabStripHost = document.querySelector<HTMLElement>('#tab-strip');
  const contentAreaHost = document.querySelector<HTMLElement>('#content-area');

  if (!menuBarHost || !sidebarHost || !workspaceHost || !tabStripHost || !contentAreaHost) {
    throw new Error('App shell is missing required mount points.');
  }

  const contentToolbarHost = document.createElement('div');
  contentToolbarHost.id = 'content-toolbar';
  workspaceHost.insertBefore(contentToolbarHost, contentAreaHost);

  const errorHost = document.createElement('div');
  errorHost.id = 'error-notification-root';
  document.body.append(errorHost);

  const warningPanelHost = document.createElement('div');
  warningPanelHost.id = 'warning-panel-root';
  document.body.append(warningPanelHost);

  mountMenuBar(menuBarHost, store, {
    onOpenFile: pickAndOpenFile,
    onBrowse: browseForFolder,
    onToggleSidebar: toggleSidebar,
    onSetTheme: setTheme,
  });
  mountSidebar(sidebarHost, store, {
    onToggleWorkspacesCollapsed: toggleWorkspacesCollapsed,
    onSwitchRoot: switchRoot,
    onRemoveWorkspace: removeWorkspace,
    onBrowse: browseForFolder,
    onPin: pinWorkspace,
    onCopy: copyRootPath,
    onRefresh: refreshTree,
    onOpenFile: openFile,
  });
  mountTabStrip(tabStripHost, store, {
    onActivateTab: switchTab,
    onCloseTab: closeTab,
    onCloseOtherTabs: closeOtherTabs,
    onCloseTabsToRight: closeTabsToRight,
    onCopyTabPath: copyTabPath,
  });
  mountContentToolbar(contentToolbarHost, store, {
    onSetDefaultMode: setDefaultMode,
  });
  mountContentArea(contentAreaHost, store, {
    onBrowse: browseForFolder,
    onOpenFile: pickAndOpenFile,
    onOpenRecentFile: openFile,
    onOpenMarkdownLink: openFile,
    onOpenExternalLink: (path) => api.openExternal(path),
    onLinkError: setError,
  });
  mountWarningPanel(warningPanelHost, store);
  mountErrorNotification(errorHost, store, {
    onDismiss: () => store.update({ error: null }, ['error']),
  });

  const contextMenuHost = document.createElement('div');
  contextMenuHost.id = 'context-menu-root';
  document.body.append(contextMenuHost);

  mountContextMenu(contextMenuHost, store, {
    onCopyPath: async (path: string) => {
      try {
        await copyTextToClipboard(path, api);
      } catch (error) {
        setError(error);
      }
    },
    onMakeRoot: async (path: string) => {
      await switchRoot(path);
    },
    onSaveAsWorkspace: async (path: string) => {
      try {
        applySession(await api.addWorkspace(path));
      } catch (error) {
        setError(error);
      }
    },
  });

  if (wsClient) {
    wsClient.on('open', () => {
      if (store.get().error?.code === WS_DISCONNECTED_ERROR_CODE) {
        store.update({ error: null }, ['error']);
      }
      rewatchAllOpenTabs();
    });
    wsClient.on('close', () => {
      setClientError(
        WS_DISCONNECTED_ERROR_CODE,
        'Live reload disconnected. Reconnecting in 2 seconds.',
      );
    });
    wsClient.on('error', (message) => {
      setClientError(WS_SERVER_ERROR_CODE, message.message);
    });
    wsClient.on('file-change', (message) => {
      if (message.event === 'deleted') {
        markTabDeleted(message.path);
        return;
      }

      void refreshWatchedFile(message.path);
    });
    wsClient.connect();
  }

  const keyboardManager = new KeyboardManager(document);
  keyboardManager.register({
    key: 'o',
    meta: true,
    description: 'Open File',
    action: () => {
      void pickAndOpenFile();
    },
  });
  keyboardManager.register({
    key: 'o',
    meta: true,
    shift: true,
    description: 'Open Folder',
    action: () => {
      void browseForFolder();
    },
  });
  keyboardManager.register({
    key: 'b',
    meta: true,
    description: 'Toggle Sidebar',
    action: () => {
      toggleSidebar();
    },
  });
  keyboardManager.register({
    key: 'm',
    meta: true,
    shift: true,
    description: 'Toggle Edit Mode',
    action: () => {
      if (store.get().activeTabId) {
        showEditModeComingSoonTooltip();
      }
    },
  });
  keyboardManager.register({
    key: 'w',
    meta: true,
    description: 'Close Active Tab',
    action: () => {
      const activeTabId = store.get().activeTabId;
      if (activeTabId) {
        void closeTab(activeTabId);
      }
    },
  });
  keyboardManager.register({
    key: ']',
    meta: true,
    shift: true,
    description: 'Next Tab',
    action: () => {
      void activateRelativeTab(1);
    },
  });
  keyboardManager.register({
    key: '[',
    meta: true,
    shift: true,
    description: 'Previous Tab',
    action: () => {
      void activateRelativeTab(-1);
    },
  });
  keyboardManager.register({
    key: 'Escape',
    description: 'Close Menu',
    action: () => {
      store.update({ activeMenuId: null, tabContextMenu: null }, [
        'activeMenuId',
        'tabContextMenu',
      ]);
    },
  });
  keyboardManager.attach();

  if (bootstrap.session.lastRoot) {
    setTreeLoading(true);
    try {
      const treeResponse = await api.getTree(bootstrap.session.lastRoot);
      applyTree(treeResponse.tree);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PATH_NOT_FOUND') {
        setInvalidRoot(error);
      } else {
        setTreeLoading(false);
        setError(error);
      }
    }
  }

  await restoreTabsFromSession();

  if (bootstrapError) {
    setError(bootstrapError);
  }
}

if (shouldAutoBootstrap()) {
  void bootstrapApp(new ApiClient(), new WsClient()).catch((error) => {
    console.error(error);
  });
}
