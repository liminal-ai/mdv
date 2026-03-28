import type { FileReadResponse } from '../../shared/types.js';
import { ApiError, type ApiClient } from '../api.js';
import type { ClientError, ClientState, StateStore, TabState } from '../state.js';
import type { ShellCapabilities } from '../utils/shell-capabilities.js';
import { directoryName, fileName } from '../utils/file-paths.js';
import { markSavePending, clearSavePending } from '../utils/ws.js';
import type { TabLifecycleModule } from './tab-lifecycle.js';

const SAVE_PENDING_CLEAR_DELAY_MS = 500;

type UnsavedChoice = 'save' | 'discard' | 'cancel';
type UnsavedModalContext = NonNullable<ClientState['unsavedModal']>['context'];

export interface EditingModule {
  toggleMode: () => void;
  setDefaultMode: (mode: ClientState['session']['defaultOpenMode']) => Promise<void>;
  saveTab: (tabId: string) => Promise<boolean>;
  saveCurrentTab: () => Promise<boolean>;
  saveCurrentTabAs: () => Promise<boolean>;
  requestTabClose: (tabId: string, context: UnsavedModalContext) => Promise<boolean>;
  closeTab: (tabId: string) => Promise<void>;
  closeOtherTabs: (tabId: string) => Promise<void>;
  closeTabsToRight: (tabId: string) => Promise<void>;
  showConflictModal: (tab: TabState) => void;
  dismissConflictModal: (tabId?: string) => void;
  resolveUnsavedChoice: (choice: UnsavedChoice) => void;
  handleConflictReload: () => Promise<void>;
  handleConflictSaveCopy: () => Promise<void>;
  handleElectronQuit: (
    dirtyTabs: TabState[],
    callbacks: { confirm: () => void; cancel: () => void },
  ) => Promise<void>;
  getDirtyTabs: () => TabState[];
}

interface EditingModuleDependencies {
  api: Pick<ApiClient, 'saveFile' | 'readFile' | 'setDefaultMode' | 'removeRecentFile'>;
  store: StateStore;
  shellCapabilities: Pick<ShellCapabilities, 'saveDialog'>;
  tabLifecycle: TabLifecycleModule;
  setError: (error: unknown) => void;
  setClientError: (code: string, message: string, severity?: ClientError['severity']) => void;
  applySession: (session: ClientState['session']) => void;
  getErrorMessage: (error: unknown) => { code: string; message: string; timeout?: boolean };
  isFileNotFoundError: (error: unknown) => boolean;
  watchPath: (path: string) => void;
  unwatchPath: (path: string) => void;
  onManifestSaved?: (path: string) => Promise<void>;
  onPackageContentSaved?: (path: string) => void;
  onMissingFileDuringOpen?: (path: string) => Promise<void>;
}

export function createEditingModule(dependencies: EditingModuleDependencies): EditingModule {
  const {
    api,
    store,
    shellCapabilities,
    tabLifecycle,
    setError,
    applySession,
    watchPath,
    unwatchPath,
    onManifestSaved,
    onPackageContentSaved,
  } = dependencies;

  const savePendingTimers = new Map<string, number>();
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

  const getActiveTab = () => tabLifecycle.getActiveTab();

  const settleUnsavedChoice = (choice: UnsavedChoice) => {
    const resolve = resolveUnsavedChoice;
    resolveUnsavedChoice = null;

    if (store.get().unsavedModal) {
      store.update({ unsavedModal: null }, ['unsavedModal']);
    }

    resolve?.(choice);
  };

  const showUnsavedModal = (
    tabs: TabState | TabState[],
    context: UnsavedModalContext,
  ): Promise<UnsavedChoice> => {
    const targetTabs = Array.isArray(tabs) ? tabs : [tabs];
    if (resolveUnsavedChoice) {
      resolveUnsavedChoice('cancel');
      resolveUnsavedChoice = null;
    }

    store.update(
      {
        unsavedModal: {
          tabId: targetTabs.length === 1 ? (targetTabs[0]?.id ?? null) : null,
          filenames: targetTabs.map((tab) => tab.filename),
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
    const nextTabs = latestState.tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...response,
            ...tabLifecycle.buildSavedTab(tab, {
              content: response.content,
              html: response.html,
              warnings: response.warnings,
              modifiedAt: response.modifiedAt,
              size: response.size,
            }),
            path: response.path,
            canonicalPath: response.canonicalPath,
          }
        : tab,
    );

    if (!nextTabs.some((tab) => tab.id === tabId)) {
      return false;
    }

    tabLifecycle.updateTabsState(nextTabs, latestState.activeTabId);
    return true;
  };

  const toggleMode = () => {
    const state = store.get();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
    if (!activeTab) {
      return;
    }

    tabLifecycle.updateTabsState(
      state.tabs.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              mode: tab.mode === 'edit' ? 'render' : 'edit',
              renderGeneration: (tab.renderGeneration ?? -1) + 1,
            }
          : tab,
      ),
      activeTab.id,
    );
  };

  const setDefaultMode = async (mode: ClientState['session']['defaultOpenMode']) => {
    try {
      applySession(await api.setDefaultMode(mode));
    } catch (error) {
      setError(error);
    }
  };

  const saveTab = async (tabId: string): Promise<boolean> => {
    const tabToSave = store.get().tabs.find((tab) => tab.id === tabId) ?? null;
    if (!tabToSave || !tabLifecycle.canPersistDirtyTab(tabToSave)) {
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
      const rendered = await api.readFile(tabToSave.path).catch(() => null);

      const latestState = store.get();
      tabLifecycle.updateTabsState(
        latestState.tabs.map((tab) =>
          tab.id === tabToSave.id
            ? tabLifecycle.buildSavedTab(tab, {
                content: contentToSave,
                html: rendered?.html ?? tab.html,
                warnings: rendered?.warnings ?? tab.warnings,
                modifiedAt: response.modifiedAt,
                size: response.size,
              })
            : tab,
        ),
        latestState.activeTabId,
      );

      await tabLifecycle.syncTabsToSession();

      if (onManifestSaved) {
        await onManifestSaved(tabToSave.path);
      }
      onPackageContentSaved?.(tabToSave.path);

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

    await tabLifecycle.performTabClose(tab.id);
    return true;
  };

  const closeTab = async (tabId: string) => {
    await requestTabClose(tabId, 'close-tab');
  };

  const closeOtherTabs = async (tabId: string) => {
    const tabs = store.get().tabs;
    for (const tab of tabs) {
      if (tab.id === tabId) {
        continue;
      }

      const closed = await requestTabClose(tab.id, 'close-others');
      if (!closed) {
        return;
      }
    }
  };

  const closeTabsToRight = async (tabId: string) => {
    const state = store.get();
    const targetIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    if (targetIndex === -1) {
      return;
    }

    for (const tab of state.tabs.slice(targetIndex + 1)) {
      const closed = await requestTabClose(tab.id, 'close-right');
      if (!closed) {
        return;
      }
    }
  };

  const saveCurrentTab = async (): Promise<boolean> => {
    const activeTab = getActiveTab();
    if (!tabLifecycle.canPersistDirtyTab(activeTab) || !activeTab.dirty) {
      return false;
    }

    return saveTab(activeTab.id);
  };

  const saveCurrentTabAs = async (): Promise<boolean> => {
    const state = store.get();
    const activeTab = getActiveTab();
    if (!activeTab || (activeTab.status !== 'ok' && !tabLifecycle.canPersistDirtyTab(activeTab))) {
      return false;
    }

    let selection: { path: string } | null;
    try {
      selection = await shellCapabilities.saveDialog({
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
      const rendered = await api.readFile(selection.path).catch(() => null);

      if (duplicateTab) {
        unwatchPath(duplicateTab.path);
      }
      if (activeTab.path !== selection.path) {
        unwatchPath(activeTab.path);
      }
      watchPath(selection.path);

      const latestState = store.get();
      const nextTabs = latestState.tabs
        .filter((tab) => tab.id !== duplicateTab?.id)
        .map((tab) =>
          tab.id === activeTab.id
            ? tabLifecycle.buildSavedTab(tab, {
                path: selection.path,
                canonicalPath: rendered?.canonicalPath ?? selection.path,
                filename: fileName(selection.path),
                content: contentToSave,
                html: rendered?.html ?? tab.html,
                warnings: rendered?.warnings ?? tab.warnings,
                modifiedAt: response.modifiedAt,
                size: response.size,
              })
            : tab,
        );

      tabLifecycle.updateTabsState(nextTabs, activeTab.id);
      await tabLifecycle.syncTabsToSession();
      return true;
    } catch (error) {
      setError(error);
      return false;
    } finally {
      scheduleClearSavePending(selection.path);
    }
  };

  const handleConflictReload = async () => {
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
        tabLifecycle.markTabDeleted(conflict.tab.path);
        dismissConflictModal(conflict.conflictModal.tabId);
        return;
      }

      setError(error);
    }
  };

  const handleConflictSaveCopy = async () => {
    const conflict = getConflictTab();
    if (!conflict) {
      dismissConflictModal();
      return;
    }

    let selection: { path: string } | null;
    try {
      selection = await shellCapabilities.saveDialog({
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

    await handleConflictReload();
  };

  const handleElectronQuit = async (
    dirtyTabs: TabState[],
    callbacks: { confirm: () => void; cancel: () => void },
  ) => {
    if (dirtyTabs.length === 0) {
      callbacks.confirm();
      return;
    }

    const choice = await showUnsavedModal(dirtyTabs, 'quit');

    if (choice === 'cancel') {
      callbacks.cancel();
      return;
    }

    if (choice === 'save') {
      for (const tab of dirtyTabs) {
        const saved = await saveTab(tab.id);
        if (!saved) {
          callbacks.cancel();
          return;
        }
      }
    }

    callbacks.confirm();
  };

  const getDirtyTabs = () => store.get().tabs.filter((tab) => tab.dirty);

  return {
    toggleMode,
    setDefaultMode,
    saveTab,
    saveCurrentTab,
    saveCurrentTabAs,
    requestTabClose,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    showConflictModal,
    dismissConflictModal,
    resolveUnsavedChoice: settleUnsavedChoice,
    handleConflictReload,
    handleConflictSaveCopy,
    handleElectronQuit,
    getDirtyTabs,
  };
}
