import { contextBridge, ipcRenderer } from 'electron';

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

  sendMenuState: (state: {
    hasDocument: boolean;
    hasDirtyTab: boolean;
    activeTabDirty: boolean;
    activeTheme: string;
    activeMode: string;
    defaultMode: string;
  }) => {
    ipcRenderer.send('menu:state-update', state);
  },
});
