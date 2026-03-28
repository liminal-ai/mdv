import path from 'node:path';
import { dialog, ipcMain, BrowserWindow } from 'electron';
import type { OpenDialogOptions, SaveDialogOptions } from 'electron';

let activeWindow: BrowserWindow | null = null;
let quitPending = false;
let ipcHandlersRegistered = false;
const wiredWindows = new WeakSet<BrowserWindow>();

function getDialogWindow(): BrowserWindow | undefined {
  return activeWindow ?? undefined;
}

async function showOpenDialog(options: OpenDialogOptions): Promise<{ path: string } | null> {
  const targetWindow = getDialogWindow();
  const result = targetWindow
    ? await dialog.showOpenDialog(targetWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return { path: result.filePaths[0]! };
}

async function showSaveDialog(options: SaveDialogOptions): Promise<{ path: string } | null> {
  const targetWindow = getDialogWindow();
  const result = targetWindow
    ? await dialog.showSaveDialog(targetWindow, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) {
    return null;
  }

  return { path: result.filePath };
}

export function registerIpcHandlers(win: BrowserWindow): void {
  activeWindow = win;
  quitPending = false;

  if (!wiredWindows.has(win)) {
    win.on('close', (event) => {
      if (quitPending) {
        return;
      }

      event.preventDefault();
      win.webContents.send('app:quit-request');
    });
    wiredWindows.add(win);
  }

  if (!ipcHandlersRegistered) {
    ipcMain.on('app:quit-confirmed', () => {
      if (!activeWindow) {
        return;
      }

      quitPending = true;
      activeWindow.close();
    });

    ipcMain.on('app:quit-cancelled', () => {
      // Window stays open
    });

    ipcMain.handle('dialog:pick-markdown-file', async () =>
      showOpenDialog({
        title: 'Open Markdown File',
        properties: ['openFile'],
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      }),
    );

    ipcMain.handle('dialog:pick-folder', async () =>
      showOpenDialog({
        title: 'Select Folder',
        properties: ['openDirectory'],
      }),
    );

    ipcMain.handle('dialog:pick-package', async () =>
      showOpenDialog({
        title: 'Open Package',
        properties: ['openFile'],
        filters: [{ name: 'Markdown Package', extensions: ['mpk', 'mpkz'] }],
      }),
    );

    ipcMain.handle(
      'dialog:save',
      async (
        eventOrRequest: unknown,
        requestOverride:
          | {
              defaultPath: string;
              defaultFilename: string;
              prompt?: string;
            }
          | undefined,
      ) => {
        const request = requestOverride ??
          ((eventOrRequest &&
          typeof eventOrRequest === 'object' &&
          'defaultPath' in eventOrRequest &&
          'defaultFilename' in eventOrRequest
            ? eventOrRequest
            : undefined) as
            | {
                defaultPath: string;
                defaultFilename: string;
                prompt?: string;
              }
            | undefined) ?? {
            defaultPath: '',
            defaultFilename: '',
          };

        return showSaveDialog({
          title: request.prompt ?? 'Save',
          defaultPath: path.join(request.defaultPath, request.defaultFilename),
        });
      },
    );

    ipcHandlersRegistered = true;
  }
}
