import type { StateStore, TabState } from '../state.js';
import type { ElectronBridge } from '../utils/electron-bridge.js';
import type { WsClient } from '../utils/ws.js';

const WS_DISCONNECTED_ERROR_CODE = 'WS_DISCONNECTED';
const WS_SERVER_ERROR_CODE = 'WS_SERVER_ERROR';

export interface IntegrationsModule {
  start: () => void;
  sendRendererReady: () => void;
  getBridge: () => ElectronBridge | null;
}

interface IntegrationsModuleDependencies {
  store: StateStore;
  wsClient: WsClient | null;
  bridge: ElectronBridge | null;
  setClientError: (code: string, message: string, severity?: 'error' | 'warning' | 'info') => void;
  onWatchPath: (path: string) => void;
  onWatchRoot: (path: string) => void;
  onFileChange: (message: { path: string; event: 'modified' | 'deleted' | 'created' }) => void;
  onTreeChange: (message: { root: string }) => void;
  onOpenFile: (path: string) => Promise<void> | void;
  onQuitRequest: (dirtyTabs: TabState[], bridge: ElectronBridge) => Promise<void> | void;
  onMenuAction: (action: string, args?: unknown) => void;
}

export function createIntegrationsModule(
  dependencies: IntegrationsModuleDependencies,
): IntegrationsModule {
  const {
    store,
    wsClient,
    bridge,
    setClientError,
    onWatchPath,
    onWatchRoot,
    onFileChange,
    onTreeChange,
    onOpenFile,
    onQuitRequest,
    onMenuAction,
  } = dependencies;

  const rewatchAllOpenTabs = () => {
    for (const path of new Set(store.get().tabs.map((tab) => tab.path))) {
      onWatchPath(path);
    }
  };

  const start = () => {
    if (wsClient) {
      wsClient.on('open', () => {
        if (store.get().error?.code === WS_DISCONNECTED_ERROR_CODE) {
          store.update({ error: null }, ['error']);
        }
        rewatchAllOpenTabs();
        const currentRoot = store.get().session.lastRoot;
        if (currentRoot) {
          onWatchRoot(currentRoot);
        }
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
        onFileChange(message);
      });
      wsClient.on('tree-change', (message) => {
        onTreeChange(message);
      });
      wsClient.connect();
    }

    if (bridge) {
      bridge.onMenuAction((action, args) => {
        onMenuAction(action, args);
      });

      bridge.onOpenFile((path) => {
        void onOpenFile(path);
      });

      bridge.onQuitRequest(() => {
        const dirtyTabs = store.get().tabs.filter((tab) => tab.dirty);
        if (dirtyTabs.length === 0) {
          bridge.confirmQuit();
          return;
        }

        void onQuitRequest(dirtyTabs, bridge);
      });

      const sendMenuState = () => {
        const state = store.get();
        const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
        bridge.sendMenuState({
          hasDocument: state.tabs.length > 0,
          hasDirtyTab: state.tabs.some((tab) => tab.dirty),
          activeTabDirty: activeTab?.dirty ?? false,
          activeTheme: state.session.theme,
          activeMode: activeTab?.mode ?? 'render',
          defaultMode: state.session.defaultOpenMode,
        });
      };

      let menuStateTimer: ReturnType<typeof setTimeout> | null = null;
      store.subscribe(() => {
        if (menuStateTimer) {
          clearTimeout(menuStateTimer);
        }

        menuStateTimer = setTimeout(() => {
          sendMenuState();
        }, 50);
      });

      sendMenuState();
    }
  };

  return {
    start,
    sendRendererReady: () => {
      bridge?.sendRendererReady();
    },
    getBridge: () => bridge,
  };
}
