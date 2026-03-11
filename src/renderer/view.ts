import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

import { documentCss } from '../core/render/styles';
import type { RenderWarning, RenderedBlock } from '../core/types';
import { buildPreviewPatchPlan } from './editorState';
import { clampSidebarWidth, getActiveTab, type RendererState, type TabMode } from './state';

export interface RendererRefs {
  openBtn: HTMLButtonElement;
  openFolderBtn: HTMLButtonElement;
  reloadBtn: HTMLButtonElement;
  saveBtn: HTMLButtonElement;
  saveAsBtn: HTMLButtonElement;
  exportPdfBtn: HTMLButtonElement;
  exportDocxBtn: HTMLButtonElement;
  exportHtmlBtn: HTMLButtonElement;
  pinRootBtn: HTMLButtonElement;
  refreshTreeBtn: HTMLButtonElement;
  tabRenderBtn: HTMLButtonElement;
  tabEditBtn: HTMLButtonElement;
  statusText: HTMLElement;
  dirtyIndicator: HTMLElement;
  previewStatus: HTMLElement;
  documentTabs: HTMLElement;
  editorHost: HTMLElement;
  renderHost: HTMLElement;
  warningsHost: HTMLElement;
  workspace: HTMLElement;
  sidebar: HTMLElement;
  sidebarResizer: HTMLElement;
  pinnedList: HTMLElement;
  pinnedEmpty: HTMLElement;
  rootPath: HTMLElement;
  treeContainer: HTMLElement;
  modalHost: HTMLElement;
  editorView: EditorView;
}

interface RendererRefsOptions {
  onEditorMarkdownChanged(markdownText: string): void;
  shouldIgnoreEditorUpdates(): boolean;
}

export function createRendererRefs(options: RendererRefsOptions): RendererRefs {
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
  const editorView = createEditor(editorHost, options);

  return {
    openBtn,
    openFolderBtn,
    reloadBtn,
    saveBtn,
    saveAsBtn,
    exportPdfBtn,
    exportDocxBtn,
    exportHtmlBtn,
    pinRootBtn,
    refreshTreeBtn,
    tabRenderBtn,
    tabEditBtn,
    statusText,
    dirtyIndicator,
    previewStatus,
    documentTabs,
    editorHost,
    renderHost,
    warningsHost,
    workspace,
    sidebar,
    sidebarResizer,
    pinnedList,
    pinnedEmpty,
    rootPath,
    treeContainer,
    modalHost,
    editorView
  };
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element as T;
}

function createEditor(parent: HTMLElement, options: RendererRefsOptions): EditorView {
  const editorState = EditorState.create({
    doc: '',
    extensions: [
      history(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      markdown(),
      EditorView.lineWrapping,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || options.shouldIgnoreEditorUpdates()) {
          return;
        }

        options.onEditorMarkdownChanged(update.state.doc.toString());
      }),
      EditorView.theme({
        '&': {
          height: '100%'
        }
      })
    ]
  });

  return new EditorView({ state: editorState, parent });
}

export function setStatus(refs: RendererRefs, text: string): void {
  refs.statusText.textContent = text;
}

export function setPreviewStatus(refs: RendererRefs, text: string): void {
  refs.previewStatus.textContent = text;
}

export function setEditorMarkdown(refs: RendererRefs, markdownText: string): void {
  refs.editorView.dispatch({
    changes: {
      from: 0,
      to: refs.editorView.state.doc.length,
      insert: markdownText
    }
  });
}

export function syncEditorWithActiveTab(refs: RendererRefs, state: RendererState): void {
  const activeTab = getActiveTab(state);
  if (!activeTab) {
    setEditorMarkdown(refs, '');
    return;
  }

  const currentDoc = refs.editorView.state.doc.toString();
  if (currentDoc !== activeTab.currentMarkdown) {
    setEditorMarkdown(refs, activeTab.currentMarkdown);
  }
}

export function renderDocumentTabs(refs: RendererRefs, state: RendererState): void {
  if (state.tabOrder.length === 0) {
    refs.documentTabs.innerHTML = '<div class="document-tabs-empty">No documents open.</div>';
    return;
  }

  refs.documentTabs.innerHTML = state.tabOrder
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

export function renderMainPane(refs: RendererRefs, state: RendererState): void {
  const activeTab = getActiveTab(state);
  renderModeTabs(refs, activeTab?.mode ?? 'render');
  renderStatus(refs, state);

  if (!activeTab) {
    refs.renderHost.innerHTML = '<div class="empty-state">Drop a <code>.md</code> file here, or use <strong>Open Markdown</strong>.</div>';
    renderWarnings(refs, []);
    refs.editorHost.classList.add('hidden');
    refs.renderHost.classList.remove('hidden');
    refs.saveBtn.disabled = true;
    refs.saveAsBtn.disabled = true;
    refs.reloadBtn.disabled = true;
    refs.exportPdfBtn.disabled = true;
    refs.exportDocxBtn.disabled = true;
    refs.exportHtmlBtn.disabled = true;
    return;
  }

  refs.saveBtn.disabled = false;
  refs.saveAsBtn.disabled = false;
  refs.reloadBtn.disabled = false;
  refs.exportPdfBtn.disabled = false;
  refs.exportDocxBtn.disabled = false;
  refs.exportHtmlBtn.disabled = false;

  if (activeTab.mode === 'edit') {
    refs.editorHost.classList.remove('hidden');
    refs.renderHost.classList.add('hidden');
  } else {
    refs.editorHost.classList.add('hidden');
    refs.renderHost.classList.remove('hidden');
    if (!activeTab.renderBlocks || activeTab.renderBlocks.length === 0) {
      refs.renderHost.innerHTML = '<div class="empty-state">Render output will appear here.</div>';
    } else {
      syncPreviewBlocks(refs, activeTab.renderBlocks);
    }
  }

  renderWarnings(refs, activeTab.warnings);
}

export function renderPinnedFolders(refs: RendererRefs, state: RendererState): void {
  if (state.pinnedFolders.length === 0) {
    refs.pinnedEmpty.classList.remove('hidden');
    refs.pinnedList.innerHTML = '';
    return;
  }

  refs.pinnedEmpty.classList.add('hidden');
  refs.pinnedList.innerHTML = state.pinnedFolders
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

export function updateRootUi(refs: RendererRefs, state: RendererState): void {
  refs.rootPath.textContent = state.activeRootPath || 'No root selected.';
  refs.pinRootBtn.textContent = isRootPinned(state) ? 'Unpin Root' : 'Pin Root';
  refs.pinRootBtn.disabled = !state.activeRootPath;
}

export function renderTree(refs: RendererRefs, state: RendererState): void {
  refs.treeContainer.innerHTML = renderTreeNodes(state.tree, state);
}

export function applySidebarWidth(refs: RendererRefs, state: RendererState, width: number, min: number, max: number): void {
  const normalized = clampSidebarWidth(width, min, max);
  state.sidebarWidth = normalized;
  document.documentElement.style.setProperty('--sidebar-width', `${normalized}px`);
}

export function applySidebarCollapsed(refs: RendererRefs, state: RendererState, collapsed: boolean): void {
  state.sidebarCollapsed = collapsed;
  refs.workspace.classList.toggle('collapsed', collapsed);
  refs.sidebar.classList.toggle('collapsed', collapsed);
}

export async function showChoiceModal(
  refs: RendererRefs,
  config: {
    title: string;
    message: string;
    buttons: Array<{ id: string; label: string; kind?: 'default' | 'danger' }>;
  }
): Promise<string> {
  return new Promise((resolve) => {
    refs.modalHost.innerHTML = '';

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

    const finish = (choice: string): void => {
      refs.modalHost.classList.add('hidden');
      refs.modalHost.innerHTML = '';
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
    refs.modalHost.appendChild(modal);
    refs.modalHost.classList.remove('hidden');
  });
}

function ensurePreviewDocumentStyles(): void {
  const existing = document.getElementById('mdvDocumentStyles') as HTMLStyleElement | null;
  if (existing) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'mdvDocumentStyles';
  style.textContent = documentCss('Letter');
  document.head.appendChild(style);
}

function syncPreviewBlocks(refs: RendererRefs, blocks: RenderedBlock[]): void {
  ensurePreviewDocumentStyles();

  let root = refs.renderHost.querySelector('.preview-content.mdv-document.mdv-document-screen') as HTMLElement | null;
  if (!root) {
    refs.renderHost.innerHTML = '';
    root = document.createElement('div');
    root.className = 'preview-content mdv-document mdv-document-screen';
    refs.renderHost.appendChild(root);
  }

  const currentElements = Array.from(root.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
  const currentBlocks = currentElements.map((element) => ({
    id: element.dataset.blockId || '',
    signature: element.dataset.blockSignature || ''
  }));
  const plan = buildPreviewPatchPlan(currentBlocks, blocks);
  const insertedIds = new Set(plan.insertedIds);
  const updatedIds = new Set(plan.updatedIds);
  const existingById = new Map(currentElements.map((element) => [element.dataset.blockId || '', element]));

  for (const removedId of plan.removedIds) {
    existingById.get(removedId)?.remove();
    existingById.delete(removedId);
  }

  const orderedElements: HTMLElement[] = [];
  for (const block of blocks) {
    let element = existingById.get(block.id) ?? null;
    if (!element || insertedIds.has(block.id) || updatedIds.has(block.id)) {
      const replacement = createPreviewBlockElement(block);
      if (element && element.parentElement === root) {
        root.replaceChild(replacement, element);
      }
      element = replacement;
      existingById.set(block.id, element);
    }
    orderedElements.push(element);
  }

  const currentOrder = Array.from(root.children)
    .filter((node): node is HTMLElement => node instanceof HTMLElement)
    .map((element) => element.dataset.blockId || '');
  const nextOrder = orderedElements.map((element) => element.dataset.blockId || '');
  const needsReorder =
    currentOrder.length !== nextOrder.length || currentOrder.some((id, index) => id !== nextOrder[index]);

  if (needsReorder) {
    const fragment = document.createDocumentFragment();
    for (const element of orderedElements) {
      fragment.appendChild(element);
    }
    root.appendChild(fragment);
  }
}

function createPreviewBlockElement(block: RenderedBlock): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = block.html.trim();
  const firstElement = template.content.firstElementChild;
  if (!firstElement) {
    const fallback = document.createElement('section');
    fallback.className = 'mdv-block mdv-block-warning';
    fallback.dataset.blockId = block.id;
    fallback.dataset.blockSignature = block.signature;
    return fallback;
  }

  const element = firstElement as HTMLElement;
  element.dataset.blockId = block.id;
  element.dataset.blockSignature = block.signature;
  return element;
}

function renderWarnings(refs: RendererRefs, warnings: RenderWarning[]): void {
  if (!warnings || warnings.length === 0) {
    refs.warningsHost.classList.add('hidden');
    refs.warningsHost.innerHTML = '';
    return;
  }

  const list = warnings
    .map((warning) => `<li><strong>${escapeHtml(warning.code)}</strong> - ${escapeHtml(warning.message)}</li>`)
    .join('');

  refs.warningsHost.innerHTML = `<ul>${list}</ul>`;
  refs.warningsHost.classList.remove('hidden');
}

function renderStatus(refs: RendererRefs, state: RendererState): void {
  const activeTab = getActiveTab(state);
  if (!activeTab) {
    setStatus(refs, 'No markdown file loaded.');
    refs.dirtyIndicator.classList.add('hidden');
    return;
  }

  setStatus(refs, `${activeTab.filePath} (${state.tabOrder.length} tab${state.tabOrder.length === 1 ? '' : 's'})`);
  refs.dirtyIndicator.classList.toggle('hidden', !activeTab.isDirty);
}

function renderModeTabs(refs: RendererRefs, mode: TabMode): void {
  refs.tabRenderBtn.classList.toggle('active', mode === 'render');
  refs.tabRenderBtn.setAttribute('aria-selected', String(mode === 'render'));
  refs.tabEditBtn.classList.toggle('active', mode === 'edit');
  refs.tabEditBtn.setAttribute('aria-selected', String(mode === 'edit'));
}

function renderTreeNodes(nodes: RendererState['tree'], state: RendererState): string {
  if (!nodes || nodes.length === 0) {
    return '<p class="muted">No markdown files in this root.</p>';
  }

  const html = nodes
    .map((node) => {
      if (node.type === 'dir') {
        const expanded = state.expandedDirs.has(node.path);
        const loaded = state.loadedDirs.has(node.path);
        const children = expanded ? (loaded ? renderTreeNodes(node.children ?? [], state) : '<p class="muted">Loading...</p>') : '';
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

function isRootPinned(state: RendererState): boolean {
  if (!state.activeRootPath) {
    return false;
  }

  return state.pinnedFolders.some((item) => item.path === state.activeRootPath);
}

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
