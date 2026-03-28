import type { SessionState, ThemeInfo } from '../shared/types.js';
import { ApiClient, ApiError } from './api.js';
import { createAppShell } from './app-shell/index.js';
import { applyTheme, readCachedTheme } from './app-shell/theme.js';
import { createDocumentsModule } from './documents/index.js';
import { createExportsModule } from './exports/index.js';
import { createIntegrationsModule } from './integrations/index.js';
import { createPackagesModule } from './packages/index.js';
import { StateStore, getDefaultPackageState, type ClientState } from './state.js';
import { createWorkspaceModule } from './workspace/index.js';
import { copyTextToClipboard } from './utils/clipboard.js';
import { getClientErrorMessage } from './utils/client-errors.js';
import { getElectronBridge } from './utils/electron-bridge.js';
import { mermaidCache } from './components/mermaid-cache.js';
import { createShellCapabilities } from './utils/shell-capabilities.js';
import { WsClient } from './utils/ws.js';

declare global {
  interface Window {
    __MDV_DISABLE_AUTO_BOOTSTRAP__?: boolean;
    __MDV_PACKAGE_DROP_HANDLERS__?: {
      dragover: (event: DragEvent) => void;
      drop: (event: DragEvent) => void | Promise<void>;
    };
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
  activePackage: null,
};

const FALLBACK_THEMES: ThemeInfo[] = [
  { id: 'light-default', label: 'Light Default', variant: 'light' },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' },
];

function createFallbackBootstrap(): Pick<ClientState, 'session' | 'availableThemes'> {
  return {
    session: structuredClone(FALLBACK_SESSION),
    availableThemes: structuredClone(FALLBACK_THEMES),
  };
}

function shouldAutoBootstrap(): boolean {
  return typeof window !== 'undefined' && !window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
}

export async function bootstrapApp(
  api = new ApiClient(),
  wsClient: WsClient | null = shouldAutoBootstrap() ? new WsClient() : null,
): Promise<{ store: StateStore; api: ApiClient; wsClient: WsClient | null }> {
  if (new URLSearchParams(location.search).has('electron')) {
    document.body.classList.add('electron');
  }

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
  const bridge = getElectronBridge();
  const shellCapabilities = createShellCapabilities(api, bridge);

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
    packageState: getDefaultPackageState(),
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

  const setError = (error: unknown) => {
    store.update({ error: getClientErrorMessage(error) }, ['error']);
  };

  const setClientError = (
    code: string,
    message: string,
    severity?: 'error' | 'warning' | 'info',
  ) => {
    store.update({ error: { code, message, severity } }, ['error']);
  };

  const watchPath = (path: string) => {
    wsClient?.send({ type: 'watch', path });
  };

  const unwatchPath = (path: string) => {
    wsClient?.send({ type: 'unwatch', path });
  };

  const moduleRefs = {} as {
    documents: ReturnType<typeof createDocumentsModule>;
    packages: ReturnType<typeof createPackagesModule>;
  };

  const workspaceModule = createWorkspaceModule({
    api,
    store,
    shellCapabilities,
    applySession,
    setError,
    setClientError,
    getErrorMessage: getClientErrorMessage,
    copyText: (text) => copyTextToClipboard(text, api),
    onBeforeSwitchRoot: () => {
      const previousRoot = moduleRefs.packages.clearForRootSwitch();
      if (previousRoot) {
        moduleRefs.documents.closeTabsUnderRoot(previousRoot);
      }
    },
    onWatchRoot: (path) => {
      wsClient?.send({ type: 'watch-root', path });
    },
  });

  const refreshPackageManifestIfNeeded = async (path: string) => {
    const pkgState = store.get().packageState;
    if (!pkgState.active || !pkgState.manifestPath || path !== pkgState.manifestPath) {
      return;
    }

    try {
      const manifest = await api.getPackageManifest();
      store.update(
        {
          packageState: {
            ...store.get().packageState,
            navigation: manifest.navigation as ClientState['packageState']['navigation'],
            metadata: manifest.metadata,
            manifestStatus: 'present',
            manifestError: null,
          },
        },
        ['packageState'],
      );

      if (manifest.navigation.length === 0) {
        setClientError('EMPTY_NAVIGATION', 'Manifest has no navigation entries', 'warning');
      }
    } catch (manifestError) {
      if (manifestError instanceof ApiError && manifestError.code === 'MANIFEST_PARSE_ERROR') {
        setClientError('MANIFEST_PARSE_ERROR', 'Manifest has syntax errors — sidebar unchanged');
      } else {
        setClientError('MANIFEST_REFRESH_FAILED', 'Failed to refresh manifest');
      }
    }
  };

  const markPackageStaleIfNeeded = (path: string) => {
    const pkgState = store.get().packageState;
    if (
      pkgState.active &&
      pkgState.mode === 'extracted' &&
      pkgState.effectiveRoot &&
      path.startsWith(pkgState.effectiveRoot) &&
      !pkgState.stale
    ) {
      store.update({ packageState: { ...store.get().packageState, stale: true } }, [
        'packageState',
      ]);
    }
  };

  moduleRefs.documents = createDocumentsModule({
    api,
    store,
    shellCapabilities,
    wsClientWatchers: { watchPath, unwatchPath },
    setError,
    setClientError,
    applySession,
    getErrorMessage: getClientErrorMessage,
    isFileNotFoundError: (error) => {
      if (error instanceof ApiError) {
        return error.code === 'FILE_NOT_FOUND' || error.status === 404;
      }

      return (
        (error as { code?: string } | undefined)?.code === 'FILE_NOT_FOUND' ||
        (error as { status?: number } | undefined)?.status === 404
      );
    },
    getPackageDisplayName: (path) => moduleRefs.packages.getPackageDisplayName(path),
    onManifestSaved: refreshPackageManifestIfNeeded,
    onPackageContentSaved: markPackageStaleIfNeeded,
    mermaidCache,
    copyText: (text) => copyTextToClipboard(text, api),
    onMissingFileDuringOpen: async () => {
      await workspaceModule.refreshTree();
    },
  });

  moduleRefs.packages = createPackagesModule({
    api,
    store,
    shellCapabilities,
    setError,
    setClientError,
    closeTabsUnderRoot: moduleRefs.documents.closeTabsUnderRoot,
    loadPackageFallbackTree: workspaceModule.loadPackageFallbackTree,
  });

  const exportsModule = createExportsModule({
    api,
    store,
    shellCapabilities,
    setError,
    getErrorMessage: getClientErrorMessage,
    getTabById: (tabId) =>
      tabId ? (store.get().tabs.find((tab) => tab.id === tabId) ?? null) : null,
    saveTab: moduleRefs.documents.saveTab,
  });

  const appShell = createAppShell({
    store,
    api,
    applySession,
    setError,
    workspace: workspaceModule,
    documents: moduleRefs.documents,
    packages: moduleRefs.packages,
    exportsModule,
    copyPath: (path) => copyTextToClipboard(path, api),
  });

  const integrationsModule = createIntegrationsModule({
    store,
    wsClient,
    bridge,
    setClientError,
    onWatchPath: watchPath,
    onWatchRoot: (path) => {
      wsClient?.send({ type: 'watch-root', path });
    },
    onFileChange: (message) => {
      void moduleRefs.documents.handleFileChange(message);
    },
    onTreeChange: (message) => {
      const currentRoot = store.get().session.lastRoot;
      if (currentRoot && currentRoot === message.root) {
        void workspaceModule.refreshTree();
      }
    },
    onOpenFile: (path) => moduleRefs.documents.openFile(path),
    onQuitRequest: (dirtyTabs, electronBridge) =>
      moduleRefs.documents.handleElectronQuit(dirtyTabs, {
        confirm: () => electronBridge.confirmQuit(),
        cancel: () => electronBridge.cancelQuit(),
      }),
    onMenuAction: (action, args) => {
      switch (action) {
        case 'open-file':
          void moduleRefs.documents.pickAndOpenFile();
          break;
        case 'open-folder':
          void workspaceModule.browseForFolder();
          break;
        case 'save':
          void moduleRefs.documents.saveCurrentTab();
          break;
        case 'save-as':
          void moduleRefs.documents.saveCurrentTabAs();
          break;
        case 'close-tab': {
          const activeTabId = store.get().activeTabId;
          if (activeTabId) {
            void moduleRefs.documents.closeTab(activeTabId);
          }
          break;
        }
        case 'export-pdf':
          void exportsModule.handleExportClick('pdf');
          break;
        case 'export-docx':
          void exportsModule.handleExportClick('docx');
          break;
        case 'export-html':
          void exportsModule.handleExportClick('html');
          break;
        case 'toggle-sidebar':
          appShell.toggleSidebar();
          break;
        case 'toggle-mode':
          moduleRefs.documents.toggleMode();
          break;
        case 'set-theme':
          if (typeof args === 'string') {
            void appShell.setTheme(args);
          }
          break;
      }
    },
  });

  appShell.mount();
  integrationsModule.start();

  await workspaceModule.restoreInitialRoot(bootstrap.session.lastRoot);

  if (bootstrap.session.activePackage) {
    await moduleRefs.packages.restoreActivePackage(bootstrap.session.activePackage);
  }

  await moduleRefs.documents.restoreTabsFromSession(bootstrap.session);

  if (bootstrapError) {
    setError(bootstrapError);
  }

  integrationsModule.sendRendererReady();

  return { store, api, wsClient };
}

if (shouldAutoBootstrap()) {
  void bootstrapApp(new ApiClient(), new WsClient()).catch((error) => {
    console.error(error);
  });
}
