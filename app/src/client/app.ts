import { ApiClient, ApiError } from './api.js';
import { mountContentArea } from './components/content-area.js';
import { mountContextMenu } from './components/context-menu.js';
import { mountErrorNotification } from './components/error-notification.js';
import { mountMenuBar } from './components/menu-bar.js';
import { mountSidebar } from './components/sidebar.js';
import { mountTabStrip } from './components/tab-strip.js';
import { StateStore, type ClientState } from './state.js';
import { copyTextToClipboard } from './utils/clipboard.js';
import { KeyboardManager } from './utils/keyboard.js';
import type { SessionState, ThemeInfo } from '../shared/types.js';

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

export async function bootstrapApp(api = new ApiClient()): Promise<void> {
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
    applyTheme(themeId); // instant DOM update before API round-trip
    try {
      applySession(await api.setTheme(themeId));
    } catch (error) {
      applyTheme(store.get().session.theme); // rollback on failure
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

  const menuBarHost = document.querySelector<HTMLElement>('#menu-bar');
  const sidebarHost = document.querySelector<HTMLElement>('#sidebar');
  const tabStripHost = document.querySelector<HTMLElement>('#tab-strip');
  const contentAreaHost = document.querySelector<HTMLElement>('#content-area');

  if (!menuBarHost || !sidebarHost || !tabStripHost || !contentAreaHost) {
    throw new Error('App shell is missing required mount points.');
  }

  const errorHost = document.createElement('div');
  errorHost.id = 'error-notification-root';
  document.body.append(errorHost);

  mountMenuBar(menuBarHost, store, {
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
  });
  mountTabStrip(tabStripHost, store);
  mountContentArea(contentAreaHost, store, { onBrowse: browseForFolder });
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

  const keyboardManager = new KeyboardManager(document);
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
    key: 'Escape',
    description: 'Close Menu',
    action: () => {
      store.update({ activeMenuId: null }, ['activeMenuId']);
    },
  });
  keyboardManager.attach();

  // Auto-load tree on bootstrap if a root was restored from session
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

  if (bootstrapError) {
    setError(bootstrapError);
  }
}

if (shouldAutoBootstrap()) {
  void bootstrapApp().catch((error) => {
    console.error(error);
  });
}
