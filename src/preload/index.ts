import { contextBridge, ipcRenderer } from 'electron';

import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type ActionResult,
  type DiskReadResult,
  type ExportPayload,
  type ExportResult,
  type FolderStatePayload,
  type FolderTreeResult,
  type LegacyDocumentActionResult,
  type MdvBridge,
  type PinnedFoldersResult,
  type TabsDiskChangedPayload,
  type TabsOpenRequestPayload,
  type UiCommand,
  type UiCommandPayload
} from '../core/ipc';
import type {
  DocumentPayload,
  DocumentTabSession,
  OpenDocumentResult,
  RenderPreviewPayload,
  TabsStatePayload
} from '../core/types';

function toLegacyActionResult(result: OpenDocumentResult): LegacyDocumentActionResult {
  return {
    ok: result.ok,
    reason: result.reason,
    tabId: result.tabId
  };
}

async function toLegacyOpenActionResult(result: OpenDocumentResult): Promise<LegacyDocumentActionResult> {
  if (!result.ok || !result.tabId) {
    return toLegacyActionResult(result);
  }

  const active = (await ipcRenderer.invoke(IPC_CHANNELS.tabsGetActive)) as DocumentTabSession | null;
  return {
    ...toLegacyActionResult(result),
    filePath: active?.tabId === result.tabId ? active.filePath : undefined
  };
}

const api: MdvBridge = {
  getTabsState(): Promise<TabsStatePayload> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsGetState);
  },
  openTabDialog(): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsOpenDialog);
  },
  openTabPath(filePath: string): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsOpenPath, filePath);
  },
  activateTab(tabId: string): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsActivate, tabId);
  },
  closeTab(tabId: string): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsClose, tabId);
  },
  closeOtherTabs(tabId: string): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsCloseOthers, tabId);
  },
  saveTab(tabId: string, markdown: string): Promise<ActionResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsSave, tabId, markdown);
  },
  saveTabAs(tabId: string, markdown: string): Promise<ActionResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsSaveAs, tabId, markdown);
  },
  renderTab(tabId: string, markdown: string): Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsRender, tabId, markdown);
  },
  readTabFromDisk(tabId: string): Promise<DiskReadResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsDiskRead, tabId);
  },
  reloadTabFromDisk(tabId: string): Promise<ActionResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsReloadFromDisk, tabId);
  },
  ackDiskChange(tabId: string): Promise<{ ok: boolean; reason?: string }> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsAckDiskChange, tabId);
  },
  getActiveTab(): Promise<DocumentTabSession | null> {
    return ipcRenderer.invoke(IPC_CHANNELS.tabsGetActive);
  },
  exportPdf(payload?: ExportPayload): Promise<ExportResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.exportPdf, payload);
  },
  exportDocx(payload?: ExportPayload): Promise<ExportResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.exportDocx, payload);
  },
  exportHtml(payload?: ExportPayload): Promise<ExportResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.exportHtml, payload);
  },
  quitApp(): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(IPC_CHANNELS.appQuit);
  },
  getFolderState(): Promise<FolderStatePayload> {
    return ipcRenderer.invoke(IPC_CHANNELS.foldersGetState);
  },
  chooseRootFolder() {
    return ipcRenderer.invoke(IPC_CHANNELS.foldersChooseRoot);
  },
  listFolderTree(rootPath?: string): Promise<FolderTreeResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.foldersListTree, rootPath);
  },
  getPinnedFolders() {
    return ipcRenderer.invoke(IPC_CHANNELS.foldersGetPins);
  },
  pinFolder(folderPath?: string): Promise<PinnedFoldersResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.foldersPin, folderPath);
  },
  unpinFolder(folderPath: string): Promise<PinnedFoldersResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.foldersUnpin, folderPath);
  },
  setRootFromPin(folderPath: string) {
    return ipcRenderer.invoke(IPC_CHANNELS.foldersSetRootFromPin, folderPath);
  },
  refreshFolders(): Promise<FolderTreeResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.foldersRefresh);
  },
  toggleSidebarState(collapsed: boolean): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(IPC_CHANNELS.uiToggleSidebarState, collapsed);
  },
  setSidebarWidth(width: number): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(IPC_CHANNELS.uiSetSidebarWidth, width);
  },
  onTabsStateUpdated(handler: (payload: TabsStatePayload) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TabsStatePayload) => handler(payload);
    ipcRenderer.on(IPC_EVENTS.tabsStateUpdated, wrapped);
    return () => ipcRenderer.removeListener(IPC_EVENTS.tabsStateUpdated, wrapped);
  },
  onTabsDiskChanged(handler: (payload: TabsDiskChangedPayload) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TabsDiskChangedPayload) => handler(payload);
    ipcRenderer.on(IPC_EVENTS.tabsDiskChanged, wrapped);
    return () => ipcRenderer.removeListener(IPC_EVENTS.tabsDiskChanged, wrapped);
  },
  onTabsOpenRequest(handler: (payload: TabsOpenRequestPayload) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TabsOpenRequestPayload) => handler(payload);
    ipcRenderer.on(IPC_EVENTS.tabsOpenRequest, wrapped);
    return () => ipcRenderer.removeListener(IPC_EVENTS.tabsOpenRequest, wrapped);
  },
  onUiCommand(handler: (command: UiCommand) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: UiCommandPayload) => handler(payload.command);
    ipcRenderer.on(IPC_EVENTS.uiCommand, wrapped);
    return () => ipcRenderer.removeListener(IPC_EVENTS.uiCommand, wrapped);
  },
  onToggleSidebar(handler: () => void): () => void {
    const wrapped = () => handler();
    ipcRenderer.on(IPC_EVENTS.uiToggleSidebar, wrapped);
    return () => ipcRenderer.removeListener(IPC_EVENTS.uiToggleSidebar, wrapped);
  },

  // Compatibility bridge preserved during refactor.
  async openDialog(): Promise<ActionResult> {
    return toLegacyOpenActionResult(await ipcRenderer.invoke(IPC_CHANNELS.tabsOpenDialog));
  },
  async openPath(filePath: string): Promise<ActionResult> {
    return toLegacyOpenActionResult(await ipcRenderer.invoke(IPC_CHANNELS.tabsOpenPath, filePath));
  },
  async reload(): Promise<ActionResult> {
    const active = (await ipcRenderer.invoke(IPC_CHANNELS.tabsGetActive)) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke(IPC_CHANNELS.tabsReloadFromDisk, active.tabId);
  },
  async saveDocument(markdown: string): Promise<ActionResult> {
    const active = (await ipcRenderer.invoke(IPC_CHANNELS.tabsGetActive)) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke(IPC_CHANNELS.tabsSave, active.tabId, markdown);
  },
  async saveDocumentAs(markdown: string): Promise<ActionResult> {
    const active = (await ipcRenderer.invoke(IPC_CHANNELS.tabsGetActive)) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke(IPC_CHANNELS.tabsSaveAs, active.tabId, markdown);
  },
  async renderMarkdown(markdown: string): Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }> {
    const active = (await ipcRenderer.invoke(IPC_CHANNELS.tabsGetActive)) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke(IPC_CHANNELS.tabsRender, active.tabId, markdown);
  },
  async readCurrentFromDisk(): Promise<DiskReadResult> {
    const active = (await ipcRenderer.invoke(IPC_CHANNELS.tabsGetActive)) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke(IPC_CHANNELS.tabsDiskRead, active.tabId);
  },
  async getState(): Promise<DocumentPayload | null> {
    return ipcRenderer.invoke(IPC_CHANNELS.documentGetState);
  },
  onDocumentUpdated(handler: (payload: DocumentPayload) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TabsStatePayload) => {
      const active = payload.tabs.find((tab) => tab.tabId === payload.activeTabId);
      if (!active) {
        return;
      }

      handler({
        filePath: active.filePath,
        markdown: active.currentMarkdown,
        html: active.renderHtml,
        warnings: active.warnings
      });
    };

    ipcRenderer.on(IPC_EVENTS.tabsStateUpdated, wrapped);
    return () => ipcRenderer.removeListener(IPC_EVENTS.tabsStateUpdated, wrapped);
  },
  onDiskChanged(handler: (payload: { filePath: string }) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TabsDiskChangedPayload) => {
      handler({ filePath: payload.filePath });
    };

    ipcRenderer.on(IPC_EVENTS.tabsDiskChanged, wrapped);
    return () => ipcRenderer.removeListener(IPC_EVENTS.tabsDiskChanged, wrapped);
  },
  onOpenRequest(handler: (payload: TabsOpenRequestPayload) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TabsOpenRequestPayload) => handler(payload);
    ipcRenderer.on(IPC_EVENTS.tabsOpenRequest, wrapped);
    return () => ipcRenderer.removeListener(IPC_EVENTS.tabsOpenRequest, wrapped);
  }
};

contextBridge.exposeInMainWorld('mdv', api);
