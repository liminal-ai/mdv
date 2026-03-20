import path from 'node:path';

import { Menu, app } from 'electron';

import { parseInternalCliArgs } from '../core/cliArgs';
import { isMarkdownPath } from '../core/drop';
import { ElectronMermaidRenderer } from './mermaidRenderer';
import { buildApplicationMenu } from './menu';
import { PreferencesStore } from './preferences';
import { runCliExport } from './cliExport';
import { createExportService } from './exportService';
import { createFolderService } from './folderService';
import { registerIpcHandlers } from './ipc';
import { createMainProcessState } from './state';
import { createTabService } from './tabService';
import { createWindowManager } from './windowManager';

export function startDesktopApp(): void {
  const state = createMainProcessState();
  const mermaidRenderer = new ElectronMermaidRenderer();
  const pendingOpenFiles: string[] = [];
  let preferencesStore: PreferencesStore | null = null;

  const getPreferencesStore = () => preferencesStore;
  const windowManager = createWindowManager({ state });
  const tabService = createTabService({
    state,
    mermaidRenderer,
    getPreferencesStore,
    sendTabsStateUpdated: () => windowManager.sendTabsStateUpdated(),
    sendDiskChanged: (tabId, filePath) => windowManager.sendDiskChanged({ tabId, filePath })
  });
  const folderService = createFolderService({ state, getPreferencesStore });
  const exportService = createExportService({ tabService, mermaidRenderer });

  const hasSingleInstanceLock = app.requestSingleInstanceLock();
  if (!hasSingleInstanceLock) {
    app.quit();
    return;
  }

  app.on('open-file', (event, openPath) => {
    event.preventDefault();
    if (app.isReady()) {
      windowManager.requestOpenDocument(openPath, async (rawPath) => {
        await tabService.openOrReuseTab(rawPath, { activate: true, sendUpdate: true, persist: true });
      });
      return;
    }
    pendingOpenFiles.push(openPath);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', (event) => {
    if (
      !state.quitConfirmed &&
      state.mainWindow &&
      !state.mainWindow.isDestroyed() &&
      !state.mainWindow.webContents.isDestroyed()
    ) {
      event.preventDefault();
      windowManager.sendUiCommand('request-app-quit');
      return;
    }
  });

  app.on('will-quit', () => {
    tabService.stopWatchingAllTabs();
    void mermaidRenderer.dispose();
  });

  app.on('second-instance', (_event, argv) => {
    const launchTarget = findLaunchMarkdownArg(argv.slice(1));
    if (launchTarget) {
      windowManager.requestOpenDocument(launchTarget, async (rawPath) => {
        await tabService.openOrReuseTab(rawPath, { activate: true, sendUpdate: true, persist: true });
      });
      return;
    }
    windowManager.revealMainWindow();
  });

  app.whenReady().then(async () => {
    const internalCli = parseInternalCliArgs(process.argv.slice(2));
    if (!internalCli.ok) {
      console.error(internalCli.error);
      app.exit(2);
      return;
    }

    if (internalCli.value?.cliExport) {
      const code = await runCliExport(internalCli.value, mermaidRenderer);
      await mermaidRenderer.dispose();
      app.exit(code);
      return;
    }

    preferencesStore = new PreferencesStore(app.getPath('userData'));
    const prefs = await preferencesStore.load();

    await folderService.initializeRootFolder();
    await tabService.restoreTabsFromPreferences(prefs.openTabs ?? [], prefs.activeTabPath);

    registerIpcHandlers({
      tabService,
      folderService,
      exportService,
      onQuitRequested: () => {
        state.quitConfirmed = true;
      }
    });

    windowManager.createMainWindow();

    Menu.setApplicationMenu(
      buildApplicationMenu({
        openMarkdown: () => {
          if (!windowManager.sendUiCommand('open-markdown')) {
            void tabService.openTabDialog();
          }
        },
        openFolder: () => {
          void folderService.chooseRootFolderViaDialog();
        },
        reloadDocument: () => {
          windowManager.sendUiCommand('reload-document');
        },
        saveDocument: () => {
          windowManager.sendUiCommand('save-document');
        },
        saveDocumentAs: () => {
          windowManager.sendUiCommand('save-document-as');
        },
        closeTab: () => {
          windowManager.sendUiCommand('close-tab');
        },
        nextDocumentTab: () => {
          windowManager.sendUiCommand('next-document-tab');
        },
        previousDocumentTab: () => {
          windowManager.sendUiCommand('previous-document-tab');
        },
        exportPdf: () => {
          windowManager.sendUiCommand('export-pdf');
        },
        exportDocx: () => {
          windowManager.sendUiCommand('export-docx');
        },
        exportHtml: () => {
          windowManager.sendUiCommand('export-html');
        },
        toggleSidebar: () => {
          windowManager.sendSidebarToggle();
        },
        showEditTab: () => {
          windowManager.sendUiCommand('show-edit-tab');
        },
        showRenderTab: () => {
          windowManager.sendUiCommand('show-render-tab');
        },
        getWindow: () => state.mainWindow
      })
    );

    const launchTarget = pendingOpenFiles.at(-1) ?? findLaunchMarkdownArg(process.argv.slice(1));
    if (launchTarget) {
      await windowManager.revealAndOpenDocument(launchTarget, async (rawPath) => {
        await tabService.openOrReuseTab(rawPath, { activate: true, sendUpdate: true, persist: true });
      });
    }

    app.on('activate', () => {
      if (!state.mainWindow || state.mainWindow.isDestroyed()) {
        windowManager.createMainWindow();
      } else {
        windowManager.revealMainWindow();
      }
    });
  });
}

function findLaunchMarkdownArg(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith('-')) {
      continue;
    }

    const resolved = path.resolve(arg);
    if (isMarkdownPath(resolved)) {
      return resolved;
    }
  }
  return null;
}
