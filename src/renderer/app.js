/* global mdv */

const openBtn = document.getElementById('openBtn');
const reloadBtn = document.getElementById('reloadBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportDocxBtn = document.getElementById('exportDocxBtn');
const exportHtmlBtn = document.getElementById('exportHtmlBtn');
const statusText = document.getElementById('statusText');
const previewHost = document.getElementById('previewHost');
const warningsHost = document.getElementById('warnings');

function setStatus(text) {
  statusText.textContent = text;
}

function renderWarnings(warnings) {
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

function renderDocument(payload) {
  setStatus(payload.filePath);
  previewHost.innerHTML = `<div class="preview-content">${payload.html}</div>`;
  renderWarnings(payload.warnings || []);
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

openBtn.addEventListener('click', async () => {
  const result = await mdv.openDialog();
  if (!result.ok && result.reason && result.reason !== 'cancelled') {
    setStatus(result.reason);
  }
});

reloadBtn.addEventListener('click', async () => {
  const result = await mdv.reload();
  if (!result.ok && result.reason) {
    setStatus(result.reason);
  }
});

exportPdfBtn.addEventListener('click', async () => {
  const result = await mdv.exportPdf();
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`PDF export failed: ${result.reason}`);
    }
    return;
  }

  setStatus(`PDF exported to ${result.filePath}`);
});

exportDocxBtn.addEventListener('click', async () => {
  const result = await mdv.exportDocx();
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
  const result = await mdv.exportHtml();
  if (!result.ok) {
    if (result.reason && result.reason !== 'cancelled') {
      setStatus(`HTML export failed: ${result.reason}`);
    }
    return;
  }

  setStatus(`HTML export written to ${result.filePath}`);
  renderWarnings(result.warnings || []);
});

mdv.onDocumentUpdated((payload) => {
  renderDocument(payload);
});

window.addEventListener('dragover', (event) => {
  event.preventDefault();
  previewHost.classList.add('drag-over');
});

window.addEventListener('dragleave', (event) => {
  event.preventDefault();
  previewHost.classList.remove('drag-over');
});

window.addEventListener('drop', async (event) => {
  event.preventDefault();
  previewHost.classList.remove('drag-over');

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    return;
  }

  const firstPath = files[0].path;
  if (!firstPath) {
    return;
  }

  const result = await mdv.openPath(firstPath);
  if (!result.ok && result.reason) {
    setStatus(result.reason);
  }
});

(async function init() {
  const initial = await mdv.getState();
  if (initial) {
    renderDocument(initial);
  }
})();
