import { BrowserWindow, screen } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const windowStateKeeper = require('electron-window-state');

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
    title: 'MD Viewer',
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.js', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  state.manage(win);

  if (serverUrl) {
    win.loadURL(`${serverUrl}?electron=1`);
  } else {
    win.loadURL(
      'data:text/html,<h1>Server failed to start</h1><p>Check the console for errors.</p>',
    );
    win.show();
    return win;
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  return win;
}
