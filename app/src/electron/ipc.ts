import { ipcMain, BrowserWindow } from 'electron';

export function registerIpcHandlers(win: BrowserWindow): void {
  let quitPending = false;

  win.on('close', (event) => {
    if (quitPending) {
      return;
    }
    event.preventDefault();
    win.webContents.send('app:quit-request');
  });

  ipcMain.on('app:quit-confirmed', () => {
    quitPending = true;
    win.close();
  });

  ipcMain.on('app:quit-cancelled', () => {
    // Window stays open
  });
}
