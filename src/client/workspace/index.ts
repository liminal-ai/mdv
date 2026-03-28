import { ApiError, type ApiClient } from '../api.js';
import type { ClientState, StateStore } from '../state.js';
import type { ShellCapabilities } from '../utils/shell-capabilities.js';
import type { ClientError } from '../state.js';

export interface WorkspaceModule {
  switchRoot: (path: string) => Promise<void>;
  browseForFolder: () => Promise<void>;
  toggleWorkspacesCollapsed: () => Promise<void>;
  pinWorkspace: () => Promise<void>;
  addWorkspace: (path: string) => Promise<void>;
  removeWorkspace: (path: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  copyRootPath: () => Promise<void>;
  loadPackageFallbackTree: (root: string) => Promise<void>;
  restoreInitialRoot: (root: string | null) => Promise<void>;
}

interface WorkspaceModuleDependencies {
  api: Pick<
    ApiClient,
    'setRoot' | 'updateSidebar' | 'addWorkspace' | 'removeWorkspace' | 'getTree'
  >;
  store: StateStore;
  shellCapabilities: Pick<ShellCapabilities, 'pickFolder'>;
  applySession: (session: ClientState['session'], options?: { clearInvalidRoot?: boolean }) => void;
  setError: (error: unknown) => void;
  setClientError: (code: string, message: string, severity?: ClientError['severity']) => void;
  getErrorMessage: (error: unknown) => { code: string; message: string; timeout?: boolean };
  copyText: (text: string) => Promise<void>;
  onBeforeSwitchRoot?: () => void;
  onWatchRoot?: (path: string) => void;
}

export function createWorkspaceModule(dependencies: WorkspaceModuleDependencies): WorkspaceModule {
  const {
    api,
    store,
    shellCapabilities,
    applySession,
    setError,
    getErrorMessage,
    copyText,
    onBeforeSwitchRoot,
    onWatchRoot,
  } = dependencies;

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

  const setTreeError = (error: unknown, retryFn: () => void) => {
    if (error instanceof ApiError && error.timeout) {
      const info = getErrorMessage(error);
      store.update({ error: { ...info, onRetry: retryFn } }, ['error']);
    } else {
      setError(error);
    }
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
    onBeforeSwitchRoot?.();
    setTreeLoading(true);

    try {
      const session = await api.setRoot(path);
      applySession(session, { clearInvalidRoot: true });

      try {
        const treeResponse = await api.getTree(path);
        applyTree(treeResponse.tree);
        onWatchRoot?.(path);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'PATH_NOT_FOUND') {
          setInvalidRoot(error);
          return;
        }

        setTreeLoading(false);
        setTreeError(error, () => void refreshTree());
      }
    } catch (error) {
      setTreeLoading(false);
      setError(error);
    }
  };

  const browseForFolder = async () => {
    try {
      const selection = await shellCapabilities.pickFolder();
      if (!selection) {
        return;
      }

      await switchRoot(selection.path);
    } catch (error) {
      setError(error);
    }
  };

  const toggleWorkspacesCollapsed = async () => {
    try {
      const collapsed = store.get().session.sidebarState.workspacesCollapsed;
      applySession(await api.updateSidebar(!collapsed));
    } catch (error) {
      setError(error);
    }
  };

  const pinWorkspace = async () => {
    const root = store.get().session.lastRoot;
    if (!root) {
      return;
    }

    await addWorkspace(root);
  };

  const addWorkspace = async (path: string) => {
    try {
      applySession(await api.addWorkspace(path));
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
      applyTree([]);
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
      setTreeError(error, () => void refreshTree());
    }
  };

  const copyRootPath = async () => {
    const root = store.get().session.lastRoot;
    if (!root) {
      return;
    }

    try {
      await copyText(root);
    } catch (error) {
      setError(error);
    }
  };

  const loadPackageFallbackTree = async (root: string): Promise<void> => {
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
      setTreeError(error, () => void loadPackageFallbackTree(root));
    }
  };

  const restoreInitialRoot = async (root: string | null) => {
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
      } else {
        setTreeLoading(false);
        setTreeError(error, () => void refreshTree());
      }
    }
  };

  return {
    switchRoot,
    browseForFolder,
    toggleWorkspacesCollapsed,
    pinWorkspace,
    addWorkspace,
    removeWorkspace,
    refreshTree,
    copyRootPath,
    loadPackageFallbackTree,
    restoreInitialRoot,
  };
}
