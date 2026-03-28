import { BrowserWindow, ipcMain, screen } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const windowStateKeeper = require('electron-window-state');

const SHOW_TIMEOUT_MS = 5_000;

export function createMainWindow(serverUrl: string | null): BrowserWindow {
  const state = windowStateKeeper({
    defaultWidth: 1420,
    defaultHeight: 960,
  });

  const displays = screen.getAllDisplays();
  const isOnScreen = displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    return state.x >= x && state.x < x + width && state.y >= y && state.y < y + height;
  });

  const win = new BrowserWindow({
    x: isOnScreen ? state.x : undefined,
    y: isOnScreen ? state.y : undefined,
    width: state.width,
    height: state.height,
    minWidth: 980,
    minHeight: 620,
    show: false,
    title: 'mdv',
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  state.manage(win);

  if (serverUrl) {
    win.loadURL(`${serverUrl}/?electron=1`);
  } else {
    win.loadURL(
      'data:text/html,<h1>Server failed to start</h1><p>Check the console for errors.</p>',
    );
    win.show();
    return win;
  }

  // Delay showing the window until the renderer has finished restoring tabs,
  // so the user never sees the empty welcome screen flash before content loads.
  // Fall back to showing after a timeout in case bootstrap fails silently.
  let shown = false;
  const showOnce = () => {
    if (shown) return;
    shown = true;
    win.show();
  };

  const timeout = setTimeout(showOnce, SHOW_TIMEOUT_MS);

  ipcMain.once('app:renderer-ready', (event) => {
    if (event.sender === win.webContents) {
      clearTimeout(timeout);
      showOnce();
    }
  });

  return win;
}
