// src/electron/main.ts
import path from "node:path";
import { app as app2, BrowserWindow as BrowserWindow5 } from "electron";

// src/electron/window.ts
import { BrowserWindow, screen } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
var require2 = createRequire(import.meta.url);
var windowStateKeeper = require2("electron-window-state");
function createMainWindow(serverUrl2) {
  const state = windowStateKeeper({
    defaultWidth: 1420,
    defaultHeight: 960
  });
  const displays = screen.getAllDisplays();
  const isOnScreen = displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    return state.x >= x && state.x < x + width && state.y >= y && state.y < y + height;
  });
  const win = new BrowserWindow({
    x: isOnScreen ? state.x : void 0,
    y: isOnScreen ? state.y : void 0,
    width: state.width,
    height: state.height,
    minWidth: 980,
    minHeight: 620,
    show: false,
    title: "mdv",
    webPreferences: {
      preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  state.manage(win);
  if (serverUrl2) {
    win.loadURL(`${serverUrl2}/?electron=1`);
  } else {
    win.loadURL(
      "data:text/html,<h1>Server failed to start</h1><p>Check the console for errors.</p>"
    );
    win.show();
    return win;
  }
  win.once("ready-to-show", () => {
    win.show();
  });
  return win;
}

// src/electron/ipc.ts
import { ipcMain } from "electron";
var activeWindow = null;
var quitPending = false;
var ipcHandlersRegistered = false;
var wiredWindows = /* @__PURE__ */ new WeakSet();
function registerIpcHandlers(win) {
  activeWindow = win;
  quitPending = false;
  if (!wiredWindows.has(win)) {
    win.on("close", (event) => {
      if (quitPending) {
        return;
      }
      event.preventDefault();
      win.webContents.send("app:quit-request");
    });
    wiredWindows.add(win);
  }
  if (!ipcHandlersRegistered) {
    ipcMain.on("app:quit-confirmed", () => {
      if (!activeWindow) {
        return;
      }
      quitPending = true;
      activeWindow.close();
    });
    ipcMain.on("app:quit-cancelled", () => {
    });
    ipcHandlersRegistered = true;
  }
}

// src/electron/file-handler.ts
import { ipcMain as ipcMain2 } from "electron";
var OPEN_FILE_CHANNEL = "app:open-file";
var RENDERER_READY_CHANNEL = "app:renderer-ready";
var activeWindow2 = null;
var getPendingFilePathRef = null;
var clearPendingFilePathRef = null;
var mainWindowLoaded = false;
var rendererReady = false;
var rendererReadyListenerRegistered = false;
var wiredWindows2 = /* @__PURE__ */ new WeakSet();
function flushPendingFile() {
  if (!activeWindow2 || !mainWindowLoaded || !rendererReady) {
    return;
  }
  const pending = getPendingFilePathRef?.();
  if (!pending) {
    return;
  }
  activeWindow2.webContents.send(OPEN_FILE_CHANNEL, { path: pending });
  clearPendingFilePathRef?.();
}
function setupFileHandler(win, getPendingFilePath, clearPendingFilePath) {
  activeWindow2 = win;
  getPendingFilePathRef = getPendingFilePath;
  clearPendingFilePathRef = clearPendingFilePath;
  mainWindowLoaded = false;
  rendererReady = false;
  if (!wiredWindows2.has(win)) {
    win.webContents.on("did-finish-load", () => {
      if (activeWindow2 !== win) {
        return;
      }
      mainWindowLoaded = true;
      flushPendingFile();
    });
    wiredWindows2.add(win);
  }
  if (!rendererReadyListenerRegistered) {
    ipcMain2.on(RENDERER_READY_CHANNEL, (event) => {
      if (!activeWindow2 || event.sender !== activeWindow2.webContents) {
        return;
      }
      rendererReady = true;
      flushPendingFile();
    });
    rendererReadyListenerRegistered = true;
  }
}

// src/electron/menu.ts
import { app, Menu, ipcMain as ipcMain3 } from "electron";
var currentState = {
  hasDocument: false,
  hasDirtyTab: false,
  activeTabDirty: false,
  activeTheme: "light-default",
  activeMode: "render",
  defaultMode: "render"
};
var activeWindow3 = null;
var menuStateListenerRegistered = false;
var THEMES = [
  { id: "light-default", label: "Light Default" },
  { id: "light-warm", label: "Light Warm" },
  { id: "dark-default", label: "Dark Default" },
  { id: "dark-cool", label: "Dark Cool" }
];
function sendAction(win, action, args) {
  if (args === void 0) {
    win.webContents.send("menu:action", action);
    return;
  }
  win.webContents.send("menu:action", action, args);
}
function sendActionToActiveWindow(action, args) {
  if (!activeWindow3) {
    return;
  }
  sendAction(activeWindow3, action, args);
}
function rebuildMenu() {
  if (!Menu?.buildFromTemplate || !Menu?.setApplicationMenu || !activeWindow3) {
    return;
  }
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "File",
      submenu: [
        {
          label: "Open File",
          accelerator: "CmdOrCtrl+O",
          click: () => sendActionToActiveWindow("open-file")
        },
        {
          label: "Open Folder",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => sendActionToActiveWindow("open-folder")
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          enabled: currentState.activeTabDirty,
          click: () => sendActionToActiveWindow("save")
        },
        {
          label: "Save As\u2026",
          accelerator: "CmdOrCtrl+Shift+S",
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow("save-as")
        },
        { type: "separator" },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow("close-tab")
        }
      ]
    },
    {
      label: "Export",
      submenu: [
        {
          label: "PDF",
          accelerator: "CmdOrCtrl+Shift+E",
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow("export-pdf")
        },
        {
          label: "DOCX",
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow("export-docx")
        },
        {
          label: "HTML",
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow("export-html")
        }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+\\",
          click: () => sendActionToActiveWindow("toggle-sidebar")
        },
        { type: "separator" },
        {
          label: "Theme",
          submenu: THEMES.map((theme) => ({
            label: theme.label,
            type: "checkbox",
            checked: currentState.activeTheme === theme.id,
            click: () => sendActionToActiveWindow("set-theme", theme.id)
          }))
        },
        { type: "separator" },
        {
          label: "Render Mode",
          accelerator: "CmdOrCtrl+Shift+M",
          type: "checkbox",
          checked: currentState.activeMode === "render",
          click: () => sendActionToActiveWindow("toggle-mode")
        },
        { type: "separator" },
        { role: "toggleDevTools" }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function buildMenu(win) {
  if (!Menu?.buildFromTemplate || !Menu?.setApplicationMenu) {
    return;
  }
  activeWindow3 = win;
  rebuildMenu();
  if (!menuStateListenerRegistered) {
    ipcMain3.on("menu:state-update", (_event, state) => {
      currentState = state;
      rebuildMenu();
    });
    menuStateListenerRegistered = true;
  }
}

// src/electron/main.ts
var mainWindow = null;
var fastify = null;
var serverUrl = null;
var pendingFilePath = null;
var shuttingDownServer = false;
var serverModulePath = "../server/index.js";
var OPENABLE_EXTENSIONS = /* @__PURE__ */ new Set([".md", ".markdown"]);
function getLaunchFilePath(argv) {
  for (const arg of argv) {
    if (!arg || arg.startsWith("-")) {
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
function wireMainWindow(win, currentServerUrl) {
  if (!currentServerUrl) {
    return;
  }
  try {
    buildMenu(win);
  } catch {
  }
  registerIpcHandlers(win);
  setupFileHandler(
    win,
    () => pendingFilePath,
    () => {
      pendingFilePath = null;
    }
  );
}
app2.on("open-file", (event, path2) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send("app:open-file", { path: path2 });
    mainWindow.focus();
  } else {
    pendingFilePath = path2;
  }
});
var gotLock = app2.requestSingleInstanceLock();
if (!gotLock) {
  app2.quit();
} else {
  app2.on("second-instance", (_event, argv) => {
    const targetWindow = mainWindow ?? BrowserWindow5.getAllWindows()[0] ?? null;
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
          targetWindow.webContents.send("app:open-file", { path: filePath });
        }
      }
    }
  });
  app2.whenReady().then(async () => {
    try {
      const { startServer } = await import(serverModulePath);
      fastify = await startServer({
        openUrl: async () => {
        },
        preferredPort: 0
      });
      pendingFilePath ??= getLaunchFilePath(process.argv);
      const address = fastify.server.address();
      const port = typeof address === "object" ? address?.port : 3e3;
      serverUrl = `http://localhost:${port}`;
      mainWindow = createMainWindow(serverUrl);
      wireMainWindow(mainWindow, serverUrl);
    } catch (error) {
      console.error("Server failed to start:", error);
      mainWindow = createMainWindow(null);
    }
  });
  app2.on("activate", () => {
    if (BrowserWindow5.getAllWindows().length === 0) {
      mainWindow = createMainWindow(serverUrl);
      wireMainWindow(mainWindow, serverUrl);
    }
  });
  app2.on("will-quit", (event) => {
    if (shuttingDownServer || !fastify) {
      return;
    }
    event.preventDefault();
    shuttingDownServer = true;
    const server = fastify;
    fastify = null;
    void server.close().catch((error) => {
      console.error("Failed to close server:", error);
    }).finally(() => {
      app2.exit(0);
    });
  });
  app2.on("window-all-closed", () => {
    app2.quit();
  });
}
