import { ipcMain, BrowserWindow } from 'electron';

let activeWindow: BrowserWindow | null = null;
let quitPending = false;
let ipcHandlersRegistered = false;
const wiredWindows = new WeakSet<BrowserWindow>();

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

    ipcHandlersRegistered = true;
  }
}
