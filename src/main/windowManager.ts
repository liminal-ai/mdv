import path from 'node:path';

import { BrowserWindow, app } from 'electron';

import { IPC_EVENTS, type TabsDiskChangedPayload, type TabsOpenRequestPayload, type UiCommand, type UiCommandPayload } from '../core/ipc';
import { isMarkdownPath } from '../core/drop';
import { buildTabsStatePayload, type MainProcessState } from './state';
import { preloadPath, rendererHtmlPath } from './paths';

interface WindowManagerOptions {
  state: MainProcessState;
}

export interface WindowManager {
  createMainWindow(): void;
  revealMainWindow(): void;
  ensureMainWindow(): Promise<BrowserWindow>;
  revealAndOpenDocument(rawPath: string, openDocument: (rawPath: string) => Promise<void>): Promise<void>;
  requestOpenDocument(rawPath: string, openDocument: (rawPath: string) => Promise<void>): void;
  sendUiCommand(command: UiCommand): boolean;
  sendTabsStateUpdated(): void;
  sendDiskChanged(payload: TabsDiskChangedPayload): void;
  sendSidebarToggle(): void;
}

export function createWindowManager({ state }: WindowManagerOptions): WindowManager {
  function createMainWindow(): void {
    state.mainWindow = new BrowserWindow({
      width: 1420,
      height: 960,
      minWidth: 980,
      minHeight: 620,
      title: 'MD Viewer',
      webPreferences: {
        preload: preloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    state.mainWindow.on('closed', () => {
      state.mainWindow = null;
    });

    void state.mainWindow.loadFile(rendererHtmlPath());
  }

  function revealMainWindow(): void {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
      return;
    }

    if (state.mainWindow.isMinimized()) {
      state.mainWindow.restore();
    }
    state.mainWindow.show();
    state.mainWindow.focus();
    app.focus({ steal: true });
  }

  async function ensureMainWindow(): Promise<BrowserWindow> {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
      createMainWindow();
    }

    const window = state.mainWindow;
    if (!window) {
      throw new Error('Unable to create main window.');
    }

    if (window.webContents.isLoadingMainFrame()) {
      await new Promise<void>((resolve) => {
        window.webContents.once('did-finish-load', () => resolve());
      });
    }

    return window;
  }

  async function revealAndOpenDocument(rawPath: string, openDocument: (rawPath: string) => Promise<void>): Promise<void> {
    try {
      await ensureMainWindow();
      revealMainWindow();
      await openDocument(rawPath);
    } catch (error) {
      console.error(`Failed to open document from OS event: ${String(error)}`);
    }
  }

  function requestOpenDocument(rawPath: string, openDocument: (rawPath: string) => Promise<void>): void {
    const resolvedPath = path.resolve(rawPath);
    if (!isMarkdownPath(resolvedPath)) {
      return;
    }

    if (state.mainWindow && !state.mainWindow.isDestroyed() && !state.mainWindow.webContents.isLoadingMainFrame()) {
      const payload: TabsOpenRequestPayload = { filePath: resolvedPath };
      state.mainWindow.webContents.send(IPC_EVENTS.tabsOpenRequest, payload);
      revealMainWindow();
      return;
    }

    void revealAndOpenDocument(resolvedPath, openDocument);
  }

  function sendUiCommand(command: UiCommand): boolean {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
      return false;
    }

    const payload: UiCommandPayload = { command };
    state.mainWindow.webContents.send(IPC_EVENTS.uiCommand, payload);
    return true;
  }

  function sendTabsStateUpdated(): void {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
      return;
    }

    state.mainWindow.webContents.send(IPC_EVENTS.tabsStateUpdated, buildTabsStatePayload(state));
  }

  function sendDiskChanged(payload: TabsDiskChangedPayload): void {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
      return;
    }

    state.mainWindow.webContents.send(IPC_EVENTS.tabsDiskChanged, payload);
  }

  function sendSidebarToggle(): void {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
      return;
    }

    state.mainWindow.webContents.send(IPC_EVENTS.uiToggleSidebar);
  }

  return {
    createMainWindow,
    revealMainWindow,
    ensureMainWindow,
    revealAndOpenDocument,
    requestOpenDocument,
    sendUiCommand,
    sendTabsStateUpdated,
    sendDiskChanged,
    sendSidebarToggle
  };
}
