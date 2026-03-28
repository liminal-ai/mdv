import { type ApiClient } from '../api.js';
import { mountContentArea } from '../components/content-area.js';
import {
  mountContentToolbar,
  TOGGLE_EXPORT_DROPDOWN_EVENT,
} from '../components/content-toolbar.js';
import { mountConflictModal } from '../components/conflict-modal.js';
import { mountContextMenu } from '../components/context-menu.js';
import { mountErrorNotification } from '../components/error-notification.js';
import { mountExportProgress } from '../components/export-progress.js';
import { mountExportResult } from '../components/export-result.js';
import { mountMenuBar } from '../components/menu-bar.js';
import { mountSidebar } from '../components/sidebar.js';
import { mountSidebarResizer } from '../components/sidebar-resizer.js';
import { mountTabStrip } from '../components/tab-strip.js';
import { mountUnsavedModal } from '../components/unsaved-modal.js';
import { mountWarningPanel } from '../components/warning-panel.js';
import type { ClientState, StateStore, TabState } from '../state.js';
import { applyTheme } from './theme.js';
import { INSERT_LINK_EVENT, KeyboardManager } from '../utils/keyboard.js';
import { reRenderMermaidDiagrams } from '../utils/mermaid-renderer.js';

export interface AppShellModule {
  mount: () => void;
  toggleSidebar: () => void;
  setTheme: (themeId: string) => Promise<void>;
}

interface AppShellDependencies {
  store: StateStore;
  api: Pick<ApiClient, 'setTheme' | 'openExternal' | 'render'>;
  applySession: (session: ClientState['session']) => void;
  setError: (error: unknown) => void;
  workspace: {
    browseForFolder: () => Promise<void>;
    toggleWorkspacesCollapsed: () => Promise<void>;
    switchRoot: (path: string) => Promise<void>;
    removeWorkspace: (path: string) => Promise<void>;
    pinWorkspace: () => Promise<void>;
    copyRootPath: () => Promise<void>;
    refreshTree: () => Promise<void>;
    addWorkspace: (path: string) => Promise<void>;
  };
  documents: {
    openFile: (path: string, anchor?: string) => Promise<void>;
    pickAndOpenFile: () => Promise<void>;
    switchTab: (tabId: string) => Promise<void>;
    closeTab: (tabId: string) => Promise<void>;
    closeOtherTabs: (tabId: string) => Promise<void>;
    closeTabsToRight: (tabId: string) => Promise<void>;
    copyTabPath: (tabId: string) => Promise<void>;
    saveCurrentTab: () => Promise<boolean>;
    saveCurrentTabAs: () => Promise<boolean>;
    toggleMode: () => void;
    setDefaultMode: (mode: ClientState['session']['defaultOpenMode']) => Promise<void>;
    activateRelativeTab: (direction: 1 | -1) => Promise<void>;
    resolveUnsavedChoice: (choice: 'save' | 'discard' | 'cancel') => void;
    dismissConflictModal: (tabId?: string) => void;
    handleConflictReload: () => Promise<void>;
    handleConflictSaveCopy: () => Promise<void>;
    getActiveTab: () => TabState | null;
  };
  packages: {
    pickAndOpenPackage: () => Promise<void>;
    createPackage: () => Promise<void>;
    exportPackage: () => Promise<void>;
    getManifestPath: () => string | null;
    openPackage: (path: string) => Promise<void>;
  };
  exportsModule: {
    handleExportClick: (
      format: 'pdf' | 'docx' | 'html',
      options?: { allowDirty?: boolean; tabId?: string },
    ) => Promise<void>;
    resolveExportDirtyWarning: (
      choice: 'save-and-export' | 'export-anyway' | 'cancel',
    ) => Promise<void>;
  };
  copyPath: (path: string) => Promise<void>;
}

export function createAppShell(dependencies: AppShellDependencies): AppShellModule {
  const {
    store,
    api,
    applySession,
    setError,
    workspace,
    documents,
    packages,
    exportsModule,
    copyPath,
  } = dependencies;

  const toggleSidebar = () => {
    const { sidebarVisible } = store.get();
    store.update({ sidebarVisible: !sidebarVisible }, ['sidebarVisible']);
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

  const mount = () => {
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
      onOpenFile: documents.pickAndOpenFile,
      onBrowse: workspace.browseForFolder,
      onOpenPackage: packages.pickAndOpenPackage,
      onNewPackage: packages.createPackage,
      onExportPackage: packages.exportPackage,
      onSave: () => {
        void documents.saveCurrentTab();
      },
      onSaveAs: () => {
        void documents.saveCurrentTabAs();
      },
      onToggleSidebar: toggleSidebar,
      onSetTheme: setTheme,
      onExportFormat: exportsModule.handleExportClick,
    });
    mountSidebar(sidebarHost, store, {
      onToggleWorkspacesCollapsed: workspace.toggleWorkspacesCollapsed,
      onSwitchRoot: workspace.switchRoot,
      onRemoveWorkspace: workspace.removeWorkspace,
      onBrowse: workspace.browseForFolder,
      onPin: workspace.pinWorkspace,
      onCopy: workspace.copyRootPath,
      onRefresh: workspace.refreshTree,
      onOpenFile: documents.openFile,
      onEditManifest: async () => {
        const manifestPath = packages.getManifestPath();
        if (!manifestPath) {
          return;
        }

        await documents.openFile(manifestPath);
      },
    });
    mountTabStrip(tabStripHost, store, {
      onActivateTab: documents.switchTab,
      onCloseTab: documents.closeTab,
      onCloseOtherTabs: documents.closeOtherTabs,
      onCloseTabsToRight: documents.closeTabsToRight,
      onCopyTabPath: documents.copyTabPath,
    });
    mountContentToolbar(contentToolbarHost, store, {
      onSetDefaultMode: documents.setDefaultMode,
      onExportFormat: exportsModule.handleExportClick,
      onResolveExportDirtyWarning: exportsModule.resolveExportDirtyWarning,
    });
    mountExportProgress(exportProgressHost, store);
    mountExportResult(exportResultHost, store);
    mountContentArea(contentAreaHost, store, {
      onBrowse: workspace.browseForFolder,
      onOpenFile: documents.pickAndOpenFile,
      onOpenRecentFile: documents.openFile,
      onOpenMarkdownLink: documents.openFile,
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
        documents.dismissConflictModal();
      },
      onReload: async () => {
        await documents.handleConflictReload();
      },
      onSaveCopy: async () => {
        await documents.handleConflictSaveCopy();
      },
    });
    mountUnsavedModal(unsavedModalHost, store, {
      onSaveAndClose: () => {
        documents.resolveUnsavedChoice('save');
      },
      onDiscardChanges: () => {
        documents.resolveUnsavedChoice('discard');
      },
      onCancel: () => {
        documents.resolveUnsavedChoice('cancel');
      },
    });

    const contextMenuHost = document.createElement('div');
    contextMenuHost.id = 'context-menu-root';
    document.body.append(contextMenuHost);

    mountContextMenu(contextMenuHost, store, {
      onCopyPath: async (path: string) => {
        try {
          await copyPath(path);
        } catch (error) {
          setError(error);
        }
      },
      onMakeRoot: async (path: string) => {
        await workspace.switchRoot(path);
      },
      onSaveAsWorkspace: async (path: string) => {
        await workspace.addWorkspace(path);
      },
    });

    if (window.__MDV_PACKAGE_DROP_HANDLERS__) {
      document.removeEventListener('dragover', window.__MDV_PACKAGE_DROP_HANDLERS__.dragover);
      document.removeEventListener('drop', window.__MDV_PACKAGE_DROP_HANDLERS__.drop);
    }

    const handleDocumentDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    const handleDocumentDrop = async (event: DragEvent) => {
      event.preventDefault();
      const files = event.dataTransfer?.files;
      if (!files?.length) {
        return;
      }

      const file = files[0];
      const filePath = (file as { path?: string }).path;

      if (!filePath) {
        return;
      }

      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext === 'mpk' || ext === 'mpkz') {
        await packages.openPackage(filePath);
      }
    };

    window.__MDV_PACKAGE_DROP_HANDLERS__ = {
      dragover: handleDocumentDragOver,
      drop: handleDocumentDrop,
    };

    document.addEventListener('dragover', handleDocumentDragOver);
    document.addEventListener('drop', handleDocumentDrop);

    const keyboardManager = new KeyboardManager(document);
    keyboardManager.register({
      key: 'o',
      meta: true,
      description: 'Open File',
      action: () => {
        void documents.pickAndOpenFile();
      },
    });
    keyboardManager.register({
      key: 'o',
      meta: true,
      shift: true,
      description: 'Open Folder',
      action: () => {
        void workspace.browseForFolder();
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
        documents.toggleMode();
      },
    });
    keyboardManager.register({
      key: 's',
      meta: true,
      description: 'Save',
      action: () => {
        void documents.saveCurrentTab();
      },
    });
    keyboardManager.register({
      key: 's',
      meta: true,
      shift: true,
      description: 'Save As',
      action: () => {
        void documents.saveCurrentTabAs();
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
        const activeTab = documents.getActiveTab();
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
          void documents.closeTab(activeTabId);
        }
      },
    });
    keyboardManager.register({
      key: ']',
      meta: true,
      shift: true,
      description: 'Next Tab',
      action: () => {
        void documents.activateRelativeTab(1);
      },
    });
    keyboardManager.register({
      key: '[',
      meta: true,
      shift: true,
      description: 'Previous Tab',
      action: () => {
        void documents.activateRelativeTab(-1);
      },
    });
    keyboardManager.register({
      key: 'e',
      meta: true,
      description: 'Toggle Edit/Render Mode',
      action: () => {
        documents.toggleMode();
      },
    });
    keyboardManager.register({
      key: 'Tab',
      ctrl: true,
      description: 'Next Tab',
      action: () => {
        void documents.activateRelativeTab(1);
      },
    });
    keyboardManager.register({
      key: 'Tab',
      ctrl: true,
      shift: true,
      description: 'Previous Tab',
      action: () => {
        void documents.activateRelativeTab(-1);
      },
    });
    keyboardManager.register({
      key: 'Escape',
      description: 'Close Menu',
      action: () => {
        if (store.get().unsavedModal) {
          documents.resolveUnsavedChoice('cancel');
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
  };

  return {
    mount,
    toggleSidebar,
    setTheme,
  };
}
