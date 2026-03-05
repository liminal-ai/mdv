import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

import { firstMarkdownPathFromDropFiles, isMarkdownPath } from '../core/drop';
import type {
  DocumentTabSession,
  FolderNode,
  OpenDocumentResult,
  PinnedFolder,
  RenderPreviewPayload,
  RenderWarning,
  TabsStatePayload
} from '../core/types';

type ActionResult = { ok: boolean; reason?: string; filePath?: string };
type ExportResult = {
  ok: boolean;
  reason?: string;
  filePath?: string;
  warnings?: Array<{ code: string; message: string; location?: string }>;
};

type ModalChoice = 'save' | 'discard' | 'cancel' | 'keep-mine' | 'reload-disk' | 'save-copy';

type UiCommand =
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

type TabMode = 'render' | 'edit';

interface ClientTab extends DocumentTabSession {
  mode: TabMode;
}

type MdvBridge = {
  getTabsState: () => Promise<TabsStatePayload>;
  openTabDialog: () => Promise<OpenDocumentResult>;
  openTabPath: (filePath: string) => Promise<OpenDocumentResult>;
  activateTab: (tabId: string) => Promise<OpenDocumentResult>;
  closeTab: (tabId: string) => Promise<OpenDocumentResult>;
  saveTab: (tabId: string, markdown: string) => Promise<ActionResult>;
  saveTabAs: (tabId: string, markdown: string) => Promise<ActionResult>;
  renderTab: (tabId: string, markdown: string) => Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }>;
  readTabFromDisk: (tabId: string) => Promise<{ ok: boolean; reason?: string; markdown?: string }>;
  reloadTabFromDisk: (tabId: string) => Promise<ActionResult>;
  ackDiskChange: (tabId: string) => Promise<{ ok: boolean; reason?: string }>;
  exportPdf: (payload?: { tabId?: string; markdown?: string }) => Promise<ExportResult>;
  exportDocx: (payload?: { tabId?: string; markdown?: string }) => Promise<ExportResult>;
  exportHtml: (payload?: { tabId?: string; markdown?: string }) => Promise<ExportResult>;
  quitApp: () => Promise<{ ok: boolean }>;
  getFolderState: () => Promise<{
    rootPath: string | null;
    pinnedFolders: PinnedFolder[];
    sidebarCollapsed: boolean;
    sidebarWidth: number;
  }>;
  chooseRootFolder: () => Promise<{ ok: boolean; reason?: string; rootPath?: string; tree?: FolderNode[] }>;
  listFolderTree: (rootPath?: string) => Promise<{ ok: boolean; reason?: string; rootPath?: string; tree: FolderNode[] }>;
  getPinnedFolders: () => Promise<PinnedFolder[]>;
  pinFolder: (folderPath?: string) => Promise<{ ok: boolean; reason?: string; pinnedFolders?: PinnedFolder[] }>;
  unpinFolder: (folderPath: string) => Promise<{ ok: boolean; reason?: string; pinnedFolders?: PinnedFolder[] }>;
  setRootFromPin: (folderPath: string) => Promise<{ ok: boolean; reason?: string; rootPath?: string; tree?: FolderNode[] }>;
  refreshFolders: () => Promise<{ ok: boolean; reason?: string; rootPath?: string; tree: FolderNode[] }>;
  toggleSidebarState: (collapsed: boolean) => Promise<{ ok: boolean }>;
  setSidebarWidth: (width: number) => Promise<{ ok: boolean }>;
  onTabsStateUpdated: (handler: (payload: TabsStatePayload) => void) => () => void;
  onTabsDiskChanged: (handler: (payload: { tabId: string; filePath: string }) => void) => () => void;
  onTabsOpenRequest: (handler: (payload: { filePath: string }) => void) => () => void;
  onUiCommand: (handler: (command: string) => void) => () => void;
  onToggleSidebar: (handler: () => void) => () => void;
};

declare global {
  interface Window {
    mdv: MdvBridge;
  }
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element as T;
}

const openBtn = byId<HTMLButtonElement>('openBtn');
const openFolderBtn = byId<HTMLButtonElement>('openFolderBtn');
const reloadBtn = byId<HTMLButtonElement>('reloadBtn');
const saveBtn = byId<HTMLButtonElement>('saveBtn');
const saveAsBtn = byId<HTMLButtonElement>('saveAsBtn');
const exportPdfBtn = byId<HTMLButtonElement>('exportPdfBtn');
const exportDocxBtn = byId<HTMLButtonElement>('exportDocxBtn');
const exportHtmlBtn = byId<HTMLButtonElement>('exportHtmlBtn');
const pinRootBtn = byId<HTMLButtonElement>('pinRootBtn');
const refreshTreeBtn = byId<HTMLButtonElement>('refreshTreeBtn');
const tabRenderBtn = byId<HTMLButtonElement>('tabRender');
const tabEditBtn = byId<HTMLButtonElement>('tabEdit');

const statusText = byId<HTMLElement>('statusText');
const dirtyIndicator = byId<HTMLElement>('dirtyIndicator');
const previewStatus = byId<HTMLElement>('previewStatus');
const documentTabs = byId<HTMLElement>('documentTabs');
const editorHost = byId<HTMLElement>('editorHost');
const renderHost = byId<HTMLElement>('renderHost');
const warningsHost = byId<HTMLElement>('warnings');
const workspace = byId<HTMLElement>('workspace');
const sidebar = byId<HTMLElement>('sidebar');
const sidebarResizer = byId<HTMLElement>('sidebarResizer');
const pinnedList = byId<HTMLElement>('pinnedList');
const pinnedEmpty = byId<HTMLElement>('pinnedEmpty');
const rootPath = byId<HTMLElement>('rootPath');
const treeContainer = byId<HTMLElement>('treeContainer');
const modalHost = byId<HTMLElement>('modalHost');

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 640;
const PREVIEW_DEBOUNCE_MS = 320;

const state = {
  sidebarCollapsed: false,
  sidebarWidth: 300,
  activeRootPath: null as string | null,
  pinnedFolders: [] as PinnedFolder[],
  tree: [] as FolderNode[],
  loadedDirs: new Set<string>(),
  expandedDirs: new Set<string>(),

  tabsById: new Map<string, ClientTab>(),
  tabOrder: [] as string[],
  activeTabId: null as string | null,

  previewRequestId: 0,
  isPreviewBusy: false
};

let previewTimer: number | null = null;
let suppressEditorListener = false;

const editorView = createEditor();

function createEditor(): EditorView {
  const editorState = EditorState.create({
    doc: '',
    extensions: [
      history(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      markdown(),
      EditorView.lineWrapping,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || suppressEditorListener) {
          return;
        }

        const markdownText = update.state.doc.toString();
        onEditorMarkdownChanged(markdownText);
      }),
      EditorView.theme({
        '&': {
          height: '100%'
        }
      })
    ]
  });

  return new EditorView({ state: editorState, parent: editorHost });
}

function getActiveTab(): ClientTab | null {
  if (!state.activeTabId) {
    return null;
  }

  return state.tabsById.get(state.activeTabId) ?? null;
}

function setStatus(text: string): void {
  statusText.textContent = text;
}

function setPreviewStatus(text: string): void {
  previewStatus.textContent = text;
}

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderWarnings(warnings: RenderWarning[]): void {
  if (!warnings || warnings.length === 0) {
    warningsHost.classList.add('hidden');
    warningsHost.innerHTML = '';
    return;
  }

  const list = warnings
    .map((warning) => `<li><strong>${escapeHtml(warning.code)}</strong> - ${escapeHtml(warning.message)}</li>`)
    .join('');

  warningsHost.innerHTML = `<ul>${list}</ul>`;
  warningsHost.classList.remove('hidden');
}

function renderDocumentTabs(): void {
  if (state.tabOrder.length === 0) {
    documentTabs.innerHTML = '<div class="document-tabs-empty">No documents open.</div>';
    return;
  }

  documentTabs.innerHTML = state.tabOrder
    .map((tabId) => {
      const tab = state.tabsById.get(tabId);
      if (!tab) {
        return '';
      }

      const isActive = tab.tabId === state.activeTabId;
      const dirtyDot = tab.isDirty ? '<span class="doc-tab-dirty" aria-hidden="true"></span>' : '';
      const changedBadge = tab.hasExternalChange ? '<span class="doc-tab-changed">changed</span>' : '';

      return `
        <button class="doc-tab ${isActive ? 'active' : ''}" type="button" data-tab-action="activate" data-tab-id="${escapeHtml(tab.tabId)}" title="${escapeHtml(tab.filePath)}">
          ${dirtyDot}
          <span class="doc-tab-title">${escapeHtml(tab.title)}</span>
          ${changedBadge}
          <span class="doc-tab-close" data-tab-action="close" data-tab-id="${escapeHtml(tab.tabId)}">x</span>
        </button>`;
    })
    .join('');
}

function renderStatus(): void {
  const activeTab = getActiveTab();
  if (!activeTab) {
    setStatus('No markdown file loaded.');
    dirtyIndicator.classList.add('hidden');
    return;
  }

  setStatus(`${activeTab.filePath} (${state.tabOrder.length} tab${state.tabOrder.length === 1 ? '' : 's'})`);
  dirtyIndicator.classList.toggle('hidden', !activeTab.isDirty);
}

function renderModeTabs(): void {
  const activeTab = getActiveTab();
  const mode: TabMode = activeTab?.mode ?? 'render';

  tabRenderBtn.classList.toggle('active', mode === 'render');
  tabRenderBtn.setAttribute('aria-selected', String(mode === 'render'));
  tabEditBtn.classList.toggle('active', mode === 'edit');
  tabEditBtn.setAttribute('aria-selected', String(mode === 'edit'));
}

function renderMainPane(): void {
  const activeTab = getActiveTab();
  renderModeTabs();
  renderStatus();

  if (!activeTab) {
    renderHost.innerHTML = '<div class="empty-state">Drop a <code>.md</code> file here, or use <strong>Open Markdown</strong>.</div>';
    renderWarnings([]);
    editorHost.classList.add('hidden');
    renderHost.classList.remove('hidden');
    saveBtn.disabled = true;
    saveAsBtn.disabled = true;
    reloadBtn.disabled = true;
    exportPdfBtn.disabled = true;
    exportDocxBtn.disabled = true;
    exportHtmlBtn.disabled = true;
    return;
  }

  saveBtn.disabled = false;
  saveAsBtn.disabled = false;
  reloadBtn.disabled = false;
  exportPdfBtn.disabled = false;
  exportDocxBtn.disabled = false;
  exportHtmlBtn.disabled = false;

  if (activeTab.mode === 'edit') {
    editorHost.classList.remove('hidden');
    renderHost.classList.add('hidden');
  } else {
    editorHost.classList.add('hidden');
    renderHost.classList.remove('hidden');
    if (!activeTab.renderHtml) {
      renderHost.innerHTML = '<div class="empty-state">Render output will appear here.</div>';
    } else {
      renderHost.innerHTML = `<div class="preview-content">${activeTab.renderHtml}</div>`;
    }
  }

  renderWarnings(activeTab.warnings);
}

function setEditorMarkdown(markdownText: string): void {
  suppressEditorListener = true;
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: markdownText
    }
  });
  suppressEditorListener = false;
}

function syncEditorWithActiveTab(): void {
  const activeTab = getActiveTab();
  if (!activeTab) {
    setEditorMarkdown('');
    return;
  }

  const currentDoc = editorView.state.doc.toString();
  if (currentDoc !== activeTab.currentMarkdown) {
    setEditorMarkdown(activeTab.currentMarkdown);
  }
}

function mergeTabsState(payload: TabsStatePayload): void {
  const previousTabs = state.tabsById;
  const nextTabs = new Map<string, ClientTab>();

  for (const session of payload.tabs) {
    const previous = previousTabs.get(session.tabId);
    const preserveActiveDraft =
      previous &&
      session.tabId === state.activeTabId &&
      previous.isDirty &&
      previous.currentMarkdown !== session.currentMarkdown;

    const currentMarkdown = preserveActiveDraft ? previous.currentMarkdown : session.currentMarkdown;

    nextTabs.set(session.tabId, {
      ...session,
      currentMarkdown,
      isDirty: currentMarkdown !== session.savedMarkdown,
      mode: previous?.mode ?? 'render'
    });
  }

  state.tabsById = nextTabs;
  state.tabOrder = payload.tabs.map((tab) => tab.tabId);

  if (payload.activeTabId && nextTabs.has(payload.activeTabId)) {
    state.activeTabId = payload.activeTabId;
  } else {
    state.activeTabId = state.tabOrder[0] ?? null;
  }
}

function applyTabsState(payload: TabsStatePayload): void {
  mergeTabsState(payload);
  renderDocumentTabs();
  syncEditorWithActiveTab();
  renderMainPane();
}

function setActiveMode(mode: TabMode): void {
  const activeTab = getActiveTab();
  if (!activeTab) {
    return;
  }

  activeTab.mode = mode;
  renderMainPane();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clearPreviewTimer(): void {
  if (previewTimer !== null) {
    window.clearTimeout(previewTimer);
    previewTimer = null;
  }
}

function schedulePreviewRender(): void {
  const activeTab = getActiveTab();
  if (!activeTab) {
    return;
  }

  clearPreviewTimer();
  setPreviewStatus('Updating render...');
  previewTimer = window.setTimeout(() => {
    void renderPreviewNow(activeTab.tabId, activeTab.currentMarkdown);
  }, PREVIEW_DEBOUNCE_MS);
}

async function renderPreviewNow(tabId: string, markdownText: string): Promise<void> {
  const requestId = ++state.previewRequestId;
  state.isPreviewBusy = true;
  setPreviewStatus('Updating render...');

  const result = await window.mdv.renderTab(tabId, markdownText);
  if (requestId !== state.previewRequestId) {
    return;
  }

  state.isPreviewBusy = false;
  if (!result.ok || !result.preview) {
    setPreviewStatus(result.reason ? `Render error: ${result.reason}` : 'Render error');
    return;
  }

  const tab = state.tabsById.get(tabId);
  if (tab) {
    tab.renderHtml = result.preview.html;
    tab.warnings = result.preview.warnings;
    tab.currentMarkdown = markdownText;
    tab.isDirty = tab.currentMarkdown !== tab.savedMarkdown;
  }

  renderDocumentTabs();
  renderMainPane();
  setPreviewStatus('');
}

function onEditorMarkdownChanged(markdownText: string): void {
  const activeTab = getActiveTab();
  if (!activeTab) {
    return;
  }

  activeTab.currentMarkdown = markdownText;
  activeTab.isDirty = activeTab.currentMarkdown !== activeTab.savedMarkdown;
  renderDocumentTabs();
  renderStatus();
  schedulePreviewRender();
}

async function showChoiceModal(config: {
  title: string;
  message: string;
  buttons: Array<{ id: ModalChoice; label: string; kind?: 'default' | 'danger' }>;
}): Promise<ModalChoice> {
  return new Promise((resolve) => {
    modalHost.innerHTML = '';

    const modal = document.createElement('div');
    modal.className = 'modal';

    const heading = document.createElement('h3');
    heading.textContent = config.title;
    modal.appendChild(heading);

    const message = document.createElement('p');
    message.textContent = config.message;
    modal.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const finish = (choice: ModalChoice): void => {
      modalHost.classList.add('hidden');
      modalHost.innerHTML = '';
      resolve(choice);
    };

    for (const buttonConfig of config.buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = buttonConfig.label;
      if (buttonConfig.kind === 'danger') {
        button.dataset.kind = 'danger';
      }
      button.addEventListener('click', () => finish(buttonConfig.id));
      actions.appendChild(button);
    }

    modal.appendChild(actions);
    modalHost.appendChild(modal);
    modalHost.classList.remove('hidden');
  });
}

function isRootPinned(): boolean {
  if (!state.activeRootPath) {
    return false;
  }
  return state.pinnedFolders.some((item) => item.path === state.activeRootPath);
}

function updateRootUi(): void {
  rootPath.textContent = state.activeRootPath || 'No root selected.';
  pinRootBtn.textContent = isRootPinned() ? 'Unpin Root' : 'Pin Root';
  pinRootBtn.disabled = !state.activeRootPath;
}

function renderPinnedFolders(): void {
  if (state.pinnedFolders.length === 0) {
    pinnedEmpty.classList.remove('hidden');
    pinnedList.innerHTML = '';
    return;
  }

  pinnedEmpty.classList.add('hidden');
  pinnedList.innerHTML = state.pinnedFolders
    .map((item) => {
      const activeClass = item.path === state.activeRootPath ? 'active' : '';
      return `
        <li class="pinned-item ${activeClass}" data-path="${escapeHtml(item.path)}">
          <button type="button" class="pinned-path" data-action="set-root" data-path="${escapeHtml(item.path)}" title="${escapeHtml(item.path)}">${escapeHtml(item.label)}</button>
          <button type="button" class="remove-pin" data-action="remove-pin" data-path="${escapeHtml(item.path)}">x</button>
        </li>`;
    })
    .join('');
}

function renderTreeNodes(nodes: FolderNode[]): string {
  if (!nodes || nodes.length === 0) {
    return '<p class="muted">No markdown files in this root.</p>';
  }

  const html = nodes
    .map((node) => {
      if (node.type === 'dir') {
        const expanded = state.expandedDirs.has(node.path);
        const loaded = state.loadedDirs.has(node.path);
        const children = expanded ? (loaded ? renderTreeNodes(node.children ?? []) : '<p class="muted">Loading...</p>') : '';
        return `
          <li>
            <button type="button" class="tree-node dir ${expanded ? 'expanded' : ''}" data-node-type="dir" data-node-path="${escapeHtml(node.path)}">${escapeHtml(node.name)}</button>
            ${expanded ? `<div class="tree-children">${children}</div>` : ''}
          </li>`;
      }

      return `
        <li>
          <button type="button" class="tree-node file" data-node-type="file" data-node-path="${escapeHtml(node.path)}">${escapeHtml(node.name)}</button>
        </li>`;
    })
    .join('');

  return `<ul class="tree-list">${html}</ul>`;
}

function renderTree(): void {
  treeContainer.innerHTML = renderTreeNodes(state.tree);
}

function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return 300;
  }
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function applySidebarWidth(width: number): void {
  const normalized = clampSidebarWidth(width);
  state.sidebarWidth = normalized;
  document.documentElement.style.setProperty('--sidebar-width', `${normalized}px`);
}

async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  state.sidebarCollapsed = collapsed;
  workspace.classList.toggle('collapsed', collapsed);
  sidebar.classList.toggle('collapsed', collapsed);
  await window.mdv.toggleSidebarState(collapsed);
}

async function persistSidebarWidth(): Promise<void> {
  await window.mdv.setSidebarWidth(state.sidebarWidth);
}

function setupSidebarResize(): void {
  let dragging = false;

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging || state.sidebarCollapsed) {
      return;
    }

    const bounds = workspace.getBoundingClientRect();
    applySidebarWidth(event.clientX - bounds.left);
  };

  const stopDragging = async (): Promise<void> => {
    if (!dragging) {
      return;
    }

    dragging = false;
    sidebarResizer.classList.remove('dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
    window.removeEventListener('pointercancel', stopDragging);
    await persistSidebarWidth();
  };

  sidebarResizer.addEventListener('pointerdown', (event) => {
    if (state.sidebarCollapsed) {
      return;
    }
    dragging = true;
    sidebarResizer.classList.add('dragging');
    sidebarResizer.setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
  });
}

async function refreshTree(rootOverride?: string, providedTree?: FolderNode[]): Promise<void> {
  const requestedRoot = rootOverride || state.activeRootPath;
  if (!requestedRoot) {
    state.tree = [];
    renderTree();
    return;
  }

  if (providedTree) {
    state.loadedDirs = new Set([requestedRoot]);
    state.tree = providedTree;
    state.activeRootPath = requestedRoot;
    renderTree();
    updateRootUi();
    return;
  }

  let result;
  try {
    result = await window.mdv.listFolderTree(requestedRoot);
  } catch {
    setStatus('Folder tree is not ready yet. Retrying can help.');
    return;
  }

  if (!result.ok) {
    setStatus(result.reason || 'Unable to load folder tree.');
    return;
  }

  state.activeRootPath = result.rootPath || requestedRoot;
  state.loadedDirs = new Set([state.activeRootPath]);
  state.tree = result.tree || [];
  renderTree();
  updateRootUi();
}

async function refreshPins(): Promise<void> {
  state.pinnedFolders = await window.mdv.getPinnedFolders();
  renderPinnedFolders();
  updateRootUi();
}

async function chooseRootFolder(): Promise<void> {
  const result = await window.mdv.chooseRootFolder();
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(result.reason);
    }
    return;
  }

  state.activeRootPath = result.rootPath || null;
  if (state.activeRootPath) {
    state.expandedDirs.add(state.activeRootPath);
  }
  await refreshTree(state.activeRootPath || undefined, result.tree || []);
  await refreshPins();
}

function setChildrenForPath(nodes: FolderNode[], targetPath: string, children: FolderNode[]): boolean {
  for (const node of nodes) {
    if (node.type === 'dir' && node.path === targetPath) {
      node.children = children;
      return true;
    }

    if (node.type === 'dir' && Array.isArray(node.children) && setChildrenForPath(node.children, targetPath, children)) {
      return true;
    }
  }

  return false;
}

async function loadDirectoryChildren(directoryPath: string): Promise<boolean> {
  let result;
  try {
    result = await window.mdv.listFolderTree(directoryPath);
  } catch {
    setStatus(`Unable to load ${directoryPath}`);
    return false;
  }

  if (!result.ok) {
    setStatus(result.reason || `Unable to load ${directoryPath}`);
    return false;
  }

  setChildrenForPath(state.tree, directoryPath, result.tree || []);
  state.loadedDirs.add(directoryPath);
  return true;
}

async function openMarkdownFromDialog(): Promise<void> {
  const result = await window.mdv.openTabDialog();
  if (!result.ok && result.reason && result.reason !== 'cancelled') {
    setStatus(result.reason);
  }
}

async function openMarkdownPath(filePath: string): Promise<void> {
  if (!isMarkdownPath(filePath)) {
    setStatus('Only .md or .markdown files are supported.');
    return;
  }

  const result = await window.mdv.openTabPath(filePath);
  if (!result.ok && result.reason) {
    setStatus(result.reason);
  }
}

async function activateDocumentTab(tabId: string): Promise<void> {
  if (tabId === state.activeTabId) {
    return;
  }

  const result = await window.mdv.activateTab(tabId);
  if (!result.ok && result.reason) {
    setStatus(result.reason);
  }
}

async function saveTab(tabId: string): Promise<boolean> {
  const tab = state.tabsById.get(tabId);
  if (!tab) {
    return false;
  }

  const result = await window.mdv.saveTab(tabId, tab.currentMarkdown);
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`Save failed: ${result.reason}`);
    }
    return false;
  }

  setStatus(`Saved ${tab.filePath}`);
  return true;
}

async function saveTabAs(tabId: string): Promise<boolean> {
  const tab = state.tabsById.get(tabId);
  if (!tab) {
    return false;
  }

  const result = await window.mdv.saveTabAs(tabId, tab.currentMarkdown);
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`Save As failed: ${result.reason}`);
    }
    return false;
  }

  setStatus(`Saved ${result.filePath || tab.filePath}`);
  return true;
}

async function closeDocumentTab(tabId: string): Promise<void> {
  const tab = state.tabsById.get(tabId);
  if (!tab) {
    return;
  }

  if (tab.isDirty) {
    const choice = await showChoiceModal({
      title: `Unsaved changes in ${tab.title}`,
      message: 'Save changes before closing this tab?',
      buttons: [
        { id: 'save', label: 'Save' },
        { id: 'discard', label: 'Discard', kind: 'danger' },
        { id: 'cancel', label: 'Cancel' }
      ]
    });

    if (choice === 'cancel') {
      return;
    }

    if (choice === 'save') {
      const saved = await saveTab(tabId);
      if (!saved) {
        return;
      }
    }
  }

  const result = await window.mdv.closeTab(tabId);
  if (!result.ok && result.reason) {
    setStatus(result.reason);
  }
}

async function ensureReloadAllowed(tab: ClientTab): Promise<boolean> {
  if (!tab.isDirty) {
    return true;
  }

  const choice = await showChoiceModal({
    title: 'Unsaved changes',
    message: 'Save changes before reloading from disk?',
    buttons: [
      { id: 'save', label: 'Save' },
      { id: 'discard', label: 'Discard', kind: 'danger' },
      { id: 'cancel', label: 'Cancel' }
    ]
  });

  if (choice === 'cancel') {
    return false;
  }

  if (choice === 'discard') {
    return true;
  }

  return saveTab(tab.tabId);
}

async function reloadActiveTabFromDisk(): Promise<void> {
  const activeTab = getActiveTab();
  if (!activeTab) {
    return;
  }

  if (!(await ensureReloadAllowed(activeTab))) {
    return;
  }

  const result = await window.mdv.reloadTabFromDisk(activeTab.tabId);
  if (!result.ok && result.reason) {
    setStatus(`Reload failed: ${result.reason}`);
  }
}

async function exportActivePdf(): Promise<void> {
  const activeTab = getActiveTab();
  if (!activeTab) {
    return;
  }

  const result = await window.mdv.exportPdf({ tabId: activeTab.tabId, markdown: activeTab.currentMarkdown });
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`PDF export failed: ${result.reason}`);
    }
    return;
  }

  setStatus(`PDF exported to ${result.filePath}`);
}

async function exportActiveDocx(): Promise<void> {
  const activeTab = getActiveTab();
  if (!activeTab) {
    return;
  }

  const result = await window.mdv.exportDocx({ tabId: activeTab.tabId, markdown: activeTab.currentMarkdown });
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`DOCX export failed: ${result.reason}`);
    }
    return;
  }

  setStatus(`DOCX exported to ${result.filePath}`);
  renderWarnings((result.warnings || []) as RenderWarning[]);
}

async function exportActiveHtml(): Promise<void> {
  const activeTab = getActiveTab();
  if (!activeTab) {
    return;
  }

  const result = await window.mdv.exportHtml({ tabId: activeTab.tabId, markdown: activeTab.currentMarkdown });
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`HTML export failed: ${result.reason}`);
    }
    return;
  }

  setStatus(`HTML export written to ${result.filePath}`);
  renderWarnings((result.warnings || []) as RenderWarning[]);
}

async function handleExternalChange(tabId: string): Promise<void> {
  const tab = state.tabsById.get(tabId);
  if (!tab || !tab.hasExternalChange) {
    return;
  }

  if (!tab.isDirty) {
    const result = await window.mdv.reloadTabFromDisk(tabId);
    if (!result.ok && result.reason) {
      setStatus(`Reload failed: ${result.reason}`);
    }
    return;
  }

  const choice = await showChoiceModal({
    title: 'File changed on disk',
    message: 'This file changed outside MD Viewer. How should we proceed?',
    buttons: [
      { id: 'keep-mine', label: 'Keep Mine' },
      { id: 'reload-disk', label: 'Reload Disk' },
      { id: 'save-copy', label: 'Save As Copy' }
    ]
  });

  if (choice === 'keep-mine') {
    await window.mdv.ackDiskChange(tabId);
    renderDocumentTabs();
    setStatus('Keeping in-editor changes.');
    return;
  }

  if (choice === 'reload-disk') {
    const result = await window.mdv.reloadTabFromDisk(tabId);
    if (!result.ok && result.reason) {
      setStatus(`Reload failed: ${result.reason}`);
    }
    return;
  }

  await saveTabAs(tabId);
}

async function maybeHandleActiveExternalChange(): Promise<void> {
  const activeTab = getActiveTab();
  if (!activeTab || !activeTab.hasExternalChange) {
    return;
  }

  await handleExternalChange(activeTab.tabId);
}

function cycleDocumentTab(direction: 1 | -1): void {
  if (state.tabOrder.length <= 1 || !state.activeTabId) {
    return;
  }

  const currentIndex = state.tabOrder.indexOf(state.activeTabId);
  if (currentIndex < 0) {
    return;
  }

  const nextIndex = (currentIndex + direction + state.tabOrder.length) % state.tabOrder.length;
  const nextTabId = state.tabOrder[nextIndex];
  if (!nextTabId) {
    return;
  }

  void activateDocumentTab(nextTabId);
}

async function attemptQuitWithPrompts(): Promise<void> {
  for (const tabId of [...state.tabOrder]) {
    const tab = state.tabsById.get(tabId);
    if (!tab || !tab.isDirty) {
      continue;
    }

    if (state.activeTabId !== tabId) {
      await activateDocumentTab(tabId);
    }

    const choice = await showChoiceModal({
      title: `Unsaved changes in ${tab.title}`,
      message: 'Save changes before quitting?',
      buttons: [
        { id: 'save', label: 'Save' },
        { id: 'discard', label: 'Discard', kind: 'danger' },
        { id: 'cancel', label: 'Cancel' }
      ]
    });

    if (choice === 'cancel') {
      return;
    }

    if (choice === 'save') {
      const saved = await saveTab(tabId);
      if (!saved) {
        return;
      }
    }
  }

  await window.mdv.quitApp();
}

documentTabs.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('[data-tab-action]') as HTMLElement | null;
  if (!target) {
    return;
  }

  const action = target.dataset.tabAction;
  const tabId = target.dataset.tabId;
  if (!tabId) {
    return;
  }

  if (action === 'close') {
    void closeDocumentTab(tabId);
    return;
  }

  void activateDocumentTab(tabId);
});

documentTabs.addEventListener('auxclick', (event) => {
  if (event.button !== 1) {
    return;
  }

  const target = (event.target as HTMLElement).closest('[data-tab-id]') as HTMLElement | null;
  const tabId = target?.dataset.tabId;
  if (!tabId) {
    return;
  }

  void closeDocumentTab(tabId);
});

openBtn.addEventListener('click', () => {
  void openMarkdownFromDialog();
});

openFolderBtn.addEventListener('click', () => {
  void chooseRootFolder();
});

reloadBtn.addEventListener('click', () => {
  void reloadActiveTabFromDisk();
});

saveBtn.addEventListener('click', () => {
  const activeTab = getActiveTab();
  if (activeTab) {
    void saveTab(activeTab.tabId);
  }
});

saveAsBtn.addEventListener('click', () => {
  const activeTab = getActiveTab();
  if (activeTab) {
    void saveTabAs(activeTab.tabId);
  }
});

exportPdfBtn.addEventListener('click', () => {
  void exportActivePdf();
});

exportDocxBtn.addEventListener('click', () => {
  void exportActiveDocx();
});

exportHtmlBtn.addEventListener('click', () => {
  void exportActiveHtml();
});

pinRootBtn.addEventListener('click', async () => {
  if (!state.activeRootPath) {
    return;
  }

  const response = isRootPinned()
    ? await window.mdv.unpinFolder(state.activeRootPath)
    : await window.mdv.pinFolder(state.activeRootPath);

  if (!response.ok) {
    setStatus(response.reason || 'Unable to update pinned folders.');
    return;
  }

  state.pinnedFolders = response.pinnedFolders || [];
  renderPinnedFolders();
  updateRootUi();
});

refreshTreeBtn.addEventListener('click', async () => {
  const result = await window.mdv.refreshFolders();
  if (!result.ok) {
    setStatus(result.reason || 'Unable to refresh folder tree.');
    return;
  }

  state.activeRootPath = result.rootPath || state.activeRootPath;
  state.loadedDirs = new Set(state.activeRootPath ? [state.activeRootPath] : []);
  state.tree = result.tree || [];
  renderTree();
  updateRootUi();
});

pinnedList.addEventListener('click', async (event) => {
  const target = (event.target as HTMLElement).closest('button[data-action]');
  if (!target) {
    return;
  }

  const action = target.getAttribute('data-action');
  const folderPath = target.getAttribute('data-path');
  if (!folderPath) {
    return;
  }

  if (action === 'remove-pin') {
    const result = await window.mdv.unpinFolder(folderPath);
    if (!result.ok) {
      setStatus(result.reason || 'Unable to unpin folder.');
      return;
    }

    state.pinnedFolders = result.pinnedFolders || [];
    renderPinnedFolders();
    updateRootUi();
    return;
  }

  const result = await window.mdv.setRootFromPin(folderPath);
  if (!result.ok) {
    setStatus(result.reason || 'Unable to set root from pin.');
    return;
  }

  state.activeRootPath = result.rootPath || folderPath;
  state.expandedDirs.add(state.activeRootPath);
  state.loadedDirs = new Set([state.activeRootPath]);
  state.tree = result.tree || [];
  renderTree();
  renderPinnedFolders();
  updateRootUi();
});

treeContainer.addEventListener('click', async (event) => {
  const target = (event.target as HTMLElement).closest('button[data-node-type]');
  if (!target) {
    return;
  }

  const nodeType = target.getAttribute('data-node-type');
  const nodePath = target.getAttribute('data-node-path');
  if (!nodeType || !nodePath) {
    return;
  }

  if (nodeType === 'dir') {
    if (state.expandedDirs.has(nodePath)) {
      state.expandedDirs.delete(nodePath);
      renderTree();
      return;
    }

    state.expandedDirs.add(nodePath);
    renderTree();

    if (!state.loadedDirs.has(nodePath)) {
      const loaded = await loadDirectoryChildren(nodePath);
      if (loaded) {
        renderTree();
      }
    }
    return;
  }

  await openMarkdownPath(nodePath);
});

window.mdv.onTabsStateUpdated((payload) => {
  const previousActive = state.activeTabId;
  applyTabsState(payload);

  if (state.activeTabId && previousActive !== state.activeTabId) {
    void maybeHandleActiveExternalChange();
  }
});

window.mdv.onTabsDiskChanged((payload) => {
  const tab = state.tabsById.get(payload.tabId);
  if (!tab) {
    return;
  }

  tab.hasExternalChange = true;
  renderDocumentTabs();

  if (payload.tabId === state.activeTabId) {
    void handleExternalChange(payload.tabId);
  }
});

window.mdv.onTabsOpenRequest((payload) => {
  void openMarkdownPath(payload.filePath);
});

window.mdv.onUiCommand((command) => {
  const typed = command as UiCommand;
  if (typed === 'open-markdown') {
    void openMarkdownFromDialog();
    return;
  }

  if (typed === 'reload-document') {
    void reloadActiveTabFromDisk();
    return;
  }

  if (typed === 'save-document') {
    const activeTab = getActiveTab();
    if (activeTab) {
      void saveTab(activeTab.tabId);
    }
    return;
  }

  if (typed === 'save-document-as') {
    const activeTab = getActiveTab();
    if (activeTab) {
      void saveTabAs(activeTab.tabId);
    }
    return;
  }

  if (typed === 'close-tab') {
    const activeTab = getActiveTab();
    if (activeTab) {
      void closeDocumentTab(activeTab.tabId);
    }
    return;
  }

  if (typed === 'next-document-tab') {
    cycleDocumentTab(1);
    return;
  }

  if (typed === 'previous-document-tab') {
    cycleDocumentTab(-1);
    return;
  }

  if (typed === 'show-edit-tab') {
    setActiveMode('edit');
    return;
  }

  if (typed === 'show-render-tab' || typed === 'show-preview-tab') {
    setActiveMode('render');
    return;
  }

  if (typed === 'export-pdf') {
    void exportActivePdf();
    return;
  }

  if (typed === 'export-docx') {
    void exportActiveDocx();
    return;
  }

  if (typed === 'export-html') {
    void exportActiveHtml();
    return;
  }

  if (typed === 'request-app-quit') {
    void attemptQuitWithPrompts();
  }
});

window.mdv.onToggleSidebar(() => {
  void setSidebarCollapsed(!state.sidebarCollapsed);
});

window.addEventListener('dragover', (event) => {
  event.preventDefault();

  if (state.tabOrder.length === 0) {
    renderHost.classList.add('drag-over');
    return;
  }

  const activeTab = getActiveTab();
  if (activeTab?.mode === 'render') {
    const target = event.target as Node | null;
    if (target && renderHost.contains(target)) {
      renderHost.classList.add('drag-over');
    }
  }
});

window.addEventListener('dragleave', (event) => {
  event.preventDefault();
  renderHost.classList.remove('drag-over');
});

window.addEventListener('drop', (event) => {
  event.preventDefault();
  renderHost.classList.remove('drag-over');

  const droppedPath = firstMarkdownPathFromDropFiles(
    event.dataTransfer ? (event.dataTransfer.files as unknown as ArrayLike<{ path?: string }>) : null
  );
  if (!droppedPath) {
    setStatus('Only .md or .markdown files are supported.');
    return;
  }

  if (state.tabOrder.length === 0) {
    void openMarkdownPath(droppedPath);
    return;
  }

  const activeTab = getActiveTab();
  if (!activeTab) {
    return;
  }

  const target = event.target as Node | null;
  const inRenderHost = target ? renderHost.contains(target) : false;

  if (activeTab.mode === 'render' && inRenderHost) {
    void openMarkdownPath(droppedPath);
    return;
  }

  setStatus('Drop markdown onto the render pane to open/replace while tabs are active.');
});

tabRenderBtn.addEventListener('click', () => {
  setActiveMode('render');
});

tabEditBtn.addEventListener('click', () => {
  setActiveMode('edit');
});

(async function init() {
  applySidebarWidth(300);
  setupSidebarResize();

  let tabsState: TabsStatePayload = { tabs: [], activeTabId: null };
  let folderState = {
    rootPath: null as string | null,
    pinnedFolders: [] as PinnedFolder[],
    sidebarCollapsed: false,
    sidebarWidth: 300
  };
  let lastInitError: unknown = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      [tabsState, folderState] = await Promise.all([window.mdv.getTabsState(), window.mdv.getFolderState()]);
      lastInitError = null;
      break;
    } catch (error) {
      lastInitError = error;
      await delay(75 * attempt);
    }
  }

  state.activeRootPath = folderState.rootPath || null;
  state.pinnedFolders = folderState.pinnedFolders || [];
  state.sidebarCollapsed = Boolean(folderState.sidebarCollapsed);
  applySidebarWidth(folderState.sidebarWidth);
  workspace.classList.toggle('collapsed', state.sidebarCollapsed);
  sidebar.classList.toggle('collapsed', state.sidebarCollapsed);

  renderPinnedFolders();
  updateRootUi();

  if (state.activeRootPath) {
    state.expandedDirs.add(state.activeRootPath);
    await refreshTree(state.activeRootPath);
  } else {
    renderTree();
  }

  applyTabsState(tabsState);
  setActiveMode('render');

  if (lastInitError) {
    setStatus('Initial load was delayed. Use Open Folder or Open Markdown if needed.');
  }
})();
