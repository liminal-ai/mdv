// Electron preload script - stub for build:electron verification
// Full implementation in Story 5

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
});
