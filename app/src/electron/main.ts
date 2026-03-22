import { app, BrowserWindow } from 'electron';
import type { FastifyInstance } from 'fastify';
import { createMainWindow } from './window.js';
import { registerIpcHandlers } from './ipc.js';
import { setupFileHandler } from './file-handler.js';
import { buildMenu } from './menu.js';

let mainWindow: BrowserWindow | null = null;
let fastify: FastifyInstance | null = null;
let serverUrl: string | null = null;
let pendingFilePath: string | null = null;
let quittingWithServerShutdown = false;
const serverModulePath = '../server/index.js';

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

    if (targetWindow) {
      mainWindow = targetWindow;

      if (targetWindow.isMinimized()) {
        targetWindow.restore();
      }

      targetWindow.focus();
      const filePath = argv.find((arg) => arg.endsWith('.md') || arg.endsWith('.markdown'));
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
      fastify = await startServer({
        openUrl: async () => {},
        preferredPort: 0,
      });
      const address = fastify.server.address();
      const port = typeof address === 'object' ? address?.port : 3000;
      serverUrl = `http://localhost:${port}`;

      mainWindow = createMainWindow(serverUrl);
      wireMainWindow(mainWindow, serverUrl);
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

  app.on('before-quit', (event) => {
    if (quittingWithServerShutdown || !fastify) {
      return;
    }

    event.preventDefault();
    quittingWithServerShutdown = true;

    const server = fastify;
    fastify = null;

    void server
      .close()
      .catch((error) => {
        console.error('Failed to close server:', error);
      })
      .finally(() => {
        app.quit();
      });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
