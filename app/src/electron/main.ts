// Electron main process entry point - stub for build:electron verification
// Full implementation in Story 5

import { app } from 'electron';

app.whenReady().then(() => {
  console.log('MD Viewer Electron app starting...');
  // Story 5 will implement: startServer(), createBrowserWindow(), registerIpcHandlers()
});

app.on('window-all-closed', () => {
  app.quit();
});
