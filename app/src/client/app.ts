import { ApiClient, ApiError } from './api.js';
import { mountContentArea } from './components/content-area.js';
import { mountErrorNotification } from './components/error-notification.js';
import { mountMenuBar } from './components/menu-bar.js';
import { mountSidebar } from './components/sidebar.js';
import { mountTabStrip } from './components/tab-strip.js';
import { StateStore, type ClientState } from './state.js';
import { KeyboardManager } from './utils/keyboard.js';

function applyTheme(themeId: string): void {
  document.documentElement.dataset.theme = themeId;

  try {
    localStorage.setItem('mdv-theme', themeId);
  } catch {
    // Ignore storage failures in privacy-restricted environments.
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
  const bootstrap = await api.bootstrap();
  applyTheme(bootstrap.session.theme);

  const initialState: ClientState = {
    session: bootstrap.session,
    availableThemes: bootstrap.availableThemes,
    tree: [],
    treeLoading: false,
    activeMenuId: null,
    contextMenu: null,
    sidebarVisible: !bootstrap.session.sidebarState.workspacesCollapsed,
    expandedDirsByRoot: {},
    error: null,
  };

  const store = new StateStore(initialState);

  const applySession = (session: ClientState['session']) => {
    applyTheme(session.theme);
    store.update(
      {
        session,
        sidebarVisible: !session.sidebarState.workspacesCollapsed,
        error: null,
      },
      ['session', 'sidebarVisible', 'error'],
    );
  };

  const setError = (error: unknown) => {
    store.update({ error: getErrorMessage(error) }, ['error']);
  };

  const browseForFolder = async () => {
    try {
      const selection = await api.browse();
      if (!selection) {
        return;
      }

      applySession(await api.setRoot(selection.path));
    } catch (error) {
      setError(error);
    }
  };

  const toggleSidebar = async () => {
    try {
      applySession(await api.updateSidebar(store.get().sidebarVisible));
    } catch (error) {
      setError(error);
    }
  };

  const setTheme = async (themeId: string) => {
    try {
      applySession(await api.setTheme(themeId));
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
  mountSidebar(sidebarHost, store);
  mountTabStrip(tabStripHost, store);
  mountContentArea(contentAreaHost, store, { onBrowse: browseForFolder });
  mountErrorNotification(errorHost, store, {
    onDismiss: () => store.update({ error: null }, ['error']),
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
      void toggleSidebar();
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
}

void bootstrapApp().catch((error) => {
  console.error(error);
});
