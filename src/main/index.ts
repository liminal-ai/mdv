import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { app, BrowserWindow, dialog, ipcMain } from 'electron';

import { parseInternalCliArgs } from '../core/cliArgs';
import { exportDocxFromHtml } from '../core/export/docx';
import { exportHtmlFolder } from '../core/export/html';
import { exportPdfFromHtml } from '../core/export/pdf';
import { readMarkdownFile, renderMarkdown } from '../core/render/markdown';
import { RenderResult } from '../core/types';
import { baseHrefFromDir, preloadPath, rendererHtmlPath } from './paths';
import { ElectronMermaidRenderer } from './mermaidRenderer';

interface DocumentUpdatePayload {
  filePath: string;
  html: string;
  warnings: Array<{ code: string; message: string; location?: string }>;
}

interface OpenResult {
  ok: boolean;
  reason?: string;
}

const state: {
  mainWindow: BrowserWindow | null;
  currentFilePath: string | null;
  currentRender: RenderResult | null;
  fileWatcher: fs.FSWatcher | null;
  watcherTimer: NodeJS.Timeout | null;
} = {
  mainWindow: null,
  currentFilePath: null,
  currentRender: null,
  fileWatcher: null,
  watcherTimer: null
};

const mermaidRenderer = new ElectronMermaidRenderer();
const pendingOpenFiles: string[] = [];

app.on('open-file', (event, openPath) => {
  event.preventDefault();
  pendingOpenFiles.push(openPath);
  if (app.isReady()) {
    void openDocument(openPath);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopWatchingCurrentFile();
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

  createMainWindow();
  setupIpcHandlers();

  const launchTarget = pendingOpenFiles.at(-1) ?? findLaunchMarkdownArg(process.argv.slice(1));
  if (launchTarget) {
    await openDocument(launchTarget);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      setupIpcHandlers();
    }
  });
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
    if (/\.md$/i.test(resolved) || /\.markdown$/i.test(resolved)) {
      return resolved;
    }
  }
  return null;
}

function createMainWindow(): void {
  state.mainWindow = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 900,
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

function setupIpcHandlers(): void {
  ipcMain.removeHandler('document:open-dialog');
  ipcMain.removeHandler('document:open-path');
  ipcMain.removeHandler('document:reload');
  ipcMain.removeHandler('document:get-state');
  ipcMain.removeHandler('export:pdf');
  ipcMain.removeHandler('export:docx');
  ipcMain.removeHandler('export:html');

  ipcMain.handle('document:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, reason: 'cancelled' } as OpenResult;
    }

    const selectedPath = result.filePaths[0];
    if (!selectedPath) {
      return { ok: false, reason: 'cancelled' } as OpenResult;
    }

    return openDocument(selectedPath);
  });

  ipcMain.handle('document:open-path', async (_event, rawPath: string) => {
    return openDocument(rawPath);
  });

  ipcMain.handle('document:reload', async () => {
    if (!state.currentFilePath) {
      return { ok: false, reason: 'No file loaded.' } as OpenResult;
    }
    return openDocument(state.currentFilePath);
  });

  ipcMain.handle('document:get-state', async () => {
    if (!state.currentFilePath || !state.currentRender) {
      return null;
    }

    return {
      filePath: state.currentFilePath,
      html: state.currentRender.html,
      warnings: state.currentRender.warnings
    } as DocumentUpdatePayload;
  });

  ipcMain.handle('export:pdf', async () => {
    if (!state.currentRender || !state.currentFilePath) {
      return { ok: false, reason: 'No document is loaded.' };
    }

    const defaultName = `${path.parse(state.currentFilePath).name}.pdf`;
    const selection = await dialog.showSaveDialog({
      title: 'Export PDF',
      defaultPath: path.join(state.currentRender.baseDir, defaultName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (selection.canceled || !selection.filePath) {
      return { ok: false, reason: 'cancelled' };
    }

    await exportPdfFromHtml(
      path.parse(state.currentFilePath).name,
      state.currentRender.html,
      selection.filePath,
      baseHrefFromDir(state.currentRender.baseDir),
      {
        pageSize: 'Letter',
        printBackground: true
      }
    );

    return { ok: true, filePath: selection.filePath };
  });

  ipcMain.handle('export:html', async () => {
    if (!state.currentRender || !state.currentFilePath) {
      return { ok: false, reason: 'No document is loaded.' };
    }

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

    const outputDir = path.join(selectedDir, `${path.parse(state.currentFilePath).name}-export`);

    const result = await exportHtmlFolder(
      outputDir,
      path.parse(state.currentFilePath).name,
      state.currentRender.exportHtml,
      state.currentRender.baseDir,
      state.currentRender.diagrams,
      state.currentRender.warnings
    );

    return {
      ok: true,
      filePath: result.outputFile,
      warnings: result.warnings
    };
  });

  ipcMain.handle('export:docx', async () => {
    if (!state.currentRender || !state.currentFilePath) {
      return { ok: false, reason: 'No document is loaded.' };
    }

    const defaultName = `${path.parse(state.currentFilePath).name}.docx`;
    const selection = await dialog.showSaveDialog({
      title: 'Export DOCX',
      defaultPath: path.join(state.currentRender.baseDir, defaultName),
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    });

    if (selection.canceled || !selection.filePath) {
      return { ok: false, reason: 'cancelled' };
    }

    const result = await exportDocxFromHtml(
      path.parse(state.currentFilePath).name,
      state.currentRender.exportHtml,
      selection.filePath,
      state.currentRender.baseDir,
      state.currentRender.diagrams,
      state.currentRender.warnings,
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
  });
}

async function openDocument(rawPath: string): Promise<OpenResult> {
  const resolvedPath = path.resolve(rawPath);

  try {
    await fsp.access(resolvedPath, fs.constants.R_OK);
  } catch {
    return { ok: false, reason: `Cannot read file: ${resolvedPath}` };
  }

  if (!/\.(md|markdown)$/i.test(resolvedPath)) {
    return { ok: false, reason: 'Only .md or .markdown files are supported.' };
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

    state.currentFilePath = resolvedPath;
    state.currentRender = rendered;

    sendDocumentUpdate({
      filePath: resolvedPath,
      html: rendered.html,
      warnings: rendered.warnings
    });

    watchCurrentFile(resolvedPath);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: String(error)
    };
  }
}

function watchCurrentFile(filePath: string): void {
  stopWatchingCurrentFile();

  state.fileWatcher = fs.watch(filePath, () => {
    if (state.watcherTimer) {
      clearTimeout(state.watcherTimer);
    }
    state.watcherTimer = setTimeout(() => {
      void openDocument(filePath);
    }, 180);
  });
}

function stopWatchingCurrentFile(): void {
  if (state.fileWatcher) {
    state.fileWatcher.close();
    state.fileWatcher = null;
  }

  if (state.watcherTimer) {
    clearTimeout(state.watcherTimer);
    state.watcherTimer = null;
  }
}

function sendDocumentUpdate(payload: DocumentUpdatePayload): void {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    return;
  }

  state.mainWindow.webContents.send('document:updated', payload);
}
