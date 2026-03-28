import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import type { FastifyInstance } from 'fastify';
import { createMainWindow } from './window.js';
import { registerIpcHandlers } from './ipc.js';
import { setupFileHandler } from './file-handler.js';
import { buildMenu } from './menu.js';

let mainWindow: BrowserWindow | null = null;
let fastify: FastifyInstance | null = null;
let serverUrl: string | null = null;
let pendingFilePath: string | null = null;
let shuttingDownServer = false;
const serverModulePath = '../server/index.js';
const OPENABLE_EXTENSIONS = new Set(['.md', '.markdown']);
const STARTUP_PROFILE_ENV = 'MDV_PROFILE_STARTUP';
const startupProfiler = createStartupProfiler(process.env[STARTUP_PROFILE_ENV] === '1');

function createStartupProfiler(enabled: boolean) {
  if (!enabled) {
    return {
      mark: (_label: string) => {},
      flush: () => {},
    };
  }

  const startedAt = performance.now();
  const marks = new Map<string, number>([['app-launch', startedAt]]);

  return {
    mark(label: string) {
      if (!marks.has(label)) {
        marks.set(label, performance.now());
      }
    },
    flush() {
      const launch = marks.get('app-launch') ?? startedAt;
      const serverReady = marks.get('server-ready');
      const windowLoad = marks.get('window-load');
      const rendererReady = marks.get('renderer-ready');

      console.log(
        [
          '[startup]',
          `launch->serverReady=${serverReady ? Math.round(serverReady - launch) : 'n/a'}ms`,
          `serverReady->windowLoad=${
            serverReady && windowLoad ? Math.round(windowLoad - serverReady) : 'n/a'
          }ms`,
          `windowLoad->rendererReady=${
            windowLoad && rendererReady ? Math.round(rendererReady - windowLoad) : 'n/a'
          }ms`,
          `launch->rendererReady=${rendererReady ? Math.round(rendererReady - launch) : 'n/a'}ms`,
        ].join(' '),
      );
    },
  };
}

function getLaunchFilePath(argv: string[]): string | null {
  for (const arg of argv) {
    if (!arg || arg.startsWith('-')) {
      continue;
    }

    const ext = path.extname(arg).toLowerCase();
    if (!OPENABLE_EXTENSIONS.has(ext)) {
      continue;
    }

    return path.isAbsolute(arg) ? arg : path.resolve(arg);
  }

  return null;
}

function wireMainWindow(win: BrowserWindow, currentServerUrl: string | null): void {
  if (!currentServerUrl) {
    return;
  }

  try {
    buildMenu(win);
  } catch {
    // Keep the app window usable even if menu setup fails in a constrained environment.
  }

  registerIpcHandlers(win);
  setupFileHandler(
    win,
    () => pendingFilePath,
    () => {
      pendingFilePath = null;
    },
  );
}

function attachStartupProfiling(win: BrowserWindow): void {
  win.webContents.on('did-finish-load', () => {
    startupProfiler.mark('window-load');
  });

  const handleRendererReady = (event: { sender: BrowserWindow['webContents'] }) => {
    if (event.sender !== win.webContents) {
      return;
    }

    startupProfiler.mark('renderer-ready');
    startupProfiler.flush();
  };

  ipcMain.once('app:renderer-ready', handleRendererReady);
}

app.on('open-file', (event, path) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('app:open-file', { path });
    mainWindow.focus();
  } else {
    pendingFilePath = path;
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const targetWindow = mainWindow ?? BrowserWindow.getAllWindows()[0] ?? null;
    const filePath = getLaunchFilePath(argv);

    if (targetWindow) {
      mainWindow = targetWindow;

      if (targetWindow.isMinimized()) {
        targetWindow.restore();
      }

      targetWindow.focus();
      if (filePath) {
        if (targetWindow.webContents.isLoading()) {
          pendingFilePath = filePath;
        } else {
          targetWindow.webContents.send('app:open-file', { path: filePath });
        }
      }
    }
  });

  app.whenReady().then(async () => {
    try {
      const { startServer } = await import(serverModulePath);
      const server = await startServer({
        openUrl: async () => {},
        preferredPort: 0,
      });
      fastify = server;
      startupProfiler.mark('server-ready');
      pendingFilePath ??= getLaunchFilePath(process.argv);
      const address = server.server.address();
      const port = typeof address === 'object' ? address?.port : 3000;
      serverUrl = `http://localhost:${port}`;

      mainWindow = createMainWindow(serverUrl);
      wireMainWindow(mainWindow, serverUrl);
      attachStartupProfiling(mainWindow);
    } catch (error) {
      console.error('Server failed to start:', error);
      mainWindow = createMainWindow(null);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(serverUrl);
      wireMainWindow(mainWindow, serverUrl);
    }
  });

  app.on('will-quit', (event) => {
    if (shuttingDownServer || !fastify) {
      return;
    }

    event.preventDefault();
    shuttingDownServer = true;

    const server = fastify;
    fastify = null;

    void server
      .close()
      .catch((error) => {
        console.error('Failed to close server:', error);
      })
      .finally(() => {
        app.exit(0);
      });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
