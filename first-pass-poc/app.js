const openBtn = document.getElementById('openBtn');
const openFolderBtn = document.getElementById('openFolderBtn');
const reloadBtn = document.getElementById('reloadBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportDocxBtn = document.getElementById('exportDocxBtn');
const exportHtmlBtn = document.getElementById('exportHtmlBtn');
const pinRootBtn = document.getElementById('pinRootBtn');
const refreshTreeBtn = document.getElementById('refreshTreeBtn');

const statusText = document.getElementById('statusText');
const previewHost = document.getElementById('previewHost');
const warningsHost = document.getElementById('warnings');
const replaceDropZone = document.getElementById('replaceDropZone');
const workspace = document.getElementById('workspace');
const sidebar = document.getElementById('sidebar');
const sidebarResizer = document.getElementById('sidebarResizer');
const pinnedList = document.getElementById('pinnedList');
const pinnedEmpty = document.getElementById('pinnedEmpty');
const rootPath = document.getElementById('rootPath');
const treeContainer = document.getElementById('treeContainer');

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 640;

const state = {
  hasDocument: false,
  sidebarCollapsed: false,
  sidebarWidth: 280,
  activeRootPath: null,
  pinnedFolders: [],
  tree: [],
  expandedDirs: new Set()
};

function isMarkdownPath(filePath) {
  return /\.(md|markdown)$/i.test((filePath || '').trim());
}

function firstMarkdownPathFromDropFiles(files) {
  if (!files || files.length === 0) {
    return null;
  }

  for (let i = 0; i < files.length; i += 1) {
    const candidate = files[i] && typeof files[i].path === 'string' ? files[i].path.trim() : '';
    if (!candidate) {
      continue;
    }
    if (isMarkdownPath(candidate)) {
      return candidate;
    }
  }

  return null;
}

function clampSidebarWidth(width) {
  if (!Number.isFinite(width)) {
    return 280;
  }
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function applySidebarWidth(width) {
  const normalized = clampSidebarWidth(width);
  state.sidebarWidth = normalized;
  document.documentElement.style.setProperty('--sidebar-width', `${normalized}px`);
}

function setStatus(text) {
  statusText.textContent = text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderWarnings(warnings) {
  if (!warnings || warnings.length === 0) {
    warningsHost.classList.add('hidden');
    warningsHost.innerHTML = '';
    return;
  }

  warningsHost.innerHTML = `<ul>${warnings
    .map((warning) => `<li><strong>${escapeHtml(warning.code)}</strong> - ${escapeHtml(warning.message)}</li>`)
    .join('')}</ul>`;
  warningsHost.classList.remove('hidden');
}

function setDocumentLoaded(loaded) {
  state.hasDocument = loaded;
  replaceDropZone.classList.toggle('hidden', !loaded);
}

function renderDocument(payload) {
  setStatus(payload.filePath);
  previewHost.innerHTML = `<div class="preview-content">${payload.html}</div>`;
  renderWarnings(payload.warnings || []);
  setDocumentLoaded(true);
}

function isRootPinned() {
  if (!state.activeRootPath) {
    return false;
  }
  return state.pinnedFolders.some((item) => item.path === state.activeRootPath);
}

function updateRootUi() {
  rootPath.textContent = state.activeRootPath || 'No root selected.';
  pinRootBtn.textContent = isRootPinned() ? 'Unpin Root' : 'Pin Root';
  pinRootBtn.disabled = !state.activeRootPath;
}

function renderPinnedFolders() {
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

function renderTreeNodes(nodes) {
  if (!nodes || nodes.length === 0) {
    return '<p class="muted">No markdown files in this root.</p>';
  }

  const html = nodes
    .map((node) => {
      if (node.type === 'dir') {
        const expanded = state.expandedDirs.has(node.path);
        const children = expanded ? renderTreeNodes(node.children || []) : '';
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

function renderTree() {
  treeContainer.innerHTML = renderTreeNodes(state.tree);
}

async function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  workspace.classList.toggle('collapsed', collapsed);
  sidebar.classList.toggle('collapsed', collapsed);
  await window.mdv.toggleSidebarState(collapsed);
}

async function persistSidebarWidth() {
  await window.mdv.setSidebarWidth(state.sidebarWidth);
}

async function refreshTree(rootOverride, providedTree) {
  const requestedRoot = rootOverride || state.activeRootPath;
  if (!requestedRoot) {
    state.tree = [];
    renderTree();
    return;
  }

  if (providedTree) {
    state.tree = providedTree;
    renderTree();
    updateRootUi();
    return;
  }

  const result = await window.mdv.listFolderTree(requestedRoot);
  if (!result.ok) {
    setStatus(result.reason || 'Unable to load folder tree.');
    return;
  }

  state.activeRootPath = result.rootPath || requestedRoot;
  state.tree = result.tree || [];
  renderTree();
  updateRootUi();
}

async function refreshPins() {
  state.pinnedFolders = await window.mdv.getPinnedFolders();
  renderPinnedFolders();
  updateRootUi();
}

async function chooseRootFolder() {
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
  await refreshTree(state.activeRootPath, result.tree || []);
  await refreshPins();
}

function setupSidebarResize() {
  let dragging = false;

  function onPointerMove(event) {
    if (!dragging || state.sidebarCollapsed) {
      return;
    }

    const bounds = workspace.getBoundingClientRect();
    const nextWidth = event.clientX - bounds.left;
    applySidebarWidth(nextWidth);
  }

  async function stopDragging() {
    if (!dragging) {
      return;
    }

    dragging = false;
    sidebarResizer.classList.remove('dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
    window.removeEventListener('pointercancel', stopDragging);
    await persistSidebarWidth();
  }

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

openBtn.addEventListener('click', async () => {
  const result = await window.mdv.openDialog();
  if (!result.ok && result.reason && result.reason !== 'cancelled') {
    setStatus(result.reason);
  }
});

openFolderBtn.addEventListener('click', async () => {
  await chooseRootFolder();
});

reloadBtn.addEventListener('click', async () => {
  const result = await window.mdv.reload();
  if (!result.ok && result.reason) {
    setStatus(result.reason);
  }
});

exportPdfBtn.addEventListener('click', async () => {
  const result = await window.mdv.exportPdf();
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`PDF export failed: ${result.reason}`);
    }
    return;
  }

  setStatus(`PDF exported to ${result.filePath}`);
});

exportDocxBtn.addEventListener('click', async () => {
  const result = await window.mdv.exportDocx();
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`DOCX export failed: ${result.reason}`);
    }
    return;
  }

  setStatus(`DOCX exported to ${result.filePath}`);
  renderWarnings(result.warnings || []);
});

exportHtmlBtn.addEventListener('click', async () => {
  const result = await window.mdv.exportHtml();
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`HTML export failed: ${result.reason}`);
    }
    return;
  }

  setStatus(`HTML export written to ${result.filePath}`);
  renderWarnings(result.warnings || []);
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
  state.tree = result.tree || [];
  renderTree();
  updateRootUi();
});

pinnedList.addEventListener('click', async (event) => {
  const target = event.target.closest('button[data-action]');
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
  state.tree = result.tree || [];
  renderTree();
  renderPinnedFolders();
  updateRootUi();
});

treeContainer.addEventListener('click', async (event) => {
  const target = event.target.closest('button[data-node-type]');
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
    } else {
      state.expandedDirs.add(nodePath);
    }

    renderTree();
    return;
  }

  const openResult = await window.mdv.openPath(nodePath);
  if (!openResult.ok && openResult.reason) {
    setStatus(openResult.reason);
  }
});

window.mdv.onDocumentUpdated((payload) => {
  renderDocument(payload);
});

window.mdv.onToggleSidebar(() => {
  void setSidebarCollapsed(!state.sidebarCollapsed);
});

replaceDropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  replaceDropZone.classList.add('drag-over');
});

replaceDropZone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  replaceDropZone.classList.remove('drag-over');
});

replaceDropZone.addEventListener('drop', async (event) => {
  event.preventDefault();
  replaceDropZone.classList.remove('drag-over');

  const droppedPath = firstMarkdownPathFromDropFiles(event.dataTransfer ? event.dataTransfer.files : null);
  if (!droppedPath) {
    setStatus('Only .md or .markdown files can replace the current document.');
    return;
  }

  const result = await window.mdv.openPath(droppedPath);
  if (!result.ok && result.reason) {
    setStatus(result.reason);
  }
});

window.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (!state.hasDocument) {
    previewHost.classList.add('drag-over');
  }
});

window.addEventListener('dragleave', (event) => {
  event.preventDefault();
  if (!state.hasDocument) {
    previewHost.classList.remove('drag-over');
  }
});

window.addEventListener('drop', async (event) => {
  event.preventDefault();

  if (state.hasDocument) {
    const inReplaceZone = replaceDropZone.contains(event.target);
    if (!inReplaceZone) {
      setStatus('Drop markdown onto the top replace bar to switch documents.');
    }
    return;
  }

  previewHost.classList.remove('drag-over');

  const droppedPath = firstMarkdownPathFromDropFiles(event.dataTransfer ? event.dataTransfer.files : null);
  if (!droppedPath) {
    setStatus('Only .md or .markdown files are supported.');
    return;
  }

  const result = await window.mdv.openPath(droppedPath);
  if (!result.ok && result.reason) {
    setStatus(result.reason);
  }
});

(async function init() {
  applySidebarWidth(280);
  setupSidebarResize();

  const [initialDocument, folderState] = await Promise.all([window.mdv.getState(), window.mdv.getFolderState()]);

  state.activeRootPath = folderState.rootPath || null;
  state.pinnedFolders = folderState.pinnedFolders || [];
  state.sidebarCollapsed = Boolean(folderState.sidebarCollapsed);
  applySidebarWidth(folderState.sidebarWidth);
  workspace.classList.toggle('collapsed', state.sidebarCollapsed);
  sidebar.classList.toggle('collapsed', state.sidebarCollapsed);

  if (state.activeRootPath) {
    state.expandedDirs.add(state.activeRootPath);
    await refreshTree(state.activeRootPath);
  } else {
    renderTree();
  }

  renderPinnedFolders();
  updateRootUi();

  if (initialDocument) {
    renderDocument(initialDocument);
  }
})();
