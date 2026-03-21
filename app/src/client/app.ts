import type { ExportFormat, FileReadResponse, SessionState, ThemeInfo } from '../shared/types.js';
import { ApiClient, ApiError } from './api.js';
import { mountContentArea } from './components/content-area.js';
import { mountContentToolbar, TOGGLE_EXPORT_DROPDOWN_EVENT } from './components/content-toolbar.js';
import { mountConflictModal } from './components/conflict-modal.js';
import { mountExportProgress } from './components/export-progress.js';
import { mountExportResult } from './components/export-result.js';
import { mountContextMenu } from './components/context-menu.js';
import { mountErrorNotification } from './components/error-notification.js';
import { mountMenuBar } from './components/menu-bar.js';
import { mountSidebar } from './components/sidebar.js';
import { mountSidebarResizer } from './components/sidebar-resizer.js';
import { mountTabStrip } from './components/tab-strip.js';
import { mountUnsavedModal } from './components/unsaved-modal.js';
import { mountWarningPanel } from './components/warning-panel.js';
import { StateStore, type ClientState, type TabState } from './state.js';
import { copyTextToClipboard } from './utils/clipboard.js';
import { INSERT_LINK_EVENT, KeyboardManager } from './utils/keyboard.js';
import { reRenderMermaidDiagrams } from './utils/mermaid-renderer.js';
import { clearSavePending, isSavePending, markSavePending, WsClient } from './utils/ws.js';

declare global {
  interface Window {
    __MDV_DISABLE_AUTO_BOOTSTRAP__?: boolean;
  }
}

const FALLBACK_SESSION: SessionState = {
  workspaces: [],
  lastRoot: null,
  lastExportDir: null,
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

const WS_DISCONNECTED_ERROR_CODE = 'WS_DISCONNECTED';
const WS_SERVER_ERROR_CODE = 'WS_SERVER_ERROR';
const LARGE_FILE_CONFIRM_MIN_BYTES = 1_048_576;
const LARGE_FILE_CONFIRM_MAX_BYTES = 5_242_880;
const SAVE_PENDING_CLEAR_DELAY_MS = 500;

let tabSequence = 0;
type UnsavedChoice = 'save' | 'discard' | 'cancel';
type ExportDirtyChoice = 'save-and-export' | 'export-anyway' | 'cancel';
type UnsavedModalContext = NonNullable<ClientState['unsavedModal']>['context'];

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

function formatMegabytes(size: number): string {
  return (size / LARGE_FILE_CONFIRM_MIN_BYTES).toFixed(1);
}

function directoryName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash > 0 ? filePath.slice(0, lastSlash) : '/';
}

function exportBaseName(filePath: string): string {
  const name = fileName(filePath);
  return name.replace(/\.(md|markdown)$/i, '');
}

function createTabId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  tabSequence += 1;
  return `tab-${Date.now()}-${tabSequence}`;
}

function createLoadingTab(
  path: string,
  mode: ClientState['session']['defaultOpenMode'] = 'render',
): TabState {
  return {
    id: createTabId(),
    path,
    canonicalPath: path,
    filename: fileName(path),
    html: '',
    content: '',
    warnings: [],
    renderGeneration: 0,
    scrollPosition: 0,
    loading: true,
    modifiedAt: '',
    size: 0,
    status: 'ok',
    mode,
    editContent: null,
    editScrollPosition: 0,
    cursorPosition: null,
    dirty: false,
    editedSinceLastSave: false,
  };
}

function buildLoadedTab(
  response: FileReadResponse,
  existing?: TabState,
  defaultMode: ClientState['session']['defaultOpenMode'] = 'render',
): TabState {
  const preserveEditState = Boolean(existing?.dirty);

  return {
    id: existing?.id ?? createTabId(),
    path: existing?.path ?? response.path,
    canonicalPath: response.canonicalPath,
    filename: existing?.filename ?? response.filename,
    html: response.html,
    content: response.content,
    warnings: response.warnings,
    renderGeneration: (existing?.renderGeneration ?? -1) + 1,
    scrollPosition: existing?.scrollPosition ?? 0,
    loading: false,
    modifiedAt: response.modifiedAt,
    size: response.size,
    status: 'ok',
    mode: existing?.mode ?? defaultMode,
    editContent: preserveEditState ? (existing?.editContent ?? null) : null,
    editScrollPosition: existing?.editScrollPosition ?? 0,
    cursorPosition: existing?.cursorPosition ?? null,
    dirty: preserveEditState,
    editedSinceLastSave: preserveEditState ? (existing?.editedSinceLastSave ?? false) : false,
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
): Promise<{ store: StateStore; api: ApiClient; wsClient: WsClient | null }> {
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
    exportState: {
      inProgress: false,
      activeFormat: null,
      result: null,
    },
    conflictModal: null,
    unsavedModal: null,
    exportDirtyWarning: null,
  };

  const store = new StateStore(initialState);
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

  const watchPath = (path: string) => {
    wsClient?.send({ type: 'watch', path });
  };

  const unwatchPath = (path: string) => {
    wsClient?.send({ type: 'unwatch', path });
  };

  const rewatchAllOpenTabs = () => {
    for (const path of new Set(store.get().tabs.map((tab) => tab.path))) {
      watchPath(path);
    }
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

  const getActiveTab = () => {
    const state = store.get();
    return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
  };

  const savePendingTimers = new Map<string, number>();

  const scheduleClearSavePending = (path: string) => {
    const existingTimer = savePendingTimers.get(path);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(() => {
      clearSavePending(path);
      savePendingTimers.delete(path);
    }, SAVE_PENDING_CLEAR_DELAY_MS);

    savePendingTimers.set(path, timer);
  };

  const buildSavedTab = (
    tab: TabState,
    options: {
      path?: string;
      canonicalPath?: string;
      filename?: string;
      content: string;
      modifiedAt: string;
      size: number;
    },
  ): TabState => ({
    ...tab,
    path: options.path ?? tab.path,
    canonicalPath: options.canonicalPath ?? tab.canonicalPath,
    filename: options.filename ?? tab.filename,
    content: options.content,
    editContent: options.content,
    modifiedAt: options.modifiedAt,
    size: options.size,
    dirty: false,
    editedSinceLastSave: false,
    loading: false,
    status: 'ok',
    errorMessage: undefined,
  });

  let beforeUnloadRegistered = false;
  let resolveUnsavedChoice: ((choice: UnsavedChoice) => void) | null = null;
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = '';
  };

  const updateBeforeUnloadHandler = () => {
    const hasDirtyTabs = store.get().tabs.some((tab) => tab.dirty);
    if (hasDirtyTabs && !beforeUnloadRegistered) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      beforeUnloadRegistered = true;
      return;
    }

    if (!hasDirtyTabs && beforeUnloadRegistered) {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      beforeUnloadRegistered = false;
    }
  };

  store.subscribe((_state, changed) => {
    if (changed.includes('tabs')) {
      updateBeforeUnloadHandler();
    }
  });

  const settleUnsavedChoice = (choice: UnsavedChoice) => {
    const resolve = resolveUnsavedChoice;
    resolveUnsavedChoice = null;

    if (store.get().unsavedModal) {
      store.update({ unsavedModal: null }, ['unsavedModal']);
    }

    resolve?.(choice);
  };

  const showUnsavedModal = (
    tab: TabState,
    context: UnsavedModalContext,
  ): Promise<UnsavedChoice> => {
    if (resolveUnsavedChoice) {
      resolveUnsavedChoice('cancel');
      resolveUnsavedChoice = null;
    }

    store.update(
      {
        unsavedModal: {
          tabId: tab.id,
          filename: tab.filename,
          context,
        },
      },
      ['unsavedModal'],
    );

    return new Promise((resolve) => {
      resolveUnsavedChoice = resolve;
    });
  };

  const showConflictModal = (tab: TabState) => {
    store.update(
      {
        conflictModal: {
          tabId: tab.id,
          filename: tab.filename,
        },
      },
      ['conflictModal'],
    );
  };

  const dismissConflictModal = (tabId?: string) => {
    const conflictModal = store.get().conflictModal;
    if (!conflictModal) {
      return;
    }

    if (tabId && conflictModal.tabId !== tabId) {
      return;
    }

    store.update({ conflictModal: null }, ['conflictModal']);
  };

  const getConflictTab = () => {
    const state = store.get();
    const conflictModal = state.conflictModal;
    if (!conflictModal) {
      return null;
    }

    const tab = state.tabs.find((candidate) => candidate.id === conflictModal.tabId) ?? null;
    if (!tab) {
      return null;
    }

    return {
      conflictModal,
      tab,
    };
  };

  const applyConflictReload = (tabId: string, response: FileReadResponse): boolean => {
    const latestState = store.get();
    const nextTabs = disambiguateDisplayNames(
      latestState.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...buildLoadedTab(response, tab),
              editContent: response.content,
              dirty: false,
              editedSinceLastSave: false,
              status: 'ok',
              errorMessage: undefined,
            }
          : tab,
      ),
    );

    if (!nextTabs.some((tab) => tab.id === tabId)) {
      return false;
    }

    updateTabsState(nextTabs, latestState.activeTabId);
    return true;
  };

  const canPersistDirtyTab = (tab: TabState | null): tab is TabState =>
    Boolean(
      tab &&
      (tab.status === 'ok' || (tab.status === 'deleted' && tab.dirty && tab.editContent !== null)),
    );

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

  const toggleMode = () => {
    const state = store.get();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
    if (!activeTab || activeTab.status !== 'ok') {
      return;
    }

    updateTabsState(
      state.tabs.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              mode: tab.mode === 'edit' ? 'render' : 'edit',
              renderGeneration: (tab.renderGeneration ?? -1) + 1,
              cursorPosition:
                tab.mode === 'render' && tab.cursorPosition === null
                  ? { line: 1, column: 1 }
                  : tab.cursorPosition,
            }
          : tab,
      ),
      state.activeTabId,
    );
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

  const performTabClose = async (tabId: string) => {
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

  const saveTab = async (tabId: string): Promise<boolean> => {
    const tabToSave = store.get().tabs.find((tab) => tab.id === tabId) ?? null;
    if (!canPersistDirtyTab(tabToSave)) {
      return false;
    }

    const contentToSave = tabToSave.editContent ?? tabToSave.content;
    markSavePending(tabToSave.path);

    try {
      const response = await api.saveFile({
        path: tabToSave.path,
        content: contentToSave,
        expectedModifiedAt: tabToSave.status === 'deleted' ? null : tabToSave.modifiedAt,
      });

      const latestState = store.get();
      const nextTabs = disambiguateDisplayNames(
        latestState.tabs.map((tab) =>
          tab.id === tabToSave.id
            ? buildSavedTab(tab, {
                content: contentToSave,
                modifiedAt: response.modifiedAt,
                size: response.size,
              })
            : tab,
        ),
      );

      updateTabsState(nextTabs, latestState.activeTabId);
      return true;
    } catch (error) {
      if ((error as { code?: string } | undefined)?.code === 'CONFLICT') {
        showConflictModal(tabToSave);
        return false;
      }

      setError(error);
      return false;
    } finally {
      scheduleClearSavePending(tabToSave.path);
    }
  };

  const requestTabClose = async (tabId: string, context: UnsavedModalContext): Promise<boolean> => {
    const tab = store.get().tabs.find((candidate) => candidate.id === tabId) ?? null;
    if (!tab) {
      return true;
    }

    if (tab.dirty) {
      const choice = await showUnsavedModal(tab, context);
      if (choice === 'cancel') {
        return false;
      }

      if (choice === 'save') {
        const saved = await saveTab(tab.id);
        if (!saved) {
          return false;
        }
      }
    }

    await performTabClose(tab.id);
    return true;
  };

  const closeTab = async (tabId: string) => {
    await requestTabClose(tabId, 'close-tab');
  };

  const closeOtherTabs = async (tabId: string) => {
    const state = store.get();
    const tabsWithScroll = saveScrollPosition(state.tabs, state.activeTabId);
    const targetTab = tabsWithScroll.find((tab) => tab.id === tabId) ?? null;
    if (!targetTab) {
      return;
    }

    store.update({ tabContextMenu: null }, ['tabContextMenu']);

    for (const tab of tabsWithScroll) {
      if (tab.id === tabId) {
        continue;
      }

      const closed = await requestTabClose(tab.id, 'close-others');
      if (!closed) {
        return;
      }
    }

    if (store.get().activeTabId !== tabId) {
      await switchTab(tabId);
    }
  };

  const closeTabsToRight = async (tabId: string) => {
    const state = store.get();
    const targetIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    if (targetIndex === -1) {
      return;
    }

    const tabsWithScroll = saveScrollPosition(state.tabs, state.activeTabId);
    store.update({ tabContextMenu: null }, ['tabContextMenu']);

    for (const tab of tabsWithScroll.slice(targetIndex + 1)) {
      const closed = await requestTabClose(tab.id, 'close-right');
      if (!closed) {
        return;
      }
    }

    if (store.get().activeTabId !== tabId) {
      await switchTab(tabId);
    }
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
    const loadingTab = createLoadingTab(path, state.session.defaultOpenMode);
    const nextTabs = disambiguateDisplayNames([
      ...saveScrollPosition(state.tabs, state.activeTabId),
      loadingTab,
    ]);

    updateTabsState(nextTabs, loadingTab.id, { closeContextMenu: true });
    restoreScrollPosition(0);

    const removeLoadingTab = () => {
      const currentState = store.get();
      if (!currentState.tabs.some((tab) => tab.id === loadingTab.id)) {
        return;
      }

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
    };

    try {
      const response = await api.readFile(path);

      if (
        response.size >= LARGE_FILE_CONFIRM_MIN_BYTES &&
        response.size <= LARGE_FILE_CONFIRM_MAX_BYTES &&
        !window.confirm(`This file is ${formatMegabytes(response.size)} MB. Open anyway?`)
      ) {
        removeLoadingTab();
        return;
      }

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
            .map((tab) =>
              tab.id === existingTab.id
                ? buildLoadedTab(response, tab, currentState.session.defaultOpenMode)
                : tab,
            ),
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
          tab.id === loadingTab.id
            ? buildLoadedTab(response, tab, currentState.session.defaultOpenMode)
            : tab,
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
      if (error instanceof ApiError && error.status === 404) {
        void api.removeRecentFile(path);
        void (async () => {
          await refreshTree();
          setError(error);
        })();
      }

      removeLoadingTab();
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

  const saveCurrentTab = async (): Promise<boolean> => {
    const activeTab = getActiveTab();
    if (!canPersistDirtyTab(activeTab) || !activeTab.dirty) {
      return false;
    }

    return saveTab(activeTab.id);
  };

  const saveCurrentTabAs = async (): Promise<boolean> => {
    const state = store.get();
    const activeTab = getActiveTab();
    if (!activeTab || (activeTab.status !== 'ok' && !canPersistDirtyTab(activeTab))) {
      return false;
    }

    let selection: { path: string } | null;
    try {
      selection = await api.saveDialog({
        defaultPath: directoryName(activeTab.path),
        defaultFilename: fileName(activeTab.path),
        prompt: 'Save',
      });
    } catch (error) {
      setError(error);
      return false;
    }

    if (!selection) {
      return false;
    }

    let duplicateTab = state.tabs.find(
      (tab) =>
        tab.id !== activeTab.id &&
        (tab.path === selection.path || tab.canonicalPath === selection.path),
    );

    if (duplicateTab?.dirty) {
      const closed = await requestTabClose(duplicateTab.id, 'save-as-replace');
      if (!closed) {
        return false;
      }

      duplicateTab = undefined;
    }

    const contentToSave = activeTab.editContent ?? activeTab.content;
    markSavePending(selection.path);

    try {
      const response = await api.saveFile({
        path: selection.path,
        content: contentToSave,
        expectedModifiedAt: null,
      });

      if (duplicateTab) {
        unwatchPath(duplicateTab.path);
      }
      if (activeTab.path !== selection.path) {
        unwatchPath(activeTab.path);
      }
      watchPath(selection.path);

      const latestState = store.get();
      const nextTabs = disambiguateDisplayNames(
        latestState.tabs
          .filter((tab) => tab.id !== duplicateTab?.id)
          .map((tab) =>
            tab.id === activeTab.id
              ? buildSavedTab(tab, {
                  path: selection.path,
                  canonicalPath: selection.path,
                  filename: fileName(selection.path),
                  content: contentToSave,
                  modifiedAt: response.modifiedAt,
                  size: response.size,
                })
              : tab,
          ),
      );

      updateTabsState(nextTabs, activeTab.id);
      await syncTabsToSession();
      return true;
    } catch (error) {
      setError(error);
      return false;
    } finally {
      scheduleClearSavePending(selection.path);
    }
  };

  const proceedWithExport = async (tab: TabState, format: ExportFormat) => {
    if (tab.status !== 'ok' || store.get().exportState.inProgress) {
      return;
    }

    const defaultDir = store.get().session.lastExportDir ?? directoryName(tab.path);
    const defaultFilename = `${exportBaseName(tab.path)}.${format}`;

    let selection: { path: string } | null;
    try {
      selection = await api.exportSaveDialog(defaultDir, defaultFilename);
    } catch (error) {
      setError(error);
      return;
    }

    if (!selection) {
      return;
    }

    void api
      .setLastExportDir(directoryName(selection.path))
      .then((session) => {
        applySession(session);
      })
      .catch((error) => {
        console.warn('Failed to persist last export directory', error);
      });

    store.update(
      {
        exportState: {
          inProgress: true,
          activeFormat: format,
          result: null,
        },
      },
      ['exportState'],
    );

    try {
      const result = await api.exportDocument({
        path: tab.path,
        format,
        savePath: selection.path,
        theme: store.get().session.theme,
      });

      store.update(
        {
          exportState: {
            inProgress: false,
            activeFormat: null,
            result: {
              type: 'success',
              outputPath: result.outputPath,
              warnings: result.warnings,
              completedAt: new Date().toISOString(),
            },
          },
        },
        ['exportState'],
      );
    } catch (error) {
      store.update(
        {
          exportState: {
            inProgress: false,
            activeFormat: null,
            result: {
              type: 'error',
              warnings: [],
              error: getErrorMessage(error).message,
              completedAt: new Date().toISOString(),
            },
          },
        },
        ['exportState'],
      );
    }
  };

  const handleExportClick = async (
    format: ExportFormat,
    options: { allowDirty?: boolean; tabId?: string } = {},
  ) => {
    const state = store.get();
    const tabId = options.tabId ?? state.activeTabId;
    const activeTab = state.tabs.find((tab) => tab.id === tabId) ?? null;
    if (!activeTab || activeTab.status !== 'ok' || state.exportState.inProgress) {
      return;
    }

    if (activeTab.dirty && !options.allowDirty) {
      store.update(
        {
          exportDirtyWarning: {
            tabId: activeTab.id,
            format,
          },
        },
        ['exportDirtyWarning'],
      );
      return;
    }

    await proceedWithExport(activeTab, format);
  };

  const resolveExportDirtyWarning = async (choice: ExportDirtyChoice) => {
    const warning = store.get().exportDirtyWarning;
    if (!warning) {
      return;
    }

    store.update({ exportDirtyWarning: null }, ['exportDirtyWarning']);

    if (choice === 'cancel') {
      return;
    }

    const warningTab = store.get().tabs.find((tab) => tab.id === warning.tabId) ?? null;
    if (!warningTab) {
      return;
    }

    if (choice === 'save-and-export') {
      const saved = await saveTab(warning.tabId);
      if (!saved) {
        return;
      }

      const latestTab = store.get().tabs.find((tab) => tab.id === warning.tabId) ?? null;
      if (!latestTab) {
        return;
      }

      await handleExportClick(warning.format, {
        allowDirty: true,
        tabId: latestTab.id,
      });
      return;
    }

    if (choice === 'export-anyway') {
      await handleExportClick(warning.format, {
        allowDirty: true,
        tabId: warningTab.id,
      });
    }
  };

  const restoreTabsFromSession = async () => {
    const { openTabs, activeTab } = bootstrap.session;
    if (!openTabs.length) {
      return;
    }

    const loadingTabs = disambiguateDisplayNames(
      openTabs.map((path) => createLoadingTab(path, bootstrap.session.defaultOpenMode)),
    );
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

        const restoredTab = buildLoadedTab(response, loadingTab, bootstrap.session.defaultOpenMode);
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
  const sidebarResizerHost = document.querySelector<HTMLElement>('#sidebar-resizer');
  const mainHost = document.querySelector<HTMLElement>('#main');
  const workspaceHost = document.querySelector<HTMLElement>('#workspace');
  const tabStripHost = document.querySelector<HTMLElement>('#tab-strip');
  const contentAreaHost = document.querySelector<HTMLElement>('#content-area');

  if (!menuBarHost || !sidebarHost || !workspaceHost || !tabStripHost || !contentAreaHost) {
    throw new Error('App shell is missing required mount points.');
  }

  if (sidebarResizerHost && mainHost) {
    mountSidebarResizer(sidebarResizerHost, mainHost, store, toggleSidebar);
  }

  const contentToolbarHost = document.createElement('div');
  contentToolbarHost.id = 'content-toolbar';
  workspaceHost.insertBefore(contentToolbarHost, contentAreaHost);

  const exportProgressHost = document.createElement('div');
  exportProgressHost.id = 'export-progress-root';
  workspaceHost.insertBefore(exportProgressHost, contentAreaHost);

  const exportResultHost = document.createElement('div');
  exportResultHost.id = 'export-result-root';
  workspaceHost.insertBefore(exportResultHost, contentAreaHost);

  const errorHost = document.createElement('div');
  errorHost.id = 'error-notification-root';
  document.body.append(errorHost);

  const warningPanelHost = document.createElement('div');
  warningPanelHost.id = 'warning-panel-root';
  document.body.append(warningPanelHost);

  const unsavedModalHost = document.createElement('div');
  unsavedModalHost.id = 'unsaved-modal-root';
  document.body.append(unsavedModalHost);

  const conflictModalHost = document.createElement('div');
  conflictModalHost.id = 'conflict-modal-root';
  document.body.append(conflictModalHost);

  mountMenuBar(menuBarHost, store, {
    onOpenFile: pickAndOpenFile,
    onBrowse: browseForFolder,
    onSave: () => {
      void saveCurrentTab();
    },
    onSaveAs: () => {
      void saveCurrentTabAs();
    },
    onToggleSidebar: toggleSidebar,
    onSetTheme: setTheme,
    onExportFormat: handleExportClick,
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
    onExportFormat: handleExportClick,
    onResolveExportDirtyWarning: resolveExportDirtyWarning,
  });
  mountExportProgress(exportProgressHost, store);
  mountExportResult(exportResultHost, store);
  mountContentArea(contentAreaHost, store, {
    onBrowse: browseForFolder,
    onOpenFile: pickAndOpenFile,
    onOpenRecentFile: openFile,
    onOpenMarkdownLink: openFile,
    onOpenExternalLink: (path) => api.openExternal(path),
    onRenderContent: (content, documentPath) => api.render({ content, documentPath }),
    onLinkError: setError,
  });
  mountWarningPanel(warningPanelHost, store);
  mountErrorNotification(errorHost, store, {
    onDismiss: () => store.update({ error: null }, ['error']),
  });
  mountConflictModal(conflictModalHost, store, {
    onKeep: () => {
      dismissConflictModal();
    },
    onReload: async () => {
      const conflict = getConflictTab();
      if (!conflict) {
        dismissConflictModal();
        return;
      }

      try {
        const response = await api.readFile(conflict.tab.path);
        if (applyConflictReload(conflict.conflictModal.tabId, response)) {
          dismissConflictModal(conflict.conflictModal.tabId);
        }
      } catch (error) {
        if (error instanceof ApiError && error.code === 'FILE_NOT_FOUND') {
          markTabDeleted(conflict.tab.path);
          dismissConflictModal(conflict.conflictModal.tabId);
          return;
        }

        setError(error);
      }
    },
    onSaveCopy: async () => {
      const conflict = getConflictTab();
      if (!conflict) {
        dismissConflictModal();
        return;
      }

      let selection: { path: string } | null;
      try {
        selection = await api.saveDialog({
          defaultPath: directoryName(conflict.tab.path),
          defaultFilename: `copy-of-${fileName(conflict.tab.path)}`,
        });
      } catch (error) {
        setError(error);
        return;
      }

      if (!selection) {
        return;
      }

      const latestConflict = getConflictTab();
      if (!latestConflict || latestConflict.conflictModal.tabId !== conflict.conflictModal.tabId) {
        return;
      }

      const contentToSave = latestConflict.tab.editContent ?? latestConflict.tab.content;

      try {
        await api.saveFile({
          path: selection.path,
          content: contentToSave,
          expectedModifiedAt: undefined,
        });
      } catch (error) {
        setError(error);
        return;
      }

      try {
        const response = await api.readFile(latestConflict.tab.path);
        if (applyConflictReload(conflict.conflictModal.tabId, response)) {
          dismissConflictModal(conflict.conflictModal.tabId);
        }
      } catch (error) {
        if (error instanceof ApiError && error.code === 'FILE_NOT_FOUND') {
          markTabDeleted(latestConflict.tab.path);
          dismissConflictModal(conflict.conflictModal.tabId);
          return;
        }

        setError(error);
      }
    },
  });
  mountUnsavedModal(unsavedModalHost, store, {
    onSaveAndClose: () => {
      settleUnsavedChoice('save');
    },
    onDiscardChanges: () => {
      settleUnsavedChoice('discard');
    },
    onCancel: () => {
      settleUnsavedChoice('cancel');
    },
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
      const state = store.get();
      const tab = state.tabs.find((candidate) => candidate.path === message.path) ?? null;

      if (message.event === 'deleted') {
        markTabDeleted(message.path);
        return;
      }

      if (isSavePending(message.path)) {
        return;
      }

      if (tab?.dirty && message.event === 'modified') {
        showConflictModal(tab);
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
      toggleMode();
    },
  });
  keyboardManager.register({
    key: 's',
    meta: true,
    description: 'Save',
    action: () => {
      void saveCurrentTab();
    },
  });
  keyboardManager.register({
    key: 's',
    meta: true,
    shift: true,
    description: 'Save As',
    action: () => {
      void saveCurrentTabAs();
    },
  });
  keyboardManager.register({
    key: 'e',
    meta: true,
    shift: true,
    description: 'Export',
    action: () => {
      const { tabs, activeTabId } = store.get();
      const activeTab = tabs.find((tab) => tab.id === activeTabId);
      if (activeTab && activeTab.status === 'ok') {
        document.dispatchEvent(new CustomEvent(TOGGLE_EXPORT_DROPDOWN_EVENT));
      }
    },
  });
  keyboardManager.register({
    key: 'k',
    meta: true,
    description: 'Insert Link',
    action: () => {
      const activeTab = getActiveTab();
      if (!activeTab || activeTab.mode !== 'edit') {
        return;
      }

      document.dispatchEvent(new CustomEvent(INSERT_LINK_EVENT));
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
      if (store.get().unsavedModal) {
        settleUnsavedChoice('cancel');
        return;
      }

      store.update({ activeMenuId: null, tabContextMenu: null }, [
        'activeMenuId',
        'tabContextMenu',
      ]);
    },
  });
  keyboardManager.attach();

  const themeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'data-theme') {
        void reRenderMermaidDiagrams();
      }
    }
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

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

  return { store, api, wsClient };
}

if (shouldAutoBootstrap()) {
  void bootstrapApp(new ApiClient(), new WsClient()).catch((error) => {
    console.error(error);
  });
}
