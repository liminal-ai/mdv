"use strict";

// src/electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
  onMenuAction: (callback) => {
    import_electron.ipcRenderer.on("menu:action", (_event, action, args) => {
      callback(action, args);
    });
  },
  onOpenFile: (callback) => {
    import_electron.ipcRenderer.on("app:open-file", (_event, data) => {
      callback(data.path);
    });
  },
  onQuitRequest: (callback) => {
    import_electron.ipcRenderer.on("app:quit-request", () => {
      callback();
    });
  },
  confirmQuit: () => {
    import_electron.ipcRenderer.send("app:quit-confirmed");
  },
  cancelQuit: () => {
    import_electron.ipcRenderer.send("app:quit-cancelled");
  },
  sendRendererReady: () => {
    import_electron.ipcRenderer.send("app:renderer-ready");
  },
  sendMenuState: (state) => {
    import_electron.ipcRenderer.send("menu:state-update", state);
  }
});
