import { BrowserWindow, ipcMain } from 'electron';

const OPEN_FILE_CHANNEL = 'app:open-file';
const RENDERER_READY_CHANNEL = 'app:renderer-ready';

let activeWindow: BrowserWindow | null = null;
let getPendingFilePathRef: (() => string | null) | null = null;
let clearPendingFilePathRef: (() => void) | null = null;
let mainWindowLoaded = false;
let rendererReady = false;
let rendererReadyListenerRegistered = false;
const wiredWindows = new WeakSet<BrowserWindow>();

function flushPendingFile(): void {
  if (!activeWindow || !mainWindowLoaded || !rendererReady) {
    return;
  }

  const pending = getPendingFilePathRef?.();
  if (!pending) {
    return;
  }

  activeWindow.webContents.send(OPEN_FILE_CHANNEL, { path: pending });
  clearPendingFilePathRef?.();
}

export function flushPendingOpenFile(): void {
  flushPendingFile();
}

export function setupFileHandler(
  win: BrowserWindow,
  getPendingFilePath: () => string | null,
  clearPendingFilePath: () => void,
): void {
  activeWindow = win;
  getPendingFilePathRef = getPendingFilePath;
  clearPendingFilePathRef = clearPendingFilePath;
  mainWindowLoaded = false;
  rendererReady = false;

  if (!wiredWindows.has(win)) {
    win.webContents.on('did-finish-load', () => {
      if (activeWindow !== win) {
        return;
      }

      mainWindowLoaded = true;
      flushPendingFile();
    });
    wiredWindows.add(win);
  }

  if (!rendererReadyListenerRegistered) {
    ipcMain.on(RENDERER_READY_CHANNEL, (event) => {
      if (!activeWindow || event.sender !== activeWindow.webContents) {
        return;
      }

      rendererReady = true;
      flushPendingFile();
    });
    rendererReadyListenerRegistered = true;
  }
}
