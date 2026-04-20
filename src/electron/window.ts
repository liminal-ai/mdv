import { BrowserWindow, ipcMain, screen } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const windowStateKeeper = require('electron-window-state');

const SHOW_TIMEOUT_MS = 5_000;

export interface StartupFailureDetails {
  details?: string;
  guidance?: string;
  logPath?: string;
}

export function createMainWindow(
  serverUrl: string | null,
  startupFailure: StartupFailureDetails | null = null,
): BrowserWindow {
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
    win.loadURL(buildStartupFailureUrl(startupFailure));
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

function buildStartupFailureUrl(startupFailure: StartupFailureDetails | null): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(buildStartupFailureHtml(startupFailure))}`;
}

function buildStartupFailureHtml(startupFailure: StartupFailureDetails | null): string {
  const guidance = startupFailure?.guidance
    ? `<p>${escapeHtml(startupFailure.guidance)}</p>`
    : '<p>Check the startup log for details.</p>';
  const logPath = startupFailure?.logPath
    ? `<p>Startup log: <code>${escapeHtml(startupFailure.logPath)}</code></p>`
    : '';
  const details = startupFailure?.details
    ? `<details open><summary>Error details</summary><pre>${escapeHtml(startupFailure.details)}</pre></details>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>mdv startup error</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", sans-serif;
      }

      body {
        margin: 0;
        background: #f6f7fb;
        color: #182131;
      }

      main {
        max-width: 760px;
        margin: 48px auto;
        padding: 32px;
        background: #ffffff;
        border: 1px solid #d9dfeb;
        border-radius: 18px;
        box-shadow: 0 18px 48px rgba(24, 33, 49, 0.08);
      }

      h1 {
        margin-top: 0;
        margin-bottom: 12px;
        font-size: 28px;
      }

      p,
      summary {
        line-height: 1.5;
      }

      code,
      pre {
        font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      }

      code {
        word-break: break-all;
      }

      details {
        margin-top: 20px;
      }

      pre {
        margin-top: 12px;
        padding: 16px;
        overflow: auto;
        background: #101826;
        color: #f5f7fb;
        border-radius: 12px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Server failed to start</h1>
      ${guidance}
      ${logPath}
      ${details}
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
