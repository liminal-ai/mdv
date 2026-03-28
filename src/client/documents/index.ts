import type { PersistedTab } from '../../shared/types.js';
import { type ApiClient } from '../api.js';
import type { ClientError, ClientState, StateStore, TabState } from '../state.js';
import type { ShellCapabilities } from '../utils/shell-capabilities.js';
import { isSavePending } from '../utils/ws.js';
import { createLoadingTab, disambiguateDisplayNames, normalizePersistedTab } from './helpers.js';
import { createEditingModule } from './editing.js';
import { createTabLifecycleModule } from './tab-lifecycle.js';

export interface DocumentsModule {
  getActiveTab: () => TabState | null;
  openFile: (path: string, anchor?: string) => Promise<void>;
  pickAndOpenFile: () => Promise<void>;
  switchTab: (tabId: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  closeOtherTabs: (tabId: string) => Promise<void>;
  closeTabsToRight: (tabId: string) => Promise<void>;
  copyTabPath: (tabId: string) => Promise<void>;
  activateRelativeTab: (direction: 1 | -1) => Promise<void>;
  toggleMode: () => void;
  setDefaultMode: (mode: ClientState['session']['defaultOpenMode']) => Promise<void>;
  saveTab: (tabId: string) => Promise<boolean>;
  saveCurrentTab: () => Promise<boolean>;
  saveCurrentTabAs: () => Promise<boolean>;
  restoreTabsFromSession: (session: ClientState['session']) => Promise<void>;
  closeTabsUnderRoot: (root: string) => void;
  handleFileChange: (message: {
    path: string;
    event: 'modified' | 'deleted' | 'created';
  }) => Promise<void>;
  resolveUnsavedChoice: (choice: 'save' | 'discard' | 'cancel') => void;
  dismissConflictModal: (tabId?: string) => void;
  handleConflictReload: () => Promise<void>;
  handleConflictSaveCopy: () => Promise<void>;
  handleElectronQuit: (
    dirtyTabs: TabState[],
    callbacks: { confirm: () => void; cancel: () => void },
  ) => Promise<void>;
  getDirtyTabs: () => TabState[];
}

interface DocumentsModuleDependencies {
  api: Pick<
    ApiClient,
    | 'readFile'
    | 'updateTabs'
    | 'touchRecentFile'
    | 'removeRecentFile'
    | 'saveFile'
    | 'setDefaultMode'
  >;
  store: StateStore;
  shellCapabilities: Pick<ShellCapabilities, 'pickMarkdownFile' | 'saveDialog'>;
  wsClientWatchers: {
    watchPath: (path: string) => void;
    unwatchPath: (path: string) => void;
  };
  setError: (error: unknown) => void;
  setClientError: (code: string, message: string, severity?: ClientError['severity']) => void;
  applySession: (session: ClientState['session']) => void;
  getErrorMessage: (error: unknown) => { code: string; message: string; timeout?: boolean };
  isFileNotFoundError: (error: unknown) => boolean;
  getPackageDisplayName: (path: string) => string | null;
  onManifestSaved?: (path: string) => Promise<void>;
  onPackageContentSaved?: (path: string) => void;
  mermaidCache: {
    invalidateForTab: (removedSources: string[], remainingSources: string[]) => void;
  };
  copyText: (text: string) => Promise<void>;
  onMissingFileDuringOpen?: (path: string) => Promise<void>;
}

export function createDocumentsModule(dependencies: DocumentsModuleDependencies): DocumentsModule {
  const {
    api,
    store,
    shellCapabilities,
    wsClientWatchers,
    setError,
    setClientError,
    applySession,
    getErrorMessage,
    isFileNotFoundError,
    getPackageDisplayName,
    onManifestSaved,
    onPackageContentSaved,
    mermaidCache,
    copyText,
    onMissingFileDuringOpen,
  } = dependencies;

  const tabLifecycle = createTabLifecycleModule({
    api,
    store,
    getErrorMessage,
    isFileNotFoundError,
    setError,
    applySession,
    watchPath: wsClientWatchers.watchPath,
    unwatchPath: wsClientWatchers.unwatchPath,
    copyText,
    onMissingFileDuringOpen,
    getPackageDisplayName,
    mermaidCache,
  });

  const editing = createEditingModule({
    api,
    store,
    shellCapabilities,
    tabLifecycle,
    setError,
    setClientError,
    applySession,
    getErrorMessage,
    isFileNotFoundError,
    watchPath: wsClientWatchers.watchPath,
    unwatchPath: wsClientWatchers.unwatchPath,
    onManifestSaved,
    onPackageContentSaved,
  });

  const pickAndOpenFile = async () => {
    try {
      const selection = await shellCapabilities.pickMarkdownFile();
      if (!selection) {
        return;
      }

      await tabLifecycle.openFile(selection.path);
    } catch (error) {
      setError(error);
    }
  };

  const restoreTabsFromSession = async (session: ClientState['session']) => {
    const { activeTab } = session;
    const persistedTabs = session.openTabs.map((tab) =>
      normalizePersistedTab(tab as string | PersistedTab, session.defaultOpenMode),
    );

    if (!persistedTabs.length) {
      return;
    }

    const loadingTabs = disambiguateDisplayNames(
      persistedTabs.map((tab) => createLoadingTab(tab.path, tab.mode, tab.scrollPosition ?? 0)),
    );
    const initialActiveTabId =
      loadingTabs.find((tab) => tab.path === activeTab)?.id ?? loadingTabs.at(-1)?.id ?? null;

    tabLifecycle.updateTabsState(loadingTabs, initialActiveTabId);
    for (const tab of loadingTabs) {
      wsClientWatchers.watchPath(tab.path);
    }

    const loadResults = await Promise.all([
      ...(initialActiveTabId ? [tabLifecycle.loadTabContent(initialActiveTabId)] : []),
      ...loadingTabs
        .filter((tab) => tab.id !== initialActiveTabId)
        .map((tab) => tabLifecycle.loadTabContent(tab.id)),
    ]);
    const needsSync = loadResults.some((result) => result.needsSync);

    if (needsSync) {
      await tabLifecycle.syncTabsToSession();
    }
  };

  const handleFileChange = async (message: {
    path: string;
    event: 'modified' | 'deleted' | 'created';
  }) => {
    const state = store.get();
    const tab = state.tabs.find((candidate) => candidate.path === message.path) ?? null;

    if (message.event === 'deleted') {
      tabLifecycle.markTabDeleted(message.path);
      return;
    }

    if (isSavePending(message.path)) {
      return;
    }

    if (tab?.dirty && message.event === 'modified') {
      editing.showConflictModal(tab);
      return;
    }

    await tabLifecycle.refreshWatchedFile(message.path);
  };

  return {
    getActiveTab: tabLifecycle.getActiveTab,
    openFile: tabLifecycle.openFile,
    pickAndOpenFile,
    switchTab: tabLifecycle.switchTab,
    closeTab: editing.closeTab,
    closeOtherTabs: editing.closeOtherTabs,
    closeTabsToRight: editing.closeTabsToRight,
    copyTabPath: tabLifecycle.copyTabPath,
    activateRelativeTab: tabLifecycle.activateRelativeTab,
    toggleMode: editing.toggleMode,
    setDefaultMode: editing.setDefaultMode,
    saveTab: editing.saveTab,
    saveCurrentTab: editing.saveCurrentTab,
    saveCurrentTabAs: editing.saveCurrentTabAs,
    restoreTabsFromSession,
    closeTabsUnderRoot: tabLifecycle.closeTabsUnderRoot,
    handleFileChange,
    resolveUnsavedChoice: editing.resolveUnsavedChoice,
    dismissConflictModal: editing.dismissConflictModal,
    handleConflictReload: editing.handleConflictReload,
    handleConflictSaveCopy: editing.handleConflictSaveCopy,
    handleElectronQuit: editing.handleElectronQuit,
    getDirtyTabs: editing.getDirtyTabs,
  };
}
