import { firstMarkdownPathFromDropFiles, isMarkdownPath } from '../core/drop';
import type { UiCommand } from '../core/ipc';
import type { FolderNode, PinnedFolder, TabsStatePayload } from '../core/types';
import { getBridge } from './bridge';
import { nextActiveTabAfterClose } from './editorState';
import { createRendererState, getActiveTab, mergeTabsState, setChildrenForPath, type ClientTab } from './state';
import {
  applySidebarCollapsed,
  applySidebarWidth,
  createRendererRefs,
  renderDocumentTabs,
  renderMainPane,
  renderPinnedFolders,
  renderTree,
  setEditorMarkdown,
  setPreviewStatus,
  setStatus,
  showChoiceModal,
  syncEditorWithActiveTab,
  updateRootUi
} from './view';

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 640;
const PREVIEW_DEBOUNCE_MS = 320;

type ModalChoice = 'save' | 'discard' | 'cancel' | 'keep-mine' | 'reload-disk' | 'save-copy';

export function createAppController(): { init(): Promise<void> } {
  const mdv = getBridge();
  const state = createRendererState();
  let previewTimer: number | null = null;
  let suppressEditorListener = false;

  const refs = createRendererRefs({
    onEditorMarkdownChanged: (markdownText) => {
      onEditorMarkdownChanged(markdownText);
    },
    shouldIgnoreEditorUpdates: () => suppressEditorListener
  });

  function withSuppressedEditorSync(run: () => void): void {
    suppressEditorListener = true;
    run();
    suppressEditorListener = false;
  }

  function applyTabsState(payload: TabsStatePayload): void {
    mergeTabsState(state, payload);
    renderDocumentTabs(refs, state);
    withSuppressedEditorSync(() => syncEditorWithActiveTab(refs, state));
    renderMainPane(refs, state);
  }

  function setActiveMode(mode: 'render' | 'edit'): void {
    const activeTab = getActiveTab(state);
    if (!activeTab) {
      return;
    }

    activeTab.mode = mode;
    renderMainPane(refs, state);
  }

  function clearPreviewTimer(): void {
    if (previewTimer !== null) {
      window.clearTimeout(previewTimer);
      previewTimer = null;
    }
  }

  function schedulePreviewRender(): void {
    const activeTab = getActiveTab(state);
    if (!activeTab) {
      return;
    }

    clearPreviewTimer();
    previewTimer = window.setTimeout(() => {
      previewTimer = null;
      void renderPreviewNow(activeTab.tabId, activeTab.currentMarkdown);
    }, PREVIEW_DEBOUNCE_MS);
  }

  async function renderPreviewNow(tabId: string, markdownText: string): Promise<void> {
    const requestId = ++state.previewRequestId;
    state.isPreviewBusy = true;
    setPreviewStatus(refs, 'Updating render...');

    const result = await mdv.renderTab(tabId, markdownText);
    if (requestId !== state.previewRequestId) {
      return;
    }

    state.isPreviewBusy = false;
    if (!result.ok || !result.preview) {
      setPreviewStatus(refs, result.reason ? `Render error: ${result.reason}` : 'Render error');
      return;
    }

    const tab = state.tabsById.get(tabId);
    if (tab) {
      tab.renderHtml = result.preview.html;
      tab.renderBlocks = result.preview.blocks;
      tab.warnings = result.preview.warnings;
      tab.currentMarkdown = markdownText;
      tab.isDirty = tab.currentMarkdown !== tab.savedMarkdown;
    }

    renderDocumentTabs(refs, state);
    renderMainPane(refs, state);
    setPreviewStatus(refs, '');
  }

  function onEditorMarkdownChanged(markdownText: string): void {
    const activeTab = getActiveTab(state);
    if (!activeTab) {
      return;
    }

    activeTab.currentMarkdown = markdownText;
    activeTab.isDirty = activeTab.currentMarkdown !== activeTab.savedMarkdown;
    renderDocumentTabs(refs, state);
    renderMainPane(refs, state);
    setPreviewStatus(refs, 'Updating render...');
    clearPreviewTimer();
    schedulePreviewRender();
  }

  async function refreshTree(rootOverride?: string, providedTree?: FolderNode[]): Promise<void> {
    const requestedRoot = rootOverride || state.activeRootPath;
    if (!requestedRoot) {
      state.tree = [];
      renderTree(refs, state);
      return;
    }

    if (providedTree) {
      state.loadedDirs = new Set([requestedRoot]);
      state.tree = providedTree;
      state.activeRootPath = requestedRoot;
      renderTree(refs, state);
      updateRootUi(refs, state);
      return;
    }

    let result;
    try {
      result = await mdv.listFolderTree(requestedRoot);
    } catch {
      setStatus(refs, 'Folder tree is not ready yet. Retrying can help.');
      return;
    }

    if (!result.ok) {
      setStatus(refs, result.reason || 'Unable to load folder tree.');
      return;
    }

    state.activeRootPath = result.rootPath || requestedRoot;
    state.loadedDirs = new Set(state.activeRootPath ? [state.activeRootPath] : []);
    state.tree = result.tree || [];
    renderTree(refs, state);
    updateRootUi(refs, state);
  }

  async function refreshPins(): Promise<void> {
    state.pinnedFolders = await mdv.getPinnedFolders();
    renderPinnedFolders(refs, state);
    updateRootUi(refs, state);
  }

  async function chooseRootFolder(): Promise<void> {
    const result = await mdv.chooseRootFolder();
    if (!result.ok) {
      if (result.reason && result.reason !== 'cancelled') {
        setStatus(refs, result.reason);
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

  async function loadDirectoryChildren(directoryPath: string): Promise<boolean> {
    let result;
    try {
      result = await mdv.listFolderTree(directoryPath);
    } catch {
      setStatus(refs, `Unable to load ${directoryPath}`);
      return false;
    }

    if (!result.ok) {
      setStatus(refs, result.reason || `Unable to load ${directoryPath}`);
      return false;
    }

    setChildrenForPath(state.tree, directoryPath, result.tree || []);
    state.loadedDirs.add(directoryPath);
    return true;
  }

  async function openMarkdownFromDialog(): Promise<void> {
    const result = await mdv.openTabDialog();
    if (!result.ok && result.reason && result.reason !== 'cancelled') {
      setStatus(refs, result.reason);
    }
  }

  async function openMarkdownPath(filePath: string): Promise<void> {
    if (!isMarkdownPath(filePath)) {
      setStatus(refs, 'Only .md or .markdown files are supported.');
      return;
    }

    const result = await mdv.openTabPath(filePath);
    if (!result.ok && result.reason) {
      setStatus(refs, result.reason);
    }
  }

  async function activateDocumentTab(tabId: string): Promise<void> {
    if (tabId === state.activeTabId) {
      return;
    }

    const result = await mdv.activateTab(tabId);
    if (!result.ok && result.reason) {
      setStatus(refs, result.reason);
    }
  }

  async function saveTab(tabId: string): Promise<boolean> {
    const tab = state.tabsById.get(tabId);
    if (!tab) {
      return false;
    }

    const result = await mdv.saveTab(tabId, tab.currentMarkdown);
    if (!result.ok) {
      if (result.reason && result.reason !== 'cancelled') {
        setStatus(refs, `Save failed: ${result.reason}`);
      }
      return false;
    }

    setStatus(refs, `Saved ${tab.filePath}`);
    return true;
  }

  async function saveTabAs(tabId: string): Promise<boolean> {
    const tab = state.tabsById.get(tabId);
    if (!tab) {
      return false;
    }

    const result = await mdv.saveTabAs(tabId, tab.currentMarkdown);
    if (!result.ok) {
      if (result.reason && result.reason !== 'cancelled') {
        setStatus(refs, `Save As failed: ${result.reason}`);
      }
      return false;
    }

    setStatus(refs, `Saved ${result.filePath || tab.filePath}`);
    return true;
  }

  async function closeDocumentTab(tabId: string): Promise<void> {
    const tab = state.tabsById.get(tabId);
    if (!tab) {
      return;
    }

    if (tab.isDirty) {
      const choice = (await showChoiceModal(refs, {
        title: `Unsaved changes in ${tab.title}`,
        message: 'Save changes before closing this tab?',
        buttons: [
          { id: 'save', label: 'Save' },
          { id: 'discard', label: 'Discard', kind: 'danger' },
          { id: 'cancel', label: 'Cancel' }
        ]
      })) as ModalChoice;

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

    const result = await mdv.closeTab(tabId);
    if (!result.ok && result.reason) {
      setStatus(refs, result.reason);
    }
  }

  async function ensureReloadAllowed(tab: ClientTab): Promise<boolean> {
    if (!tab.isDirty) {
      return true;
    }

    const choice = (await showChoiceModal(refs, {
      title: 'Unsaved changes',
      message: 'Save changes before reloading from disk?',
      buttons: [
        { id: 'save', label: 'Save' },
        { id: 'discard', label: 'Discard', kind: 'danger' },
        { id: 'cancel', label: 'Cancel' }
      ]
    })) as ModalChoice;

    if (choice === 'cancel') {
      return false;
    }

    if (choice === 'discard') {
      return true;
    }

    return saveTab(tab.tabId);
  }

  async function reloadActiveTabFromDisk(): Promise<void> {
    const activeTab = getActiveTab(state);
    if (!activeTab) {
      return;
    }

    if (!(await ensureReloadAllowed(activeTab))) {
      return;
    }

    const result = await mdv.reloadTabFromDisk(activeTab.tabId);
    if (!result.ok && result.reason) {
      setStatus(refs, `Reload failed: ${result.reason}`);
    }
  }

  async function exportActivePdf(): Promise<void> {
    const activeTab = getActiveTab(state);
    if (!activeTab) {
      return;
    }

    const result = await mdv.exportPdf({ tabId: activeTab.tabId, markdown: activeTab.currentMarkdown });
    if (!result.ok) {
      if (result.reason && result.reason !== 'cancelled') {
        setStatus(refs, `PDF export failed: ${result.reason}`);
      }
      return;
    }

    setStatus(refs, `PDF exported to ${result.filePath}`);
  }

  async function exportActiveDocx(): Promise<void> {
    const activeTab = getActiveTab(state);
    if (!activeTab) {
      return;
    }

    const result = await mdv.exportDocx({ tabId: activeTab.tabId, markdown: activeTab.currentMarkdown });
    if (!result.ok) {
      if (result.reason && result.reason !== 'cancelled') {
        setStatus(refs, `DOCX export failed: ${result.reason}`);
      }
      return;
    }

    setStatus(refs, `DOCX exported to ${result.filePath}`);
    renderMainPane(refs, state);
  }

  async function exportActiveHtml(): Promise<void> {
    const activeTab = getActiveTab(state);
    if (!activeTab) {
      return;
    }

    const result = await mdv.exportHtml({ tabId: activeTab.tabId, markdown: activeTab.currentMarkdown });
    if (!result.ok) {
      if (result.reason && result.reason !== 'cancelled') {
        setStatus(refs, `HTML export failed: ${result.reason}`);
      }
      return;
    }

    setStatus(refs, `HTML export written to ${result.filePath}`);
    renderMainPane(refs, state);
  }

  async function handleExternalChange(tabId: string): Promise<void> {
    const tab = state.tabsById.get(tabId);
    if (!tab || !tab.hasExternalChange) {
      return;
    }

    if (!tab.isDirty) {
      const result = await mdv.reloadTabFromDisk(tabId);
      if (!result.ok && result.reason) {
        setStatus(refs, `Reload failed: ${result.reason}`);
      }
      return;
    }

    const choice = (await showChoiceModal(refs, {
      title: 'File changed on disk',
      message: 'This file changed outside MD Viewer. How should we proceed?',
      buttons: [
        { id: 'keep-mine', label: 'Keep Mine' },
        { id: 'reload-disk', label: 'Reload Disk' },
        { id: 'save-copy', label: 'Save As Copy' }
      ]
    })) as ModalChoice;

    if (choice === 'keep-mine') {
      await mdv.ackDiskChange(tabId);
      renderDocumentTabs(refs, state);
      setStatus(refs, 'Keeping in-editor changes.');
      return;
    }

    if (choice === 'reload-disk') {
      const result = await mdv.reloadTabFromDisk(tabId);
      if (!result.ok && result.reason) {
        setStatus(refs, `Reload failed: ${result.reason}`);
      }
      return;
    }

    await saveTabAs(tabId);
  }

  async function maybeHandleActiveExternalChange(): Promise<void> {
    const activeTab = getActiveTab(state);
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

      const choice = (await showChoiceModal(refs, {
        title: `Unsaved changes in ${tab.title}`,
        message: 'Save changes before quitting?',
        buttons: [
          { id: 'save', label: 'Save' },
          { id: 'discard', label: 'Discard', kind: 'danger' },
          { id: 'cancel', label: 'Cancel' }
        ]
      })) as ModalChoice;

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

    await mdv.quitApp();
  }

  async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
    applySidebarCollapsed(refs, state, collapsed);
    await mdv.toggleSidebarState(collapsed);
  }

  async function persistSidebarWidth(): Promise<void> {
    await mdv.setSidebarWidth(state.sidebarWidth);
  }

  function setupSidebarResize(): void {
    let dragging = false;

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging || state.sidebarCollapsed) {
        return;
      }

      const bounds = refs.workspace.getBoundingClientRect();
      applySidebarWidth(refs, state, event.clientX - bounds.left, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
    };

    const stopDragging = async (): Promise<void> => {
      if (!dragging) {
        return;
      }

      dragging = false;
      refs.sidebarResizer.classList.remove('dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
      await persistSidebarWidth();
    };

    refs.sidebarResizer.addEventListener('pointerdown', (event) => {
      if (state.sidebarCollapsed) {
        return;
      }
      dragging = true;
      refs.sidebarResizer.classList.add('dragging');
      refs.sidebarResizer.setPointerCapture(event.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', stopDragging);
      window.addEventListener('pointercancel', stopDragging);
    });
  }

  function bindDomEvents(): void {
    refs.documentTabs.addEventListener('click', (event) => {
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

    refs.documentTabs.addEventListener('auxclick', (event) => {
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

    refs.openBtn.addEventListener('click', () => void openMarkdownFromDialog());
    refs.openFolderBtn.addEventListener('click', () => void chooseRootFolder());
    refs.reloadBtn.addEventListener('click', () => void reloadActiveTabFromDisk());
    refs.saveBtn.addEventListener('click', () => {
      const activeTab = getActiveTab(state);
      if (activeTab) {
        void saveTab(activeTab.tabId);
      }
    });
    refs.saveAsBtn.addEventListener('click', () => {
      const activeTab = getActiveTab(state);
      if (activeTab) {
        void saveTabAs(activeTab.tabId);
      }
    });
    refs.exportPdfBtn.addEventListener('click', () => void exportActivePdf());
    refs.exportDocxBtn.addEventListener('click', () => void exportActiveDocx());
    refs.exportHtmlBtn.addEventListener('click', () => void exportActiveHtml());
    refs.pinRootBtn.addEventListener('click', async () => {
      if (!state.activeRootPath) {
        return;
      }

      const response = state.pinnedFolders.some((item) => item.path === state.activeRootPath)
        ? await mdv.unpinFolder(state.activeRootPath)
        : await mdv.pinFolder(state.activeRootPath);

      if (!response.ok) {
        setStatus(refs, response.reason || 'Unable to update pinned folders.');
        return;
      }

      state.pinnedFolders = response.pinnedFolders || [];
      renderPinnedFolders(refs, state);
      updateRootUi(refs, state);
    });
    refs.refreshTreeBtn.addEventListener('click', async () => {
      const result = await mdv.refreshFolders();
      if (!result.ok) {
        setStatus(refs, result.reason || 'Unable to refresh folder tree.');
        return;
      }

      state.activeRootPath = result.rootPath || state.activeRootPath;
      state.loadedDirs = new Set(state.activeRootPath ? [state.activeRootPath] : []);
      state.tree = result.tree || [];
      renderTree(refs, state);
      updateRootUi(refs, state);
    });
    refs.pinnedList.addEventListener('click', async (event) => {
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
        const result = await mdv.unpinFolder(folderPath);
        if (!result.ok) {
          setStatus(refs, result.reason || 'Unable to unpin folder.');
          return;
        }

        state.pinnedFolders = result.pinnedFolders || [];
        renderPinnedFolders(refs, state);
        updateRootUi(refs, state);
        return;
      }

      const result = await mdv.setRootFromPin(folderPath);
      if (!result.ok) {
        setStatus(refs, result.reason || 'Unable to set root from pin.');
        return;
      }

      state.activeRootPath = result.rootPath || folderPath;
      state.expandedDirs.add(state.activeRootPath);
      state.loadedDirs = new Set([state.activeRootPath]);
      state.tree = result.tree || [];
      renderTree(refs, state);
      renderPinnedFolders(refs, state);
      updateRootUi(refs, state);
    });
    refs.treeContainer.addEventListener('click', async (event) => {
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
          renderTree(refs, state);
          return;
        }

        state.expandedDirs.add(nodePath);
        renderTree(refs, state);

        if (!state.loadedDirs.has(nodePath)) {
          const loaded = await loadDirectoryChildren(nodePath);
          if (loaded) {
            renderTree(refs, state);
          }
        }
        return;
      }

      await openMarkdownPath(nodePath);
    });

    window.addEventListener('dragover', (event) => {
      event.preventDefault();

      if (state.tabOrder.length === 0) {
        refs.renderHost.classList.add('drag-over');
        return;
      }

      const activeTab = getActiveTab(state);
      if (activeTab?.mode === 'render') {
        const target = event.target as Node | null;
        if (target && refs.renderHost.contains(target)) {
          refs.renderHost.classList.add('drag-over');
        }
      }
    });

    window.addEventListener('dragleave', (event) => {
      event.preventDefault();
      refs.renderHost.classList.remove('drag-over');
    });

    window.addEventListener('drop', (event) => {
      event.preventDefault();
      refs.renderHost.classList.remove('drag-over');

      const droppedPath = firstMarkdownPathFromDropFiles(
        event.dataTransfer ? (event.dataTransfer.files as unknown as ArrayLike<{ path?: string }>) : null
      );
      if (!droppedPath) {
        setStatus(refs, 'Only .md or .markdown files are supported.');
        return;
      }

      if (state.tabOrder.length === 0) {
        void openMarkdownPath(droppedPath);
        return;
      }

      const activeTab = getActiveTab(state);
      if (!activeTab) {
        return;
      }

      const target = event.target as Node | null;
      const inRenderHost = target ? refs.renderHost.contains(target) : false;

      if (activeTab.mode === 'render' && inRenderHost) {
        void openMarkdownPath(droppedPath);
        return;
      }

      setStatus(refs, 'Drop markdown onto the render pane to open/replace while tabs are active.');
    });

    refs.tabRenderBtn.addEventListener('click', () => setActiveMode('render'));
    refs.tabEditBtn.addEventListener('click', () => setActiveMode('edit'));
  }

  function bindBridgeEvents(): void {
    mdv.onTabsStateUpdated((payload) => {
      const previousActive = state.activeTabId;
      applyTabsState(payload);

      if (state.activeTabId && previousActive !== state.activeTabId) {
        void maybeHandleActiveExternalChange();
      }
    });

    mdv.onTabsDiskChanged((payload) => {
      const tab = state.tabsById.get(payload.tabId);
      if (!tab) {
        return;
      }

      tab.hasExternalChange = true;
      renderDocumentTabs(refs, state);

      if (payload.tabId === state.activeTabId) {
        void handleExternalChange(payload.tabId);
      }
    });

    mdv.onTabsOpenRequest((payload) => {
      void openMarkdownPath(payload.filePath);
    });

    const commandHandlers: Record<UiCommand, () => void> = {
      'open-markdown': () => void openMarkdownFromDialog(),
      'reload-document': () => void reloadActiveTabFromDisk(),
      'save-document': () => {
        const activeTab = getActiveTab(state);
        if (activeTab) {
          void saveTab(activeTab.tabId);
        }
      },
      'save-document-as': () => {
        const activeTab = getActiveTab(state);
        if (activeTab) {
          void saveTabAs(activeTab.tabId);
        }
      },
      'close-tab': () => {
        const activeTab = getActiveTab(state);
        if (activeTab) {
          void closeDocumentTab(activeTab.tabId);
        }
      },
      'next-document-tab': () => cycleDocumentTab(1),
      'previous-document-tab': () => cycleDocumentTab(-1),
      'show-edit-tab': () => setActiveMode('edit'),
      'show-render-tab': () => setActiveMode('render'),
      'show-preview-tab': () => setActiveMode('render'),
      'export-pdf': () => void exportActivePdf(),
      'export-docx': () => void exportActiveDocx(),
      'export-html': () => void exportActiveHtml(),
      'request-app-quit': () => void attemptQuitWithPrompts()
    };

    mdv.onUiCommand((command) => {
      commandHandlers[command]?.();
    });

    mdv.onToggleSidebar(() => {
      void setSidebarCollapsed(!state.sidebarCollapsed);
    });
  }

  async function init(): Promise<void> {
    applySidebarWidth(refs, state, 300, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
    setupSidebarResize();
    bindDomEvents();
    bindBridgeEvents();

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
        [tabsState, folderState] = await Promise.all([mdv.getTabsState(), mdv.getFolderState()]);
        lastInitError = null;
        break;
      } catch (error) {
        lastInitError = error;
        await new Promise<void>((resolve) => window.setTimeout(resolve, 75 * attempt));
      }
    }

    state.activeRootPath = folderState.rootPath || null;
    state.pinnedFolders = folderState.pinnedFolders || [];
    applySidebarCollapsed(refs, state, Boolean(folderState.sidebarCollapsed));
    applySidebarWidth(refs, state, folderState.sidebarWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);

    renderPinnedFolders(refs, state);
    updateRootUi(refs, state);

    if (state.activeRootPath) {
      state.expandedDirs.add(state.activeRootPath);
      await refreshTree(state.activeRootPath);
    } else {
      renderTree(refs, state);
    }

    applyTabsState(tabsState);
    setActiveMode('render');

    if (lastInitError) {
      setStatus(refs, 'Initial load was delayed. Use Open Folder or Open Markdown if needed.');
    }
  }

  return { init };
}
