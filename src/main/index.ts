import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { BrowserWindow, Menu, app, dialog, ipcMain } from 'electron';

import { parseInternalCliArgs } from '../core/cliArgs';
import { isMarkdownPath } from '../core/drop';
import { exportDocxFromHtml } from '../core/export/docx';
import { exportHtmlFolder } from '../core/export/html';
import { exportPdfFromHtml } from '../core/export/pdf';
import { readMarkdownFile, renderMarkdown } from '../core/render/markdown';
import {
  DocumentPayload,
  DocumentTabSession,
  FolderNode,
  OpenDocumentResult,
  RenderPreviewPayload,
  RenderResult,
  TabsStatePayload
} from '../core/types';
import { listMarkdownChildren } from './folders';
import { buildApplicationMenu } from './menu';
import { ElectronMermaidRenderer } from './mermaidRenderer';
import { baseHrefFromDir, preloadPath, rendererHtmlPath } from './paths';
import { PreferencesStore } from './preferences';

interface ActionResult {
  ok: boolean;
  reason?: string;
  filePath?: string;
  warnings?: Array<{ code: string; message: string; location?: string }>;
}

interface ExportPayload {
  tabId?: string;
  markdown?: string;
}

interface TabSessionInternal {
  tabId: string;
  filePath: string;
  title: string;
  savedMarkdown: string;
  currentMarkdown: string;
  render: RenderResult;
  warnings: RenderResult['warnings'];
  isDirty: boolean;
  hasExternalChange: boolean;
  lastDiskMtimeMs?: number;
  ignoreWatcherEventsUntil: number;
}

const state: {
  mainWindow: BrowserWindow | null;
  currentRootFolder: string | null;
  tabsById: Map<string, TabSessionInternal>;
  tabOrder: string[];
  activeTabId: string | null;
  watchersByTabId: Map<string, fs.FSWatcher>;
  watcherTimersByTabId: Map<string, NodeJS.Timeout>;
  quitConfirmed: boolean;
} = {
  mainWindow: null,
  currentRootFolder: null,
  tabsById: new Map<string, TabSessionInternal>(),
  tabOrder: [],
  activeTabId: null,
  watchersByTabId: new Map<string, fs.FSWatcher>(),
  watcherTimersByTabId: new Map<string, NodeJS.Timeout>(),
  quitConfirmed: false
};

const mermaidRenderer = new ElectronMermaidRenderer();
const pendingOpenFiles: string[] = [];
let preferencesStore: PreferencesStore | null = null;
let nextTabId = 1;

app.on('open-file', (event, openPath) => {
  event.preventDefault();
  if (app.isReady()) {
    requestOpenDocument(openPath);
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
    sendUiCommand('request-app-quit');
    return;
  }

  stopWatchingAllTabs();
});

app.whenReady().then(async () => {
  const internalCli = parseInternalCliArgs(process.argv.slice(2));
  if (!internalCli.ok) {
    console.error(internalCli.error);
    app.exit(2);
    return;
  }

  if (internalCli.value?.cliExport) {
    const code = await runCliExport(internalCli.value);
    await mermaidRenderer.dispose();
    app.exit(code);
    return;
  }

  preferencesStore = new PreferencesStore(app.getPath('userData'));
  const prefs = await preferencesStore.load();

  if (prefs.lastRootFolder) {
    try {
      const st = await fsp.stat(prefs.lastRootFolder);
      if (st.isDirectory()) {
        state.currentRootFolder = prefs.lastRootFolder;
      }
    } catch {
      state.currentRootFolder = null;
    }
  }

  if (!state.currentRootFolder) {
    const homeDir = os.homedir();
    try {
      const st = await fsp.stat(homeDir);
      if (st.isDirectory()) {
        state.currentRootFolder = homeDir;
      }
    } catch {
      state.currentRootFolder = null;
    }
  }

  if (state.currentRootFolder && preferencesStore.get().lastRootFolder !== state.currentRootFolder) {
    await preferencesStore.setLastRootFolder(state.currentRootFolder);
  }

  await restoreTabsFromPreferences(prefs.openTabs ?? [], prefs.activeTabPath);

  setupIpcHandlers();
  createMainWindow();

  Menu.setApplicationMenu(
    buildApplicationMenu({
      openMarkdown: () => {
        if (!sendUiCommand('open-markdown')) {
          void openTabDialog();
        }
      },
      openFolder: () => {
        void chooseRootFolderViaDialog();
      },
      reloadDocument: () => {
        sendUiCommand('reload-document');
      },
      saveDocument: () => {
        sendUiCommand('save-document');
      },
      saveDocumentAs: () => {
        sendUiCommand('save-document-as');
      },
      closeTab: () => {
        sendUiCommand('close-tab');
      },
      nextDocumentTab: () => {
        sendUiCommand('next-document-tab');
      },
      previousDocumentTab: () => {
        sendUiCommand('previous-document-tab');
      },
      exportPdf: () => {
        sendUiCommand('export-pdf');
      },
      exportDocx: () => {
        sendUiCommand('export-docx');
      },
      exportHtml: () => {
        sendUiCommand('export-html');
      },
      toggleSidebar: () => {
        sendSidebarToggle();
      },
      showEditTab: () => {
        sendUiCommand('show-edit-tab');
      },
      showRenderTab: () => {
        sendUiCommand('show-render-tab');
      },
      getWindow: () => state.mainWindow
    })
  );

  const launchTarget = pendingOpenFiles.at(-1) ?? findLaunchMarkdownArg(process.argv.slice(1));
  if (launchTarget) {
    await revealAndOpenDocument(launchTarget);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      setupIpcHandlers();
      createMainWindow();
    } else {
      revealMainWindow();
    }
  });
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', (_event, argv) => {
  const launchTarget = findLaunchMarkdownArg(argv.slice(1));
  if (launchTarget) {
    requestOpenDocument(launchTarget);
    return;
  }
  revealMainWindow();
});

async function runCliExport(args: {
  input: string;
  output: string;
  format: 'pdf' | 'html' | 'docx' | 'all';
}): Promise<number> {
  try {
    const inputPath = path.resolve(args.input);
    const markdown = await readMarkdownFile(inputPath);
    const renderResult = await renderMarkdown(
      {
        inputPath,
        markdown,
        baseDir: path.dirname(inputPath),
        offline: true
      },
      mermaidRenderer
    );

    const stem = path.parse(inputPath).name;
    if (args.format === 'pdf' || args.format === 'all') {
      const pdfOutput = resolvePdfPath(args.output, stem, args.format === 'pdf');
      await exportPdfFromHtml(stem, renderResult.html, pdfOutput, baseHrefFromDir(renderResult.baseDir), {
        pageSize: 'Letter',
        printBackground: true
      });
      console.log(`PDF exported: ${pdfOutput}`);
    }

    if (args.format === 'docx' || args.format === 'all') {
      const docxOutput = resolveDocxPath(args.output, stem, args.format === 'docx');
      const docxResult = await exportDocxFromHtml(
        stem,
        renderResult.exportHtml,
        docxOutput,
        renderResult.baseDir,
        renderResult.diagrams,
        renderResult.warnings,
        {
          pageSize: 'Letter',
          marginsInches: {
            top: 1,
            right: 1,
            bottom: 1,
            left: 1
          }
        }
      );
      console.log(`DOCX exported: ${docxResult.outputFile}`);
      if (docxResult.warnings.length > 0) {
        console.warn('Warnings:');
        for (const warning of docxResult.warnings) {
          console.warn(`- [${warning.code}] ${warning.message}`);
        }
      }
    }

    if (args.format === 'html' || args.format === 'all') {
      const htmlDir = resolveHtmlDir(args.output, stem, args.format === 'html');
      const htmlResult = await exportHtmlFolder(
        htmlDir,
        stem,
        renderResult.exportHtml,
        renderResult.baseDir,
        renderResult.diagrams,
        renderResult.warnings
      );
      console.log(`HTML exported: ${htmlResult.outputFile}`);
      if (htmlResult.warnings.length > 0) {
        console.warn('Warnings:');
        for (const warning of htmlResult.warnings) {
          console.warn(`- [${warning.code}] ${warning.message}`);
        }
      }
    }

    return 0;
  } catch (error) {
    console.error(`Export failed: ${String(error)}`);
    return 3;
  }
}

function resolvePdfPath(output: string, stem: string, strictFile: boolean): string {
  const resolved = path.resolve(output);
  if (strictFile && resolved.toLowerCase().endsWith('.pdf')) {
    return resolved;
  }
  if (resolved.toLowerCase().endsWith('.pdf')) {
    return resolved;
  }
  return path.join(resolved, `${stem}.pdf`);
}

function resolveHtmlDir(output: string, stem: string, strictDir: boolean): string {
  const resolved = path.resolve(output);
  if (strictDir) {
    return resolved;
  }
  if (path.extname(resolved)) {
    return resolved;
  }
  return path.join(resolved, `${stem}-export`);
}

function resolveDocxPath(output: string, stem: string, strictFile: boolean): string {
  const resolved = path.resolve(output);
  if (strictFile && resolved.toLowerCase().endsWith('.docx')) {
    return resolved;
  }
  if (resolved.toLowerCase().endsWith('.docx')) {
    return resolved;
  }
  return path.join(resolved, `${stem}.docx`);
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

async function revealAndOpenDocument(rawPath: string): Promise<void> {
  try {
    await ensureMainWindow();
    revealMainWindow();
    await openOrReuseTab(rawPath, { activate: true, sendUpdate: true, persist: true });
  } catch (error) {
    console.error(`Failed to open document from OS event: ${String(error)}`);
  }
}

function requestOpenDocument(rawPath: string): void {
  const resolvedPath = path.resolve(rawPath);
  if (!isMarkdownPath(resolvedPath)) {
    return;
  }

  if (state.mainWindow && !state.mainWindow.isDestroyed() && !state.mainWindow.webContents.isLoadingMainFrame()) {
    state.mainWindow.webContents.send('tabs:open-request', { filePath: resolvedPath });
    revealMainWindow();
    return;
  }

  void revealAndOpenDocument(resolvedPath);
}

function sendUiCommand(command: string): boolean {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    return false;
  }

  state.mainWindow.webContents.send('ui:command', { command });
  return true;
}

function setupIpcHandlers(): void {
  ipcMain.removeHandler('tabs:get-state');
  ipcMain.removeHandler('tabs:open-dialog');
  ipcMain.removeHandler('tabs:open-path');
  ipcMain.removeHandler('tabs:activate');
  ipcMain.removeHandler('tabs:close');
  ipcMain.removeHandler('tabs:close-others');
  ipcMain.removeHandler('tabs:save');
  ipcMain.removeHandler('tabs:save-as');
  ipcMain.removeHandler('tabs:render');
  ipcMain.removeHandler('tabs:disk-read');
  ipcMain.removeHandler('tabs:reload-from-disk');
  ipcMain.removeHandler('tabs:ack-disk-change');
  ipcMain.removeHandler('tabs:get-active');
  ipcMain.removeHandler('app:quit');

  ipcMain.removeHandler('document:open-dialog');
  ipcMain.removeHandler('document:open-path');
  ipcMain.removeHandler('document:reload');
  ipcMain.removeHandler('document:save');
  ipcMain.removeHandler('document:save-as');
  ipcMain.removeHandler('document:render');
  ipcMain.removeHandler('document:disk-read');
  ipcMain.removeHandler('document:get-state');

  ipcMain.removeHandler('export:pdf');
  ipcMain.removeHandler('export:docx');
  ipcMain.removeHandler('export:html');
  ipcMain.removeHandler('folders:get-state');
  ipcMain.removeHandler('folders:choose-root');
  ipcMain.removeHandler('folders:list-tree');
  ipcMain.removeHandler('folders:get-pins');
  ipcMain.removeHandler('folders:pin');
  ipcMain.removeHandler('folders:unpin');
  ipcMain.removeHandler('folders:set-root-from-pin');
  ipcMain.removeHandler('folders:refresh');
  ipcMain.removeHandler('ui:toggle-sidebar-state');
  ipcMain.removeHandler('ui:set-sidebar-width');

  ipcMain.handle('tabs:get-state', async (): Promise<TabsStatePayload> => buildTabsStatePayload());

  ipcMain.handle('tabs:open-dialog', async () => {
    return openTabDialog();
  });

  ipcMain.handle('tabs:open-path', async (_event, rawPath: string) => {
    return openOrReuseTab(rawPath, { activate: true, sendUpdate: true, persist: true });
  });

  ipcMain.handle('tabs:activate', async (_event, tabId: string) => {
    return activateTab(tabId);
  });

  ipcMain.handle('tabs:close', async (_event, tabId: string) => {
    return closeTab(tabId);
  });

  ipcMain.handle('tabs:close-others', async (_event, tabId: string) => {
    return closeOtherTabs(tabId);
  });

  ipcMain.handle('tabs:save', async (_event, tabId: string, markdown: string) => {
    return saveTab(tabId, markdown);
  });

  ipcMain.handle('tabs:save-as', async (_event, tabId: string, markdown: string) => {
    return saveTabAs(tabId, markdown);
  });

  ipcMain.handle('tabs:render', async (_event, tabId: string, markdown: string) => {
    return renderTabPreview(tabId, markdown);
  });

  ipcMain.handle('tabs:disk-read', async (_event, tabId: string) => {
    return readTabFromDisk(tabId);
  });

  ipcMain.handle('tabs:reload-from-disk', async (_event, tabId: string) => {
    return reloadTabFromDisk(tabId);
  });

  ipcMain.handle('tabs:ack-disk-change', async (_event, tabId: string) => {
    const tab = getTabById(tabId);
    if (!tab) {
      return { ok: false, reason: 'Tab not found.' };
    }

    tab.hasExternalChange = false;
    sendTabsStateUpdated();
    return { ok: true };
  });

  ipcMain.handle('tabs:get-active', async () => {
    const activeTab = getActiveTab();
    if (!activeTab) {
      return null;
    }
    return toPublicTabSession(activeTab);
  });

  ipcMain.handle('app:quit', async () => {
    state.quitConfirmed = true;
    app.quit();
    return { ok: true };
  });

  // Compatibility bridge for one release.
  ipcMain.handle('document:open-dialog', async () => toActionResult(await openTabDialog()));
  ipcMain.handle('document:open-path', async (_event, rawPath: string) =>
    toActionResult(await openOrReuseTab(rawPath, { activate: true, sendUpdate: true, persist: true }))
  );
  ipcMain.handle('document:reload', async () => {
    const activeTab = getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' } as ActionResult;
    }
    return reloadTabFromDisk(activeTab.tabId);
  });
  ipcMain.handle('document:save', async (_event, markdown: string) => {
    const activeTab = getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' } as ActionResult;
    }
    return saveTab(activeTab.tabId, markdown);
  });
  ipcMain.handle('document:save-as', async (_event, markdown: string) => {
    const activeTab = getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' } as ActionResult;
    }
    return saveTabAs(activeTab.tabId, markdown);
  });
  ipcMain.handle('document:render', async (_event, markdown: string) => {
    const activeTab = getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return renderTabPreview(activeTab.tabId, markdown);
  });
  ipcMain.handle('document:disk-read', async () => {
    const activeTab = getActiveTab();
    if (!activeTab) {
      return { ok: false, reason: 'No file loaded.' };
    }
    return readTabFromDisk(activeTab.tabId);
  });
  ipcMain.handle('document:get-state', async () => {
    const activeTab = getActiveTab();
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

  ipcMain.handle('export:pdf', async (_event, payload?: ExportPayload) => exportCurrentPdfDialog(payload));
  ipcMain.handle('export:docx', async (_event, payload?: ExportPayload) => exportCurrentDocxDialog(payload));
  ipcMain.handle('export:html', async (_event, payload?: ExportPayload) => exportCurrentHtmlDialog(payload));

  ipcMain.handle('folders:get-state', async () => {
    return {
      rootPath: state.currentRootFolder,
      pinnedFolders: preferencesStore?.getPinnedFolders() ?? [],
      sidebarCollapsed: preferencesStore?.get().sidebarCollapsed ?? false,
      sidebarWidth: preferencesStore?.get().sidebarWidth ?? 280
    };
  });

  ipcMain.handle('folders:choose-root', async () => {
    return chooseRootFolderViaDialog();
  });

  ipcMain.handle('folders:list-tree', async (_event, requestedRoot?: string) => {
    const rootPath = requestedRoot ? path.resolve(requestedRoot) : state.currentRootFolder;
    if (!rootPath) {
      return { ok: false, reason: 'No root folder selected.', tree: [] as FolderNode[] };
    }

    const tree = await listMarkdownChildren(rootPath);
    return { ok: true, rootPath, tree };
  });

  ipcMain.handle('folders:get-pins', async () => {
    return preferencesStore?.getPinnedFolders() ?? [];
  });

  ipcMain.handle('folders:pin', async (_event, folderPath?: string) => {
    if (!preferencesStore) {
      return { ok: false, reason: 'Preferences unavailable.' };
    }

    const candidate = folderPath ? path.resolve(folderPath) : state.currentRootFolder;
    if (!candidate) {
      return { ok: false, reason: 'No folder provided.' };
    }

    try {
      const st = await fsp.stat(candidate);
      if (!st.isDirectory()) {
        return { ok: false, reason: 'Selected path is not a directory.' };
      }
    } catch {
      return { ok: false, reason: 'Folder is not accessible.' };
    }

    const pinnedFolders = await preferencesStore.pinFolder(candidate);
    return { ok: true, pinnedFolders };
  });

  ipcMain.handle('folders:unpin', async (_event, folderPath: string) => {
    if (!preferencesStore) {
      return { ok: false, reason: 'Preferences unavailable.' };
    }

    const pinnedFolders = await preferencesStore.unpinFolder(folderPath);
    return { ok: true, pinnedFolders };
  });

  ipcMain.handle('folders:set-root-from-pin', async (_event, folderPath: string) => {
    const normalized = path.resolve(folderPath);

    try {
      const st = await fsp.stat(normalized);
      if (!st.isDirectory()) {
        return { ok: false, reason: 'Pinned path is not a directory.' };
      }
    } catch {
      return { ok: false, reason: 'Pinned folder is not accessible.' };
    }

    state.currentRootFolder = normalized;
    if (preferencesStore) {
      await preferencesStore.setLastRootFolder(normalized);
    }

    const tree = await listMarkdownChildren(normalized);
    return { ok: true, rootPath: normalized, tree };
  });

  ipcMain.handle('folders:refresh', async () => {
    if (!state.currentRootFolder) {
      return { ok: false, reason: 'No root folder selected.', tree: [] as FolderNode[] };
    }

    const tree = await listMarkdownChildren(state.currentRootFolder);
    return { ok: true, rootPath: state.currentRootFolder, tree };
  });

  ipcMain.handle('ui:toggle-sidebar-state', async (_event, collapsed: boolean) => {
    if (preferencesStore) {
      await preferencesStore.setSidebarCollapsed(collapsed);
    }
    return { ok: true };
  });

  ipcMain.handle('ui:set-sidebar-width', async (_event, width: number) => {
    if (preferencesStore && Number.isFinite(width)) {
      await preferencesStore.setSidebarWidth(width);
    }
    return { ok: true };
  });
}

function toActionResult(result: OpenDocumentResult): ActionResult {
  return {
    ok: result.ok,
    reason: result.reason,
    filePath: result.tabId
  };
}

function createTabId(): string {
  const value = `tab-${nextTabId}`;
  nextTabId += 1;
  return value;
}

function getActiveTab(): TabSessionInternal | null {
  if (!state.activeTabId) {
    return null;
  }

  return state.tabsById.get(state.activeTabId) ?? null;
}

function getTabById(tabId: string): TabSessionInternal | null {
  return state.tabsById.get(tabId) ?? null;
}

function findTabIdByPath(filePath: string): string | null {
  for (const [tabId, tab] of state.tabsById.entries()) {
    if (tab.filePath === filePath) {
      return tabId;
    }
  }

  return null;
}

function buildTabsStatePayload(): TabsStatePayload {
  const tabs = state.tabOrder
    .map((tabId) => state.tabsById.get(tabId))
    .filter((tab): tab is TabSessionInternal => Boolean(tab))
    .map((tab) => toPublicTabSession(tab));

  return {
    tabs,
    activeTabId: state.activeTabId
  };
}

function toPublicTabSession(tab: TabSessionInternal): DocumentTabSession {
  return {
    tabId: tab.tabId,
    filePath: tab.filePath,
    title: tab.title,
    savedMarkdown: tab.savedMarkdown,
    currentMarkdown: tab.currentMarkdown,
    renderHtml: tab.render.html,
    warnings: tab.warnings,
    isDirty: tab.isDirty,
    hasExternalChange: tab.hasExternalChange,
    lastDiskMtimeMs: tab.lastDiskMtimeMs
  };
}

function sendTabsStateUpdated(): void {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    return;
  }

  state.mainWindow.webContents.send('tabs:state-updated', buildTabsStatePayload());
}

function sendDiskChanged(tabId: string, filePath: string): void {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    return;
  }

  state.mainWindow.webContents.send('tabs:disk-changed', { tabId, filePath });
}

function sendSidebarToggle(): void {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    return;
  }

  state.mainWindow.webContents.send('ui:toggle-sidebar');
}

async function openTabDialog(): Promise<OpenDocumentResult> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, reason: 'cancelled' };
  }

  const selectedPath = result.filePaths[0];
  if (!selectedPath) {
    return { ok: false, reason: 'cancelled' };
  }

  return openOrReuseTab(selectedPath, { activate: true, sendUpdate: true, persist: true });
}

async function openOrReuseTab(
  rawPath: string,
  options?: {
    activate?: boolean;
    sendUpdate?: boolean;
    persist?: boolean;
  }
): Promise<OpenDocumentResult> {
  const activate = options?.activate ?? true;
  const sendUpdate = options?.sendUpdate ?? true;
  const persist = options?.persist ?? true;
  const resolvedPath = path.resolve(rawPath);

  try {
    await fsp.access(resolvedPath, fs.constants.R_OK);
  } catch {
    return { ok: false, reason: `Cannot read file: ${resolvedPath}` };
  }

  if (!isMarkdownPath(resolvedPath)) {
    return { ok: false, reason: 'Only .md or .markdown files are supported.' };
  }

  const existingTabId = findTabIdByPath(resolvedPath);
  if (existingTabId) {
    if (activate) {
      state.activeTabId = existingTabId;
    }

    if (persist) {
      await persistTabSession();
    }

    if (sendUpdate) {
      sendTabsStateUpdated();
    }

    return { ok: true, tabId: existingTabId };
  }

  try {
    const markdown = await readMarkdownFile(resolvedPath);
    const rendered = await renderMarkdown(
      {
        inputPath: resolvedPath,
        markdown,
        baseDir: path.dirname(resolvedPath),
        offline: true
      },
      mermaidRenderer
    );

    const st = await fsp.stat(resolvedPath);
    const tabId = createTabId();
    const tab: TabSessionInternal = {
      tabId,
      filePath: resolvedPath,
      title: path.basename(resolvedPath),
      savedMarkdown: markdown,
      currentMarkdown: markdown,
      render: rendered,
      warnings: rendered.warnings,
      isDirty: false,
      hasExternalChange: false,
      lastDiskMtimeMs: st.mtimeMs,
      ignoreWatcherEventsUntil: 0
    };

    state.tabsById.set(tabId, tab);
    state.tabOrder.push(tabId);
    if (activate || !state.activeTabId) {
      state.activeTabId = tabId;
    }

    if (!state.currentRootFolder) {
      state.currentRootFolder = path.dirname(resolvedPath);
      if (preferencesStore) {
        await preferencesStore.setLastRootFolder(state.currentRootFolder);
      }
    }

    watchTabFile(tabId, resolvedPath);

    if (persist) {
      await persistTabSession();
    }

    if (sendUpdate) {
      sendTabsStateUpdated();
    }

    return { ok: true, tabId };
  } catch (error) {
    return {
      ok: false,
      reason: String(error)
    };
  }
}

async function activateTab(tabId: string): Promise<OpenDocumentResult> {
  if (!state.tabsById.has(tabId)) {
    return { ok: false, reason: 'Tab not found.' };
  }

  state.activeTabId = tabId;
  await persistTabSession();
  sendTabsStateUpdated();
  return { ok: true, tabId };
}

async function closeTab(tabId: string): Promise<OpenDocumentResult> {
  if (!state.tabsById.has(tabId)) {
    return { ok: false, reason: 'Tab not found.' };
  }

  stopWatchingTab(tabId);
  state.tabsById.delete(tabId);
  state.tabOrder = state.tabOrder.filter((id) => id !== tabId);

  if (state.activeTabId === tabId) {
    state.activeTabId = state.tabOrder.at(-1) ?? null;
  }

  await persistTabSession();
  sendTabsStateUpdated();
  return { ok: true, tabId: state.activeTabId ?? undefined };
}

async function closeOtherTabs(tabId: string): Promise<OpenDocumentResult> {
  if (!state.tabsById.has(tabId)) {
    return { ok: false, reason: 'Tab not found.' };
  }

  for (const id of [...state.tabOrder]) {
    if (id === tabId) {
      continue;
    }

    stopWatchingTab(id);
    state.tabsById.delete(id);
  }

  state.tabOrder = [tabId];
  state.activeTabId = tabId;
  await persistTabSession();
  sendTabsStateUpdated();
  return { ok: true, tabId };
}

async function saveTab(tabId: string, markdown: string): Promise<ActionResult> {
  const tab = getTabById(tabId);
  if (!tab) {
    return { ok: false, reason: 'Tab not found.' };
  }

  try {
    return await writeMarkdownToTabPath(tab, tab.filePath, markdown, false);
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

async function saveTabAs(tabId: string, markdown: string): Promise<ActionResult> {
  const tab = getTabById(tabId);
  if (!tab) {
    return { ok: false, reason: 'Tab not found.' };
  }

  const preferredBase =
    tab.filePath ??
    path.join(state.currentRootFolder ?? os.homedir(), 'untitled.md');
  const defaultPath = preferredBase.toLowerCase().endsWith('.md') || preferredBase.toLowerCase().endsWith('.markdown')
    ? preferredBase
    : `${preferredBase}.md`;

  const selection = await dialog.showSaveDialog({
    title: 'Save Markdown As',
    defaultPath,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
  });

  if (selection.canceled || !selection.filePath) {
    return { ok: false, reason: 'cancelled' };
  }

  const resolvedPath = path.resolve(selection.filePath);
  const existingTab = findTabIdByPath(resolvedPath);
  if (existingTab && existingTab !== tabId) {
    return { ok: false, reason: 'Another open tab already uses this file.' };
  }

  try {
    return await writeMarkdownToTabPath(tab, resolvedPath, markdown, true);
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

async function writeMarkdownToTabPath(
  tab: TabSessionInternal,
  targetPath: string,
  markdown: string,
  switchPath: boolean
): Promise<ActionResult> {
  const resolvedPath = path.resolve(targetPath);
  const baseDir = path.dirname(resolvedPath);
  tab.ignoreWatcherEventsUntil = Date.now() + 1200;

  await fsp.writeFile(resolvedPath, markdown, 'utf8');

  const rendered = await renderMarkdown(
    {
      inputPath: resolvedPath,
      markdown,
      baseDir,
      offline: true
    },
    mermaidRenderer
  );

  tab.savedMarkdown = markdown;
  tab.currentMarkdown = markdown;
  tab.render = rendered;
  tab.warnings = rendered.warnings;
  tab.isDirty = false;
  tab.hasExternalChange = false;
  tab.lastDiskMtimeMs = (await fsp.stat(resolvedPath)).mtimeMs;

  if (switchPath && tab.filePath !== resolvedPath) {
    const previousPath = tab.filePath;
    tab.filePath = resolvedPath;
    tab.title = path.basename(resolvedPath);

    stopWatchingTab(tab.tabId);
    watchTabFile(tab.tabId, resolvedPath);

    if (state.currentRootFolder === path.dirname(previousPath)) {
      state.currentRootFolder = baseDir;
    }
  }

  if (!switchPath && tab.filePath === resolvedPath) {
    watchTabFile(tab.tabId, resolvedPath);
  }

  state.activeTabId = tab.tabId;

  if (switchPath) {
    state.currentRootFolder = baseDir;
    if (preferencesStore) {
      await preferencesStore.setLastRootFolder(baseDir);
    }
  }

  await persistTabSession();
  sendTabsStateUpdated();

  return { ok: true, filePath: resolvedPath };
}

async function renderTabPreview(tabId: string, markdown: string): Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }> {
  const tab = getTabById(tabId);
  if (!tab) {
    return { ok: false, reason: 'Tab not found.' };
  }

  try {
    const rendered = await renderMarkdown(
      {
        inputPath: tab.filePath,
        markdown,
        baseDir: path.dirname(tab.filePath),
        offline: true
      },
      mermaidRenderer
    );

    tab.currentMarkdown = markdown;
    tab.render = rendered;
    tab.warnings = rendered.warnings;
    tab.isDirty = markdown !== tab.savedMarkdown;

    sendTabsStateUpdated();

    return {
      ok: true,
      preview: {
        html: rendered.html,
        warnings: rendered.warnings
      }
    };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

async function readTabFromDisk(tabId: string): Promise<{ ok: boolean; reason?: string; markdown?: string }> {
  const tab = getTabById(tabId);
  if (!tab) {
    return { ok: false, reason: 'Tab not found.' };
  }

  try {
    const markdown = await readMarkdownFile(tab.filePath);
    return { ok: true, markdown };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

async function reloadTabFromDisk(tabId: string): Promise<ActionResult> {
  const tab = getTabById(tabId);
  if (!tab) {
    return { ok: false, reason: 'Tab not found.' };
  }

  try {
    const markdown = await readMarkdownFile(tab.filePath);
    const rendered = await renderMarkdown(
      {
        inputPath: tab.filePath,
        markdown,
        baseDir: path.dirname(tab.filePath),
        offline: true
      },
      mermaidRenderer
    );

    tab.savedMarkdown = markdown;
    tab.currentMarkdown = markdown;
    tab.render = rendered;
    tab.warnings = rendered.warnings;
    tab.isDirty = false;
    tab.hasExternalChange = false;
    tab.lastDiskMtimeMs = (await fsp.stat(tab.filePath)).mtimeMs;

    sendTabsStateUpdated();
    return { ok: true, filePath: tab.filePath };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

async function chooseRootFolderViaDialog(): Promise<{ ok: boolean; reason?: string; rootPath?: string; tree?: FolderNode[] }> {
  const result = await dialog.showOpenDialog({
    title: 'Select Root Folder',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, reason: 'cancelled' };
  }

  const rootPath = result.filePaths[0];
  if (!rootPath) {
    return { ok: false, reason: 'cancelled' };
  }

  state.currentRootFolder = rootPath;
  if (preferencesStore) {
    await preferencesStore.setLastRootFolder(rootPath);
  }

  const tree = await listMarkdownChildren(rootPath);
  return {
    ok: true,
    rootPath,
    tree
  };
}

async function exportCurrentPdfDialog(payload?: ExportPayload): Promise<ActionResult> {
  const tab = getExportTab(payload?.tabId);
  if (!tab) {
    return { ok: false, reason: 'No document is loaded.' };
  }

  const renderResult = payload?.markdown === undefined ? tab.render : await renderForExport(tab, payload.markdown);

  const defaultName = `${path.parse(tab.filePath).name}.pdf`;
  const selection = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath: path.join(path.dirname(tab.filePath), defaultName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (selection.canceled || !selection.filePath) {
    return { ok: false, reason: 'cancelled' };
  }

  await exportPdfFromHtml(
    path.parse(tab.filePath).name,
    renderResult.html,
    selection.filePath,
    baseHrefFromDir(path.dirname(tab.filePath)),
    {
      pageSize: 'Letter',
      printBackground: true
    }
  );

  return { ok: true, filePath: selection.filePath };
}

async function exportCurrentDocxDialog(payload?: ExportPayload): Promise<ActionResult> {
  const tab = getExportTab(payload?.tabId);
  if (!tab) {
    return { ok: false, reason: 'No document is loaded.' };
  }

  const renderResult = payload?.markdown === undefined ? tab.render : await renderForExport(tab, payload.markdown);

  const defaultName = `${path.parse(tab.filePath).name}.docx`;
  const selection = await dialog.showSaveDialog({
    title: 'Export DOCX',
    defaultPath: path.join(path.dirname(tab.filePath), defaultName),
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  });

  if (selection.canceled || !selection.filePath) {
    return { ok: false, reason: 'cancelled' };
  }

  const result = await exportDocxFromHtml(
    path.parse(tab.filePath).name,
    renderResult.exportHtml,
    selection.filePath,
    renderResult.baseDir,
    renderResult.diagrams,
    renderResult.warnings,
    {
      pageSize: 'Letter',
      marginsInches: {
        top: 1,
        right: 1,
        bottom: 1,
        left: 1
      }
    }
  );

  return {
    ok: true,
    filePath: result.outputFile,
    warnings: result.warnings
  };
}

async function exportCurrentHtmlDialog(payload?: ExportPayload): Promise<ActionResult> {
  const tab = getExportTab(payload?.tabId);
  if (!tab) {
    return { ok: false, reason: 'No document is loaded.' };
  }

  const renderResult = payload?.markdown === undefined ? tab.render : await renderForExport(tab, payload.markdown);

  const selection = await dialog.showOpenDialog({
    title: 'Select Export Destination',
    properties: ['openDirectory', 'createDirectory']
  });

  if (selection.canceled || selection.filePaths.length === 0) {
    return { ok: false, reason: 'cancelled' };
  }

  const selectedDir = selection.filePaths[0];
  if (!selectedDir) {
    return { ok: false, reason: 'cancelled' };
  }

  const outputDir = path.join(selectedDir, `${path.parse(tab.filePath).name}-export`);
  const result = await exportHtmlFolder(
    outputDir,
    path.parse(tab.filePath).name,
    renderResult.exportHtml,
    renderResult.baseDir,
    renderResult.diagrams,
    renderResult.warnings
  );

  return {
    ok: true,
    filePath: result.outputFile,
    warnings: result.warnings
  };
}

function getExportTab(tabId?: string): TabSessionInternal | null {
  if (tabId) {
    return getTabById(tabId);
  }
  return getActiveTab();
}

async function renderForExport(tab: TabSessionInternal, markdown: string): Promise<RenderResult> {
  const rendered = await renderMarkdown(
    {
      inputPath: tab.filePath,
      markdown,
      baseDir: path.dirname(tab.filePath),
      offline: true
    },
    mermaidRenderer
  );

  tab.currentMarkdown = markdown;
  tab.render = rendered;
  tab.warnings = rendered.warnings;
  tab.isDirty = markdown !== tab.savedMarkdown;

  sendTabsStateUpdated();
  return rendered;
}

function watchTabFile(tabId: string, filePath: string): void {
  stopWatchingTab(tabId);

  try {
    const watcher = fs.watch(filePath, () => {
      const existingTimer = state.watcherTimersByTabId.get(tabId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(async () => {
        const tab = getTabById(tabId);
        if (!tab) {
          return;
        }

        if (Date.now() < tab.ignoreWatcherEventsUntil) {
          return;
        }

        try {
          const st = await fsp.stat(filePath);
          tab.lastDiskMtimeMs = st.mtimeMs;
        } catch {
          // Ignore mtime failures; event still indicates potential change.
        }

        tab.hasExternalChange = true;
        sendTabsStateUpdated();
        sendDiskChanged(tabId, filePath);
      }, 180);

      state.watcherTimersByTabId.set(tabId, timer);
    });

    state.watchersByTabId.set(tabId, watcher);
  } catch {
    // Ignore watcher setup failures in restricted environments.
  }
}

function stopWatchingTab(tabId: string): void {
  const watcher = state.watchersByTabId.get(tabId);
  if (watcher) {
    watcher.close();
    state.watchersByTabId.delete(tabId);
  }

  const timer = state.watcherTimersByTabId.get(tabId);
  if (timer) {
    clearTimeout(timer);
    state.watcherTimersByTabId.delete(tabId);
  }
}

function stopWatchingAllTabs(): void {
  for (const tabId of [...state.watchersByTabId.keys()]) {
    stopWatchingTab(tabId);
  }
}

async function persistTabSession(): Promise<void> {
  if (!preferencesStore) {
    return;
  }

  const openTabs = state.tabOrder
    .map((tabId) => state.tabsById.get(tabId)?.filePath)
    .filter((item): item is string => Boolean(item));
  const activeTabPath = state.activeTabId ? state.tabsById.get(state.activeTabId)?.filePath : undefined;

  await preferencesStore.setTabSession(openTabs, activeTabPath);
}

async function restoreTabsFromPreferences(openTabs: string[], activeTabPath?: string): Promise<void> {
  for (const candidate of openTabs) {
    if (!candidate || !isMarkdownPath(candidate)) {
      continue;
    }

    const result = await openOrReuseTab(candidate, {
      activate: false,
      sendUpdate: false,
      persist: false
    });

    if (!result.ok) {
      console.warn(`[restore] Skipping tab ${candidate}: ${result.reason ?? 'unknown reason'}`);
    }
  }

  if (activeTabPath) {
    const existingTabId = findTabIdByPath(path.resolve(activeTabPath));
    if (existingTabId) {
      state.activeTabId = existingTabId;
    }
  }

  if (!state.activeTabId && state.tabOrder.length > 0) {
    state.activeTabId = state.tabOrder[0] ?? null;
  }
}
