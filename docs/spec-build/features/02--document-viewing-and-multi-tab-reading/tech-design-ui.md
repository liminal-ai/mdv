# Technical Design: Epic 2 — UI (Client)

**Parent:** [tech-design.md](tech-design.md)
**Companion:** [tech-design-api.md](tech-design-api.md) · [test-plan.md](test-plan.md)

This document covers the client-side additions for Epic 2: tab management, document display (rendered HTML from server), content toolbar, link click handling, WebSocket client, file path display, keyboard shortcuts, and client state extensions.

---

## Client State Extensions: `client/state.ts`

Epic 2 extends the `ClientState` interface with tab management, active document, and warning state.

### Extended State Shape

```typescript
export interface ClientState {
  // From Epic 1 (unchanged)
  session: SessionState;
  availableThemes: ThemeInfo[];
  tree: TreeNode[] | null;
  treeLoading: boolean;
  activeMenuId: string | null;
  contextMenu: ContextMenuState | null;
  sidebarVisible: boolean;
  expandedDirsByRoot: Map<string, Set<string>>;
  error: AppError | null;

  // Epic 2 additions
  tabs: TabState[];                     // Ordered list of open tabs
  activeTabId: string | null;           // ID of the active tab (null = no tabs open)
  tabContextMenu: TabContextMenuState | null;  // Right-click context menu on a tab
  contentToolbarVisible: boolean;       // True when at least one tab is open
}

export interface TabState {
  id: string;                 // Unique identifier (UUID)
  path: string;               // Absolute path (display path, as user opened it)
  canonicalPath: string;      // Resolved path (for dedup, never shown to user)
  filename: string;           // Display name (basename, or disambiguated)
  html: string;               // Last-fetched rendered HTML from server
  content: string;            // Last-fetched raw markdown (for future use)
  warnings: RenderWarning[];  // Rendering warnings
  scrollPosition: number;     // Vertical scroll offset within this tab
  loading: boolean;           // True while fetching/re-fetching content
  modifiedAt: string;         // ISO 8601, last server-reported mtime
  size: number;               // Raw markdown size in bytes
  status: 'ok' | 'deleted' | 'error';  // File state
  errorMessage?: string;      // Error details when status is 'error'
}

export interface TabContextMenuState {
  x: number;
  y: number;
  tabId: string;
  items: ContextMenuItem[];
}
```

### Tab State Lifecycle

```
Tree click → Check dedup (canonicalPath) → Create TabState (loading: true)
           → Fetch GET /api/file → Update TabState (html, warnings, loading: false)
           → Send WS watch → Persist to session (openTabs, activeTab)

Tab switch → Save scroll position of outgoing tab
           → Set activeTabId → Restore scroll position of incoming tab
           → Update menu bar status → Persist activeTab to session

Tab close → Save/remove TabState → Send WS unwatch
          → If last tab: clear activeTabId, hide toolbar
          → Persist to session

File change (WS) → Re-fetch GET /api/file → Update TabState (html, warnings)
                 → If active tab: update displayed content
```

### Duplicate Tab Detection (AC-1.3)

When opening a file, the client checks `canonicalPath` against all open tabs:

```typescript
function findExistingTab(canonicalPath: string, tabs: TabState[]): TabState | undefined {
  return tabs.find(t => t.canonicalPath === canonicalPath);
}
```

If found, the existing tab is activated — no new tab created. The `canonicalPath` is provided by the server in `FileReadResponse.canonicalPath`, which uses `fs.realpath()` to resolve symlinks. The display path (`path`) may differ between the tree click and the original open, but the canonical path matches.

### Tab Display Name Disambiguation (TC-4.1c)

When multiple open tabs share the same basename, the display names are disambiguated by adding parent directory context:

```typescript
function computeDisplayNames(tabs: TabState[]): void {
  // Group by basename
  const groups = new Map<string, TabState[]>();
  for (const tab of tabs) {
    const base = path.basename(tab.path);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(tab);
  }

  for (const [base, group] of groups) {
    if (group.length === 1) {
      group[0].filename = base;  // Unique — just the filename
    } else {
      // Walk up path segments until each is unique
      disambiguate(group);
    }
  }
}

function disambiguate(tabs: TabState[]): void {
  const segments = tabs.map(t => t.path.split('/').reverse());
  let depth = 2; // Start at "parent/file.md"

  while (depth <= Math.max(...segments.map(s => s.length))) {
    const names = segments.map(s => s.slice(0, depth).reverse().join('/'));
    if (new Set(names).size === names.length) {
      // All unique at this depth
      tabs.forEach((t, i) => { t.filename = names[i]; });
      return;
    }
    depth++;
  }

  // Fallback: use full paths (shouldn't happen in practice)
  tabs.forEach(t => { t.filename = t.path; });
}
```

Display names are recomputed whenever a tab is opened or closed. This function is pure — no side effects, easily testable.

### Session Sync for Tabs

Tab mutations update the server session for persistence. To avoid excessive API calls, the client batches: a single `PUT /api/session/tabs` call per user action.

```typescript
async function syncTabsToSession(store: StateStore): Promise<void> {
  const { tabs, activeTabId } = store.get();
  const activeTab = tabs.find(t => t.id === activeTabId);
  await api.updateTabs(
    tabs.map(t => t.path),
    activeTab?.path ?? null,
  );
  // Response is a SessionState — but we don't need to update client state from it
  // because the client is the source of truth for tab order during the session.
  // Session persistence is for crash recovery / refresh only.
}
```

---

## API Client Extensions: `client/api.ts`

New methods added to the `api` object:

```typescript
export const api = {
  // ... all Epic 1 methods ...

  readFile: (path: string) =>
    request<FileReadResponse>('GET', `/api/file?path=${encodeURIComponent(path)}`),

  pickFile: () =>
    request<{ path: string } | null>('POST', '/api/file/pick'),

  openExternal: (path: string) =>
    request<{ ok: true }>('POST', '/api/open-external', { path }),

  setDefaultMode: (mode: string) =>
    request<SessionState>('PUT', '/api/session/default-mode', { mode }),

  updateTabs: (openTabs: string[], activeTab: string | null) =>
    request<SessionState>('PUT', '/api/session/tabs', { openTabs, activeTab }),

  // Image URLs are constructed directly in rendered HTML by the server.
  // No client API method needed — the browser fetches /api/image?path=... via <img src>.
};
```

---

## WebSocket Client: `client/utils/ws.ts`

The WebSocket client manages the persistent connection and dispatches received messages to handlers.

```typescript
export class WsClient {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, ((msg: any) => void)[]>();
  private reconnectTimer: number | null = null;

  connect(): void {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${location.host}/ws`);

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const listeners = this.handlers.get(msg.type) ?? [];
        for (const handler of listeners) {
          handler(msg);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.socket.onclose = () => {
      // Auto-reconnect after 2 seconds
      this.reconnectTimer = window.setTimeout(() => this.connect(), 2000);
    };

    this.socket.onerror = () => {
      // onclose will fire after onerror — reconnect handled there
    };
  }

  send(msg: ClientWsMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
    // If not connected, message is dropped. The client will re-watch
    // all open tabs on reconnect (see reconnect handler in app.ts).
  }

  on(type: string, handler: (msg: any) => void): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }
}
```

### Reconnect Behavior

On reconnect (after connection loss), the client re-sends `watch` for all open tabs. This handles server restarts and transient connection issues:

```typescript
// In app.ts bootstrap
wsClient.on('open', () => {
  const { tabs } = store.get();
  for (const tab of tabs) {
    wsClient.send({ type: 'watch', path: tab.path });
  }
});
```

**AC Coverage:** AC-7.1 (watch lifecycle), AC-9.3a (server unreachable — detected via WebSocket close, reconnect attempted).

---

## Tab Strip: `client/components/tab-strip.ts`

The tab strip transitions from Epic 1's empty state to active tab management. When no tabs are open, it shows "No documents open" (Epic 1 behavior). When tabs exist, it shows the tab bar with full interaction.

### Structure (active state)

```
#tab-strip
├── .tab-strip__scroll-container
│   ├── .tab[data-tab-id="..."].tab--active
│   │   ├── .tab__label  "architecture.md"
│   │   └── .tab__close  ✕ (always visible on active tab)
│   ├── .tab[data-tab-id="..."]
│   │   ├── .tab__label  "readme.md"
│   │   └── .tab__close  ✕ (visible on hover)
│   ├── .tab.tab--loading[data-tab-id="..."]
│   │   ├── .tab__label  "notes.md"
│   │   └── .tab__spinner
│   └── ...
├── .tab-strip__overflow-left (gradient shadow, visible when scrolled)
├── .tab-strip__overflow-right (gradient shadow, visible when more tabs)
└── .tab-strip__count  "12 tabs" (visible when overflowing)
```

### Tab Behavior

**Open (AC-4.1):** New tabs appear at the right end of the strip and become active. Tab label shows the filename (or disambiguated path for duplicates). The loading tab shows a spinner until the file read completes.

**Switch (AC-4.2):** Click an inactive tab to switch. The outgoing tab's `scrollPosition` is saved. The incoming tab's content is displayed and scroll position restored. Menu bar status updates to the new file's path. Content toolbar warnings update.

**Close (AC-4.3):** Close button visible on hover for inactive tabs, always visible on active tab. Closing the active tab activates the adjacent tab (prefer right, fall back to left). Closing the last tab returns to empty state and hides the content toolbar.

**Scroll position preservation (TC-4.2b):** When switching away from a tab, the current `scrollTop` of the content area is saved to `TabState.scrollPosition`. When switching back, the content area is rendered and the saved `scrollTop` is restored. The restore happens after a `requestAnimationFrame` to ensure the DOM has been painted.

```typescript
// Save scroll position before switching
function saveScrollPosition(store: StateStore): void {
  const { activeTabId, tabs } = store.get();
  if (!activeTabId) return;
  const scrollTop = document.querySelector('.content-area__body')?.scrollTop ?? 0;
  const updatedTabs = tabs.map(t =>
    t.id === activeTabId ? { ...t, scrollPosition: scrollTop } : t
  );
  store.update({ tabs: updatedTabs }, ['tabs']);
}

// Restore scroll position after switching
function restoreScrollPosition(scrollPosition: number): void {
  requestAnimationFrame(() => {
    const body = document.querySelector('.content-area__body');
    if (body) body.scrollTop = scrollPosition;
  });
}
```

### Tab Overflow (AC-4.4)

When tabs exceed the available width, the strip scrolls horizontally. CSS handles the scrolling; visual indicators (gradient shadows) show when off-screen tabs exist:

```css
.tab-strip__scroll-container {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  /* Hide scrollbar — scroll via buttons or mouse wheel */
  scrollbar-width: none;
}
.tab-strip__scroll-container::-webkit-scrollbar {
  display: none;
}
```

When the active tab is off-screen (e.g., after keyboard shortcut navigation), the strip scrolls to bring it into view:

```typescript
function ensureActiveTabVisible(tabId: string): void {
  const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
  tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}
```

**Tab count indicator (TC-4.4c):** When tabs overflow, a small count shows total open tabs (e.g., "12 tabs"). Positioned at the right edge of the tab strip.

### Tab Context Menu (AC-4.3d)

Right-clicking a tab opens a context menu with:

| Item | Action | When |
|------|--------|------|
| Close | Close this tab | Always |
| Close Others | Close all tabs except this one | 2+ tabs open |
| Close Tabs to the Right | Close tabs to the right of this one | Tabs exist to the right |
| Copy Path | Copy this tab's file path to clipboard | Always |

The tab context menu reuses the same positioning and close behavior as the file tree context menu from Epic 1 (click outside closes, Escape closes, action fires + closes).

**AC Coverage:** AC-4.1–4.5 (all tab ACs).

---

## Content Area: `client/components/content-area.ts`

The content area transitions from Epic 1's empty state to displaying rendered HTML from the server.

### Structure (with document open)

```
#content-area
├── .content-toolbar (NEW — see Content Toolbar section)
└── .content-area__body
    └── .markdown-body
        ├── <h1 id="heading">...</h1>
        ├── <p>...</p>
        ├── <img src="/api/image?path=...">
        ├── <div class="image-placeholder" data-type="missing">...</div>
        ├── <table>...</table>
        ├── <pre><code class="language-typescript">...</code></pre>
        ├── <div class="mermaid-placeholder">...</div>
        └── ...
```

### Rendering Flow

When a tab becomes active (or is first opened), the content area displays its rendered HTML:

```typescript
render(state: ClientState): void {
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);

  if (!activeTab) {
    // No tabs open — show Epic 1 empty state
    this.renderEmptyState(state);
    return;
  }

  if (activeTab.loading) {
    // Tab is loading — show loading indicator
    this.renderLoading(activeTab);
    return;
  }

  if (activeTab.status === 'deleted') {
    // File was deleted — show deleted state with last-known content
    this.renderDeletedState(activeTab);
    return;
  }

  if (activeTab.status === 'error') {
    // Error state
    this.renderError(activeTab);
    return;
  }

  // Normal rendering — inject server-provided HTML
  const body = this.el.querySelector('.content-area__body')!;
  const markdownBody = body.querySelector('.markdown-body')!;
  markdownBody.innerHTML = activeTab.html;

  // Attach link click handler to the rendered content
  linkHandler.attach(markdownBody, state);
}
```

The `.markdown-body` container wraps server-rendered HTML. CSS in `markdown-body.css` styles all semantic HTML elements using theme variables. The server-produced HTML contains standard elements (`<h1>`, `<p>`, `<table>`, `<pre>`, `<code>`, `<blockquote>`, `<img>`, `<ul>`, `<ol>`, `<li>`, `<input type="checkbox">`, `<hr>`, `<a>`, `<details>`, `<summary>`, etc.) plus custom placeholders (`.image-placeholder`, `.mermaid-placeholder`).

### Loading Indicator (AC-1.2)

While a file is being fetched, the content area shows a loading state:

```
.content-area__body
└── .content-area__loading
    ├── .spinner
    └── "Loading..."
```

The loading indicator appears immediately when a file open is triggered and disappears when `FileReadResponse` arrives. For localhost, this is typically <50ms — the indicator may flash briefly or not appear at all.

### File Deleted State (AC-7.3)

When a watched file is deleted:

```
.content-area__body
└── .content-area__deleted
    ├── .content-area__deleted-banner
    │   ├── ⚠ "File not found"
    │   └── "This file has been deleted. Content shown is the last-known version."
    └── .markdown-body  (last-known rendered HTML, visually muted)
```

The last-known content remains visible (muted/faded) so the user can still read it. If the file is recreated, the banner updates and the content reloads (TC-7.3b).

### Empty State Transition

When the last tab is closed, the content area returns to Epic 1's empty state (app name, Open File/Folder buttons, recent files). The `renderEmptyState()` method is the same as Epic 1's implementation. The recent files list is now functional — clicking an entry triggers the file open flow.

**Recent file click (AC-1.7):** When a recent file is clicked, the client calls `api.readFile(path)`. If the file doesn't exist (404), the error is shown and the entry is removed from the recent files list via `api.removeRecentFile(path)` (TC-1.7b).

**AC Coverage:** AC-1.1 (rendered content display), AC-1.2 (loading indicator), AC-1.7 (recent file click), AC-2.1–2.11 (all rendering — displayed as HTML from server), AC-7.3 (deleted file state).

---

## Content Toolbar: `client/components/content-toolbar.ts`

The content toolbar appears between the tab strip and the rendered content when at least one document is open.

### Structure

```
.content-toolbar
├── .content-toolbar__left
│   ├── .mode-toggle
│   │   ├── button.mode-toggle__render.mode-toggle--active  "Render"
│   │   └── button.mode-toggle__edit.mode-toggle--disabled   "Edit"
│   └── .default-mode-picker
│       └── button  "Opens in: Render ▾"
│           └── .dropdown (on click)
│               ├── .dropdown__item.dropdown__item--active  "✓ Render"
│               └── .dropdown__item.dropdown__item--disabled  "Edit (coming soon)"
├── .content-toolbar__right
│   ├── .export-dropdown
│   │   └── button  "Export ▾"
│   │       └── .dropdown (on click)
│   │           ├── .dropdown__item.dropdown__item--disabled  "PDF (coming soon)"
│   │           ├── .dropdown__item.dropdown__item--disabled  "DOCX (coming soon)"
│   │           └── .dropdown__item.dropdown__item--disabled  "HTML (coming soon)"
│   └── .status-area
│       └── .warning-count (visible when warnings > 0)
│           └── "⚠ 3 warnings"
```

### Visibility (AC-6.1)

The toolbar is visible when `tabs.length > 0` and hidden when no tabs are open. This is tracked by `contentToolbarVisible` in state, derived from tab count.

### Mode Toggle (AC-6.2)

Render button is visually active. Edit button is present but dimmed with `aria-disabled="true"`. Clicking Edit shows a tooltip: "Edit mode coming soon." No mode change occurs. The keyboard shortcut for mode toggle (if registered) is a no-op for Edit in this epic.

### Default Mode Picker (AC-6.3)

Dropdown shows "Render" (active, checkmarked) and "Edit" (disabled, "coming soon" indicator). Only "Render" is selectable. The selection persists to the session via `PUT /api/session/default-mode`. Epic 5 enables the Edit option.

### Export Dropdown (AC-6.4)

Dropdown shows PDF, DOCX, HTML — all disabled with "coming soon" indicators. Same visual pattern as Epic 1's disabled Export menu. Epic 4 enables these.

### Warning Count (AC-6.5)

When the active tab has `warnings.length > 0`, the status area shows a warning count (e.g., "⚠ 3 warnings"). Clicking the count opens a warning panel/popover.

**AC Coverage:** AC-6.1–6.5 (all toolbar ACs).

---

## Warning Panel: `client/components/warning-panel.ts`

A popover that lists individual rendering warnings when the user clicks the warning count.

### Structure

```
.warning-panel (positioned below warning count, floating)
├── .warning-panel__header
│   ├── "Rendering Warnings"
│   └── button.warning-panel__close  ✕
└── .warning-panel__list
    ├── .warning-panel__item
    │   ├── .warning-panel__icon  ⚠
    │   ├── .warning-panel__type  "Missing image"
    │   └── .warning-panel__detail  "./images/diagram.png"
    ├── .warning-panel__item
    │   ├── .warning-panel__icon  🔒
    │   ├── .warning-panel__type  "Remote image blocked"
    │   └── .warning-panel__detail  "https://example.com/logo.png"
    └── ...
```

Close on outside click or Escape, same as dropdown menus.

**AC Coverage:** AC-6.5b (warning count click shows details).

---

## Link Handler: `client/utils/link-handler.ts`

Handles click events on links within rendered markdown content. Classifies each link and routes to the appropriate action.

### Link Classification

```typescript
export function classifyLink(
  href: string,
  documentPath: string,
): LinkAction {
  // External link (http/https)
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return { type: 'external', url: href };
  }

  // Anchor link (starts with #)
  if (href.startsWith('#')) {
    return { type: 'anchor', id: href.slice(1) };
  }

  // Relative or absolute local path
  const resolved = href.startsWith('/')
    ? href
    : path.resolve(path.dirname(documentPath), href);

  // Split path and anchor: "./other.md#section" → path + anchor
  const [filePath, anchor] = splitPathAndAnchor(resolved);

  // Check if it's a markdown file
  const ext = path.extname(filePath).toLowerCase();
  if (MARKDOWN_EXTENSIONS.has(ext)) {
    return { type: 'markdown', path: filePath, anchor };
  }

  // Non-markdown local file
  return { type: 'local-file', path: filePath };
}

type LinkAction =
  | { type: 'external'; url: string }
  | { type: 'anchor'; id: string }
  | { type: 'markdown'; path: string; anchor?: string }
  | { type: 'local-file'; path: string };
```

### Click Handler

```typescript
export function attach(
  container: HTMLElement,
  state: ClientState,
): void {
  container.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;

    const href = target.getAttribute('href');
    if (!href) return;

    e.preventDefault(); // Prevent browser navigation for all links

    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (!activeTab) return;

    const action = classifyLink(href, activeTab.path);

    switch (action.type) {
      case 'external':
        // Open in system browser (AC-2.7a)
        window.open(action.url, '_blank', 'noopener');
        break;

      case 'anchor':
        // Scroll to heading within current document (AC-2.7b)
        const target = document.getElementById(action.id);
        target?.scrollIntoView({ behavior: 'smooth' });
        break;

      case 'markdown':
        // Open markdown file in new tab (AC-5.1a)
        openFile(action.path, action.anchor);
        break;

      case 'local-file':
        // Open with system handler (AC-5.3a)
        api.openExternal(action.path).catch(err => {
          showError(`Could not open file: ${err.message}`);
        });
        break;
    }
  });
}
```

### Broken Link Handling (AC-5.2)

When a markdown link points to a nonexistent file, the `openFile()` call receives a 404 from the server. The client shows an inline error toast: "File not found: ./path/to/missing.md". The link itself is not pre-validated during rendering — validation happens on click. This keeps the rendering pipeline simple and avoids false positives (the file might be created between render and click).

### Link with Anchor (TC-5.1b)

When a link includes an anchor (e.g., `./other.md#section-name`), the file is opened in a new tab and then the view scrolls to the target heading. The scroll happens after the content is rendered:

```typescript
async function openFile(filePath: string, anchor?: string): Promise<void> {
  // ... normal file open flow ...
  // After content renders:
  if (anchor) {
    requestAnimationFrame(() => {
      const target = document.getElementById(anchor);
      target?.scrollIntoView({ behavior: 'smooth' });
    });
  }
}
```

**AC Coverage:** AC-2.7 (link behavior), AC-5.1–5.3 (all link navigation ACs).

---

## File Path Display: `client/components/menu-bar.ts` (modification)

### Menu Bar Status Area

The menu bar's status area (right side, established in Epic 1 as empty) now shows the active document's file path.

```
.menu-bar__status
└── .file-path
    └── "...code/project-atlas/docs/architecture.md"
```

**Path display (AC-8.1a):** The full absolute path is in the `title` attribute (tooltip). The visible text is truncated from the left if it exceeds available space: `…/docs/architecture.md`. CSS handles this with `direction: rtl; text-overflow: ellipsis; text-align: left;` — a standard technique to truncate from the left while keeping left-to-right reading order.

```css
.file-path {
  direction: rtl;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  text-align: left;
  unicode-bidi: plaintext;
  max-width: 300px;
  color: var(--color-text-secondary);
  font-size: 0.85em;
}
```

**Path updates on tab switch (TC-8.1c):** The router re-renders the menu bar when `activeTabId` changes. The render function reads the active tab's path and updates the status area.

**Path cleared in empty state (TC-8.1d):** When no tabs are open (`activeTabId` is null), the status area is empty.

### Open File Activation

Epic 1 shipped the Open File icon and Cmd+O as disabled/unregistered. Epic 2 activates both:

- The Open File quick-action icon loses its `.menu-bar__icon--disabled` class and triggers `api.pickFile()` on click
- Cmd+O is registered in the keyboard manager (see Keyboard section)
- The File menu "Open File" item becomes functional

**AC Coverage:** AC-8.1 (file path display), AC-1.5 (Open File activated).

---

## Keyboard Shortcuts: `client/utils/keyboard.ts` (extensions)

### New Shortcuts (Epic 2)

| Key | Action | AC |
|-----|--------|-----|
| Cmd+O | Open File (file picker) | AC-1.5 |
| Cmd+W | Close active tab | AC-4.3b |
| Cmd+Shift+] | Next tab | AC-4.5a |
| Cmd+Shift+[ | Previous tab | AC-4.5b |

These are registered during app bootstrap, after Epic 1's shortcuts. The keyboard manager handles them identically — `document`-level `keydown` with `preventDefault()`.

**Tab navigation wrapping:** Next tab at the end wraps to the first tab. Previous tab at the beginning wraps to the last tab.

**Cmd+W with no tabs:** If no tabs are open, Cmd+W is a no-op (does not close the browser tab because `preventDefault()` is called — and browsers don't close tabs on Cmd+W in a single-tab window anyway, but we prevent it explicitly).

**AC Coverage:** AC-1.5 (Cmd+O), AC-4.3b (Cmd+W), AC-4.5 (tab navigation).

---

## Router Extensions: `client/router.ts`

The router adds subscriptions for new state fields:

```typescript
// Additions to setupRouter()

const contentToolbar = new ContentToolbar(/* mount point */);
const tabContextMenu = new TabContextMenu(/* mount point */);
const warningPanel = new WarningPanel(/* mount point */);

store.subscribe((state, changed) => {
  // ... Epic 1 subscriptions unchanged ...

  // Tab strip updates when tabs or active tab changes
  if (changed.some(c => ['tabs', 'activeTabId'].includes(c))) {
    tabStrip.render(state);
    contentArea.render(state);
    menuBar.render(state);  // For file path display
  }

  // Content toolbar updates with tab state
  if (changed.some(c => ['tabs', 'activeTabId', 'contentToolbarVisible'].includes(c))) {
    contentToolbar.render(state);
  }

  // Tab context menu
  if (changed.includes('tabContextMenu')) {
    tabContextMenu.render(state);
  }
});
```

---

## Bootstrap Extensions: `client/app.ts`

The bootstrap sequence extends to handle tab restoration and WebSocket setup:

```
Epic 1 bootstrap (unchanged):
  1. Fetch bootstrap from server (GET /api/session)
  2. Initialize client state from bootstrap
  3. Render shell components
  4. If session has a root, fetch and render file tree
  5. Register keyboard shortcuts

Epic 2 additions:
  6. Open WebSocket connection to /ws
  7. Register Cmd+O, Cmd+W, Cmd+Shift+], Cmd+Shift+[ shortcuts
  8. If session has openTabs, restore them:
     a. For each path in openTabs, call GET /api/file
     b. Create TabState for each successful response
     c. Set activeTab from session
     d. Send 'watch' for each restored tab
  9. Register WebSocket message handlers:
     a. 'file-change' → re-fetch file, update tab content
     b. 'error' → log or show notification
```

Tab restoration (step 8) is sequential — each file is fetched and added one at a time to avoid overwhelming the server. Since it's localhost, each fetch completes in <50ms, so restoring 10 tabs takes <500ms. A loading state is shown during restoration.

If a previously-open file no longer exists during restoration, its tab is silently skipped and removed from the persisted list. The user sees only the tabs that could be loaded.

---

## Markdown Body Styles: `client/styles/markdown-body.css`

This file styles all semantic HTML produced by the server's rendering pipeline. Every style references CSS custom properties from `themes.css`, ensuring all 4 themes work automatically.

### Key Styling Rules

```css
.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-text-primary);
  max-width: 900px;
  margin: 0 auto;
  padding: 2em;
}

/* Headings */
.markdown-body h1 { font-size: 2em; border-bottom: 1px solid var(--color-border); padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid var(--color-border-light); padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.25em; }
/* h4-h6 follow same pattern with decreasing sizes */

/* Code */
.markdown-body code {
  background: var(--color-bg-tertiary);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 0.9em;
}
.markdown-body pre {
  background: var(--color-bg-tertiary);
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
}
.markdown-body pre code {
  background: none;
  padding: 0;
}

/* Tables (AC-2.4) */
.markdown-body table {
  border-collapse: collapse;
  width: 100%;
  display: block;
  overflow-x: auto;  /* TC-2.4c: wide tables scroll horizontally */
}
.markdown-body th {
  background: var(--color-bg-secondary);
  font-weight: 600;
}
.markdown-body th, .markdown-body td {
  border: 1px solid var(--color-border);
  padding: 6px 13px;
}

/* Blockquotes (AC-2.6) */
.markdown-body blockquote {
  border-left: 4px solid var(--color-accent);
  padding: 0.5em 1em;
  margin-left: 0;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
}

/* Links (AC-2.7c) */
.markdown-body a {
  color: var(--color-accent);
  text-decoration: none;
  cursor: pointer;
}
.markdown-body a:hover {
  text-decoration: underline;
  color: var(--color-accent-hover);
}

/* Images (AC-3.1c, AC-3.1d) */
.markdown-body img {
  max-width: 100%;         /* Scale down to fit */
  height: auto;            /* Maintain aspect ratio */
}

/* Image placeholders */
.image-placeholder {
  background: var(--color-bg-tertiary);
  border: 1px dashed var(--color-border);
  padding: 1em;
  border-radius: 4px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin: 1em 0;
}

/* Task lists (AC-2.8) */
.markdown-body .task-list-item {
  list-style-type: none;
}
.markdown-body .task-list-item input[type="checkbox"] {
  margin-right: 0.5em;
  pointer-events: none;  /* Read-only until Epic 5 */
}

/* Mermaid placeholder (AC-2.11) */
.mermaid-placeholder {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1em;
  margin: 1em 0;
}
.mermaid-placeholder__label {
  color: var(--color-text-muted);
  font-style: italic;
  margin-bottom: 0.5em;
}

/* Horizontal rule (AC-2.2b) */
.markdown-body hr {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 2em 0;
}

/* Long lines (TC-9.2b) */
.markdown-body {
  word-wrap: break-word;
  overflow-wrap: break-word;
}
```

### Theme Compatibility (Q10)

All styles reference `var(--color-*)` variables defined in `themes.css`. When the theme changes (via `data-theme` attribute on `<html>`), every rendered element updates instantly — no class changes, no re-rendering needed. This is the same mechanism Epic 1 uses for chrome styling, extended to markdown content.

**AC Coverage:** AC-2.1–2.11 (visual rendering), AC-3.1c–d (image sizing), TC-2.4c (wide table scroll), TC-9.2b (long line wrapping).

---

## Content Toolbar Styles: `client/styles/content-toolbar.css`

```css
.content-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85em;
}

.mode-toggle {
  display: flex;
  gap: 2px;
  background: var(--color-bg-tertiary);
  border-radius: 4px;
  padding: 2px;
}
.mode-toggle button {
  padding: 4px 12px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
}
.mode-toggle--active {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}
.mode-toggle--disabled {
  color: var(--color-text-muted);
  cursor: default;
}

.warning-count {
  color: var(--color-warning);
  cursor: pointer;
}
.warning-count:hover {
  text-decoration: underline;
}
```

---

## Tab Strip Styles: `client/styles/tab-strip.css` (modifications)

```css
/* Epic 1: empty state styles remain */

/* Epic 2: active tab styles */
.tab {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  gap: 6px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}
.tab:hover {
  background: var(--color-bg-hover);
}
.tab--active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-accent);
}
.tab__close {
  opacity: 0;
  transition: opacity 0.1s;
  cursor: pointer;
  font-size: 0.8em;
}
.tab:hover .tab__close,
.tab--active .tab__close {
  opacity: 1;
}
.tab--loading .tab__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-text-muted);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Overflow indicators */
.tab-strip__count {
  padding: 0 8px;
  color: var(--color-text-muted);
  font-size: 0.8em;
  flex-shrink: 0;
}
```

---

## Self-Review Checklist (UI)

- [x] Client state extends cleanly from Epic 1 — no breaking changes
- [x] Tab lifecycle covers open, switch, close, loading, deleted, error states
- [x] Duplicate detection uses canonicalPath from server response
- [x] Display name disambiguation handles same-filename tabs
- [x] Tab persistence syncs openTabs + activeTab to server session
- [x] Scroll position saved on tab switch, restored after DOM paint
- [x] WebSocket client handles connect, reconnect, message dispatch
- [x] Tab strip handles overflow with scroll, gradient indicators, count
- [x] Content area transitions between empty state, loading, content, deleted
- [x] Content toolbar visible only with open tabs, disabled controls documented
- [x] Warning panel shows individual warning details
- [x] Link handler classifies: external, anchor, markdown, local-file
- [x] Broken link click shows error (not pre-validated during render)
- [x] File path display in menu bar with left-truncation CSS technique
- [x] Open File icon and Cmd+O activated (was disabled in Epic 1)
- [x] All new keyboard shortcuts documented
- [x] Markdown body styles reference CSS custom properties for theme compatibility
- [x] All CSS references var(--color-*) — no hardcoded colors
