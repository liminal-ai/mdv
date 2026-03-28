import { contextBridge, ipcRenderer } from 'electron';
import type { MenuState } from '../shared/contracts/electron.js';

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,

  onMenuAction: (callback: (action: string, args?: unknown) => void) => {
    ipcRenderer.on('menu:action', (_event, action: string, args?: unknown) => {
      callback(action, args);
    });
  },

  onOpenFile: (callback: (path: string) => void) => {
    ipcRenderer.on('app:open-file', (_event, data: { path: string }) => {
      callback(data.path);
    });
  },

  onQuitRequest: (callback: () => void) => {
    ipcRenderer.on('app:quit-request', () => {
      callback();
    });
  },

  confirmQuit: () => {
    ipcRenderer.send('app:quit-confirmed');
  },

  cancelQuit: () => {
    ipcRenderer.send('app:quit-cancelled');
  },

  sendRendererReady: () => {
    ipcRenderer.send('app:renderer-ready');
  },

  sendMenuState: (state: MenuState) => {
    ipcRenderer.send('menu:state-update', state);
  },

  pickMarkdownFile: () => ipcRenderer.invoke('dialog:pick-markdown-file'),

  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),

  pickPackage: () => ipcRenderer.invoke('dialog:pick-package'),

  saveDialog: (request: { defaultPath: string; defaultFilename: string; prompt?: string }) =>
    ipcRenderer.invoke('dialog:save', request),
});
