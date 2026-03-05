"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
const drop_1 = require("../core/drop");
const cliArgs_1 = require("../core/cliArgs");
const docx_1 = require("../core/export/docx");
const html_1 = require("../core/export/html");
const pdf_1 = require("../core/export/pdf");
const markdown_1 = require("../core/render/markdown");
const folders_1 = require("./folders");
const menu_1 = require("./menu");
const mermaidRenderer_1 = require("./mermaidRenderer");
const paths_1 = require("./paths");
const preferences_1 = require("./preferences");
const state = {
    mainWindow: null,
    currentFilePath: null,
    currentMarkdown: '',
    currentRender: null,
    currentRootFolder: null,
    fileWatcher: null,
    watcherTimer: null,
    ignoreWatcherEventsUntil: 0
};
const mermaidRenderer = new mermaidRenderer_1.ElectronMermaidRenderer();
const pendingOpenFiles = [];
let preferencesStore = null;
electron_1.app.on('open-file', (event, openPath) => {
    event.preventDefault();
    if (electron_1.app.isReady()) {
        requestOpenDocument(openPath);
        return;
    }
    pendingOpenFiles.push(openPath);
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    stopWatchingCurrentFile();
});
electron_1.app.whenReady().then(async () => {
    const internalCli = (0, cliArgs_1.parseInternalCliArgs)(process.argv.slice(2));
    if (!internalCli.ok) {
        console.error(internalCli.error);
        electron_1.app.exit(2);
        return;
    }
    if (internalCli.value?.cliExport) {
        const code = await runCliExport(internalCli.value);
        await mermaidRenderer.dispose();
        electron_1.app.exit(code);
        return;
    }
    preferencesStore = new preferences_1.PreferencesStore(electron_1.app.getPath('userData'));
    const prefs = await preferencesStore.load();
    if (prefs.lastRootFolder) {
        try {
            const st = await promises_1.default.stat(prefs.lastRootFolder);
            if (st.isDirectory()) {
                state.currentRootFolder = prefs.lastRootFolder;
            }
        }
        catch {
            state.currentRootFolder = null;
        }
    }
    if (!state.currentRootFolder) {
        const homeDir = node_os_1.default.homedir();
        try {
            const st = await promises_1.default.stat(homeDir);
            if (st.isDirectory()) {
                state.currentRootFolder = homeDir;
            }
        }
        catch {
            state.currentRootFolder = null;
        }
    }
    if (state.currentRootFolder && preferencesStore.get().lastRootFolder !== state.currentRootFolder) {
        await preferencesStore.setLastRootFolder(state.currentRootFolder);
    }
    setupIpcHandlers();
    createMainWindow();
    electron_1.Menu.setApplicationMenu((0, menu_1.buildApplicationMenu)({
        openMarkdown: () => {
            if (!sendUiCommand('open-markdown')) {
                void openMarkdownDialog();
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
        exportPdf: () => {
            void exportCurrentPdfDialog();
        },
        exportDocx: () => {
            void exportCurrentDocxDialog();
        },
        exportHtml: () => {
            void exportCurrentHtmlDialog();
        },
        toggleSidebar: () => {
            sendSidebarToggle();
        },
        showEditTab: () => {
            sendUiCommand('show-edit-tab');
        },
        showPreviewTab: () => {
            sendUiCommand('show-preview-tab');
        },
        getWindow: () => state.mainWindow
    }));
    const launchTarget = pendingOpenFiles.at(-1) ?? findLaunchMarkdownArg(process.argv.slice(1));
    if (launchTarget) {
        await revealAndOpenDocument(launchTarget);
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            setupIpcHandlers();
            createMainWindow();
        }
        else {
            revealMainWindow();
        }
    });
});
const hasSingleInstanceLock = electron_1.app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
    electron_1.app.quit();
}
electron_1.app.on('second-instance', (_event, argv) => {
    const launchTarget = findLaunchMarkdownArg(argv.slice(1));
    if (launchTarget) {
        requestOpenDocument(launchTarget);
        return;
    }
    revealMainWindow();
});
async function runCliExport(args) {
    try {
        const inputPath = node_path_1.default.resolve(args.input);
        const markdown = await (0, markdown_1.readMarkdownFile)(inputPath);
        const renderResult = await (0, markdown_1.renderMarkdown)({
            inputPath,
            markdown,
            baseDir: node_path_1.default.dirname(inputPath),
            offline: true
        }, mermaidRenderer);
        const stem = node_path_1.default.parse(inputPath).name;
        if (args.format === 'pdf' || args.format === 'all') {
            const pdfOutput = resolvePdfPath(args.output, stem, args.format === 'pdf');
            await (0, pdf_1.exportPdfFromHtml)(stem, renderResult.html, pdfOutput, (0, paths_1.baseHrefFromDir)(renderResult.baseDir), {
                pageSize: 'Letter',
                printBackground: true
            });
            console.log(`PDF exported: ${pdfOutput}`);
        }
        if (args.format === 'docx' || args.format === 'all') {
            const docxOutput = resolveDocxPath(args.output, stem, args.format === 'docx');
            const docxResult = await (0, docx_1.exportDocxFromHtml)(stem, renderResult.exportHtml, docxOutput, renderResult.baseDir, renderResult.diagrams, renderResult.warnings, {
                pageSize: 'Letter',
                marginsInches: {
                    top: 1,
                    right: 1,
                    bottom: 1,
                    left: 1
                }
            });
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
            const htmlResult = await (0, html_1.exportHtmlFolder)(htmlDir, stem, renderResult.exportHtml, renderResult.baseDir, renderResult.diagrams, renderResult.warnings);
            console.log(`HTML exported: ${htmlResult.outputFile}`);
            if (htmlResult.warnings.length > 0) {
                console.warn('Warnings:');
                for (const warning of htmlResult.warnings) {
                    console.warn(`- [${warning.code}] ${warning.message}`);
                }
            }
        }
        return 0;
    }
    catch (error) {
        console.error(`Export failed: ${String(error)}`);
        return 3;
    }
}
function resolvePdfPath(output, stem, strictFile) {
    const resolved = node_path_1.default.resolve(output);
    if (strictFile && resolved.toLowerCase().endsWith('.pdf')) {
        return resolved;
    }
    if (resolved.toLowerCase().endsWith('.pdf')) {
        return resolved;
    }
    return node_path_1.default.join(resolved, `${stem}.pdf`);
}
function resolveHtmlDir(output, stem, strictDir) {
    const resolved = node_path_1.default.resolve(output);
    if (strictDir) {
        return resolved;
    }
    if (node_path_1.default.extname(resolved)) {
        return resolved;
    }
    return node_path_1.default.join(resolved, `${stem}-export`);
}
function resolveDocxPath(output, stem, strictFile) {
    const resolved = node_path_1.default.resolve(output);
    if (strictFile && resolved.toLowerCase().endsWith('.docx')) {
        return resolved;
    }
    if (resolved.toLowerCase().endsWith('.docx')) {
        return resolved;
    }
    return node_path_1.default.join(resolved, `${stem}.docx`);
}
function findLaunchMarkdownArg(argv) {
    for (const arg of argv) {
        if (arg.startsWith('-')) {
            continue;
        }
        const resolved = node_path_1.default.resolve(arg);
        if ((0, drop_1.isMarkdownPath)(resolved)) {
            return resolved;
        }
    }
    return null;
}
function createMainWindow() {
    state.mainWindow = new electron_1.BrowserWindow({
        width: 1420,
        height: 960,
        minWidth: 980,
        minHeight: 620,
        title: 'MD Viewer',
        webPreferences: {
            preload: (0, paths_1.preloadPath)(),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });
    state.mainWindow.on('closed', () => {
        state.mainWindow = null;
    });
    void state.mainWindow.loadFile((0, paths_1.rendererHtmlPath)());
}
function revealMainWindow() {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
        return;
    }
    if (state.mainWindow.isMinimized()) {
        state.mainWindow.restore();
    }
    state.mainWindow.show();
    state.mainWindow.focus();
    electron_1.app.focus({ steal: true });
}
async function ensureMainWindow() {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
        createMainWindow();
    }
    const window = state.mainWindow;
    if (!window) {
        throw new Error('Unable to create main window.');
    }
    if (window.webContents.isLoadingMainFrame()) {
        await new Promise((resolve) => {
            window.webContents.once('did-finish-load', () => resolve());
        });
    }
    return window;
}
async function revealAndOpenDocument(rawPath) {
    try {
        await ensureMainWindow();
        revealMainWindow();
        await openDocument(rawPath);
    }
    catch (error) {
        console.error(`Failed to open document from OS event: ${String(error)}`);
    }
}
function requestOpenDocument(rawPath) {
    const resolvedPath = node_path_1.default.resolve(rawPath);
    if (!(0, drop_1.isMarkdownPath)(resolvedPath)) {
        return;
    }
    if (state.mainWindow && !state.mainWindow.isDestroyed() && !state.mainWindow.webContents.isLoadingMainFrame()) {
        state.mainWindow.webContents.send('document:open-request', { filePath: resolvedPath });
        revealMainWindow();
        return;
    }
    void revealAndOpenDocument(resolvedPath);
}
function sendUiCommand(command) {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
        return false;
    }
    state.mainWindow.webContents.send('ui:command', { command });
    return true;
}
function setupIpcHandlers() {
    electron_1.ipcMain.removeHandler('document:open-dialog');
    electron_1.ipcMain.removeHandler('document:open-path');
    electron_1.ipcMain.removeHandler('document:reload');
    electron_1.ipcMain.removeHandler('document:save');
    electron_1.ipcMain.removeHandler('document:save-as');
    electron_1.ipcMain.removeHandler('document:render');
    electron_1.ipcMain.removeHandler('document:disk-read');
    electron_1.ipcMain.removeHandler('document:get-state');
    electron_1.ipcMain.removeHandler('export:pdf');
    electron_1.ipcMain.removeHandler('export:docx');
    electron_1.ipcMain.removeHandler('export:html');
    electron_1.ipcMain.removeHandler('folders:get-state');
    electron_1.ipcMain.removeHandler('folders:choose-root');
    electron_1.ipcMain.removeHandler('folders:list-tree');
    electron_1.ipcMain.removeHandler('folders:get-pins');
    electron_1.ipcMain.removeHandler('folders:pin');
    electron_1.ipcMain.removeHandler('folders:unpin');
    electron_1.ipcMain.removeHandler('folders:set-root-from-pin');
    electron_1.ipcMain.removeHandler('folders:refresh');
    electron_1.ipcMain.removeHandler('ui:toggle-sidebar-state');
    electron_1.ipcMain.removeHandler('ui:set-sidebar-width');
    electron_1.ipcMain.handle('document:open-dialog', async () => openMarkdownDialog());
    electron_1.ipcMain.handle('document:open-path', async (_event, rawPath) => openDocument(rawPath));
    electron_1.ipcMain.handle('document:reload', async () => {
        if (!state.currentFilePath) {
            return { ok: false, reason: 'No file loaded.' };
        }
        return openDocument(state.currentFilePath);
    });
    electron_1.ipcMain.handle('document:save', async (_event, markdown) => {
        return saveCurrentDocument(markdown);
    });
    electron_1.ipcMain.handle('document:save-as', async (_event, markdown) => {
        return saveCurrentDocumentAs(markdown);
    });
    electron_1.ipcMain.handle('document:render', async (_event, markdown) => {
        try {
            const preview = await renderPreview(markdown);
            return { ok: true, preview };
        }
        catch (error) {
            return { ok: false, reason: String(error) };
        }
    });
    electron_1.ipcMain.handle('document:disk-read', async () => {
        if (!state.currentFilePath) {
            return { ok: false, reason: 'No file loaded.' };
        }
        try {
            const markdown = await (0, markdown_1.readMarkdownFile)(state.currentFilePath);
            return { ok: true, markdown };
        }
        catch (error) {
            return { ok: false, reason: String(error) };
        }
    });
    electron_1.ipcMain.handle('document:get-state', async () => {
        if (!state.currentFilePath || !state.currentRender) {
            return null;
        }
        return {
            filePath: state.currentFilePath,
            markdown: state.currentMarkdown,
            html: state.currentRender.html,
            warnings: state.currentRender.warnings
        };
    });
    electron_1.ipcMain.handle('export:pdf', async () => exportCurrentPdfDialog());
    electron_1.ipcMain.handle('export:docx', async () => exportCurrentDocxDialog());
    electron_1.ipcMain.handle('export:html', async () => exportCurrentHtmlDialog());
    electron_1.ipcMain.handle('folders:get-state', async () => {
        return {
            rootPath: state.currentRootFolder,
            pinnedFolders: preferencesStore?.getPinnedFolders() ?? [],
            sidebarCollapsed: preferencesStore?.get().sidebarCollapsed ?? false,
            sidebarWidth: preferencesStore?.get().sidebarWidth ?? 280
        };
    });
    electron_1.ipcMain.handle('folders:choose-root', async () => {
        return chooseRootFolderViaDialog();
    });
    electron_1.ipcMain.handle('folders:list-tree', async (_event, requestedRoot) => {
        const rootPath = requestedRoot ? node_path_1.default.resolve(requestedRoot) : state.currentRootFolder;
        if (!rootPath) {
            return { ok: false, reason: 'No root folder selected.', tree: [] };
        }
        const tree = await (0, folders_1.listMarkdownChildren)(rootPath);
        return { ok: true, rootPath, tree };
    });
    electron_1.ipcMain.handle('folders:get-pins', async () => {
        return preferencesStore?.getPinnedFolders() ?? [];
    });
    electron_1.ipcMain.handle('folders:pin', async (_event, folderPath) => {
        if (!preferencesStore) {
            return { ok: false, reason: 'Preferences unavailable.' };
        }
        const candidate = folderPath ? node_path_1.default.resolve(folderPath) : state.currentRootFolder;
        if (!candidate) {
            return { ok: false, reason: 'No folder provided.' };
        }
        try {
            const st = await promises_1.default.stat(candidate);
            if (!st.isDirectory()) {
                return { ok: false, reason: 'Selected path is not a directory.' };
            }
        }
        catch {
            return { ok: false, reason: 'Folder is not accessible.' };
        }
        const pinnedFolders = await preferencesStore.pinFolder(candidate);
        return { ok: true, pinnedFolders };
    });
    electron_1.ipcMain.handle('folders:unpin', async (_event, folderPath) => {
        if (!preferencesStore) {
            return { ok: false, reason: 'Preferences unavailable.' };
        }
        const pinnedFolders = await preferencesStore.unpinFolder(folderPath);
        return { ok: true, pinnedFolders };
    });
    electron_1.ipcMain.handle('folders:set-root-from-pin', async (_event, folderPath) => {
        const normalized = node_path_1.default.resolve(folderPath);
        try {
            const st = await promises_1.default.stat(normalized);
            if (!st.isDirectory()) {
                return { ok: false, reason: 'Pinned path is not a directory.' };
            }
        }
        catch {
            return { ok: false, reason: 'Pinned folder is not accessible.' };
        }
        state.currentRootFolder = normalized;
        if (preferencesStore) {
            await preferencesStore.setLastRootFolder(normalized);
        }
        const tree = await (0, folders_1.listMarkdownChildren)(normalized);
        return { ok: true, rootPath: normalized, tree };
    });
    electron_1.ipcMain.handle('folders:refresh', async () => {
        if (!state.currentRootFolder) {
            return { ok: false, reason: 'No root folder selected.', tree: [] };
        }
        const tree = await (0, folders_1.listMarkdownChildren)(state.currentRootFolder);
        return { ok: true, rootPath: state.currentRootFolder, tree };
    });
    electron_1.ipcMain.handle('ui:toggle-sidebar-state', async (_event, collapsed) => {
        if (preferencesStore) {
            await preferencesStore.setSidebarCollapsed(collapsed);
        }
        return { ok: true };
    });
    electron_1.ipcMain.handle('ui:set-sidebar-width', async (_event, width) => {
        if (preferencesStore && Number.isFinite(width)) {
            await preferencesStore.setSidebarWidth(width);
        }
        return { ok: true };
    });
}
async function openMarkdownDialog() {
    const result = await electron_1.dialog.showOpenDialog({
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
    return openDocument(selectedPath);
}
async function chooseRootFolderViaDialog() {
    const result = await electron_1.dialog.showOpenDialog({
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
    const tree = await (0, folders_1.listMarkdownChildren)(rootPath);
    return {
        ok: true,
        rootPath,
        tree
    };
}
async function exportCurrentPdfDialog() {
    if (!state.currentRender || !state.currentFilePath) {
        return { ok: false, reason: 'No document is loaded.' };
    }
    const defaultName = `${node_path_1.default.parse(state.currentFilePath).name}.pdf`;
    const selection = await electron_1.dialog.showSaveDialog({
        title: 'Export PDF',
        defaultPath: node_path_1.default.join(state.currentRender.baseDir, defaultName),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (selection.canceled || !selection.filePath) {
        return { ok: false, reason: 'cancelled' };
    }
    await (0, pdf_1.exportPdfFromHtml)(node_path_1.default.parse(state.currentFilePath).name, state.currentRender.html, selection.filePath, (0, paths_1.baseHrefFromDir)(state.currentRender.baseDir), {
        pageSize: 'Letter',
        printBackground: true
    });
    return { ok: true, filePath: selection.filePath };
}
async function exportCurrentDocxDialog() {
    if (!state.currentRender || !state.currentFilePath) {
        return { ok: false, reason: 'No document is loaded.' };
    }
    const defaultName = `${node_path_1.default.parse(state.currentFilePath).name}.docx`;
    const selection = await electron_1.dialog.showSaveDialog({
        title: 'Export DOCX',
        defaultPath: node_path_1.default.join(state.currentRender.baseDir, defaultName),
        filters: [{ name: 'Word Document', extensions: ['docx'] }]
    });
    if (selection.canceled || !selection.filePath) {
        return { ok: false, reason: 'cancelled' };
    }
    const result = await (0, docx_1.exportDocxFromHtml)(node_path_1.default.parse(state.currentFilePath).name, state.currentRender.exportHtml, selection.filePath, state.currentRender.baseDir, state.currentRender.diagrams, state.currentRender.warnings, {
        pageSize: 'Letter',
        marginsInches: {
            top: 1,
            right: 1,
            bottom: 1,
            left: 1
        }
    });
    return {
        ok: true,
        filePath: result.outputFile,
        warnings: result.warnings
    };
}
async function exportCurrentHtmlDialog() {
    if (!state.currentRender || !state.currentFilePath) {
        return { ok: false, reason: 'No document is loaded.' };
    }
    const selection = await electron_1.dialog.showOpenDialog({
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
    const outputDir = node_path_1.default.join(selectedDir, `${node_path_1.default.parse(state.currentFilePath).name}-export`);
    const result = await (0, html_1.exportHtmlFolder)(outputDir, node_path_1.default.parse(state.currentFilePath).name, state.currentRender.exportHtml, state.currentRender.baseDir, state.currentRender.diagrams, state.currentRender.warnings);
    return {
        ok: true,
        filePath: result.outputFile,
        warnings: result.warnings
    };
}
async function renderPreview(markdown) {
    const fallbackInputPath = node_path_1.default.join(state.currentRootFolder ?? node_os_1.default.homedir(), 'untitled.md');
    const inputPath = state.currentFilePath ?? fallbackInputPath;
    const baseDir = node_path_1.default.dirname(inputPath);
    const rendered = await (0, markdown_1.renderMarkdown)({
        inputPath,
        markdown,
        baseDir,
        offline: true
    }, mermaidRenderer);
    state.currentMarkdown = markdown;
    state.currentRender = rendered;
    return {
        html: rendered.html,
        warnings: rendered.warnings
    };
}
async function writeMarkdownToPath(targetPath, markdown, switchCurrentPath) {
    const resolvedPath = node_path_1.default.resolve(targetPath);
    const baseDir = node_path_1.default.dirname(resolvedPath);
    state.ignoreWatcherEventsUntil = Date.now() + 1200;
    await promises_1.default.writeFile(resolvedPath, markdown, 'utf8');
    const rendered = await (0, markdown_1.renderMarkdown)({
        inputPath: resolvedPath,
        markdown,
        baseDir,
        offline: true
    }, mermaidRenderer);
    if (switchCurrentPath || !state.currentFilePath || state.currentFilePath === resolvedPath) {
        state.currentFilePath = resolvedPath;
        watchCurrentFile(resolvedPath);
    }
    state.currentMarkdown = markdown;
    state.currentRender = rendered;
    if (switchCurrentPath) {
        state.currentRootFolder = baseDir;
        if (preferencesStore) {
            await preferencesStore.setLastRootFolder(baseDir);
        }
    }
    sendDocumentUpdate({
        filePath: resolvedPath,
        markdown,
        html: rendered.html,
        warnings: rendered.warnings
    });
    return { ok: true, filePath: resolvedPath };
}
async function saveCurrentDocument(markdown) {
    if (!state.currentFilePath) {
        return { ok: false, reason: 'No file loaded.' };
    }
    try {
        return await writeMarkdownToPath(state.currentFilePath, markdown, false);
    }
    catch (error) {
        return { ok: false, reason: String(error) };
    }
}
async function saveCurrentDocumentAs(markdown) {
    const preferredBase = state.currentFilePath ??
        node_path_1.default.join(state.currentRootFolder ?? node_os_1.default.homedir(), 'untitled.md');
    const defaultPath = preferredBase.toLowerCase().endsWith('.md') || preferredBase.toLowerCase().endsWith('.markdown')
        ? preferredBase
        : `${preferredBase}.md`;
    const selection = await electron_1.dialog.showSaveDialog({
        title: 'Save Markdown As',
        defaultPath,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    });
    if (selection.canceled || !selection.filePath) {
        return { ok: false, reason: 'cancelled' };
    }
    try {
        return await writeMarkdownToPath(selection.filePath, markdown, true);
    }
    catch (error) {
        return { ok: false, reason: String(error) };
    }
}
async function openDocument(rawPath) {
    const resolvedPath = node_path_1.default.resolve(rawPath);
    try {
        await promises_1.default.access(resolvedPath, node_fs_1.default.constants.R_OK);
    }
    catch {
        return { ok: false, reason: `Cannot read file: ${resolvedPath}` };
    }
    if (!(0, drop_1.isMarkdownPath)(resolvedPath)) {
        return { ok: false, reason: 'Only .md or .markdown files are supported.' };
    }
    try {
        const markdown = await (0, markdown_1.readMarkdownFile)(resolvedPath);
        const rendered = await (0, markdown_1.renderMarkdown)({
            inputPath: resolvedPath,
            markdown,
            baseDir: node_path_1.default.dirname(resolvedPath),
            offline: true
        }, mermaidRenderer);
        state.currentFilePath = resolvedPath;
        state.currentMarkdown = markdown;
        state.currentRender = rendered;
        if (!state.currentRootFolder) {
            state.currentRootFolder = node_path_1.default.dirname(resolvedPath);
            if (preferencesStore) {
                await preferencesStore.setLastRootFolder(state.currentRootFolder);
            }
        }
        sendDocumentUpdate({
            filePath: resolvedPath,
            markdown,
            html: rendered.html,
            warnings: rendered.warnings
        });
        watchCurrentFile(resolvedPath);
        return { ok: true };
    }
    catch (error) {
        return {
            ok: false,
            reason: String(error)
        };
    }
}
function watchCurrentFile(filePath) {
    stopWatchingCurrentFile();
    state.fileWatcher = node_fs_1.default.watch(filePath, () => {
        if (state.watcherTimer) {
            clearTimeout(state.watcherTimer);
        }
        state.watcherTimer = setTimeout(() => {
            if (Date.now() < state.ignoreWatcherEventsUntil) {
                return;
            }
            sendDiskChanged(filePath);
        }, 180);
    });
}
function stopWatchingCurrentFile() {
    if (state.fileWatcher) {
        state.fileWatcher.close();
        state.fileWatcher = null;
    }
    if (state.watcherTimer) {
        clearTimeout(state.watcherTimer);
        state.watcherTimer = null;
    }
}
function sendDocumentUpdate(payload) {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
        return;
    }
    state.mainWindow.webContents.send('document:updated', payload);
}
function sendDiskChanged(filePath) {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
        return;
    }
    state.mainWindow.webContents.send('document:disk-changed', { filePath });
}
function sendSidebarToggle() {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
        return;
    }
    state.mainWindow.webContents.send('ui:toggle-sidebar');
}
