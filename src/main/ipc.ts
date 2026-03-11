import { app, ipcMain } from 'electron';

import {
  IPC_CHANNELS,
  type ActionResult,
  type LegacyDocumentActionResult
} from '../core/ipc';
import type { DocumentPayload } from '../core/types';
import type { ExportService } from './exportService';
import type { FolderService } from './folderService';
import { toPublicTabSession } from './state';
import type { TabService } from './tabService';

interface RegisterIpcHandlersOptions {
  tabService: TabService;
  folderService: FolderService;
  exportService: ExportService;
  onQuitRequested: () => void;
}

const ALL_HANDLERS = Object.values(IPC_CHANNELS);

function removeExistingHandlers(): void {
  for (const channel of ALL_HANDLERS) {
    ipcMain.removeHandler(channel);
  }
}

export function toLegacyActionResult(
  result: { ok: boolean; reason?: string; tabId?: string },
  filePath?: string
): LegacyDocumentActionResult {
  return {
    ok: result.ok,
    reason: result.reason,
    tabId: result.tabId,
    filePath
  };
}

export function registerIpcHandlers({
  tabService,
  folderService,
  exportService,
  onQuitRequested
}: RegisterIpcHandlersOptions): void {
  removeExistingHandlers();

  ipcMain.handle(IPC_CHANNELS.tabsGetState, async () => tabService.buildTabsStatePayload());
  ipcMain.handle(IPC_CHANNELS.tabsOpenDialog, async () => tabService.openTabDialog());
  ipcMain.handle(IPC_CHANNELS.tabsOpenPath, async (_event, rawPath: string) =>
    tabService.openOrReuseTab(rawPath, { activate: true, sendUpdate: true, persist: true })
  );
  ipcMain.handle(IPC_CHANNELS.tabsActivate, async (_event, tabId: string) => tabService.activateTab(tabId));
  ipcMain.handle(IPC_CHANNELS.tabsClose, async (_event, tabId: string) => tabService.closeTab(tabId));
  ipcMain.handle(IPC_CHANNELS.tabsCloseOthers, async (_event, tabId: string) => tabService.closeOtherTabs(tabId));
  ipcMain.handle(IPC_CHANNELS.tabsSave, async (_event, tabId: string, markdown: string) => tabService.saveTab(tabId, markdown));
  ipcMain.handle(IPC_CHANNELS.tabsSaveAs, async (_event, tabId: string, markdown: string) => tabService.saveTabAs(tabId, markdown));
  ipcMain.handle(IPC_CHANNELS.tabsRender, async (_event, tabId: string, markdown: string) => tabService.renderTabPreview(tabId, markdown));
  ipcMain.handle(IPC_CHANNELS.tabsDiskRead, async (_event, tabId: string) => tabService.readTabFromDisk(tabId));
  ipcMain.handle(IPC_CHANNELS.tabsReloadFromDisk, async (_event, tabId: string) => tabService.reloadTabFromDisk(tabId));
  ipcMain.handle(IPC_CHANNELS.tabsAckDiskChange, async (_event, tabId: string) => tabService.ackDiskChange(tabId));
  ipcMain.handle(IPC_CHANNELS.tabsGetActive, async () => {
    const activeTab = tabService.getActiveTab();
    return activeTab ? toPublicTabSession(activeTab) : null;
  });

  ipcMain.handle(IPC_CHANNELS.appQuit, async () => {
    onQuitRequested();
    app.quit();
    return { ok: true };
  });

  registerLegacyDocumentHandlers(tabService);

  ipcMain.handle(IPC_CHANNELS.exportPdf, async (_event, payload) => exportService.exportCurrentPdfDialog(payload));
  ipcMain.handle(IPC_CHANNELS.exportDocx, async (_event, payload) => exportService.exportCurrentDocxDialog(payload));
  ipcMain.handle(IPC_CHANNELS.exportHtml, async (_event, payload) => exportService.exportCurrentHtmlDialog(payload));

  ipcMain.handle(IPC_CHANNELS.foldersGetState, async () => folderService.getFolderState());
  ipcMain.handle(IPC_CHANNELS.foldersChooseRoot, async () => folderService.chooseRootFolderViaDialog());
  ipcMain.handle(IPC_CHANNELS.foldersListTree, async (_event, requestedRoot?: string) => folderService.listFolderTree(requestedRoot));
  ipcMain.handle(IPC_CHANNELS.foldersGetPins, async () => folderService.getPinnedFolders());
  ipcMain.handle(IPC_CHANNELS.foldersPin, async (_event, folderPath?: string) => folderService.pinFolder(folderPath));
  ipcMain.handle(IPC_CHANNELS.foldersUnpin, async (_event, folderPath: string) => folderService.unpinFolder(folderPath));
  ipcMain.handle(IPC_CHANNELS.foldersSetRootFromPin, async (_event, folderPath: string) => folderService.setRootFromPin(folderPath));
  ipcMain.handle(IPC_CHANNELS.foldersRefresh, async () => folderService.refreshFolders());
  ipcMain.handle(IPC_CHANNELS.uiToggleSidebarState, async (_event, collapsed: boolean) => folderService.setSidebarCollapsed(collapsed));
  ipcMain.handle(IPC_CHANNELS.uiSetSidebarWidth, async (_event, width: number) => folderService.setSidebarWidth(width));
}

function registerLegacyDocumentHandlers(tabService: TabService): void {
  ipcMain.handle(IPC_CHANNELS.documentOpenDialog, async () => {
    const result = await tabService.openTabDialog();
    const activeTab = result.ok && result.tabId ? tabService.getTabById(result.tabId) : null;
    return toLegacyActionResult(result, activeTab?.filePath);
  });
  ipcMain.handle(IPC_CHANNELS.documentOpenPath, async (_event, rawPath: string) =>
    {
      const result = await tabService.openOrReuseTab(rawPath, { activate: true, sendUpdate: true, persist: true });
      const activeTab = result.ok && result.tabId ? tabService.getTabById(result.tabId) : null;
      return toLegacyActionResult(result, activeTab?.filePath);
    }
  );
  ipcMain.handle(IPC_CHANNELS.documentReload, async () => {
    const activeTab = tabService.getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' } as ActionResult;
    }
    return tabService.reloadTabFromDisk(activeTab.tabId);
  });
  ipcMain.handle(IPC_CHANNELS.documentSave, async (_event, markdown: string) => {
    const activeTab = tabService.getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' } as ActionResult;
    }
    return tabService.saveTab(activeTab.tabId, markdown);
  });
  ipcMain.handle(IPC_CHANNELS.documentSaveAs, async (_event, markdown: string) => {
    const activeTab = tabService.getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' } as ActionResult;
    }
    return tabService.saveTabAs(activeTab.tabId, markdown);
  });
  ipcMain.handle(IPC_CHANNELS.documentRender, async (_event, markdown: string) => {
    const activeTab = tabService.getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return tabService.renderTabPreview(activeTab.tabId, markdown);
  });
  ipcMain.handle(IPC_CHANNELS.documentDiskRead, async () => {
    const activeTab = tabService.getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return tabService.readTabFromDisk(activeTab.tabId);
  });
  ipcMain.handle(IPC_CHANNELS.documentGetState, async () => {
    const activeTab = tabService.getActiveTab();
    if (!activeTab) {
      return null;
    }

    return {
      filePath: activeTab.filePath,
      markdown: activeTab.currentMarkdown,
      html: activeTab.render.html,
      warnings: activeTab.warnings
    } as DocumentPayload;
  });
}
