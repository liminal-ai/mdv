import type {
  DocumentPayload,
  DocumentTabSession,
  FolderNode,
  OpenDocumentResult,
  PinnedFolder,
  RenderPreviewPayload,
  RenderWarning,
  TabsStatePayload
} from './types';

export const IPC_CHANNELS = {
  tabsGetState: 'tabs:get-state',
  tabsOpenDialog: 'tabs:open-dialog',
  tabsOpenPath: 'tabs:open-path',
  tabsActivate: 'tabs:activate',
  tabsClose: 'tabs:close',
  tabsCloseOthers: 'tabs:close-others',
  tabsSave: 'tabs:save',
  tabsSaveAs: 'tabs:save-as',
  tabsRender: 'tabs:render',
  tabsDiskRead: 'tabs:disk-read',
  tabsReloadFromDisk: 'tabs:reload-from-disk',
  tabsAckDiskChange: 'tabs:ack-disk-change',
  tabsGetActive: 'tabs:get-active',
  appQuit: 'app:quit',
  documentOpenDialog: 'document:open-dialog',
  documentOpenPath: 'document:open-path',
  documentReload: 'document:reload',
  documentSave: 'document:save',
  documentSaveAs: 'document:save-as',
  documentRender: 'document:render',
  documentDiskRead: 'document:disk-read',
  documentGetState: 'document:get-state',
  exportPdf: 'export:pdf',
  exportDocx: 'export:docx',
  exportHtml: 'export:html',
  foldersGetState: 'folders:get-state',
  foldersChooseRoot: 'folders:choose-root',
  foldersListTree: 'folders:list-tree',
  foldersGetPins: 'folders:get-pins',
  foldersPin: 'folders:pin',
  foldersUnpin: 'folders:unpin',
  foldersSetRootFromPin: 'folders:set-root-from-pin',
  foldersRefresh: 'folders:refresh',
  uiToggleSidebarState: 'ui:toggle-sidebar-state',
  uiSetSidebarWidth: 'ui:set-sidebar-width'
} as const;

export const IPC_EVENTS = {
  tabsStateUpdated: 'tabs:state-updated',
  tabsDiskChanged: 'tabs:disk-changed',
  tabsOpenRequest: 'tabs:open-request',
  uiCommand: 'ui:command',
  uiToggleSidebar: 'ui:toggle-sidebar'
} as const;

export type ActionResult = { ok: boolean; reason?: string; filePath?: string };

export type ExportResult = {
  ok: boolean;
  reason?: string;
  filePath?: string;
  warnings?: Array<{ code: string; message: string; location?: string }>;
};

export interface ExportPayload {
  tabId?: string;
  markdown?: string;
}

export interface DiskReadResult {
  ok: boolean;
  reason?: string;
  markdown?: string;
}

export interface FolderStatePayload {
  rootPath: string | null;
  pinnedFolders: PinnedFolder[];
  sidebarCollapsed: boolean;
  sidebarWidth: number;
}

export interface FolderTreeResult {
  ok: boolean;
  reason?: string;
  rootPath?: string;
  tree: FolderNode[];
}

export interface RootFolderResult {
  ok: boolean;
  reason?: string;
  rootPath?: string;
  tree?: FolderNode[];
}

export interface PinnedFoldersResult {
  ok: boolean;
  reason?: string;
  pinnedFolders?: PinnedFolder[];
}

export interface TabsDiskChangedPayload {
  tabId: string;
  filePath: string;
}

export interface TabsOpenRequestPayload {
  filePath: string;
}

export type UiCommand =
  | 'open-markdown'
  | 'reload-document'
  | 'save-document'
  | 'save-document-as'
  | 'close-tab'
  | 'next-document-tab'
  | 'previous-document-tab'
  | 'show-edit-tab'
  | 'show-render-tab'
  | 'show-preview-tab'
  | 'export-pdf'
  | 'export-docx'
  | 'export-html'
  | 'request-app-quit';

export interface UiCommandPayload {
  command: UiCommand;
}

export interface MdvBridge {
  getTabsState: () => Promise<TabsStatePayload>;
  openTabDialog: () => Promise<OpenDocumentResult>;
  openTabPath: (filePath: string) => Promise<OpenDocumentResult>;
  activateTab: (tabId: string) => Promise<OpenDocumentResult>;
  closeTab: (tabId: string) => Promise<OpenDocumentResult>;
  closeOtherTabs: (tabId: string) => Promise<OpenDocumentResult>;
  saveTab: (tabId: string, markdown: string) => Promise<ActionResult>;
  saveTabAs: (tabId: string, markdown: string) => Promise<ActionResult>;
  renderTab: (tabId: string, markdown: string) => Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }>;
  readTabFromDisk: (tabId: string) => Promise<DiskReadResult>;
  reloadTabFromDisk: (tabId: string) => Promise<ActionResult>;
  ackDiskChange: (tabId: string) => Promise<{ ok: boolean; reason?: string }>;
  getActiveTab: () => Promise<DocumentTabSession | null>;
  exportPdf: (payload?: ExportPayload) => Promise<ExportResult>;
  exportDocx: (payload?: ExportPayload) => Promise<ExportResult>;
  exportHtml: (payload?: ExportPayload) => Promise<ExportResult>;
  quitApp: () => Promise<{ ok: boolean }>;
  getFolderState: () => Promise<FolderStatePayload>;
  chooseRootFolder: () => Promise<RootFolderResult>;
  listFolderTree: (rootPath?: string) => Promise<FolderTreeResult>;
  getPinnedFolders: () => Promise<PinnedFolder[]>;
  pinFolder: (folderPath?: string) => Promise<PinnedFoldersResult>;
  unpinFolder: (folderPath: string) => Promise<PinnedFoldersResult>;
  setRootFromPin: (folderPath: string) => Promise<RootFolderResult>;
  refreshFolders: () => Promise<FolderTreeResult>;
  toggleSidebarState: (collapsed: boolean) => Promise<{ ok: boolean }>;
  setSidebarWidth: (width: number) => Promise<{ ok: boolean }>;
  onTabsStateUpdated: (handler: (payload: TabsStatePayload) => void) => () => void;
  onTabsDiskChanged: (handler: (payload: TabsDiskChangedPayload) => void) => () => void;
  onTabsOpenRequest: (handler: (payload: TabsOpenRequestPayload) => void) => () => void;
  onUiCommand: (handler: (command: UiCommand) => void) => () => void;
  onToggleSidebar: (handler: () => void) => () => void;

  // Compatibility bridge preserved during refactor.
  openDialog: () => Promise<ActionResult>;
  openPath: (filePath: string) => Promise<ActionResult>;
  reload: () => Promise<ActionResult>;
  saveDocument: (markdown: string) => Promise<ActionResult>;
  saveDocumentAs: (markdown: string) => Promise<ActionResult>;
  renderMarkdown: (markdown: string) => Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }>;
  readCurrentFromDisk: () => Promise<DiskReadResult>;
  getState: () => Promise<DocumentPayload | null>;
  onDocumentUpdated: (handler: (payload: DocumentPayload) => void) => () => void;
  onDiskChanged: (handler: (payload: { filePath: string }) => void) => () => void;
  onOpenRequest: (handler: (payload: TabsOpenRequestPayload) => void) => () => void;
}

export interface LegacyDocumentActionResult extends ActionResult {
  tabId?: string;
}

export interface LegacyDocumentPayload extends DocumentPayload {
  warnings: RenderWarning[];
}
