import { ApiClient } from '../api.js';
import type { ClientState, StateStore, TabState } from '../state.js';
import { fileName } from '../utils/file-paths.js';
import {
  buildLoadedTab,
  buildSavedTab,
  captureScrollSnapshot,
  canPersistDirtyTab,
  createLoadingTab,
  disambiguateDisplayNames,
  extractMermaidSources,
  restoreScrollPosition,
  restoreScrollSnapshot,
  saveScrollPosition,
  scrollToHeading,
} from './helpers.js';

export interface TabLifecycleDependencies {
  api: Pick<ApiClient, 'readFile' | 'updateTabs' | 'touchRecentFile' | 'removeRecentFile'>;
  store: StateStore;
  getErrorMessage: (error: unknown) => { code: string; message: string; timeout?: boolean };
  isFileNotFoundError: (error: unknown) => boolean;
  setError: (error: unknown) => void;
  applySession: (session: ClientState['session']) => void;
  watchPath: (path: string) => void;
  unwatchPath: (path: string) => void;
  copyText: (text: string) => Promise<void>;
  onMissingFileDuringOpen?: (path: string) => Promise<void>;
  setContentToolbarVisible?: (visible: boolean) => void;
  getPackageDisplayName: (path: string) => string | null;
  mermaidCache: {
    invalidateForTab: (removedSources: string[], remainingSources: string[]) => void;
  };
}

export interface TabLifecycleModule {
  getActiveTab: () => TabState | null;
  updateTabsState: (
    tabs: TabState[],
    activeTabId: string | null,
    options?: { closeContextMenu?: boolean },
  ) => void;
  syncTabsToSession: () => Promise<void>;
  touchRecentFile: (path: string) => Promise<void>;
  closeTabsUnderRoot: (root: string) => void;
  switchTab: (tabId: string) => Promise<void>;
  performTabClose: (tabId: string) => Promise<void>;
  closeTabImmediate: (tabId: string) => void;
  copyTabPath: (tabId: string) => Promise<void>;
  markTabDeleted: (path: string) => void;
  refreshWatchedFile: (path: string) => Promise<void>;
  loadTabContent: (tabId: string) => Promise<{ needsSync: boolean }>;
  openFile: (path: string, anchor?: string) => Promise<void>;
  activateRelativeTab: (direction: 1 | -1) => Promise<void>;
  buildSavedTab: typeof buildSavedTab;
  canPersistDirtyTab: typeof canPersistDirtyTab;
}

export function createTabLifecycleModule(
  dependencies: TabLifecycleDependencies,
): TabLifecycleModule {
  const {
    api,
    store,
    getErrorMessage,
    isFileNotFoundError,
    setError,
    applySession,
    watchPath,
    unwatchPath,
    copyText,
    onMissingFileDuringOpen,
    getPackageDisplayName,
    mermaidCache,
  } = dependencies;

  const pendingTabLoads = new Map<string, Promise<{ needsSync: boolean }>>();

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

  const syncTabsToSession = async () => {
    const { tabs, activeTabId } = store.get();
    const persistedTabs = tabs.filter((tab) => tab.status === 'ok');
    const activeTab = persistedTabs.find((tab) => tab.id === activeTabId) ?? null;

    try {
      applySession(
        await api.updateTabs(
          persistedTabs.map((tab) => ({
            path: tab.path,
            mode: tab.mode,
            scrollPosition: tab.mode === 'edit' ? tab.editScrollPosition : tab.scrollPosition,
          })),
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

  const removeRecentFile = async (path: string) => {
    try {
      applySession(await api.removeRecentFile(path));
    } catch (error) {
      setError(error);
    }
  };

  const closeTabsUnderRoot = (root: string) => {
    const state = store.get();
    const remainingTabs = disambiguateDisplayNames(
      state.tabs.filter((tab) => !tab.path.startsWith(root)),
    );

    updateTabsState(
      remainingTabs,
      remainingTabs.length > 0 ? (remainingTabs[0]?.id ?? null) : null,
      {
        closeContextMenu: true,
      },
    );
  };

  const switchTab = async (tabId: string) => {
    const state = store.get();
    const nextTabs = saveScrollPosition(state.tabs, state.activeTabId);
    updateTabsState(nextTabs, tabId);
  };

  const performTabClose = async (tabId: string) => {
    const state = store.get();
    const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) {
      return;
    }

    const closingTab = state.tabs[tabIndex] ?? null;
    const nextTabsWithScroll = saveScrollPosition(state.tabs, state.activeTabId);

    if (closingTab) {
      const remainingSources = nextTabsWithScroll
        .filter((tab) => tab.id !== closingTab.id)
        .flatMap((tab) => extractMermaidSources(tab.html));
      mermaidCache.invalidateForTab(extractMermaidSources(closingTab.html), remainingSources);
      unwatchPath(closingTab.path);
    }

    const nextTabs = disambiguateDisplayNames(nextTabsWithScroll.filter((tab) => tab.id !== tabId));
    let nextActiveTabId = state.activeTabId;

    if (state.activeTabId === tabId) {
      const fallback = nextTabs[tabIndex] ?? nextTabs[tabIndex - 1] ?? null;
      nextActiveTabId = fallback?.id ?? null;
    }

    updateTabsState(nextTabs, nextActiveTabId, { closeContextMenu: true });
    restoreScrollPosition(nextTabs.find((tab) => tab.id === nextActiveTabId)?.scrollPosition ?? 0);
    await syncTabsToSession();
  };

  const closeTabImmediate = (tabId: string) => {
    void performTabClose(tabId);
  };

  const copyTabPath = async (tabId: string) => {
    const tab = store.get().tabs.find((candidate) => candidate.id === tabId) ?? null;
    if (!tab) {
      return;
    }

    try {
      await copyText(tab.path);
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
      if (isFileNotFoundError(error)) {
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

  const loadTabContent = async (tabId: string): Promise<{ needsSync: boolean }> => {
    const existingRequest = pendingTabLoads.get(tabId);
    if (existingRequest) {
      return existingRequest;
    }

    const state = store.get();
    const targetTab = state.tabs.find((tab) => tab.id === tabId) ?? null;
    if (!targetTab || !targetTab.loading) {
      return { needsSync: false };
    }

    const loadRequest = (async () => {
      try {
        const response = await api.readFile(targetTab.path);
        const latestState = store.get();
        const latestTab = latestState.tabs.find((tab) => tab.id === tabId) ?? null;
        if (!latestTab || !latestTab.loading) {
          return { needsSync: false };
        }

        const duplicateTab = latestState.tabs.find(
          (tab) => tab.id !== tabId && tab.canonicalPath === response.canonicalPath,
        );

        if (duplicateTab) {
          unwatchPath(latestTab.path);

          const mergedTabs = disambiguateDisplayNames(
            latestState.tabs
              .filter((tab) => tab.id !== tabId)
              .map((tab) =>
                tab.id === duplicateTab.id
                  ? buildLoadedTab(response, tab, latestState.session.defaultOpenMode)
                  : tab,
              ),
          );
          const nextActiveTabId =
            latestState.activeTabId === tabId ? duplicateTab.id : latestState.activeTabId;

          updateTabsState(mergedTabs, nextActiveTabId);

          if (latestState.activeTabId === tabId) {
            restoreScrollPosition(
              mergedTabs.find((tab) => tab.id === duplicateTab.id)?.scrollPosition ?? 0,
            );
          }

          return { needsSync: true };
        }

        const hydratedTabs = disambiguateDisplayNames(
          latestState.tabs.map((tab) =>
            tab.id === tabId
              ? buildLoadedTab(response, tab, latestState.session.defaultOpenMode)
              : tab,
          ),
        );

        updateTabsState(hydratedTabs, latestState.activeTabId);

        if (latestState.activeTabId === tabId) {
          restoreScrollPosition(hydratedTabs.find((tab) => tab.id === tabId)?.scrollPosition ?? 0);
        }

        return { needsSync: false };
      } catch (error) {
        const latestState = store.get();
        if (!latestState.tabs.some((tab) => tab.id === tabId)) {
          return { needsSync: false };
        }

        updateTabsState(
          latestState.tabs.map((tab) => {
            if (tab.id !== tabId) {
              return tab;
            }

            if (isFileNotFoundError(error)) {
              return {
                ...tab,
                loading: false,
                status: 'deleted',
                errorMessage: undefined,
              };
            }

            return {
              ...tab,
              loading: false,
              status: 'error',
              errorMessage: getErrorMessage(error).message,
            };
          }),
          latestState.activeTabId,
        );

        if (!isFileNotFoundError(error)) {
          setError(error);
        }

        return { needsSync: false };
      }
    })();

    pendingTabLoads.set(tabId, loadRequest);

    try {
      return await loadRequest;
    } finally {
      if (pendingTabLoads.get(tabId) === loadRequest) {
        pendingTabLoads.delete(tabId);
      }
    }
  };

  const openFile = async (path: string, anchor?: string): Promise<void> => {
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
    const loadingTab = createLoadingTab(
      path,
      state.session.defaultOpenMode,
      0,
      getPackageDisplayName(path) ?? fileName(path),
    );
    const nextTabs = disambiguateDisplayNames([
      ...saveScrollPosition(state.tabs, state.activeTabId),
      loadingTab,
    ]);

    updateTabsState(nextTabs, loadingTab.id, { closeContextMenu: true });
    await syncTabsToSession();
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
      if ((error as { status?: number }).status === 404 && getPackageDisplayName(path)) {
        const currentState = store.get();
        if (currentState.tabs.some((tab) => tab.id === loadingTab.id)) {
          updateTabsState(
            currentState.tabs.map((tab) =>
              tab.id === loadingTab.id
                ? {
                    ...tab,
                    loading: false,
                    status: 'error' as const,
                    errorMessage: `File not found: ${path}`,
                  }
                : tab,
            ),
            loadingTab.id,
          );
          return;
        }
      }

      if ((error as { status?: number }).status === 404) {
        await removeRecentFile(path);
        if (onMissingFileDuringOpen) {
          await onMissingFileDuringOpen(path);
        }
      }

      removeLoadingTab();
      setError(error);
    }
  };

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

  return {
    getActiveTab,
    updateTabsState,
    syncTabsToSession,
    touchRecentFile,
    closeTabsUnderRoot,
    switchTab,
    performTabClose,
    closeTabImmediate,
    copyTabPath,
    markTabDeleted,
    refreshWatchedFile,
    loadTabContent,
    openFile,
    activateRelativeTab,
    buildSavedTab,
    canPersistDirtyTab,
  };
}
