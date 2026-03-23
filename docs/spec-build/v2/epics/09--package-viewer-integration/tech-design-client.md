# Technical Design — Client Companion: Package Viewer Integration

This companion document details the client-side implementation for Epic 9. It covers the package-mode sidebar, mode switching, menu bar integration, stale indicator, manifest editing UI, and client-side flows. For system context, module overview, and work breakdown, see the index (`tech-design.md`).

---

## Client State Extension: `app/src/client/state.ts`

The `ClientState` interface gains a `packageState` field that tracks the client's understanding of the active package. This state is populated from the `GET /api/session` bootstrap response (which includes `activePackage`) and from `POST /api/package/open` responses.

```typescript
// Additions to state.ts

export interface PackageNavigationNode {
  displayName: string;
  filePath?: string;       // relative path within package; absent for group labels
  children: PackageNavigationNode[];
  isGroup: boolean;
}

export interface PackageMetadata {
  title?: string;
  version?: string;
  author?: string;
}

export interface PackageState {
  /** Whether a package is currently active */
  active: boolean;

  /** The sidebar mode: 'filesystem' (default), 'package', or 'fallback' */
  sidebarMode: 'filesystem' | 'package' | 'fallback';

  /** Package source path (original .mpk/.mpkz or directory) */
  sourcePath: string | null;

  /** Root directory for file operations (temp dir for extracted, source for dir-mode) */
  effectiveRoot: string | null;

  /** Package format */
  format: 'mpk' | 'mpkz' | null;

  /** Whether this is an extracted or directory-mode package */
  mode: 'extracted' | 'directory' | null;

  /** Manifest-driven navigation tree */
  navigation: PackageNavigationNode[];

  /** Package metadata from manifest frontmatter */
  metadata: PackageMetadata;

  /** Whether extracted content has been modified since opening */
  stale: boolean;

  /** Manifest status: present, missing, or unreadable */
  manifestStatus: 'present' | 'missing' | 'unreadable' | null;

  /** Parse error message when manifestStatus is 'unreadable' */
  manifestError: string | null;

  /** The manifest file path (absolute) for detecting manifest saves */
  manifestPath: string | null;

  /** Collapsed group labels (by displayName) in the package sidebar */
  collapsedGroups: Set<string>;
}

// Default package state (no package active)
export function getDefaultPackageState(): PackageState {
  return {
    active: false,
    sidebarMode: 'filesystem',
    sourcePath: null,
    effectiveRoot: null,
    format: null,
    mode: null,
    navigation: [],
    metadata: {},
    stale: false,
    manifestStatus: null,
    manifestError: null,
    manifestPath: null,
    collapsedGroups: new Set(),
  };
}
```

Add `packageState: PackageState` to the `ClientState` interface. Initialize with `getDefaultPackageState()` in the app bootstrap.

The `packageState` is separate from the existing `session` field. The `session.activePackage` persisted value drives the initial package state on bootstrap; the `packageState` in `ClientState` is the live runtime state that the UI reacts to.

---

## Sidebar Mode Architecture (Q5)

The existing `sidebar.ts` mounts the file tree, workspaces, and root line into the sidebar container. Package mode replaces the file tree with a manifest-driven navigation tree while keeping the root line (which shows the current root path).

The sidebar doesn't use two separate component instances that swap. Instead, the sidebar's **content area** (the region below the root line) is cleared and re-mounted with either the file tree or the package navigation based on `packageState.sidebarMode`. This is consistent with the vanilla JS pattern used throughout the app — mount/unmount via DOM manipulation, not framework-level component switching.

```typescript
// Modified mountSidebar() in sidebar.ts

export function mountSidebar(
  container: HTMLElement,
  store: StateStore,
  actions: SidebarActions,
): () => void {
  // Existing: workspacesHost, rootLineHost, expand/collapse buttons, file-tree

  const contentHost = createElement('div', { className: 'sidebar__content' });

  let cleanupContent: (() => void) | null = null;

  function renderSidebarContent(): void {
    if (cleanupContent) {
      cleanupContent();
      cleanupContent = null;
    }
    contentHost.innerHTML = '';

    const state = store.get();
    const mode = state.packageState.sidebarMode;

    if (mode === 'package') {
      // Mount package sidebar: header + manifest nav tree
      cleanupContent = mountPackageSidebar(contentHost, store, {
        onOpenFile: actions.onOpenFile,
        onEditManifest: actions.onEditManifest,
      });
    } else if (mode === 'fallback') {
      // Mount fallback: file tree + fallback indicator
      cleanupContent = mountFallbackSidebar(contentHost, store, {
        onOpenFile: actions.onOpenFile,
      });
    } else {
      // Mount filesystem mode: mode indicator + existing file tree
      // AC-2.2b: filesystem mode has its own indicator, visually distinct from package mode
      const fsIndicator = createElement('div', {
        className: 'sidebar__mode-indicator sidebar__mode-indicator--filesystem',
      });
      fsIndicator.textContent = 'Folder';
      contentHost.appendChild(fsIndicator);
      cleanupContent = mountFileTree(contentHost, store, actions.onOpenFile);
      // Show expand/collapse buttons
    }
  }

  // Re-render sidebar content when mode changes
  const unsubscribe = store.subscribe((state, changed) => {
    if (changed.includes('packageState')) {
      renderSidebarContent();
    }
  });

  // Initial render
  renderSidebarContent();

  return () => {
    unsubscribe();
    if (cleanupContent) cleanupContent();
  };
}
```

The `SidebarActions` interface extends with package-specific actions:

```typescript
export interface SidebarActions extends RootLineActions, Omit<WorkspacesActions, 'onToggleCollapsed'> {
  onToggleWorkspacesCollapsed: () => void;
  onOpenFile: (path: string) => void | Promise<void>;
  onEditManifest: () => void | Promise<void>;  // NEW
}
```

---

## Package Sidebar Component: `app/src/client/components/package-sidebar.ts`

The package sidebar renders when `packageState.sidebarMode === 'package'`. It contains two sections: a **package header** (metadata + indicators) and a **navigation tree** (manifest-driven).

### Package Header: `package-header.ts`

Displays package metadata and visual indicators. The header answers **Q3 (Package metadata display location)**: metadata appears in the sidebar header area, above the navigation tree.

```typescript
/**
 * Mount the package header into the sidebar.
 * Shows: title, version, author (from metadata), mode indicator, stale indicator.
 *
 * Covers: AC-2.1 (metadata display), AC-2.2 (mode indicator), AC-7.2 (stale indicator)
 */
export function mountPackageHeader(
  container: HTMLElement,
  store: StateStore,
  actions: { onEditManifest: () => void },
): () => void {
  throw new NotImplementedError('mountPackageHeader');
}
```

**Layout:**

```
┌─────────────────────────────────┐
│ 📦 Package Mode                 │  ← Mode indicator (AC-2.2)
│ My Project v1.0                 │  ← Title + version (AC-2.1)
│ by Author Name                  │  ← Author (AC-2.1)
│ [Edit Manifest]     [⚠ Stale]  │  ← Action + stale indicator
└─────────────────────────────────┘
```

**Mode indicator (AC-2.2):** A label or icon distinguishing package mode from filesystem mode. In filesystem mode, the indicator reads "Filesystem" or shows a folder icon. In package mode, it reads "Package" or shows a package icon. The indicator is always visible so the user always knows which mode they're in.

**Metadata display (AC-2.1):**
- **TC-2.1a (full metadata):** Title, version, and author all displayed
- **TC-2.1b (partial metadata):** Only present fields shown; absent fields produce no empty placeholders
- **TC-2.1c (no metadata):** Package filename used as fallback title

**Stale indicator (AC-7.2):**
- Visible when `packageState.stale === true` — a label like "Modified" or a warning icon
- Only for extracted packages (`packageState.mode === 'extracted'`)
- Not shown for directory-mode packages (TC-7.2c)

**Edit Manifest button:** Opens the manifest file in the content area (AC-6.1). Clicking dispatches the `onEditManifest` action, which opens the manifest file path in a new tab using the existing file-open flow.

### Navigation Tree

The navigation tree renders the manifest's `NavigationNode[]` as a nested list. Display names come from `NavigationNode.displayName`. Group labels (`isGroup: true`) are rendered as non-clickable headings. Linked entries (`filePath` present) are clickable — clicking dispatches `onOpenFile` with the absolute path (effectiveRoot + filePath).

```typescript
/**
 * Mount the package navigation tree.
 * Renders NavigationNode[] as a nested, collapsible list.
 *
 * Covers: AC-1.4 (click entry opens document), AC-1.5 (group labels),
 *         AC-2.3 (hierarchy preservation)
 */
export function mountPackageNavigation(
  container: HTMLElement,
  store: StateStore,
  actions: { onOpenFile: (path: string) => void },
): () => void {
  throw new NotImplementedError('mountPackageNavigation');
}
```

**Rendering rules:**
- Each `NavigationNode` becomes a `.pkg-nav__entry` div
- Group labels (`isGroup: true`): rendered with `pkg-nav__group` class, a collapse/expand toggle, and child entries indented beneath. Clicking the group label toggles collapse — it does NOT open a document (AC-1.5, TC-1.5a).
- Linked entries (`filePath` present): rendered with `pkg-nav__link` class. Clicking dispatches `onOpenFile(effectiveRoot + '/' + node.filePath)`.
- Nesting: children are rendered recursively at each level. Three levels of nesting are supported (TC-2.3c) with progressive indentation via CSS margin or padding.
- Collapse state is tracked per-group in `packageState.collapsedGroups` (a Set of group displayNames). TC-1.5b: collapsing hides children, expanding shows them.

**Tab creation (TC-1.4c):** The `onOpenFile` action triggers the existing tab-opening logic in `app.ts`. The tab's ID is the absolute file path. The tab label uses the file's `NavigationNode.displayName` rather than the filename — this means the tab strip shows the manifest's display name (e.g., "Getting Started") rather than the raw filename (`getting-started.md`). To resolve the display name, `onOpenFile(absolutePath)` computes the relative path by stripping the `effectiveRoot` prefix, then walks `packageState.navigation` recursively to find the `NavigationNode` whose `filePath` matches. If no match is found (e.g., file opened from fallback mode), the filename is used as the tab label.

```typescript
// In app.ts — resolve display name for package files:
function getPackageDisplayName(absolutePath: string): string | null {
  const state = store.get().packageState;
  if (!state.active || !state.effectiveRoot) return null;
  const relativePath = absolutePath.replace(state.effectiveRoot + '/', '');
  return findDisplayName(state.navigation, relativePath);
}

function findDisplayName(nodes: PackageNavigationNode[], filePath: string): string | null {
  for (const node of nodes) {
    if (node.filePath === filePath) return node.displayName;
    const childMatch = findDisplayName(node.children, filePath);
    if (childMatch) return childMatch;
  }
  return null;
}
```

**Missing file (TC-1.4d):** If the `/api/file` request returns 404, the content area shows an error message. This uses the existing error display logic — no new component needed.

**Rendering parity (TC-1.4e):** Files from extracted packages are read via the existing `/api/file` endpoint and rendered through the existing markdown pipeline (markdown-it + Mermaid + shiki). No special rendering path is needed — the pipeline works on any markdown content regardless of its source.

### DOM Selectors (E2E Test Targets)

| Selector | Element | Purpose |
|----------|---------|---------|
| `.pkg-header` | Div | Package header container |
| `.pkg-header__title` | Span | Package title |
| `.pkg-header__version` | Span | Package version |
| `.pkg-header__author` | Span | Package author |
| `.pkg-header__mode` | Span | Mode indicator ("Package" / "Filesystem") |
| `.pkg-header__stale` | Span | Stale indicator |
| `.pkg-header__edit-manifest` | Button | Edit manifest button |
| `.pkg-nav` | Div | Navigation tree container |
| `.pkg-nav__entry` | Div | Navigation entry (group or link) |
| `.pkg-nav__group` | Div | Group label entry |
| `.pkg-nav__link` | Div | Linked entry (clickable) |
| `.pkg-nav__link[data-path]` | Attribute | Relative file path on link entries |
| `.pkg-nav__children` | Div | Children container (for collapse/expand) |
| `.sidebar__mode-indicator` | Span | Sidebar-level mode indicator |
| `.sidebar__fallback-indicator` | Span | "No manifest" fallback indicator |

---

## Menu Bar Integration: `app/src/client/components/menu-bar.ts`

The File menu gains three new items. The existing `getMenuItems()` function for the `'file'` menu ID is extended:

```typescript
// Additions to the 'file' menu items:

function getMenuItems(menuId: MenuId, state: ClientState, actions: MenuBarActions): MenuItem[] {
  if (menuId === 'file') {
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
    const pkgState = state.packageState;
    const isExtractedWithManifest =
      pkgState.active && pkgState.mode === 'extracted' && pkgState.manifestStatus === 'present';

    return [
      { label: 'Open File', shortcut: 'Cmd+O', action: actions.onOpenFile },
      { label: 'Open Folder', shortcut: 'Cmd+Shift+O', action: actions.onBrowse },
      // NEW: Open Package
      { label: 'Open Package', action: actions.onOpenPackage },
      // Separator (represented by a disabled item with separator styling)
      { label: '---', disabled: true },
      // NEW: New Package (disabled for extracted packages with parseable manifest — AC-4.4)
      {
        label: 'New Package',
        disabled: isExtractedWithManifest,
        action: !isExtractedWithManifest ? actions.onNewPackage : undefined,
      },
      { label: '---', disabled: true },
      {
        label: 'Save',
        shortcut: 'Cmd+S',
        disabled: !activeTab?.dirty,
        action: activeTab?.dirty ? actions.onSave : undefined,
      },
      {
        label: 'Save As...',
        shortcut: 'Cmd+Shift+S',
        disabled: !activeTab,
        action: activeTab ? actions.onSaveAs : undefined,
      },
    ];
  }

  // ... existing export and view menus ...
}
```

The Export menu gains a package export item:

```typescript
// In the 'export' menu section:
if (menuId === 'export') {
  // ... existing format exports (PDF, DOCX, HTML) ...

  return [
    ...existingExportItems,
    { label: '---', disabled: true },
    // NEW: Export Package
    {
      label: 'Export Package',
      disabled: !state.session.lastRoot && !state.packageState.active,
      action: actions.onExportPackage,
    },
  ];
}
```

`MenuBarActions` interface extends:

```typescript
export interface MenuBarActions {
  // Existing:
  onOpenFile: () => void | Promise<void>;
  onBrowse: () => void | Promise<void>;
  onSave?: () => void | Promise<void>;
  onSaveAs?: () => void | Promise<void>;
  onToggleSidebar: () => void | Promise<void>;
  onSetTheme: (themeId: string) => void | Promise<void>;
  onExportFormat: (format: ExportFormat) => void | Promise<void>;
  // NEW:
  onOpenPackage: () => void | Promise<void>;
  onNewPackage: () => void | Promise<void>;
  onExportPackage: () => void | Promise<void>;
}
```

---

## Mode Switching Flow

Mode switching is the mechanism for transitioning between filesystem mode, package mode, and fallback mode. The sidebar content re-renders when `packageState.sidebarMode` changes. The transitions:

**Filesystem → Package** (AC-3.2): User opens a `.mpk`/`.mpkz` file. The client calls `POST /api/package/open`, receives the response, and updates `packageState` with the navigation tree, metadata, and mode. The sidebar re-renders with the package navigation.

**Package → Filesystem** (AC-3.1): User opens a regular folder via File → Open Folder. The client calls `PUT /api/session/root` (existing endpoint), then updates `packageState` back to the default (inactive). The sidebar re-renders with the filesystem tree. Tabs from the package are closed (TC-3.1b) because the tab paths point to the temp directory which is no longer the active root.

**Package → Package** (AC-3.3): User opens a different package. The new `POST /api/package/open` call triggers the server to clean up the previous temp directory and create a new one. The client receives the new package's data and updates `packageState`. Previous package tabs are closed.

**Package → Fallback** (AC-8.1): When `POST /api/package/open` returns with `manifestStatus: 'missing'` or `'unreadable'`, the client sets `packageState.sidebarMode = 'fallback'`. The sidebar renders a filesystem tree of the extracted content (using `GET /api/tree?root=<extractedRoot>`) with a fallback indicator.

```typescript
// In app.ts — handling package open response:

async function handlePackageOpen(response: PackageOpenResponse): Promise<void> {
  const { metadata, navigation, packageInfo } = response;

  // Close existing tabs from previous package/workspace
  closePreviousTabs(store);

  // Determine sidebar mode
  let sidebarMode: 'package' | 'fallback';
  if (packageInfo.manifestStatus === 'present') {
    sidebarMode = 'package';
  } else {
    sidebarMode = 'fallback';
  }

  // Compute manifest path (for detecting manifest saves)
  const manifestPath = packageInfo.manifestStatus === 'present'
    ? `${packageInfo.extractedRoot}/${MANIFEST_FILENAME}`
    : null;

  store.update({
    packageState: {
      active: true,
      sidebarMode,
      sourcePath: packageInfo.sourcePath,
      effectiveRoot: packageInfo.extractedRoot,
      format: packageInfo.format,
      mode: 'extracted',
      navigation,
      metadata: metadata as PackageMetadata,
      stale: false,
      manifestStatus: packageInfo.manifestStatus,
      manifestError: packageInfo.manifestError ?? null,
      manifestPath,
      collapsedGroups: new Set(),
    },
  }, ['packageState']);

  // If fallback mode, fetch the file tree for the extracted root
  if (sidebarMode === 'fallback') {
    await fetchAndDisplayTree(packageInfo.extractedRoot);
  }

  // Update session root to the extracted root
  // (so existing file/tree operations use the right base)
  store.update({
    session: {
      ...store.get().session,
      lastRoot: packageInfo.extractedRoot,
    },
  }, ['session']);
}
```

### Tab Cleanup on Mode Switch (TC-3.1b)

When switching from package mode to filesystem mode (or to a different package), tabs pointing to files in the previous temp directory are closed. The logic: iterate `store.get().tabs`, filter out any tab whose `path` starts with the previous `packageState.effectiveRoot` prefix.

```typescript
function closePreviousTabs(store: StateStore): void {
  const state = store.get();
  const prevRoot = state.packageState.effectiveRoot;
  if (!prevRoot) return;

  const remainingTabs = state.tabs.filter(
    (tab) => !tab.path.startsWith(prevRoot),
  );

  store.update({
    tabs: remainingTabs,
    activeTabId: remainingTabs.length > 0 ? remainingTabs[0].id : null,
  }, ['tabs', 'activeTabId']);
}
```

---

## Drag-and-Drop Flow (Q4)

Drag-and-drop of `.mpk`/`.mpkz` files onto the app. The implementation depends on the runtime:

**Electron:** The Electron preload bridge provides `file.path` on drop events. The client checks the file extension and routes to the package open flow:

```typescript
// In app.ts — drop handler:
document.addEventListener('drop', async (event) => {
  event.preventDefault();
  const files = event.dataTransfer?.files;
  if (!files?.length) return;

  const file = files[0];
  const filePath = (file as any).path; // Electron provides this

  if (!filePath) return; // Browser-only — path not available

  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'mpk' || ext === 'mpkz') {
    // Open as package
    const response = await apiClient.openPackage(filePath);
    await handlePackageOpen(response);
  }
  // Other file types: existing drop behavior (if any)
});
```

**Browser-only:** The `File` API doesn't expose the full filesystem path. Drag-and-drop of `.mpk`/`.mpkz` files in browser-only mode is deferred (see Deferred Items in index). The File menu and CLI argument remain the primary open methods.

TC-1.2b (dropping a non-package file): The extension check ensures only `.mpk`/`.mpkz` files trigger the package open flow. Other file types fall through to existing behavior (or are ignored if no drop handler exists).

---

## Export Flow — Save Dialog (Q9)

When the user selects File → Export Package (or equivalent), the app presents a save dialog for the output file. Format selection works by **file extension inference**:

1. The save dialog opens with a default filename derived from the package title (or source filename) with `.mpk` extension
2. The user can change the filename — if they type `.mpkz`, the export uses compression
3. The `compress` flag sent to `POST /api/package/export` is determined by whether the output path ends with `.mpkz`

This approach requires no extra UI for format selection — the file extension IS the format selector. It's consistent with how other export formats work (the user picks a filename and extension).

```typescript
// In app.ts — export package action:
async function handleExportPackage(): Promise<void> {
  const state = store.get();
  const pkgState = state.packageState;

  // Determine default filename
  const defaultName = pkgState.metadata.title
    ?? path.basename(pkgState.sourcePath ?? 'package')
    ?? 'package';
  const defaultFilename = `${defaultName}.mpk`;

  // Open save dialog
  const response = await apiClient.saveDialog({
    defaultPath: state.session.lastExportDir ?? homedir(),
    defaultFilename,
    prompt: 'Export Package',
  });

  if (!response) return; // TC-5.4a: user cancelled

  const outputPath = response.path;
  const compress = outputPath.endsWith('.mpkz');

  // Call export endpoint
  const result = await apiClient.exportPackage({
    outputPath,
    compress,
    sourceDir: pkgState.effectiveRoot ?? undefined,
  });

  // If exported to original source path, clear stale (TC-5.3b)
  if (
    pkgState.mode === 'extracted' &&
    pkgState.sourcePath &&
    outputPath === pkgState.sourcePath
  ) {
    store.update({
      packageState: { ...pkgState, stale: false },
    }, ['packageState']);
  }

  // Show success notification
  showExportSuccess(result);
}
```

---

## Manifest Re-Sync Strategy (Q2)

When the user saves the manifest file, the sidebar needs to update. The strategy is **client-initiated re-fetch on manifest save**:

1. After every successful file save (via the existing save flow in `app.ts`), check if the saved file's path matches `packageState.manifestPath`
2. If yes, call `GET /api/package/manifest` to re-fetch the parsed manifest
3. On success: update `packageState.navigation` and `packageState.metadata` — the sidebar re-renders automatically via the StateStore subscription
4. On 422 (parse error, AC-6.3): show an error notification and do NOT update the navigation — the sidebar retains its previous state
5. On empty navigation (AC-6.4): update the navigation to `[]` and show a warning notification

```typescript
// In app.ts — after successful file save:
async function onFileSaved(savedPath: string): Promise<void> {
  const pkgState = store.get().packageState;

  // Check if the saved file is the manifest
  if (pkgState.active && pkgState.manifestPath && savedPath === pkgState.manifestPath) {
    try {
      const manifest = await apiClient.getPackageManifest();
      const hasNavigation = manifest.navigation.length > 0;

      store.update({
        packageState: {
          ...pkgState,
          navigation: manifest.navigation,
          metadata: manifest.metadata as PackageMetadata,
        },
      }, ['packageState']);

      if (!hasNavigation) {
        // AC-6.4: empty navigation warning
        showWarning('Manifest has no navigation entries');
      }
    } catch (err) {
      if (isApiError(err) && err.code === 'MANIFEST_PARSE_ERROR') {
        // AC-6.3: parse error — retain previous sidebar
        showError('Manifest has syntax errors — sidebar unchanged');
      }
    }
  }

  // Stale detection: if saved file is in an extracted package
  if (
    pkgState.active &&
    pkgState.mode === 'extracted' &&
    pkgState.effectiveRoot &&
    savedPath.startsWith(pkgState.effectiveRoot) &&
    !pkgState.stale
  ) {
    // Mark stale (AC-7.2)
    store.update({
      packageState: { ...pkgState, stale: true },
    }, ['packageState']);
    // The server also marks stale via markStale() — but the client
    // updates immediately for responsive UI
  }
}
```

---

## Fallback Mode Sidebar

When a package has no manifest or an unreadable manifest, the sidebar shows the extracted files as a filesystem tree — the same view used for regular folders. The key differences from regular filesystem mode:

1. **Fallback indicator (AC-8.2):** A label appears in the sidebar header area:
   - Missing manifest: "No manifest — showing filesystem view"
   - Unreadable manifest (TC-8.2c): "Manifest could not be parsed — showing filesystem view"
2. **Package header still shows:** The mode indicator says "Package (fallback)" instead of "Package"
3. **File tree uses `extractedRoot`:** The tree is populated via `GET /api/tree?root=<extractedRoot>`, which works on the temp directory

The `mountFallbackSidebar()` function combines the mode indicator, a fallback-specific indicator, and the existing file tree:

```typescript
export function mountFallbackSidebar(
  container: HTMLElement,
  store: StateStore,
  actions: { onOpenFile: (path: string) => void },
): () => void {
  const state = store.get();

  // 1. Render mode indicator showing "Package (fallback)"
  const modeIndicator = createElement('div', {
    className: 'sidebar__mode-indicator sidebar__mode-indicator--fallback',
  });
  modeIndicator.textContent = 'Package (fallback)';

  // 2. Render fallback indicator with specific message
  const indicator = createElement('div', {
    className: 'sidebar__fallback-indicator',
  });
  if (state.packageState.manifestStatus === 'unreadable') {
    indicator.textContent = 'Manifest could not be parsed — showing filesystem view';
  } else {
    indicator.textContent = 'No manifest — showing filesystem view';
  }

  // 3. Render file tree using extractedRoot
  const treeHost = createElement('div', { className: 'sidebar__tree' });
  const cleanupTree = mountFileTree(treeHost, store, actions.onOpenFile);

  container.append(modeIndicator, indicator, treeHost);
  return () => { cleanupTree(); };
}
```

TC-8.2b (indicator not shown for regular folders): The fallback indicator only renders when `packageState.sidebarMode === 'fallback'`. Regular filesystem mode never sets this — it uses `sidebarMode === 'filesystem'`.

---

## Overwrite Confirmation (AC-4.2)

When the user selects File → New Package and a manifest already exists, the server returns 409 `MANIFEST_EXISTS`. The client shows a confirmation dialog:

```typescript
async function handleNewPackage(): Promise<void> {
  const root = store.get().session.lastRoot;
  if (!root) return;

  try {
    // First attempt without overwrite
    const response = await apiClient.createPackage({ rootDir: root });
    handlePackageCreated(response);
  } catch (err) {
    if (isApiError(err) && err.code === 'MANIFEST_EXISTS') {
      // Show confirmation
      const confirmed = await showConfirmDialog(
        'A manifest already exists. Overwrite it with a new scaffold?',
      );
      if (confirmed) {
        // Retry with overwrite
        const response = await apiClient.createPackage({ rootDir: root, overwrite: true });
        handlePackageCreated(response);
      }
      // TC-4.2b: user cancelled — no action
    }
  }
}
```

The confirmation dialog uses the existing modal infrastructure (similar to the unsaved changes modal).

---

## Package Bootstrap on App Startup

On app startup, the client checks the session's `activePackage` field:

```typescript
// In app.ts bootstrap:
async function bootstrap(): Promise<void> {
  const { session, availableThemes } = await apiClient.getSession();

  // ... existing bootstrap ...

  // Package state restoration
  if (session.activePackage) {
    const ap = session.activePackage;
    try {
      // Determine sidebar mode from persisted manifestStatus
      const isFallback = ap.manifestStatus === 'missing' || ap.manifestStatus === 'unreadable';
      let navigation: PackageNavigationNode[] = [];
      let metadata: PackageMetadata = {};
      let manifestPath: string | null = null;

      if (!isFallback) {
        // Fetch the manifest to get navigation tree
        const manifest = await apiClient.getPackageManifest();
        navigation = manifest.navigation;
        metadata = manifest.metadata as PackageMetadata;
        manifestPath = `${ap.extractedRoot}/${MANIFEST_FILENAME}`;
      }

      store.update({
        packageState: {
          active: true,
          sidebarMode: isFallback ? 'fallback' : 'package',
          sourcePath: ap.sourcePath,
          effectiveRoot: ap.extractedRoot,
          format: ap.format,
          mode: ap.mode,
          navigation,
          metadata,
          stale: ap.stale,
          manifestStatus: ap.manifestStatus,
          manifestError: null,
          manifestPath,
          collapsedGroups: new Set(),
        },
      }, ['packageState']);

      // If fallback mode, populate the file tree
      if (isFallback) {
        await fetchAndDisplayTree(ap.extractedRoot);
      }
    } catch {
      // Package couldn't be restored (temp dir cleaned up, etc.)
      // Fall back to no package
    }
  }
}
```

---

## New Package in Fallback Mode (AC-8.3)

When a package is in fallback mode (missing or unreadable manifest), the user can select File → New Package to scaffold a manifest. This re-uses the same `POST /api/package/create` endpoint but targets the `extractedRoot` directory:

```typescript
async function handleNewPackageInFallback(): Promise<void> {
  const pkgState = store.get().packageState;
  if (!pkgState.effectiveRoot) return;

  const hasExistingManifest = pkgState.manifestStatus === 'unreadable';

  if (hasExistingManifest) {
    // TC-8.3b: unreadable manifest exists — show overwrite confirmation
    const confirmed = await showConfirmDialog(
      'The existing manifest could not be parsed. Overwrite with a new scaffold?',
    );
    if (!confirmed) return;
  }

  const response = await apiClient.createPackage({
    rootDir: pkgState.effectiveRoot,
    overwrite: hasExistingManifest,
  });

  // Switch from fallback to package mode
  store.update({
    packageState: {
      ...pkgState,
      sidebarMode: 'package',
      navigation: response.navigation,
      metadata: response.metadata as PackageMetadata,
      manifestStatus: 'present',
      manifestError: null,
      manifestPath: response.manifestPath,
      stale: true, // TC-8.3a: stale indicator appears (package now differs from source)
    },
  }, ['packageState']);
}
```

---

## API Client Extensions

The existing `ApiClient` class in `app/src/client/api.ts` needs methods for the new package endpoints:

```typescript
// Additions to ApiClient:

async openPackage(filePath: string): Promise<PackageOpenResponse> {
  const response = await this.post('/api/package/open', { filePath });
  return response.json();
}

async getPackageManifest(): Promise<PackageManifestResponse> {
  const response = await this.get('/api/package/manifest');
  return response.json();
}

async createPackage(request: PackageCreateRequest): Promise<PackageCreateResponse> {
  const response = await this.post('/api/package/create', request);
  return response.json();
}

async exportPackage(request: PackageExportRequest): Promise<PackageExportResponse> {
  const response = await this.post('/api/package/export', request);
  return response.json();
}
```

These follow the existing pattern in ApiClient — simple fetch wrappers that POST/GET and return parsed JSON.
