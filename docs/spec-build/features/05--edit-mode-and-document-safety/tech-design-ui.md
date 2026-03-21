# Technical Design: Epic 5 — UI (Client)

**Parent:** [tech-design.md](tech-design.md)
**Companion:** [tech-design-api.md](tech-design-api.md) · [test-plan.md](test-plan.md)

This document covers the client-side additions for Epic 5: CodeMirror 6 integration, mode switching, dirty state tracking, conflict modal, unsaved changes modal, quit protection, insert tools, default mode picker activation, and export-with-dirty warning.

---

## Client State Extensions: `client/state.ts`

Epic 5 extends `ClientState` and `TabState` for edit mode.

### Extended TabState

```typescript
export interface TabState {
  // All Epic 2 fields (unchanged)
  id: string;
  path: string;
  canonicalPath: string;
  filename: string;
  html: string;
  content: string;          // last-saved raw markdown (from server on load or after save)
  warnings: RenderWarning[];
  scrollPosition: number;   // render mode scroll offset
  loading: boolean;
  modifiedAt: string;
  size: number;
  status: 'ok' | 'deleted' | 'error';
  errorMessage?: string;

  // Epic 5 additions
  mode: 'render' | 'edit';
  editContent: string | null;    // current editor buffer; null if never entered edit mode
  editScrollPosition: number;    // editor scroll offset (separate from render scroll)
  cursorPosition: { line: number; column: number } | null;
  dirty: boolean;                // true when editContent differs from content
  editedSinceLastSave: boolean;  // fast-path dirty flag (set on any edit, cleared on save)
}
```

### Extended ClientState

```typescript
export interface ClientState {
  // All Epic 1–4 fields (unchanged)

  // Epic 5 additions
  conflictModal: ConflictModalState | null;
  unsavedModal: UnsavedModalState | null;
  exportDirtyWarning: ExportDirtyWarningState | null;
}

export interface ConflictModalState {
  tabId: string;
  filename: string;
}

export interface UnsavedModalState {
  tabId: string;
  filename: string;
  /** What happens after the modal resolves (close tab, quit, etc.) */
  context: 'close-tab' | 'close-others' | 'close-right' | 'quit';
}

export interface ExportDirtyWarningState {
  tabId: string;
  format: 'pdf' | 'docx' | 'html';
}
```

### Initial Tab State for Edit Fields

When a new tab is created (file opened):

```typescript
const newTab: TabState = {
  // ... existing fields from Epic 2 ...
  mode: store.get().session.defaultOpenMode,  // 'render' or 'edit' (AC-7.1b)
  editContent: null,
  editScrollPosition: 0,
  cursorPosition: null,
  dirty: false,
  editedSinceLastSave: false,
};
```

If `defaultOpenMode` is `'edit'`, the tab opens directly in Edit mode (TC-7.1d). The editor is populated with the file's `content` on first render.

---

## CodeMirror Integration: `client/components/editor.ts`

This is the core new module for Epic 5. It wraps CodeMirror 6 with the project's theme system, change tracking, and cursor position reporting.

### Initialization

```typescript
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';

// basicSetup (from the codemirror meta-package) includes:
// line numbers, history (undo/redo), default keybindings, bracket matching,
// search (Cmd+F), highlight active line, and more.
// This replaces manually assembling history(), keymap.of([...]), lineNumbers(), etc.

export interface EditorOptions {
  /** Called when document content changes (any edit) */
  onContentChange: (content: string) => void;
  /** Called when cursor position changes */
  onCursorChange: (line: number, column: number) => void;
  /** Called to check if editor updates should be suppressed (during programmatic content replacement) */
  shouldSuppressUpdates: () => boolean;
}

export class Editor {
  private view: EditorView;
  private suppressUpdates = false;

  constructor(parent: HTMLElement, options: EditorOptions) {
    const state = EditorState.create({
      doc: '',
      extensions: [
        basicSetup,                    // line numbers, history, search, keybindings, bracket matching
        keymap.of([indentWithTab]),     // Tab key indents (not in basicSetup by default)
        markdown(),                     // Markdown syntax highlighting
        EditorView.lineWrapping,        // Soft line wrapping

        // Change listener — fires on every edit
        EditorView.updateListener.of((update) => {
          if (this.suppressUpdates || options.shouldSuppressUpdates()) return;

          if (update.docChanged) {
            options.onContentChange(update.state.doc.toString());
          }

          // Cursor position update (fires on cursor move, not just content change)
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          options.onCursorChange(line.number, pos - line.from + 1);
        }),

        // Theme integration via CSS custom properties
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-content': {
            fontFamily: '"SF Mono", "Fira Code", monospace',
            fontSize: '14px',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--color-bg-secondary)',
            color: 'var(--color-text-muted)',
            borderRight: '1px solid var(--color-border)',
          },
          '&.cm-focused .cm-cursor': {
            borderLeftColor: 'var(--color-text-primary)',
          },
          '.cm-activeLine': {
            backgroundColor: 'var(--color-bg-hover)',
          },
          '&.cm-focused .cm-selectionBackground, ::selection': {
            backgroundColor: 'var(--color-accent)',
            opacity: '0.2',
          },
        }),
      ],
    });

    this.view = new EditorView({ state, parent });
  }

  /** Replace entire document content (used for initial load, reload, conflict resolution) */
  setContent(content: string): void {
    this.suppressUpdates = true;
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: content },
    });
    this.suppressUpdates = false;
  }

  /** Get current document content */
  getContent(): string {
    return this.view.state.doc.toString();
  }

  /** Get scroll position (top of viewport in pixels) */
  getScrollTop(): number {
    return this.view.scrollDOM.scrollTop;
  }

  /** Set scroll position */
  setScrollTop(top: number): void {
    this.view.scrollDOM.scrollTop = top;
  }

  /** Scroll to approximate percentage of document */
  scrollToPercentage(percentage: number): void {
    const maxScroll = this.view.scrollDOM.scrollHeight - this.view.scrollDOM.clientHeight;
    this.view.scrollDOM.scrollTop = maxScroll * percentage;
  }

  /** Get current scroll percentage */
  getScrollPercentage(): number {
    const maxScroll = this.view.scrollDOM.scrollHeight - this.view.scrollDOM.clientHeight;
    if (maxScroll <= 0) return 0;
    return this.view.scrollDOM.scrollTop / maxScroll;
  }

  /** Insert text at current cursor position (for insert tools) */
  insertAtCursor(text: string): void {
    const pos = this.view.state.selection.main.head;
    this.view.dispatch({
      changes: { from: pos, insert: text },
      selection: { anchor: pos + text.length },
    });
    this.view.focus();
  }

  /** Replace selected text (for insert link with selection) */
  replaceSelection(text: string): void {
    const { from, to } = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    this.view.focus();
  }

  /** Get currently selected text */
  getSelection(): string {
    const { from, to } = this.view.state.selection.main;
    return this.view.state.doc.sliceString(from, to);
  }

  /** Focus the editor */
  focus(): void {
    this.view.focus();
  }

  /** Destroy the editor view (cleanup) */
  destroy(): void {
    this.view.destroy();
  }
}
```

The POC's `createEditor()` function (in `view.ts`) uses the same CodeMirror extensions: `history()`, `keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap])`, `markdown()`, `EditorView.lineWrapping`, `syntaxHighlighting(defaultHighlightStyle, { fallback: true })`, and `EditorView.updateListener.of(...)`. Our wrapper adds theme integration via CSS custom properties and exposes a richer API for scroll management and insert tools.

**Suppress mechanism:** `suppressUpdates` prevents the change listener from firing during programmatic content replacement (initial load, reload from disk, conflict resolution). The POC uses the same pattern — `suppressEditorListener` flag checked inside `shouldIgnoreEditorUpdates()`.

**Theme integration (AC-2.3):** CodeMirror's `EditorView.theme()` accepts CSS-in-JS objects that can reference `var(--color-*)` variables from our theme system. When the user switches themes, CSS custom properties update and the editor's colors change instantly — no editor re-initialization needed. This is the same mechanism as all other components.

**AC Coverage:** AC-2.1 (editor with syntax highlighting), AC-2.2 (standard editing operations — handled natively by CodeMirror), AC-2.3 (theme adaptation), AC-2.4 (scroll position management).

---

## Mode Switching: `client/components/content-area.ts` (modification)

### Mode Toggle Behavior

When the user switches modes, the content area transitions between rendered HTML and the CodeMirror editor.

The content area maintains a `renderGeneration` counter — an instance field incremented on every call to `showRendered()`. This counter serves as a stale-render guard: after each async gap (api.render, Mermaid post-processing), the code checks whether `this.renderGeneration` still matches the token captured at the start. If a newer render was triggered (user toggled modes again, switched tabs, or content changed), the stale result is discarded. This is stronger than checking `activeTabId` alone — it handles rapid mode toggles on the same tab.

```typescript
private renderGeneration = 0;  // incremented per showRendered() call
render(state: ClientState): void {
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  if (!activeTab) {
    this.renderEmptyState(state);
    return;
  }

  if (activeTab.mode === 'edit') {
    this.showEditor(activeTab, state);
  } else {
    this.showRendered(activeTab, state);
  }
}

private showEditor(tab: TabState, state: ClientState): void {
  // Hide rendered content, show editor
  this.markdownBody.classList.add('hidden');
  this.editorContainer.classList.remove('hidden');

  // Sync editor content (if first time entering edit, or tab switch)
  const editorContent = tab.editContent ?? tab.content;
  if (this.editor.getContent() !== editorContent) {
    this.editor.setContent(editorContent);
  }

  // Restore edit-mode scroll position
  this.editor.setScrollTop(tab.editScrollPosition);
  this.editor.focus();
}

private async showRendered(tab: TabState, state: ClientState): Promise<void> {
  // Save edit-mode scroll position before switching
  if (this.editorContainer && !this.editorContainer.classList.contains('hidden')) {
    // Save editor state before hiding
    const updatedTabs = state.tabs.map(t =>
      t.id === tab.id ? {
        ...t,
        editScrollPosition: this.editor.getScrollTop(),
        editContent: this.editor.getContent(),
      } : t
    );
    store.update({ tabs: updatedTabs }, ['tabs']);
  }

  // Hide editor, show rendered content
  this.editorContainer.classList.add('hidden');
  this.markdownBody.classList.remove('hidden');

  // Render token: prevents stale async results from overwriting fresh ones.
  // Keyed on tab ID AND incremented per render request. This handles:
  //   - User switches tabs during render (different tab ID)
  //   - User toggles Edit→Render→Edit→Render on same tab (same tab, different token)
  //   - User edits content then re-triggers render before first completes (same tab, different token)
  const renderToken = ++this.renderGeneration;

  // If tab has unsaved edits, render from edit content (TC-1.1e)
  if (tab.dirty && tab.editContent) {
    const response = await api.render({
      content: tab.editContent,
      documentPath: tab.path,
    });

    // Stale guard: if a newer render was triggered or tab changed, discard
    if (this.renderGeneration !== renderToken) return;

    this.markdownBody.innerHTML = response.html;

    // Post-process: link handler + Mermaid (same as Epic 2–3)
    linkHandler.attach(this.markdownBody, state);
    const mermaidResult = await renderMermaidBlocks(this.markdownBody);

    // Second stale guard after Mermaid async
    if (this.renderGeneration !== renderToken) return;

    // Merge warnings (replace server warnings, keep mermaid warnings)
    const serverWarnings = response.warnings;
    const allWarnings = [...serverWarnings, ...mermaidResult.warnings];
    // Update tab warnings in state
    store.update({
      tabs: store.get().tabs.map(t =>
        t.id === tab.id ? { ...t, warnings: allWarnings, html: response.html } : t
      ),
    }, ['tabs']);
  } else {
    // No edits — use cached rendered HTML (normal Epic 2 path)
    this.markdownBody.innerHTML = tab.html;
    linkHandler.attach(this.markdownBody, state);
    await renderMermaidBlocks(this.markdownBody);
  }

  // Restore render-mode scroll position
  requestAnimationFrame(() => {
    this.markdownBody.parentElement!.scrollTop = tab.scrollPosition;
  });
}
```

**TC-1.1e: Render reflects unsaved edits.** When switching to Render with dirty content, the client calls `POST /api/render` with the unsaved editor content. The server renders it (markdown-it + Shiki + image processing + DOMPurify) and returns HTML + warnings. The client displays the rendered output and post-processes Mermaid diagrams. Warnings are recomputed from the unsaved content — the user sees accurate warnings.

**TC-1.1d: Dirty state preserved across mode switch.** When switching away from Edit, the editor content and scroll position are saved to `TabState`. When switching back, they're restored. The dirty indicator remains visible in both modes.

**TC-1.1f: Mode per tab.** Each tab has its own `mode` field. Switching tabs restores the target tab's mode — if Tab A was in Edit and Tab B in Render, switching to Tab B shows rendered content, switching back to Tab A shows the editor.

**Scroll position mapping (Q3):** When switching from Render to Edit, the approximate scroll percentage is mapped: `renderScrollPercentage = scrollTop / scrollHeight`. The editor is then scrolled to the same percentage of its total height. Vice versa for Edit to Render.

**AC Coverage:** AC-1.1 (mode toggle), AC-1.2 (toolbar state per mode).

---

## Dirty State Tracking

The epic's data contract (line 617) says: "`dirty` can be derived from `editContent !== content`, but tracking it explicitly avoids recomputing on every keystroke for large files. The derivation is the source of truth; the field is a cache." This means `dirty` must accurately reflect whether content has changed — regardless of how the user got there (typing forward, undo, paste-replace, etc.).

### Hybrid Approach: Instant Flag + Debounced Truth

```typescript
let dirtyCheckTimer: ReturnType<typeof setTimeout> | null = null;
const DIRTY_CHECK_DEBOUNCE_MS = 300;

function handleContentChange(newContent: string, tab: TabState): void {
  tab.editContent = newContent;

  // Instant: set dirty immediately so the dot appears on first keystroke (O(1))
  tab.dirty = true;
  tab.editedSinceLastSave = true;
  store.update({ tabs: [...tabs] }, ['tabs']);

  // Debounced truth: 300ms after last keystroke, check if content actually differs
  if (dirtyCheckTimer) clearTimeout(dirtyCheckTimer);
  dirtyCheckTimer = setTimeout(() => {
    dirtyCheckTimer = null;
    const isDirty = tab.editContent !== tab.content;
    if (tab.dirty !== isDirty) {
      tab.dirty = isDirty;
      tab.editedSinceLastSave = isDirty;
      store.update({ tabs: [...tabs] }, ['tabs']);
    }
  }, DIRTY_CHECK_DEBOUNCE_MS);
}

function handleSaveSuccess(tab: TabState, newContent: string): void {
  // After successful save, content and editContent are equal by definition
  tab.content = newContent;
  tab.dirty = false;
  tab.editedSinceLastSave = false;
  if (dirtyCheckTimer) { clearTimeout(dirtyCheckTimer); dirtyCheckTimer = null; }
  store.update({ tabs: [...tabs] }, ['tabs']);
}
```

**Why debounced, not per-keystroke?** For files under 5MB (our hard limit from Epic 2), string comparison takes <5ms. But calling it on every keystroke adds unnecessary work during rapid typing. The 300ms debounce means:
- The dirty dot appears instantly on the first edit (no perceptible delay).
- If the user types back to saved content (forward edits, not undo), the dot clears within 300ms of the last keystroke.
- If the user undoes back to saved content, the dot clears within 300ms.
- All paths to clean state are covered — undo, manual retype, paste-replace, etc.

The POC's `computeDirty(savedMarkdown, currentMarkdown)` uses simple string equality on every change. Our debounced version is slightly more efficient but converges to the same truth.

Implementation note: the shipped code intentionally deviates here. We use per-keystroke string comparison to keep `dirty` and `editedSinceLastSave` always truthful immediately, including when the user types back to the saved state without waiting for a 300ms debounce window. For our file size limits, that comparison cost is negligible, and the stricter truthfulness is preferable to a transiently stale dirty indicator.

**AC Coverage:** AC-4.1 (tab dirty indicator), AC-4.2 (toolbar dirty indicator), AC-4.3 (per-tab dirty tracking), TC-2.2e (undo back to clean).

---

## Content Toolbar Updates: `client/components/content-toolbar.ts` (modification)

### Mode Toggle Activation

Epic 2 shipped the mode toggle with Edit disabled ("coming soon"). Epic 5 activates it.

```
.mode-toggle
├── button.mode-toggle__render  "Render"  (active when tab.mode === 'render')
└── button.mode-toggle__edit    "Edit"    (active when tab.mode === 'edit')
```

Click handler:
```typescript
function handleModeToggle(mode: 'render' | 'edit'): void {
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  if (!activeTab) return;

  store.update({
    tabs: state.tabs.map(t =>
      t.id === activeTab.id ? { ...t, mode } : t
    ),
  }, ['tabs']);
}
```

### Cursor Position Display (AC-2.1c)

When in Edit mode, the status area shows cursor position:

```
.content-toolbar__status
└── "Ln 42, Col 15"   (visible in edit mode)
    or
    "⚠ 3 warnings"   (visible in render mode)
```

The cursor position updates on every cursor move via the editor's `onCursorChange` callback.

### Dirty Indicator (AC-4.2)

A "Modified" label appears next to the mode toggle when the tab is dirty:

```
.content-toolbar__left
├── .mode-toggle (Render / Edit buttons)
├── .dirty-indicator  "● Modified"  (visible when tab.dirty === true)
└── .default-mode-picker  "Opens in: Render ▾"
```

The dirty indicator is visible in both Render and Edit modes (TC-4.2b).

### Default Mode Picker Activation (AC-7.1)

Epic 2 shipped the "Opens in" dropdown with Edit disabled. Epic 5 enables it:

```typescript
function renderDefaultModePicker(state: ClientState): void {
  const { defaultOpenMode } = state.session;

  renderItem.classList.toggle('dropdown__item--active', defaultOpenMode === 'render');
  editItem.classList.toggle('dropdown__item--active', defaultOpenMode === 'edit');
  editItem.classList.remove('dropdown__item--disabled');
  editItem.removeAttribute('aria-disabled');
}
```

Click handler calls `api.setDefaultMode(mode)` — the endpoint already exists from Epic 2 but only accepted `"render"`. Epic 5's server change updates the validation to also accept `"edit"`.

**AC Coverage:** AC-1.2 (toolbar state), AC-4.2 (dirty indicator), AC-7.1 (default mode picker).

---

## Tab Strip Updates: `client/components/tab-strip.ts` (modification)

### Dirty Dot Indicator (AC-4.1)

Tabs with unsaved changes show a dot indicator:

```
.tab[data-tab-id="..."]
├── .tab__dirty-dot  ●  (visible when tab.dirty === true)
├── .tab__label  "architecture.md"
└── .tab__close  ✕
```

The POC renders this exactly: `const dirtyDot = tab.isDirty ? '<span class="doc-tab-dirty" aria-hidden="true"></span>' : '';`

CSS:
```css
.tab__dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  flex-shrink: 0;
}
```

**AC Coverage:** AC-4.1 (tab dirty indicator).

---

## Conflict Modal: `client/components/conflict-modal.ts`

When a watched file changes on disk while the tab has unsaved edits, the conflict modal appears.

### Structure

```
.modal-overlay
└── .modal
    ├── .modal__title  "File changed externally"
    ├── .modal__message  "architecture.md has been modified by another process."
    └── .modal__actions
        ├── button  "Keep My Changes"
        ├── button  "Reload from Disk"
        └── button  "Save Copy"
```

### Integration with File Watching

The conflict modal integrates with Epic 2's WebSocket `file-change` handler. The existing handler in `ws.ts` is modified:

```typescript
// Modified file-change handler
wsClient.on('file-change', async (msg) => {
  const tab = state.tabs.find(t => t.path === msg.path);
  if (!tab) return;

  // Self-change suppression (TC-3.1d)
  if (savePending.has(msg.path)) return;

  if (tab.dirty) {
    // Tab has unsaved edits → show conflict modal (AC-6.1)
    store.update({
      conflictModal: { tabId: tab.id, filename: tab.filename },
    }, ['conflictModal']);
  } else {
    // Tab is clean → auto-reload silently (Epic 2 behavior, AC-6.2)
    const response = await api.readFile(tab.path);
    store.update({
      tabs: state.tabs.map(t =>
        t.id === tab.id ? {
          ...t,
          content: response.content,
          html: response.html,
          warnings: response.warnings,
          modifiedAt: response.modifiedAt,
          editContent: null,
        } : t
      ),
    }, ['tabs']);
  }
});
```

### Modal Actions

```typescript
async function handleConflictChoice(
  choice: 'keep' | 'reload' | 'save-copy',
  tab: TabState,
): Promise<void> {
  switch (choice) {
    case 'keep':
      // Keep local edits — dismiss modal, dirty state preserved (TC-6.1b)
      store.update({ conflictModal: null }, ['conflictModal']);
      break;

    case 'reload':
      // Reload from disk — fetch fresh content, replace editor (TC-6.1c)
      const response = await api.readFile(tab.path);
      store.update({
        conflictModal: null,
        tabs: state.tabs.map(t =>
          t.id === tab.id ? {
            ...t,
            content: response.content,
            html: response.html,
            warnings: response.warnings,
            modifiedAt: response.modifiedAt,
            editContent: response.content,
            dirty: false,
            editedSinceLastSave: false,
          } : t
        ),
      }, ['conflictModal', 'tabs']);
      break;

    case 'save-copy': {
      // Save As dialog → save edits to new path, then reload original (TC-6.1d)
      // Capture tab ID before async gaps — stale-write guard
      const conflictTabId = tab.id;
      const lastSlash = tab.path.lastIndexOf('/');
      const dir = tab.path.slice(0, lastSlash);
      const filename = tab.path.slice(lastSlash + 1);
      const result = await api.saveDialog(dir, `copy-of-${filename}`);

      if (!result) {
        // User cancelled Save As — return to conflict modal (TC-6.1e)
        return;
      }

      // Stale guard: if user switched tabs during save dialog, abort
      if (store.get().activeTabId !== conflictTabId) {
        store.update({ conflictModal: null }, ['conflictModal']);
        return;
      }

      try {
        await api.saveFile({ path: result.path, content: tab.editContent! });
      } catch {
        // Save failed — return to conflict modal (TC-6.1f)
        showError('Could not save copy. Try a different location.');
        return;
      }

      // Copy saved — now reload the original from disk
      const freshResponse = await api.readFile(tab.path);
      store.update({
        conflictModal: null,
        tabs: store.get().tabs.map(t =>
          t.id === conflictTabId ? {
            ...t,
            content: freshResponse.content,
            html: freshResponse.html,
            warnings: freshResponse.warnings,
            modifiedAt: freshResponse.modifiedAt,
            editContent: freshResponse.content,
            dirty: false,
            editedSinceLastSave: false,
          } : t
        ),
      }, ['conflictModal', 'tabs']);
      break;
  }
}
```

The POC's `handleExternalChange()` in `controller.ts` follows the same three-choice pattern: `keep-mine` → ack, `reload-disk` → reload from disk, `save-copy` → save as then reload.

**AC Coverage:** AC-6.1 (conflict modal), AC-6.2 (auto-reload for clean tabs), AC-6.3 (deletion while editing).

---

## Unsaved Changes Modal: `client/components/unsaved-modal.ts`

When closing a dirty tab or quitting with dirty tabs, the unsaved changes modal prompts the user.

### Structure

```
.modal-overlay
└── .modal
    ├── .modal__title  "Unsaved changes"
    ├── .modal__message  "You have unsaved changes in architecture.md."
    └── .modal__actions
        ├── button.button--primary  "Save and Close"
        ├── button.button--danger   "Discard Changes"
        └── button                  "Cancel"
```

### Close Tab Flow (AC-5.1)

Modified `closeTab()` function:

```typescript
async function closeTab(tabId: string): Promise<void> {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  if (tab.dirty) {
    // Show modal, wait for choice (TC-5.1a)
    const choice = await showUnsavedModal(tab);

    if (choice === 'cancel') return;                    // TC-5.1d
    if (choice === 'save') {
      const saved = await saveTab(tab);
      if (!saved) return;  // Save failed — don't close (TC-5.1b)
    }
    // choice === 'discard' falls through to close (TC-5.1c)
  }

  // Actually close the tab (remove from state, unwatch file)
  performTabClose(tabId);
}
```

The POC's `closeDocumentTab()` in `controller.ts` follows the same pattern: check dirty → show modal → save/discard/cancel → close.

### Close Others / Close Right with Dirty Tabs (AC-5.2)

For "Close Others" and "Close Tabs to the Right", iterate through the tabs to be closed. For each dirty tab, show the modal. If the user cancels at any point, stop closing.

```typescript
async function closeOtherTabs(keepTabId: string): Promise<void> {
  const tabsToClose = state.tabs.filter(t => t.id !== keepTabId);

  for (const tab of tabsToClose) {
    if (tab.dirty) {
      const choice = await showUnsavedModal(tab);
      if (choice === 'cancel') return;  // Stop closing remaining tabs (TC-5.2a)
      if (choice === 'save') {
        const saved = await saveTab(tab);
        if (!saved) return;
      }
    }
    performTabClose(tab.id);
  }
}
```

**AC Coverage:** AC-5.1 (close dirty tab), AC-5.2 (close multiple with dirty).

---

## Quit Protection: `client/app.ts` (modification)

### Browser beforeunload (AC-5.3e)

When any tab is dirty, register a `beforeunload` handler. When no tabs are dirty, remove it.

```typescript
function updateBeforeUnloadHandler(): void {
  const hasDirtyTabs = state.tabs.some(t => t.dirty);

  if (hasDirtyTabs && !beforeUnloadRegistered) {
    window.addEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadRegistered = true;
  } else if (!hasDirtyTabs && beforeUnloadRegistered) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadRegistered = false;
  }
}

function beforeUnloadHandler(e: BeforeUnloadEvent): void {
  e.preventDefault();
  // Cross-browser: some browsers require returnValue to be set,
  // others require preventDefault(). Belt-and-suspenders for safety-critical behavior.
  e.returnValue = '';
}
```

This is called whenever `tabs` state changes. The browser shows a generic "Changes you made may not be saved" dialog when the user tries to close the tab or navigate away.

**TC-5.3f:** When no tabs are dirty, the handler is removed. The browser closes without any prompt.

**AC Coverage:** AC-5.3 (quit protection — browser path).

---

## Self-Change Suppression: `client/utils/ws.ts` (modification)

When the user saves a file, the save triggers a file system change event that the watcher picks up. The `savePending` map prevents this self-originated change from showing a conflict modal or triggering a reload.

```typescript
// In ws.ts
const savePending = new Map<string, boolean>();

export function markSavePending(path: string): void {
  savePending.set(path, true);
}

export function clearSavePending(path: string): void {
  savePending.delete(path);
}

export function isSavePending(path: string): boolean {
  return savePending.has(path);
}
```

Used in the save flow:

```typescript
async function saveTab(tab: TabState): Promise<boolean> {
  markSavePending(tab.path);
  try {
    const response = await api.saveFile({
      path: tab.path,
      content: tab.editContent!,
      expectedModifiedAt: tab.modifiedAt,
    });

    // Update tab state: new modifiedAt, clear dirty
    store.update({
      tabs: state.tabs.map(t =>
        t.id === tab.id ? {
          ...t,
          content: tab.editContent!,  // savedContent = editContent now
          modifiedAt: response.modifiedAt,
          size: response.size,
          dirty: false,
          editedSinceLastSave: false,
        } : t
      ),
    }, ['tabs']);

    return true;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'CONFLICT') {
      // Stale write — show conflict modal (TC-3.1e)
      store.update({
        conflictModal: { tabId: tab.id, filename: tab.filename },
      }, ['conflictModal']);
      return false;
    }
    // Other save error — show notification (AC-3.3)
    showError(`Save failed: ${err instanceof ApiError ? err.message : 'Unknown error'}`);
    return false;
  } finally {
    // Small delay before clearing to account for watcher debounce (300ms)
    setTimeout(() => clearSavePending(tab.path), 500);
  }
}
```

The `finally` block clears the flag after 500ms — enough time for the watcher's 300ms debounce to fire and be suppressed. The extra 200ms margin accounts for timer imprecision.

**AC Coverage:** TC-3.1d (save doesn't trigger self-conflict).

---

## Insert Tools: `client/components/insert-tools.ts`

### Insert Link (AC-9.1)

Triggered by Cmd+K:

```typescript
function insertLink(editor: Editor): void {
  const selection = editor.getSelection();

  if (selection) {
    // Text selected — use as link text, prompt only for URL (TC-9.1b)
    const url = prompt('Enter URL:');
    if (!url) return;
    editor.replaceSelection(`[${selection}](${url})`);
  } else {
    // No selection — prompt for both (TC-9.1a)
    const text = prompt('Link text:');
    if (!text) return;
    const url = prompt('Enter URL:');
    if (!url) return;
    editor.insertAtCursor(`[${text}](${url})`);
  }
}
```

Note: `prompt()` is used for v1 simplicity. A custom inline dialog (popover near the cursor) would be a refinement. The POC doesn't implement insert tools — this is new.

### Insert Table (AC-9.2)

Triggered by a toolbar action (no keyboard shortcut — tables are less frequently inserted):

```typescript
function insertTable(editor: Editor): void {
  const colsStr = prompt('Number of columns:', '3');
  const rowsStr = prompt('Number of rows:', '2');
  if (!colsStr || !rowsStr) return;

  const cols = Math.max(1, Math.min(20, parseInt(colsStr, 10) || 3));
  const rows = Math.max(1, Math.min(50, parseInt(rowsStr, 10) || 2));

  const header = '| ' + Array.from({ length: cols }, (_, i) => `Header ${i + 1}`).join(' | ') + ' |';
  const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
  const bodyRows = Array.from({ length: rows }, () =>
    '| ' + Array.from({ length: cols }, () => '   ').join(' | ') + ' |'
  );

  const table = [header, separator, ...bodyRows].join('\n');
  editor.insertAtCursor('\n' + table + '\n');
}
```

**AC Coverage:** AC-9.1 (insert link), AC-9.2 (insert table).

---

## Export-with-Dirty Warning: Content Toolbar Modification

When the user initiates an export while the active tab has unsaved edits (AC-8.1):

```typescript
async function handleExportClick(format: ExportFormat): Promise<void> {
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  if (!activeTab) return;

  // Check for unsaved edits (AC-8.1)
  if (activeTab.dirty) {
    store.update({
      exportDirtyWarning: { tabId: activeTab.id, format },
    }, ['exportDirtyWarning']);
    return;
  }

  // No dirty edits — proceed with export normally (Epic 4 flow)
  await proceedWithExport(activeTab, format);
}
```

The warning modal:
```
.modal-overlay
└── .modal
    ├── .modal__title  "Unsaved changes"
    ├── .modal__message  "This file has unsaved changes. The export will use the saved version on disk, not your current edits."
    └── .modal__actions
        ├── button  "Save and Export"    → save first, then export
        ├── button  "Export Anyway"      → export from disk version
        └── button  "Cancel"
```

### Export-Dirty Warning Handlers

```typescript
async function handleExportDirtyChoice(
  choice: 'save-and-export' | 'export-anyway' | 'cancel',
): Promise<void> {
  const warning = store.get().exportDirtyWarning;
  if (!warning) return;

  const tab = state.tabs.find(t => t.id === warning.tabId);
  if (!tab) {
    store.update({ exportDirtyWarning: null }, ['exportDirtyWarning']);
    return;
  }

  switch (choice) {
    case 'save-and-export':
      // TC-8.1b: Save first, then export
      store.update({ exportDirtyWarning: null }, ['exportDirtyWarning']);
      const saved = await saveTab(tab);
      if (!saved) return; // Save failed — don't export, error already shown
      // Tab is now clean — proceed with normal Epic 4 export flow
      await proceedWithExport(tab, warning.format);
      break;

    case 'export-anyway':
      // TC-8.1c: Export from disk version, edits stay in editor
      store.update({ exportDirtyWarning: null }, ['exportDirtyWarning']);
      await proceedWithExport(tab, warning.format);
      break;

    case 'cancel':
      // Dismiss warning, no export, no save
      store.update({ exportDirtyWarning: null }, ['exportDirtyWarning']);
      break;
  }
}

// proceedWithExport is the existing Epic 4 export flow:
// save dialog → POST /api/export → progress → result notification
```

**AC Coverage:** AC-8.1 (export with unsaved edits warning), TC-8.1a (warning shown), TC-8.1b (Save and Export), TC-8.1c (Export Anyway).

---

## File Menu Updates: `client/components/menu-bar.ts` (modification)

Add Save and Save As to the File menu:

```
.menu-item[data-menu="file"]
└── .menu-item__dropdown
    ├── .menu-action  "Open File       Cmd+O"
    ├── .menu-action  "Open Folder     Cmd+Shift+O"
    ├── .menu-separator
    ├── .menu-action  "Save            Cmd+S"       ← NEW (enabled when dirty)
    ├── .menu-action  "Save As...      Cmd+Shift+S" ← NEW (always enabled with doc open)
    └── ...
```

Save is enabled only when the active tab is dirty. Save As is always enabled when a document is open (TC-8.2a, TC-8.2b).

**AC Coverage:** AC-8.2 (File menu Save and Save As).

---

## Keyboard Shortcuts: `client/utils/keyboard.ts` (extensions)

### New Shortcuts (Epic 5)

| Key | Action | AC |
|-----|--------|-----|
| Cmd+S | Save | AC-3.1 |
| Cmd+Shift+S | Save As | AC-3.2 |
| Cmd+Shift+M | Toggle Render/Edit mode | AC-1.1c |
| Cmd+K | Insert link (when in edit mode) | AC-9.1 |

Cmd+S and Cmd+Shift+S call `preventDefault()` to override the browser's native save-page behavior (A8).

Cmd+Shift+M was registered in Epic 2 as a no-op ("coming soon" tooltip). Epic 5 replaces the handler with actual mode toggling.

Cmd+K is only active in edit mode. In render mode, it's a no-op.

**AC Coverage:** AC-3.1b (Cmd+S), AC-3.2a (Cmd+Shift+S), AC-1.1c (Cmd+Shift+M), AC-9.1a (Cmd+K).

---

## Router Extensions: `client/router.ts` (modification)

Epic 5 adds subscriptions for new state-driven components:

```typescript
// Additions to setupRouter()

const conflictModal = new ConflictModal(/* mount point */);
const unsavedModal = new UnsavedModal(/* mount point */);

store.subscribe((state, changed) => {
  // ... all Epic 1–4 subscriptions unchanged ...

  // Conflict modal appears/dismisses based on state
  if (changed.includes('conflictModal')) {
    conflictModal.render(state);
  }

  // Unsaved changes modal
  if (changed.includes('unsavedModal')) {
    unsavedModal.render(state);
  }

  // Export-dirty warning modal
  if (changed.includes('exportDirtyWarning')) {
    exportDirtyWarning.render(state);
  }

  // Tab strip and content toolbar re-render on tab changes (dirty state)
  // These are already wired from Epic 2 — the existing 'tabs' subscription
  // handles dirty dot and toolbar dirty indicator automatically since
  // tab-strip and content-toolbar read tab.dirty from state.
});
```

---

## Bootstrap Extensions: `client/app.ts` (modification)

The bootstrap sequence extends for Epic 5:

```
Epic 1–4 bootstrap (unchanged):
  1. Fetch bootstrap from server (GET /api/session)
  2. Initialize client state from bootstrap
  3. Render shell components
  4. If session has a root, fetch and render file tree
  5. Register Epic 1–4 keyboard shortcuts
  6. Open WebSocket connection
  7. Restore tabs from session (openTabs + activeTab persisted since Epic 2)

Epic 5 additions:
  8. Register new keyboard shortcuts: Cmd+S, Cmd+Shift+S, Cmd+Shift+M, Cmd+K
  9. Set up beforeunload handler (registers/deregisters based on dirty tab state)
  10. Restored tabs open in defaultOpenMode (may be 'edit' if user changed the default)
```

**Tab persistence vs edit state on restart:** Tab identity (which files are open, which is active) persists across restarts — this was established in Epic 2's tech design as a deviation from Epic 2's A5. Edit state (`editContent`, `dirty`, `cursorPosition`, `editScrollPosition`) does NOT persist — all tabs restart in their default mode with fresh content from disk. Unsaved edits are lost on restart. The quit protection (`beforeunload`) is the safety net that prevents this from being silent data loss. This is consistent with Epic 5's A6: "Tab state is client-side only and does not persist across restarts" — A6 refers to edit state, not tab identity.

The `beforeunload` handler is managed reactively — it's registered when any tab becomes dirty and removed when all tabs are clean. The state subscription in step 9 calls `updateBeforeUnloadHandler()` whenever the `tabs` field changes.

---

## CSS

### `client/styles/editor.css`

```css
.editor-container {
  height: 100%;
  overflow: hidden;
}

.editor-container .cm-editor {
  height: 100%;
}

.editor-container .cm-scroller {
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 14px;
  line-height: 1.6;
}
```

### `client/styles/modal.css`

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 24px;
  max-width: 480px;
  width: 90%;
  box-shadow: var(--shadow-dropdown);
}

.modal__title {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--color-text-primary);
}

.modal__message {
  color: var(--color-text-secondary);
  margin: 0 0 20px;
  line-height: 1.5;
}

.modal__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modal__actions button {
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 0.9em;
}

.modal__actions button:hover {
  background: var(--color-bg-hover);
}

.modal__actions .button--primary {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.modal__actions .button--danger {
  color: var(--color-error);
  border-color: var(--color-error);
}
```

### Content Toolbar Additions (`client/styles/content-toolbar.css`)

```css
.dirty-indicator {
  color: var(--color-warning);
  font-size: 0.85em;
  font-weight: 500;
}

.cursor-position {
  color: var(--color-text-muted);
  font-size: 0.8em;
  font-family: "SF Mono", "Fira Code", monospace;
}
```

All styles reference `var(--color-*)` for theme compatibility.

---

## Self-Review Checklist (UI)

- [x] Client state extends cleanly from Epics 1–4 — no breaking changes
- [x] CodeMirror 6 wrapper using basicSetup (line numbers, history, search built-in)
- [x] Theme integration via CSS custom properties in EditorView.theme()
- [x] Suppress mechanism prevents change listener during programmatic updates
- [x] Mode switching: content-area toggles between rendered HTML and editor
- [x] Render-from-unsaved: POST /api/render for dirty content preview
- [x] Dirty state: instant flag (fast) + debounced 300ms string comparison (truth for all paths to clean)
- [x] Tab dirty dot indicator matching POC pattern
- [x] Content toolbar: mode toggle activated, cursor position, dirty indicator
- [x] Default mode picker: Edit option enabled, persistence via existing session endpoint
- [x] Conflict modal: Keep/Reload/Save Copy with cancel and failure edge cases
- [x] Unsaved modal: Save and Close/Discard/Cancel for single and multi-tab close
- [x] Quit protection: beforeunload when any tab dirty, removed when all clean
- [x] Self-change suppression: savePending flag with 500ms clear delay
- [x] Insert tools: Cmd+K for link, dialog for table
- [x] Export-with-dirty warning: full handlers for Save and Export / Export Anyway / Cancel
- [x] Stale async guards using renderGeneration token (not just activeTabId) — handles rapid mode toggles on same tab
- [x] Stale guard on conflict Save Copy flow
- [x] Tab persistence vs edit state semantics documented in bootstrap section
- [x] beforeunload handler sets event.returnValue for cross-browser reliability
- [x] Router wiring section documents state subscriptions for modals
- [x] Bootstrap extension section documents keyboard shortcuts and beforeunload setup
- [x] File menu: Save and Save As items with correct enabled state
- [x] New keyboard shortcuts: Cmd+S, Cmd+Shift+S, Cmd+Shift+M, Cmd+K
- [x] Modal styles use CSS custom properties for theme compatibility
- [x] All patterns validated against first-pass POC
