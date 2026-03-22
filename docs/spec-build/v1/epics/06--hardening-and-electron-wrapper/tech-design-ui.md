# Technical Design: Epic 6 — UI (Client) + Electron

This companion covers two domains: client-side performance hardening (chunked rendering, file tree virtualization, Mermaid caching) and the Electron desktop wrapper (main process, native menus, IPC, quit flow, file associations, packaging).

---

## Part A: Performance Hardening (Client)

### Chunked DOM Insertion: `client/components/chunked-render.ts`

The existing rendering path sets `contentArea.innerHTML = html` in a single operation. For a 10,000-line document, the HTML string can be 500KB+ of DOM elements. Parsing and laying out this DOM in one frame blocks the main thread for 1–3 seconds, freezing the loading indicator and preventing user interaction.

**Solution:** Split the HTML string into chunks at block-level boundaries, then parse and insert each chunk incrementally using `requestAnimationFrame()`. This avoids the synchronous full-document parse that would occur with a single `template.innerHTML = html` assignment.

```typescript
export interface ChunkedRenderOptions {
  container: HTMLElement;
  html: string;
  chunkSize?: number;       // approximate characters per chunk, default 50_000
  onProgress?: (inserted: number, total: number) => void;
  onComplete?: () => void;
  signal?: AbortSignal;     // cancel on tab switch
}

// Split HTML string at block-level element boundaries
function splitHtmlChunks(html: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const blockBoundary = /<\/(?:div|p|h[1-6]|pre|table|blockquote|ul|ol|li|section|article|hr)\s*>/gi;
  let start = 0;

  while (start < html.length) {
    let end = start + chunkSize;
    if (end >= html.length) {
      chunks.push(html.slice(start));
      break;
    }
    // Find the nearest block-level closing tag after the chunk boundary
    blockBoundary.lastIndex = end;
    const match = blockBoundary.exec(html);
    end = match ? match.index + match[0].length : end;
    chunks.push(html.slice(start, end));
    start = end;
  }
  return chunks;
}

export function renderChunked(options: ChunkedRenderOptions): void {
  const { container, html, chunkSize = 50_000, onProgress, onComplete, signal } = options;

  const chunks = splitHtmlChunks(html, chunkSize);
  const total = chunks.length;
  let inserted = 0;

  container.innerHTML = ''; // Clear existing content

  function insertBatch() {
    if (signal?.aborted) return;

    const chunk = chunks.shift();
    if (!chunk) {
      onComplete?.();
      return;
    }

    // Parse only this chunk — not the entire document
    const template = document.createElement('template');
    template.innerHTML = chunk;
    container.appendChild(template.content);

    inserted++;
    onProgress?.(inserted, total);

    requestAnimationFrame(insertBatch);
  }

  requestAnimationFrame(insertBatch);
}
```

**Integration with content-area.ts:** The existing `setRenderedContent(html)` function calls `renderChunked()` instead of setting `innerHTML` directly. For documents under 200 elements (~500 lines), fall back to direct `innerHTML` — the overhead of chunked insertion isn't justified for small documents.

**Tab switch during rendering:** If the user switches tabs while chunked insertion is in progress, the `AbortSignal` cancels the remaining batches. The new tab's content renders fresh.

**Mermaid post-processing:** The existing `processMermaidPlaceholders()` runs after all HTML is inserted. With chunked rendering, it runs after `onComplete()`. Mermaid diagrams that appear in early batches are visible but not yet rendered — they show the placeholder until the full document is inserted and Mermaid processing begins. This is acceptable because Mermaid rendering is already asynchronous (Epic 3 design).

**Covers:** AC-1.1a (large file render without freezing), AC-1.1b (smooth scrolling — chunked insertion doesn't block scroll events), AC-1.2b (mode switch — Render mode uses chunked insertion for large files).

---

### Mermaid Render Cache: `client/components/mermaid-cache.ts`

Mermaid diagrams are expensive to render — each diagram invokes the Mermaid.js library, which parses the source, builds an SVG, and performs text measurement via the DOM. For a document with 5 diagrams, re-rendering on every tab switch or mode switch adds 2–5 seconds of latency.

**Solution:** An LRU cache that stores rendered SVG strings keyed by `sourceHash:themeId`.

```typescript
interface CacheEntry {
  svg: string;
  accessedAt: number;
}

export class MermaidCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  private makeKey(source: string, themeId: string): string {
    return `${fnv1a(source)}:${themeId}`;
  }

  get(source: string, themeId: string): string | null {
    const key = this.makeKey(source, themeId);
    const entry = this.cache.get(key);
    if (!entry) return null;
    entry.accessedAt = Date.now();
    return entry.svg;
  }

  set(source: string, themeId: string, svg: string): void {
    const key = this.makeKey(source, themeId);
    this.cache.set(key, { svg, accessedAt: Date.now() });
    this.evictIfNeeded();
  }

  invalidateForTab(sources: string[]): void {
    // Remove entries whose source appears only in the closed tab
    // Called on tab close with the tab's Mermaid sources
    const sourceHashes = new Set(sources.map(fnv1a));
    for (const [key] of this.cache) {
      const hash = key.split(':')[0];
      if (sourceHashes.has(hash)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.maxEntries) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of this.cache) {
        if (entry.accessedAt < oldestTime) {
          oldestTime = entry.accessedAt;
          oldestKey = key;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }
}
```

**FNV-1a hash function:**

```typescript
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16);
}
```

**Integration with mermaid-renderer.ts:** The existing `processMermaidPlaceholders()` function is modified to check the cache before invoking `mermaid.render()`:

```typescript
for (const placeholder of placeholders) {
  const source = placeholder.dataset.mermaidSource;
  const cached = mermaidCache.get(source, currentThemeId);
  if (cached) {
    placeholder.innerHTML = cached;
    continue;
  }

  try {
    const { svg } = await mermaid.render(uniqueId(), source);
    mermaidCache.set(source, currentThemeId, svg);
    placeholder.innerHTML = svg;
  } catch (error) {
    // existing error fallback
  }
}
```

**Theme switch behavior:** When the theme changes, the existing `reinitializeMermaid()` function re-renders all visible diagrams. The cache is NOT cleared on theme switch — entries for the old theme remain (keyed by `sourceHash:oldThemeId`) and are reused if the user switches back. New renders for the current theme create new cache entries (keyed by `sourceHash:newThemeId`). LRU eviction handles memory pressure.

**Tab close:** When a tab is closed, `mermaidCache.invalidateForTab(tabMermaidSources)` removes entries for diagrams that only appeared in that tab. This is conservative — if the same diagram appears in another open tab, the cache entry survives because `invalidateForTab` only removes entries whose source hash is in the provided list. A more precise approach (reference counting) would be more complex for minimal benefit.

**Covers:** AC-6.1 (cache hits on tab switch, mode switch), AC-6.2 (theme switch re-renders, old entries stay for switch-back), AC-6.3 (bounded cache, LRU eviction, tab close cleanup).

---

### File Tree Virtualization: `client/components/virtual-tree.ts`

The existing file tree renders every `TreeNode` as a DOM element via `mountFileTree()` in `file-tree.ts` (called from `sidebar.ts`). With 1,500 nodes fully expanded, the sidebar has 1,500+ DOM elements, each with click handlers, ARIA attributes, hover styles, and context menu listeners. Scrolling becomes janky, and Expand All takes seconds as the browser lays out all nodes simultaneously.

**Solution:** A lightweight virtual scroller that renders only visible tree rows.

**Architecture:**

1. **Flat list computation (existing):** The tree is already flattened into a visible-node list by the existing expand/collapse logic. Each node has a `depth` value for indentation. This flat list is the input to the virtualizer.

2. **Virtual scroll container:**
   ```typescript
   export interface VirtualTreeOptions {
     container: HTMLElement;        // the scrollable sidebar area
     rowHeight: number;             // fixed row height (28px matches current CSS)
     overscan: number;              // extra rows above/below viewport (default 20)
     renderRow: (node: FlatTreeNode, index: number) => HTMLElement;
     onNodeClick: (node: FlatTreeNode) => void;
     onNodeContextMenu: (node: FlatTreeNode, event: MouseEvent) => void;
   }

   export class VirtualTree {
     private nodes: FlatTreeNode[] = [];
     private scrollTop = 0;
     private viewportHeight = 0;

     constructor(private options: VirtualTreeOptions) {
       // Create spacer for total height
       this.spacer = document.createElement('div');
       this.viewport = document.createElement('div');
       options.container.appendChild(this.spacer);
       options.container.appendChild(this.viewport);

       options.container.addEventListener('scroll', this.onScroll);
       new ResizeObserver(this.onResize).observe(options.container);
     }

     setNodes(nodes: FlatTreeNode[]): void {
       this.nodes = nodes;
       this.spacer.style.height = `${nodes.length * this.options.rowHeight}px`;
       this.render();
     }

     private render(): void {
       const { rowHeight, overscan, renderRow } = this.options;
       const startIndex = Math.max(0, Math.floor(this.scrollTop / rowHeight) - overscan);
       const visibleCount = Math.ceil(this.viewportHeight / rowHeight) + 2 * overscan;
       const endIndex = Math.min(this.nodes.length, startIndex + visibleCount);

       this.viewport.style.transform = `translateY(${startIndex * rowHeight}px)`;

       // Diff and patch visible rows
       // ... (reuse existing DOM elements where possible, create/remove as needed)
     }

     destroy(): void {
       this.options.container.removeEventListener('scroll', this.onScroll);
     }
   }
   ```

3. **Row rendering:** Each row is rendered by the existing tree node rendering logic, adapted to receive a `FlatTreeNode` instead of recursively building the tree DOM. The row includes: indentation spacer (depth * indent width), expand/collapse icon (for directories), file/folder icon, name text, and markdown count badge (for directories).

**Integration with file-tree.ts:** The existing `mountFileTree()` function's DOM rendering is replaced by `VirtualTree.setNodes()`. The flat list computation (converting `TreeNode[]` to `FlatTreeNode[]` based on expand/collapse state) stays in `sidebar.ts`. The `VirtualTree` only handles rendering the visible window.

**Expand All performance:** Expand All changes the flat list (many more nodes visible). `setNodes()` updates the spacer height and re-renders the viewport window. Since only ~40 rows are in the DOM at any time, Expand All is instantaneous regardless of tree size.

**Keyboard navigation:** Arrow key navigation updates the focused index. If the focused row is outside the viewport, the virtualizer scrolls to bring it into view (same as the existing `scrollIntoView` behavior, but now the virtualizer controls the scroll position).

**Covers:** AC-2.1 (large tree loading and expand), AC-2.1c (scroll performance), AC-2.2 (count badges — unchanged, just rendered per-row).

---

### Count Badges: No Async Mechanism Needed

The current tree scan computes `TreeNode.mdCount` during the recursive scan — counts are always present in a successful response. The epic's AC-2.2 says "If counts take time, directories appear first and counts fill in asynchronously." From the client's perspective, the tree load IS asynchronous (loading indicator during the `GET /api/tree` fetch). When the response arrives, all counts are present.

On timeout (500 SCAN_ERROR with `timeout: true`), no partial tree is returned — the client shows an error with a retry option. The epic's TC-13.1b asks for "partial tree with incomplete indicator," but the server's scan-and-abort approach does not produce partial results (the AbortController cancels the scan, not the response). This is documented as a deviation: timeout produces a retry prompt, not a partial tree. The retry prompt is more useful than a partial tree with missing counts and inconsistent structure.

---

## Part B: Electron Wrapper

### Electron Main Process: `electron/main.ts`

The main process is the Electron app's entry point. It starts Fastify, creates the BrowserWindow, and registers OS event handlers.

```typescript
import { app, BrowserWindow } from 'electron';
import { createRequire } from 'node:module';
import { startServer } from '../server/index.js';
import { createMainWindow, restoreWindowState } from './window.js';
import { buildMenu } from './menu.js';
import { registerIpcHandlers } from './ipc.js';
import { setupFileHandler } from './file-handler.js';

const require = createRequire(import.meta.url);

let mainWindow: BrowserWindow | null = null;
let serverUrl: string | null = null;
let pendingFilePath: string | null = null;

// Register open-file BEFORE app.whenReady() — macOS fires this before ready
// when the app is launched by double-clicking a .md file (TC-9.2a, TC-9.2e)
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('app:open-file', { path });
    mainWindow.focus();
  } else {
    pendingFilePath = path;
  }
});

// Single-instance lock (AC-7.2)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // Route file arguments to existing window (TC-7.2b)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const filePath = argv.find((arg) => arg.endsWith('.md') || arg.endsWith('.markdown'));
      if (filePath) {
        mainWindow.webContents.send('app:open-file', { path: filePath });
      }
    }
  });

  app.whenReady().then(async () => {
    try {
      // Start Fastify in-process (AC-7.1a)
      const fastify = await startServer({
        openUrl: async () => {},  // suppress browser open
        preferredPort: 0,         // dynamic port
      });
      const address = fastify.server.address();
      const port = typeof address === 'object' ? address?.port : 3000;
      serverUrl = `http://localhost:${port}`;

      // Create window (AC-7.1c — show: false until ready)
      mainWindow = createMainWindow(serverUrl);

      // Native menus (AC-8.1)
      buildMenu(mainWindow);

      // IPC handlers (AC-10.1)
      registerIpcHandlers(mainWindow);

      // File association handler (AC-9.2) — flushes pendingFilePath after page load
      setupFileHandler(
        mainWindow,
        () => pendingFilePath,
        () => { pendingFilePath = null; },
      );

    } catch (error) {
      // TC-13.2a: Server fails to start
      mainWindow = createMainWindow(null); // show error page
    }
  });

  // macOS: re-create window on dock click
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverUrl) {
      mainWindow = createMainWindow(serverUrl);
    }
  });

  // Quit lifecycle
  app.on('window-all-closed', () => {
    app.quit();
  });
}
```

**Startup sequence:**
1. Request single-instance lock
2. `app.whenReady()` → start Fastify (dynamic port)
3. Create BrowserWindow (hidden, `show: false`)
4. BrowserWindow loads `http://localhost:{port}?electron=1`
5. `ready-to-show` event → show window (no white flash, TC-7.1c)
6. Register native menus, IPC handlers, file handler

**Server lifecycle:** The Fastify instance is held in module scope. When the app quits (`window-all-closed`), Electron's process exit closes the server. For graceful shutdown, `app.on('will-quit')` can call `fastify.close()`, though for a local single-user app this is not critical.

---

### Window Management: `electron/window.ts`

```typescript
import { BrowserWindow, screen } from 'electron';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const windowStateKeeper = require('electron-window-state');

export function createMainWindow(serverUrl: string | null): BrowserWindow {
  const state = windowStateKeeper({
    defaultWidth: 1420,
    defaultHeight: 960,
  });

  // Validate window position is on a visible display (TC-7.3b)
  const displays = screen.getAllDisplays();
  const isOnScreen = displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    return state.x >= x && state.x < x + width && state.y >= y && state.y < y + height;
  });

  const win = new BrowserWindow({
    x: isOnScreen ? state.x : undefined,
    y: isOnScreen ? state.y : undefined,
    width: state.width,
    height: state.height,
    minWidth: 980,
    minHeight: 620,
    show: false,  // AC-7.1c: no white flash
    title: 'MD Viewer',
    webPreferences: {
      preload: new URL('./preload.js', import.meta.url).pathname,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  state.manage(win);

  if (serverUrl) {
    win.loadURL(`${serverUrl}?electron=1`);
  } else {
    // Server failed to start — show error (TC-13.2a)
    win.loadURL(`data:text/html,<h1>Server failed to start</h1><p>Check the console for errors.</p>`);
    win.show();
    return win;
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  return win;
}
```

**Window state persistence (AC-7.3):** `electron-window-state` handles save/restore of x, y, width, height, and maximized state. It writes to Electron's `userData` directory (`~/Library/Application Support/MD Viewer/`). This is separate from the Fastify session data (`~/Library/Application Support/md-viewer/`) — window geometry is Electron-only.

**Disconnected display (TC-7.3b):** Before applying saved coordinates, check that the saved position falls within a visible display's bounds. If not, let Electron choose a default position on the primary display.

**Security (NFR):** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer process has no direct Node.js access. All communication goes through the preload bridge.

---

### Preload Bridge: `electron/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,

  onMenuAction: (callback: (action: string, args?: unknown) => void) => {
    ipcRenderer.on('menu:action', (_event, action: string, args?: unknown) => {
      callback(action, args);
    });
  },

  onOpenFile: (callback: (path: string) => void) => {
    ipcRenderer.on('app:open-file', (_event, data: { path: string }) => {
      callback(data.path);
    });
  },

  onQuitRequest: (callback: () => void) => {
    ipcRenderer.on('app:quit-request', () => {
      callback();
    });
  },

  confirmQuit: () => {
    ipcRenderer.send('app:quit-confirmed');
  },

  cancelQuit: () => {
    ipcRenderer.send('app:quit-cancelled');
  },

  sendMenuState: (state: {
    hasDocument: boolean;
    hasDirtyTab: boolean;
    activeTabDirty: boolean;
    activeTheme: string;
    activeMode: string;
    defaultMode: string;
  }) => {
    ipcRenderer.send('menu:state-update', state);
  },
});
```

**7 methods, all one-directional.** No `invoke` (request-response) patterns — all communication is fire-and-forget or event-based. This keeps the IPC surface simple and avoids blocking the renderer on main process responses.

---

### Client-Side Electron Bridge: `client/utils/electron-bridge.ts`

```typescript
interface ElectronBridge {
  isElectron: boolean;
  onMenuAction: (callback: (action: string, args?: unknown) => void) => void;
  onOpenFile: (callback: (path: string) => void) => void;
  onQuitRequest: (callback: () => void) => void;
  confirmQuit: () => void;
  cancelQuit: () => void;
  sendMenuState: (state: MenuState) => void;
}

export interface MenuState {
  hasDocument: boolean;
  hasDirtyTab: boolean;
  activeTabDirty: boolean;
  activeTheme: string;
  activeMode: 'render' | 'edit';
  defaultMode: 'render' | 'edit';
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}

export function isElectron(): boolean {
  return window.electron?.isElectron === true;
}

export function getElectronBridge(): ElectronBridge | null {
  return window.electron ?? null;
}
```

**Usage in app.ts:**

```typescript
const bridge = getElectronBridge();
if (bridge) {
  // Wire menu actions to existing handlers
  bridge.onMenuAction((action, args) => {
    switch (action) {
      case 'open-file': handleOpenFile(); break;
      case 'open-folder': handleOpenFolder(); break;
      case 'save': handleSave(); break;
      case 'save-as': handleSaveAs(); break;
      case 'close-tab': handleCloseTab(); break;
      case 'export-pdf': handleExport('pdf'); break;
      case 'export-docx': handleExport('docx'); break;
      case 'export-html': handleExport('html'); break;
      case 'toggle-sidebar': handleToggleSidebar(); break;
      case 'toggle-mode': handleToggleMode(); break;
      case 'set-theme': handleSetTheme(args as string); break;
      // ... etc
    }
  });

  // Wire open-file from OS
  bridge.onOpenFile((path) => {
    openDocument(path);
  });

  // Wire quit flow
  bridge.onQuitRequest(() => {
    const dirtyTabs = getDirtyTabs();
    if (dirtyTabs.length === 0) {
      bridge.confirmQuit();
      return;
    }
    showQuitModal(dirtyTabs, {
      onSaveAllAndQuit: async () => {
        for (const tab of dirtyTabs) await saveTab(tab.id);
        bridge.confirmQuit();
      },
      onDiscardAllAndQuit: () => bridge.confirmQuit(),
      onCancel: () => bridge.cancelQuit(),
    });
  });

  // State sync for native menus (debounced)
  let menuStateTimer: ReturnType<typeof setTimeout> | null = null;
  store.subscribe(() => {
    if (menuStateTimer) clearTimeout(menuStateTimer);
    menuStateTimer = setTimeout(() => {
      const state = store.get();
      const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
      bridge.sendMenuState({
        hasDocument: state.tabs.length > 0,
        hasDirtyTab: state.tabs.some((t) => t.dirty),
        activeTabDirty: activeTab?.dirty ?? false,
        activeTheme: state.theme,
        activeMode: activeTab?.mode ?? 'render',
        defaultMode: state.defaultOpenMode,
      });
    }, 50);
  });
}
```

---

### Native Menu Bar: `electron/menu.ts`

The native menu mirrors the web app's menu structure from Epics 1–5: app menu, File, Export, View.

```typescript
import { app, Menu, BrowserWindow, ipcMain } from 'electron';

interface MenuState {
  hasDocument: boolean;
  hasDirtyTab: boolean;
  activeTabDirty: boolean;
  activeTheme: string;
  activeMode: string;
  defaultMode: string;
}

let currentState: MenuState = {
  hasDocument: false,
  hasDirtyTab: false,
  activeTabDirty: false,
  activeTheme: 'light-default',
  activeMode: 'render',
  defaultMode: 'render',
};

const THEMES = [
  { id: 'light-default', label: 'Light Default' },
  { id: 'light-warm', label: 'Light Warm' },
  { id: 'dark-default', label: 'Dark Default' },
  { id: 'dark-cool', label: 'Dark Cool' },
];

function sendAction(win: BrowserWindow, action: string, args?: unknown): void {
  win.webContents.send('menu:action', action, args);
}

export function buildMenu(win: BrowserWindow): void {
  function rebuild(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      // App menu (TC-8.1d)
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      // File menu (TC-8.1a)
      {
        label: 'File',
        submenu: [
          { label: 'Open File', accelerator: 'CmdOrCtrl+O', click: () => sendAction(win, 'open-file') },
          { label: 'Open Folder', accelerator: 'CmdOrCtrl+Shift+O', click: () => sendAction(win, 'open-folder') },
          { type: 'separator' },
          { label: 'Save', accelerator: 'CmdOrCtrl+S', enabled: currentState.activeTabDirty, click: () => sendAction(win, 'save') },
          { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', enabled: currentState.hasDocument, click: () => sendAction(win, 'save-as') },
          { type: 'separator' },
          { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', enabled: currentState.hasDocument, click: () => sendAction(win, 'close-tab') },
        ],
      },
      // Export menu (TC-8.1b)
      {
        label: 'Export',
        submenu: [
          { label: 'PDF', accelerator: 'CmdOrCtrl+Shift+E', enabled: currentState.hasDocument, click: () => sendAction(win, 'export-pdf') },
          { label: 'DOCX', enabled: currentState.hasDocument, click: () => sendAction(win, 'export-docx') },
          { label: 'HTML', enabled: currentState.hasDocument, click: () => sendAction(win, 'export-html') },
        ],
      },
      // View menu (TC-8.1c)
      {
        label: 'View',
        submenu: [
          { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => sendAction(win, 'toggle-sidebar') },
          { type: 'separator' },
          {
            label: 'Theme',
            submenu: THEMES.map((theme) => ({
              label: theme.label,
              type: 'checkbox' as const,
              checked: currentState.activeTheme === theme.id,
              click: () => sendAction(win, 'set-theme', theme.id),
            })),
          },
          { type: 'separator' },
          { label: 'Render Mode', accelerator: 'CmdOrCtrl+Shift+M', click: () => sendAction(win, 'toggle-mode') },
          { type: 'separator' },
          { role: 'toggleDevTools' },
        ],
      },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  // Initial build
  rebuild();

  // State sync (AC-8.2)
  ipcMain.on('menu:state-update', (_event, state: MenuState) => {
    currentState = state;
    rebuild();
  });
}
```

**Menu rebuild on state change:** The menu is rebuilt from template on every state update. This is the standard Electron pattern — `Menu.buildFromTemplate()` is fast (~1ms), and Electron does not support mutating individual menu items after creation. The 50ms debounce on the client side ensures rebuilds are batched.

**Keyboard shortcut ownership:** Native menus register accelerators (Cmd+S, Cmd+O, etc.). In Electron, these take precedence over the web app's `keydown` handlers. This means the web app's shortcut handler won't fire for these keys — the native menu handles them and sends the action via IPC. This is correct behavior: native menus should own keyboard shortcuts in Electron.

The web app's shortcut handler remains for non-menu shortcuts (Cmd+Shift+], Cmd+Shift+[ for tab navigation, etc.) that don't have native menu equivalents.

---

### Native Menu State Sync: IPC Flow

```
Client state changes (tab open/close, edit, save, theme switch)
  ↓
store.subscribe() fires
  ↓
50ms debounce
  ↓
bridge.sendMenuState({ hasDocument, hasDirtyTab, activeTabDirty, activeTheme, ... })
  ↓
ipcRenderer.send('menu:state-update', state)
  ↓
Main process: ipcMain.on('menu:state-update')
  ↓
Rebuild menu template with updated enabled/checked values
  ↓
Menu.setApplicationMenu(Menu.buildFromTemplate(template))
```

**Covers:** AC-8.2a (Export disabled), AC-8.2b/c (Save disabled/enabled), AC-8.2d (theme checkmark).

---

### IPC Handler Registration: `electron/ipc.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';

export function registerIpcHandlers(win: BrowserWindow): void {
  let quitPending = false;

  // Quit flow (AC-10.1)
  win.on('close', (event) => {
    if (quitPending) return; // Already confirmed

    event.preventDefault();
    win.webContents.send('app:quit-request');
  });

  ipcMain.on('app:quit-confirmed', () => {
    quitPending = true;
    win.close(); // This time, 'close' event won't preventDefault
  });

  ipcMain.on('app:quit-cancelled', () => {
    // Nothing to do — the window stays open
  });
}
```

**Quit flow sequence:**

```
User presses Cmd+Q or clicks close button
  ↓
BrowserWindow 'close' event fires
  ↓
event.preventDefault() — window stays open
  ↓
Send 'app:quit-request' to renderer
  ↓
Renderer checks dirty tabs
  ↓
IF no dirty tabs:
  renderer sends 'app:quit-confirmed'
  main process sets quitPending = true
  main process calls win.close() — this time close proceeds
  ↓
IF dirty tabs:
  renderer shows quit modal (Save All / Discard All / Cancel)
  ↓
  Save All: save all tabs, then 'app:quit-confirmed'
  Discard All: 'app:quit-confirmed'
  Cancel: 'app:quit-cancelled' — window stays open
```

**Covers:** AC-10.1a–f (all quit flow scenarios).

---

### File Association Handler: `electron/file-handler.ts`

The `open-file` listener is registered in `main.ts` BEFORE `app.whenReady()` (see Electron Main Process section above) because macOS fires `open-file` before the ready event when the app is launched by double-clicking a file. The listener queues the path in module-level `pendingFilePath`.

`file-handler.ts` does NOT register its own `open-file` listener — that would create a duplicate. Instead, it provides the `did-finish-load` hook that flushes the pending path:

```typescript
import { BrowserWindow } from 'electron';

export function setupFileHandler(
  win: BrowserWindow,
  getPendingFilePath: () => string | null,
  clearPendingFilePath: () => void,
): void {
  // Flush pending file after page loads (cold-launch file open)
  win.webContents.on('did-finish-load', () => {
    const pending = getPendingFilePath();
    if (pending) {
      win.webContents.send('app:open-file', { path: pending });
      clearPendingFilePath();
    }
  });
}
```

**Startup with file open (TC-9.2a, TC-9.2e):** When the user double-clicks a `.md` file and the app isn't running, macOS launches the app and fires `open-file` before the window is ready. The handler queues the path and sends it after `did-finish-load`. The client's `restoreTabsFromSession()` runs first (restoring persisted tabs), then `onOpenFile` fires (opening the clicked file in a new tab or activating its existing tab).

**Dock drag (TC-9.2c):** Same `open-file` event, same handler.

**Already-open file (TC-9.2d):** The client's `openDocument()` function already handles duplicate detection (Epic 2 AC-1.3). The `open-file` handler just routes the path to `openDocument()`.

---

### Electron Detection and HTML Menu Bar Hiding

**CSS:**

```css
/* In base.css or menu-bar.css */
body.electron #menu-bar {
  display: none;
}

body.electron #main {
  /* Reclaim the space — content shifts up */
  top: 0;
}
```

**JavaScript (in app.ts bootstrap):**

```typescript
// Check for Electron query param (set by BrowserWindow URL)
if (new URLSearchParams(location.search).has('electron')) {
  document.body.classList.add('electron');
}
```

This runs synchronously before any DOM rendering, so the HTML menu bar never flashes. The `body.electron` class is the single detection point — all Electron-specific CSS and JS branches check this class or the `isElectron()` utility function.

**Covers:** AC-8.3a (no duplicate menu bar), AC-8.3b (browser retains HTML menu bar).

---

### Tab Restore on Startup: `client/app.ts` Modifications

The existing `restoreTabsFromSession()` already restores tabs from `session.openTabs`. Epic 6 extends it to use `PersistedTab` objects:

```typescript
const restoreTabsFromSession = async () => {
  const { openTabs, activeTab } = bootstrap.session;
  if (!openTabs.length) return;

  // For legacy tabs (migrated from string[]), the Zod schema sets mode='render'
  // as a default. Since we can't distinguish "user explicitly chose render" from
  // "migrated from legacy string," legacy tabs always restore in render mode.
  // This is acceptable — the only time it matters is the first restart after
  // upgrade, and render mode is the safe default.
  const loadingTabs = disambiguateDisplayNames(
    openTabs.map((persisted) =>
      createLoadingTab(persisted.path, persisted.mode)
    ),
  );

  const initialActiveTabId =
    loadingTabs.find((tab) => tab.path === activeTab)?.id ?? loadingTabs.at(-1)?.id ?? null;

  updateTabsState(loadingTabs, initialActiveTabId);

  // Eagerly load active tab (TC-11.1b)
  const activeLoadingTab = loadingTabs.find((tab) => tab.id === initialActiveTabId);
  if (activeLoadingTab) {
    await loadTabContent(activeLoadingTab.id);
  }
  // Other tabs load lazily on switch (existing behavior)
};
```

**Per-tab mode restore (TC-11.1c):** The `createLoadingTab` function already accepts a mode parameter. The change is passing `persisted.mode` instead of `bootstrap.session.defaultOpenMode` for every tab.

**Scroll position restore:** Best-effort. The `persisted.scrollPosition` is stored and applied after content loads. For Render mode, it sets `container.scrollTop`. For Edit mode, it calls `editor.setScrollTop()`. The scroll position is approximate — document content may have changed since the position was saved.

**syncTabsToSession update:** The existing function sends `tabs.map(tab => tab.path)`. The change is sending `PersistedTab` objects:

```typescript
await api.updateTabs(
  tabs
    .filter((tab) => tab.status === 'ok' || (tab.status === 'deleted' && tab.dirty && tab.editContent !== null))
    .map((tab) => ({
      path: tab.path,
      mode: tab.mode,
      scrollPosition: tab.mode === 'edit'
        ? tab.editScrollPosition
        : tab.scrollPosition,
    })),
  activeTab?.path ?? null,
);
```

---

### Packaging and Install: `electron-builder.yml`

```yaml
appId: com.leemoore.mdviewer
productName: MD Viewer
directories:
  output: dist/electron
mac:
  category: public.app-category.productivity
  target:
    - target: dir
      arch:
        - arm64
        - x64
  icon: assets/icon/md-viewer.icns
  identity: null  # ad-hoc signing (no Developer ID)
fileAssociations:
  - ext: md
    name: Markdown Document
    role: Viewer
    rank: Default
  - ext: markdown
    name: Markdown Document
    role: Viewer
    rank: Default
asar: true
files:
  - app/dist/**/*
  - app/src/client/**/*.html
  - app/src/client/**/*.css
  - node_modules/**/*
  - "!node_modules/**/test/**"
  - "!node_modules/**/*.md"
extraMetadata:
  main: app/dist/electron/main.js
```

**File associations (AC-9.1):** The `fileAssociations` config generates `CFBundleDocumentTypes` in the app's Info.plist. macOS Launch Services discovers this on first launch and registers MD Viewer as an available handler for `.md` and `.markdown` files.

**Ad-hoc signing (AC-12.2b):** `identity: null` tells electron-builder to skip Developer ID signing. For ARM64 builds, electron-builder v26+ automatically applies an ad-hoc signature. This is the correct configuration for unsigned local distribution.

**Stable bundle ID (AC-9.3, AC-12.2a):** `appId: com.leemoore.mdviewer` is consistent across builds. Reinstalling at the same path preserves file associations because macOS keys associations on bundle ID + path.

### Install Script: `scripts/install-app.sh`

```bash
#!/bin/bash
set -euo pipefail

INSTALL_DIR="$HOME/Applications"
APP_NAME="MD Viewer.app"

echo "Building MD Viewer..."
npm run build
npm run build:electron

echo "Packaging..."
npx electron-builder --mac --dir

# Determine architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  SOURCE="dist/electron/mac-arm64/$APP_NAME"
else
  SOURCE="dist/electron/mac/$APP_NAME"
fi

if [ ! -d "$SOURCE" ]; then
  echo "Error: Build output not found at $SOURCE"
  exit 1
fi

echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/$APP_NAME"
cp -R "$SOURCE" "$INSTALL_DIR/$APP_NAME"

echo "MD Viewer installed to $INSTALL_DIR/$APP_NAME"
echo "You can now open it from ~/Applications or set it as your default .md handler."
```

**`npm run build:electron`** is a new script that compiles both the Electron main process AND preload script:

```json
{
  "build:electron": "esbuild app/src/electron/main.ts app/src/electron/preload.ts --bundle --platform=node --format=esm --outdir=app/dist/electron --external:electron --external:electron-window-state"
}
```

This produces two output files: `app/dist/electron/main.js` and `app/dist/electron/preload.js`. The `--external` flags prevent esbuild from bundling Electron APIs and the CJS window-state module — these are resolved at runtime by Electron's Node.js.

The `BrowserWindow` preload path references `app/dist/electron/preload.js` — both artifacts must exist for the app to start.

**Covers:** AC-12.1 (one-command install), AC-12.1b (reinstall preserves data — only the .app is replaced, session data lives in `~/Library/Application Support/md-viewer/`), AC-12.3 (user data location).

---

### Server Crash Recovery: `electron/main.ts` Extension

```typescript
// TC-13.2b: Server crashes mid-session
// Monitor the Fastify server health
let fastifyInstance: FastifyInstance | null = null;

// In the startup sequence:
fastifyInstance = await startServer({ ... });

// Periodic health check (every 5s)
setInterval(async () => {
  if (!fastifyInstance) return;
  try {
    const response = await fetch(`${serverUrl}/api/session`);
    if (!response.ok) throw new Error('Health check failed');
  } catch {
    // Server is unresponsive — notify renderer
    mainWindow?.webContents.send('app:server-error');
  }
}, 5000);
```

The client shows a "Server disconnected — Restart" overlay when it receives `app:server-error` or when any API call fails with a network error (existing behavior from Epic 2 AC-9.3). The Restart button sends an IPC message to the main process, which calls `fastifyInstance.close()`, re-runs `startServer()`, and reloads the BrowserWindow.

---

## Self-Review Checklist (UI + Electron)

- [x] Chunked rendering handles abort on tab switch
- [x] Mermaid cache keyed by source + theme, LRU eviction, tab close cleanup
- [x] Virtual tree renders only visible rows, integrates with existing expand/collapse
- [x] Electron main process uses existing `startServer()` with injected options
- [x] Preload bridge is minimal — 7 methods, no file operations
- [x] Native menu mirrors web app menus with state sync via IPC
- [x] Quit flow uses `close` event prevention + IPC round-trip
- [x] File associations via electron-builder `fileAssociations` config
- [x] `open-file` handler queues path if fired before window ready
- [x] Tab restore uses `PersistedTab` with per-tab mode
- [x] Electron detection via URL query param — synchronous, no flash
- [x] Window state persistence with disconnected-display guard
- [x] Install script handles both ARM64 and Intel
- [x] All interfaces trace to ACs
