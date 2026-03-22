import { BrowserWindow } from 'electron';

export function setupFileHandler(
  win: BrowserWindow,
  getPendingFilePath: () => string | null,
  clearPendingFilePath: () => void,
): void {
  win.webContents.on('did-finish-load', () => {
    const pending = getPendingFilePath();
    if (pending) {
      win.webContents.send('app:open-file', { path: pending });
      clearPendingFilePath();
    }
  });
}
