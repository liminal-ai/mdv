import { contextBridge, ipcRenderer } from 'electron';

import type {
  DocumentPayload,
  DocumentTabSession,
  FolderNode,
  OpenDocumentResult,
  PinnedFolder,
  RenderPreviewPayload,
  TabsStatePayload
} from '../core/types';

type ActionResult = { ok: boolean; reason?: string; filePath?: string };

type ExportResult = {
  ok: boolean;
  reason?: string;
  filePath?: string;
  warnings?: Array<{ code: string; message: string; location?: string }>;
};

function openDocumentResultToAction(result: OpenDocumentResult): ActionResult {
  return {
    ok: result.ok,
    reason: result.reason,
    filePath: result.tabId
  };
}

const api = {
  getTabsState(): Promise<TabsStatePayload> {
    return ipcRenderer.invoke('tabs:get-state');
  },
  openTabDialog(): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke('tabs:open-dialog');
  },
  openTabPath(filePath: string): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke('tabs:open-path', filePath);
  },
  activateTab(tabId: string): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke('tabs:activate', tabId);
  },
  closeTab(tabId: string): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke('tabs:close', tabId);
  },
  closeOtherTabs(tabId: string): Promise<OpenDocumentResult> {
    return ipcRenderer.invoke('tabs:close-others', tabId);
  },
  saveTab(tabId: string, markdown: string): Promise<ActionResult> {
    return ipcRenderer.invoke('tabs:save', tabId, markdown);
  },
  saveTabAs(tabId: string, markdown: string): Promise<ActionResult> {
    return ipcRenderer.invoke('tabs:save-as', tabId, markdown);
  },
  renderTab(tabId: string, markdown: string): Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }> {
    return ipcRenderer.invoke('tabs:render', tabId, markdown);
  },
  readTabFromDisk(tabId: string): Promise<{ ok: boolean; reason?: string; markdown?: string }> {
    return ipcRenderer.invoke('tabs:disk-read', tabId);
  },
  reloadTabFromDisk(tabId: string): Promise<ActionResult> {
    return ipcRenderer.invoke('tabs:reload-from-disk', tabId);
  },
  ackDiskChange(tabId: string): Promise<{ ok: boolean; reason?: string }> {
    return ipcRenderer.invoke('tabs:ack-disk-change', tabId);
  },
  getActiveTab(): Promise<DocumentTabSession | null> {
    return ipcRenderer.invoke('tabs:get-active');
  },

  // Compatibility bridge for one release.
  async openDialog(): Promise<ActionResult> {
    const result = (await ipcRenderer.invoke('tabs:open-dialog')) as OpenDocumentResult;
    return openDocumentResultToAction(result);
  },
  async openPath(filePath: string): Promise<ActionResult> {
    const result = (await ipcRenderer.invoke('tabs:open-path', filePath)) as OpenDocumentResult;
    return openDocumentResultToAction(result);
  },
  async reload(): Promise<ActionResult> {
    const active = (await ipcRenderer.invoke('tabs:get-active')) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke('tabs:reload-from-disk', active.tabId);
  },
  async saveDocument(markdown: string): Promise<ActionResult> {
    const active = (await ipcRenderer.invoke('tabs:get-active')) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke('tabs:save', active.tabId, markdown);
  },
  async saveDocumentAs(markdown: string): Promise<ActionResult> {
    const active = (await ipcRenderer.invoke('tabs:get-active')) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke('tabs:save-as', active.tabId, markdown);
  },
  async renderMarkdown(markdown: string): Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }> {
    const active = (await ipcRenderer.invoke('tabs:get-active')) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke('tabs:render', active.tabId, markdown);
  },
  async readCurrentFromDisk(): Promise<{ ok: boolean; reason?: string; markdown?: string }> {
    const active = (await ipcRenderer.invoke('tabs:get-active')) as DocumentTabSession | null;
    if (!active) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return ipcRenderer.invoke('tabs:disk-read', active.tabId);
  },
  async getState(): Promise<DocumentPayload | null> {
    return ipcRenderer.invoke('document:get-state');
  },

  exportPdf(payload?: { tabId?: string; markdown?: string }): Promise<ExportResult> {
    return ipcRenderer.invoke('export:pdf', payload);
  },
  exportDocx(payload?: { tabId?: string; markdown?: string }): Promise<ExportResult> {
    return ipcRenderer.invoke('export:docx', payload);
  },
  exportHtml(payload?: { tabId?: string; markdown?: string }): Promise<ExportResult> {
    return ipcRenderer.invoke('export:html', payload);
  },
  quitApp(): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke('app:quit');
  },

  getFolderState(): Promise<{
    rootPath: string | null;
    pinnedFolders: PinnedFolder[];
    sidebarCollapsed: boolean;
    sidebarWidth: number;
  }> {
    return ipcRenderer.invoke('folders:get-state');
  },
  chooseRootFolder(): Promise<{ ok: boolean; reason?: string; rootPath?: string; tree?: FolderNode[] }> {
    return ipcRenderer.invoke('folders:choose-root');
  },
  listFolderTree(rootPath?: string): Promise<{
    ok: boolean;
    reason?: string;
    rootPath?: string;
    tree: FolderNode[];
  }> {
    return ipcRenderer.invoke('folders:list-tree', rootPath);
  },
  getPinnedFolders(): Promise<PinnedFolder[]> {
    return ipcRenderer.invoke('folders:get-pins');
  },
  pinFolder(folderPath?: string): Promise<{ ok: boolean; reason?: string; pinnedFolders?: PinnedFolder[] }> {
    return ipcRenderer.invoke('folders:pin', folderPath);
  },
  unpinFolder(folderPath: string): Promise<{ ok: boolean; reason?: string; pinnedFolders?: PinnedFolder[] }> {
    return ipcRenderer.invoke('folders:unpin', folderPath);
  },
  setRootFromPin(folderPath: string): Promise<{
    ok: boolean;
    reason?: string;
    rootPath?: string;
    tree?: FolderNode[];
  }> {
    return ipcRenderer.invoke('folders:set-root-from-pin', folderPath);
  },
  refreshFolders(): Promise<{ ok: boolean; reason?: string; rootPath?: string; tree: FolderNode[] }> {
    return ipcRenderer.invoke('folders:refresh');
  },
  toggleSidebarState(collapsed: boolean): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke('ui:toggle-sidebar-state', collapsed);
  },
  setSidebarWidth(width: number): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke('ui:set-sidebar-width', width);
  },

  onTabsStateUpdated(handler: (payload: TabsStatePayload) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TabsStatePayload) => handler(payload);
    ipcRenderer.on('tabs:state-updated', wrapped);
    return () => ipcRenderer.removeListener('tabs:state-updated', wrapped);
  },
  onTabsDiskChanged(handler: (payload: { tabId: string; filePath: string }) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: { tabId: string; filePath: string }) => handler(payload);
    ipcRenderer.on('tabs:disk-changed', wrapped);
    return () => ipcRenderer.removeListener('tabs:disk-changed', wrapped);
  },
  onTabsOpenRequest(handler: (payload: { filePath: string }) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: { filePath: string }) => handler(payload);
    ipcRenderer.on('tabs:open-request', wrapped);
    return () => ipcRenderer.removeListener('tabs:open-request', wrapped);
  },

  // Compatibility events for older renderer code.
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

    ipcRenderer.on('tabs:state-updated', wrapped);
    return () => ipcRenderer.removeListener('tabs:state-updated', wrapped);
  },
  onDiskChanged(handler: (payload: { filePath: string }) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: { tabId: string; filePath: string }) => {
      handler({ filePath: payload.filePath });
    };

    ipcRenderer.on('tabs:disk-changed', wrapped);
    return () => ipcRenderer.removeListener('tabs:disk-changed', wrapped);
  },
  onOpenRequest(handler: (payload: { filePath: string }) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: { filePath: string }) => handler(payload);
    ipcRenderer.on('tabs:open-request', wrapped);
    return () => ipcRenderer.removeListener('tabs:open-request', wrapped);
  },

  onUiCommand(handler: (command: string) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: { command: string }) => handler(payload.command);
    ipcRenderer.on('ui:command', wrapped);
    return () => ipcRenderer.removeListener('ui:command', wrapped);
  },
  onToggleSidebar(handler: () => void): () => void {
    const wrapped = () => handler();
    ipcRenderer.on('ui:toggle-sidebar', wrapped);
    return () => ipcRenderer.removeListener('ui:toggle-sidebar', wrapped);
  }
};

contextBridge.exposeInMainWorld('mdv', api);
