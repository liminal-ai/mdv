# Test Plan: Epic 2 — Document Viewing and Multi-Tab Reading

**Parent:** [tech-design.md](tech-design.md)
**Companion:** [tech-design-api.md](tech-design-api.md) · [tech-design-ui.md](tech-design-ui.md)

This document maps every TC from the epic to a test, defines the mock strategy, lists test fixtures, specifies verification scripts, and breaks work into chunks with test counts.

---

## Mock Strategy

### Server Tests

Same pattern as Epic 1: test at the route handler level using Fastify's `inject()`. Mock at filesystem and child_process boundaries. The rendering pipeline (markdown-it, DOMPurify) is exercised through route handlers — NOT mocked.

| Layer | Mock? | Why |
|-------|-------|-----|
| Route handlers (`server/routes/*`) | **Test here** | Entry point |
| Services (`server/services/*`) | Don't mock | Exercised through routes |
| Render pipeline (markdown-it, DOMPurify) | **Don't mock** | In-process dependency, part of what we're testing |
| `node:fs/promises`, `node:fs` | **Mock** | External boundary — filesystem |
| `node:child_process` | **Mock** | External boundary — osascript, open |
| `fs.watch` | **Mock** | External boundary — filesystem watcher |
| Zod schemas | Don't mock | Part of validation pipeline |

### Client Tests

Same pattern as Epic 1: JSDOM + mock API client. WebSocket is a new mock boundary.

| Layer | Mock? | Why |
|-------|-------|-----|
| Components (`client/components/*`) | **Test here** | Entry point |
| State store (`client/state.ts`) | Don't mock | Exercised through components |
| API client (`client/api.ts`) | **Mock** | External boundary — server |
| WebSocket client (`client/utils/ws.ts`) | **Mock** | External boundary — WebSocket |
| `navigator.clipboard` | Mock | Browser API, not in JSDOM |
| DOM / JSDOM | Don't mock | That's what we're testing |

---

## Test Fixtures

### `tests/fixtures/markdown-samples.ts`

Sample markdown content for rendering tests. Each sample targets specific ACs.

```typescript
export const headingsMarkdown = `
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
`;

export const inlineFormattingMarkdown = `
**bold** *italic* ~~strikethrough~~ \`inline code\`
`;

export const listsMarkdown = `
- item 1
- item 2
  - nested 2a
  - nested 2b
    - deep nested

1. first
2. second
3. third
`;

export const taskListMarkdown = `
- [ ] undone task
- [x] done task
- [ ] another undone
`;

export const tableMarkdown = `
| Left | Center | Right |
|:-----|:------:|------:|
| a    |   b    |     c |
| long content | centered | right-aligned |
`;

export const wideTableMarkdown = `
| Col1 | Col2 | Col3 | Col4 | Col5 | Col6 | Col7 | Col8 | Col9 | Col10 | Col11 | Col12 |
|------|------|------|------|------|------|------|------|------|-------|-------|-------|
| data | data | data | data | data | data | data | data | data | data  | data  | data  |
`;

export const codeBlockMarkdown = `
\`\`\`typescript
const x: number = 42;
\`\`\`

    indented code block
`;

export const blockquoteMarkdown = `
> Single blockquote

> > Nested blockquote
`;

export const linksMarkdown = `
[External](https://example.com)
[Anchor](#section-heading)
[Relative MD](./other.md)
[Relative with anchor](./other.md#heading)
[Non-MD](./diagram.svg)
`;

export const imageMarkdown = `
![Local](./images/diagram.png)
![Absolute](/tmp/test/image.jpg)
![Missing](./missing.png)
![Remote](https://example.com/image.png)
![Unsupported](./file.psd)
`;

export const rawHtmlMarkdown = `
<details>
<summary>Click me</summary>
Content inside details
</details>

<kbd>Ctrl+C</kbd>
<sup>superscript</sup>
<sub>subscript</sub>
<br>
`;

export const scriptTagMarkdown = `
<script>alert('xss')</script>
Normal content after script.
`;

export const mermaidMarkdown = `
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`;

export const emptyMarkdown = '';

export const malformedMarkdown = `
**unclosed bold
*unclosed italic
\`unclosed code
| broken | table
`;

export const longLineMarkdown = 'x'.repeat(15000);

export const horizontalRuleMarkdown = `
---
***
___
`;
```

### `tests/fixtures/file-responses.ts`

```typescript
import type { FileReadResponse } from '../../src/shared/types.js';

export const basicFileResponse: FileReadResponse = {
  path: '/Users/leemoore/code/project/docs/architecture.md',
  canonicalPath: '/Users/leemoore/code/project/docs/architecture.md',
  filename: 'architecture.md',
  content: '# Architecture\n\nSome content.',
  html: '<h1 id="architecture">Architecture</h1>\n<p>Some content.</p>',
  warnings: [],
  modifiedAt: '2026-03-19T00:00:00Z',
  size: 35,
};

export const fileWithWarnings: FileReadResponse = {
  ...basicFileResponse,
  warnings: [
    { type: 'missing-image', source: './missing.png', message: 'Missing image: ./missing.png' },
    { type: 'remote-image-blocked', source: 'https://example.com/img.png', message: 'Remote image blocked' },
  ],
};

export const largeFileResponse: FileReadResponse = {
  ...basicFileResponse,
  size: 2 * 1024 * 1024, // 2MB
};

export const duplicateFilenameResponses: FileReadResponse[] = [
  { ...basicFileResponse, path: '/a/docs/architecture.md', canonicalPath: '/a/docs/architecture.md' },
  { ...basicFileResponse, path: '/b/specs/architecture.md', canonicalPath: '/b/specs/architecture.md' },
];

export const symlinkFileResponse: FileReadResponse = {
  ...basicFileResponse,
  path: '/root/docs/link.md',       // symlink path (display)
  canonicalPath: '/real/path/doc.md', // resolved path (dedup)
};

export const deletedFileState = {
  ...basicFileResponse,
  status: 'deleted' as const,
};
```

### `tests/fixtures/tab-states.ts`

```typescript
import type { TabState } from '../../src/client/state.js';

export const singleTab: TabState = {
  id: 'tab-1',
  path: '/Users/leemoore/code/docs/readme.md',
  canonicalPath: '/Users/leemoore/code/docs/readme.md',
  filename: 'readme.md',
  html: '<h1>README</h1>',
  content: '# README',
  warnings: [],
  scrollPosition: 0,
  loading: false,
  modifiedAt: '2026-03-19T00:00:00Z',
  size: 10,
  status: 'ok',
};

export const multipleTabs: TabState[] = [
  { ...singleTab, id: 'tab-1', path: '/a/readme.md', filename: 'readme.md' },
  { ...singleTab, id: 'tab-2', path: '/a/design.md', filename: 'design.md' },
  { ...singleTab, id: 'tab-3', path: '/a/notes.md', filename: 'notes.md' },
];

export const manyTabs: TabState[] = Array.from({ length: 15 }, (_, i) => ({
  ...singleTab,
  id: `tab-${i}`,
  path: `/docs/doc-${i}.md`,
  filename: `doc-${i}.md`,
}));
```

---

## TC → Test Mapping

### Server Tests

#### `tests/server/routes/file.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1a | File open returns rendered HTML | Mock fs → file content | Response has html, warnings, metadata |
| TC-1.3b | Canonical path resolves symlinks | Mock fs.realpath → different path | canonicalPath differs from path |
| TC-1.4a | File outside root opens normally | Mock fs → file at different root | 200 response with content |
| TC-1.5a | File picker returns selected path | Mock exec → stdout path | POST /api/file/pick returns { path } |
| TC-1.5b | File picker selection opens file | Mock exec → path | Path returned, usable for GET /api/file |
| TC-1.5c | File picker cancel returns null | Mock exec → exit code 1 | POST /api/file/pick returns null |
| TC-1.6a | Recent file tracked on open | — | POST /api/session/recent-files called after read |
| TC-9.1a | Permission denied returns 403 | Mock fs.stat → EACCES | Returns 403 PERMISSION_DENIED |
| TC-9.1b | File disappeared returns 404 | Mock fs.stat → ENOENT | Returns 404 FILE_NOT_FOUND |
| TC-9.2c | Binary .md file doesn't crash | Mock fs → binary buffer | Returns 200 with best-effort rendering |
| TC-9.3b | File read timeout | Mock fs.readFile → delay | Configurable timeout, returns error |
| — | **Non-TC: Non-absolute path rejected** | — | GET /api/file?path=relative returns 400 |
| — | **Non-TC: Non-markdown extension rejected** | — | GET /api/file?path=/a/b.txt returns 415 |
| — | **Non-TC: File over 5MB rejected** | Mock fs.stat → 6MB | Returns 413 FILE_TOO_LARGE |
| — | **Non-TC: File 1-5MB returns with size** | Mock fs.stat → 2MB | Response includes size for client warning |
| — | **Non-TC: Empty file renders without error** | Mock fs → '' | Returns 200 with empty html |

**Test count: 16** (11 TC-mapped + 5 non-TC)

#### `tests/server/routes/file-render.test.ts`

Tests for the rendering pipeline, exercised through the file read endpoint. markdown-it and DOMPurify run for real — not mocked.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.1a | Headings h1-h6 render correctly | Mock fs → headingsMarkdown | HTML contains h1-h6 tags with anchor IDs |
| TC-2.2a | Inline formatting renders | Mock fs → inlineFormattingMarkdown | HTML contains strong, em, del, code |
| TC-2.2b | Horizontal rules render | Mock fs → horizontalRuleMarkdown | HTML contains hr tags |
| TC-2.3a | Ordered and unordered lists render | Mock fs → listsMarkdown | HTML contains ol, ul, li elements |
| TC-2.3b | Nested lists render with indentation | Mock fs → nested listsMarkdown | Nested ul/ol within li |
| TC-2.4a | Basic table renders with headers | Mock fs → tableMarkdown | HTML contains table, thead, tbody, th, td |
| TC-2.4b | Table column alignment | Mock fs → tableMarkdown with alignment | td elements have style/align attributes |
| TC-2.5a | Fenced code block renders monospace | Mock fs → codeBlockMarkdown | HTML contains pre > code |
| TC-2.5b | Language hint preserved in class | Mock fs → typescript code block | code element has class="language-typescript" |
| TC-2.5c | Indented code block renders | Mock fs → indented code | HTML contains pre > code |
| TC-2.6a | Blockquote renders | Mock fs → blockquoteMarkdown | HTML contains blockquote |
| TC-2.6b | Nested blockquotes render | Mock fs → nested blockquote | Nested blockquote elements |
| TC-2.7c | Links are rendered as anchor tags | Mock fs → linksMarkdown | HTML contains a elements with href |
| TC-2.8a | Task list checkboxes render | Mock fs → taskListMarkdown | HTML contains input[type=checkbox] |
| TC-2.9a | Safe HTML elements render | Mock fs → rawHtmlMarkdown | HTML contains details, summary, kbd, sup, sub |
| TC-2.9b | Script tags stripped | Mock fs → scriptTagMarkdown | No script tags in HTML output |
| TC-2.10a | Empty file renders without error | Mock fs → '' | Returns 200, empty html (no crash) |
| TC-2.11a | Mermaid blocks show placeholder | Mock fs → mermaidMarkdown | HTML contains mermaid-placeholder class |
| TC-9.2a | Unclosed formatting renders gracefully | Mock fs → malformedMarkdown | Returns 200 with best-effort HTML |
| TC-9.2b | Extremely long lines don't crash | Mock fs → longLineMarkdown | Returns 200 (renderer handles gracefully) |
| — | **Non-TC: Heading anchor IDs follow GFM** | Headings with special chars | IDs are lowercase, hyphenated, deduped |
| — | **Non-TC: Slugger resets per document** | Two docs with same heading | Each gets id="heading" (not "heading-1") |
| — | **Non-TC: HTML entities escaped in code blocks** | Code with <div> | Appears as text, not rendered |

**Test count: 23** (20 TC-mapped + 3 non-TC)

#### `tests/server/routes/file-images.test.ts`

Image handling through the rendering pipeline.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | Relative image src rewritten to proxy URL | Mock fs → image exists | img src = /api/image?path={absolute} |
| TC-3.1b | Absolute image src rewritten to proxy URL | Mock fs → image exists | img src = /api/image?path={absolute} |
| TC-3.2a | Missing image replaced with placeholder | Mock fs → image doesn't exist | HTML has image-placeholder div |
| TC-3.2b | Unsupported format shows placeholder | Mock fs → .psd reference | HTML has image-placeholder, warning added |
| TC-3.2c | Missing image adds to warnings array | Mock fs → missing image | warnings array has missing-image entry |
| TC-3.3a | Remote image blocked with placeholder | Mock fs → http:// image | HTML has image-placeholder with URL |
| TC-3.3b | Remote image adds to warnings array | Mock fs → https:// image | warnings array has remote-image-blocked entry |
| — | **Non-TC: Multiple images processed correctly** | Doc with 5 images | All 5 processed, correct warnings |

**Test count: 8** (7 TC-mapped + 1 non-TC)

#### `tests/server/routes/image.test.ts`

Image proxy endpoint tests.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | Proxy serves image with correct content-type | Mock fs → .png file | Response Content-Type: image/png |
| TC-3.1b | Proxy serves absolute path image | Mock fs → file exists | 200 with image data |
| — | **Non-TC: Non-absolute path rejected** | Relative path | Returns 400 |
| — | **Non-TC: Missing image returns 404** | Mock fs → ENOENT | Returns 404 |
| — | **Non-TC: SVG served with correct type** | Mock fs → .svg file | Content-Type: image/svg+xml |

**Test count: 5** (2 TC-mapped + 3 non-TC)

#### `tests/server/routes/ws.test.ts`

WebSocket and file watching tests.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-7.1a | Watch established on subscribe | Send { type: 'watch' } | fs.watch called for path |
| TC-7.1b | Watch released on unsubscribe | Send { type: 'unwatch' } | watcher.close() called |
| TC-7.2a | File change emits notification | Trigger fs.watch 'change' event | Client receives file-change message |
| TC-7.2b | Changes are debounced | Trigger 5 rapid changes | Only 1 notification after debounce |
| TC-7.3a | File deletion sends deleted event | Trigger fs.watch 'rename', stat → ENOENT | Client receives event: 'deleted' |
| TC-7.3b | File recreation after deletion | Trigger rename → ENOENT → stat → exists | Client receives event: 'created' |
| TC-7.4a | 20 simultaneous watchers | Subscribe 20 paths | All watchers established, no errors |
| — | **Non-TC: Invalid message format** | Send garbage | Error message returned |
| — | **Non-TC: Connection close cleans up watchers** | Subscribe, then close | All watchers for that connection cleaned |
| — | **Non-TC: Atomic save detected (rename then exists)** | Trigger rename, stat → exists | Watcher re-established, change notification sent |

**Test count: 10** (7 TC-mapped + 3 non-TC)

#### `tests/server/routes/open-external.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-5.3a | Opens file with system handler | Mock exec, stat → exists | exec called with 'open' + quoted path |
| — | **Non-TC: Missing file returns 404** | Mock stat → ENOENT | Returns 404 |
| — | **Non-TC: Path with spaces handled** | Path with spaces | exec uses quoted path |

**Test count: 3** (1 TC-mapped + 2 non-TC)

#### `tests/server/routes/session-epic2.test.ts`

Session extension tests.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-6.3c | Default mode persists | Set mode, reload | GET /api/session returns mode |
| — | **Non-TC: Only 'render' accepted in Epic 2** | PUT mode='edit' | Returns 400 |
| — | **Non-TC: Tab list persists** | PUT tabs, reload | GET /api/session returns openTabs |
| — | **Non-TC: Active tab persists** | PUT activeTab, reload | GET /api/session returns activeTab |
| — | **Non-TC: Default session has new fields** | No session file | defaultOpenMode='render', openTabs=[], activeTab=null |

**Test count: 5** (1 TC-mapped + 4 non-TC)

### Client Tests

#### `tests/client/components/tab-strip.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-4.1a | Tab shows filename as label | Render with tab | Tab label matches filename |
| TC-4.1b | New tab appears at right end | Render with 5 tabs, add 6th | 6th tab at right, is active |
| TC-4.1c | Duplicate filenames disambiguated | Render with same-name tabs | Labels show parent dirs |
| TC-4.2a | Tab click switches content | Render with multiple tabs, click inactive | Active tab changes, content updates |
| TC-4.2b | Scroll position preserved on switch | Scroll tab A, switch to B, switch back to A | Tab A scroll position restored |
| TC-4.3a | Close button visible on hover/active | Render tabs | Active tab close visible, inactive on hover |
| TC-4.3b | Close tab removes it | Click close on tab | Tab removed from strip |
| TC-4.3c | Close last tab returns to empty state | Close only tab | Empty state shown, toolbar hidden |
| TC-4.3d | Tab right-click context menu | Right-click tab | Menu with Close, Close Others, Close Right, Copy Path |
| TC-4.3e | Close Others closes all except target | Select Close Others | Only right-clicked tab remains |
| TC-4.3f | Close Tabs to the Right | 5 tabs, Close Right on tab 3 | Tabs 4,5 closed; 1,2,3 remain |
| TC-4.3g | Copy Path from tab context menu | Select Copy Path | Clipboard has file path |
| TC-4.4a | Tab overflow scrolls | Render 15 tabs | Strip is scrollable |
| TC-4.4b | Active tab scrolled into view | Switch to off-screen tab | Tab scrolled into view |
| TC-4.4c | Tab count indicator shown | Render overflowing tabs | "15 tabs" indicator visible |
| TC-4.5a | Next tab shortcut | Simulate Cmd+Shift+] | Next tab activated, wraps |
| TC-4.5b | Previous tab shortcut | Simulate Cmd+Shift+[ | Previous tab activated, wraps |
| TC-1.2a | Loading indicator shown during fetch | Create tab with loading: true | Spinner visible |
| TC-1.2b | Loading clears on render | Set loading: false | Content replaces spinner |
| TC-1.3a | Duplicate file reuses tab | Open same canonicalPath twice | Existing tab activated, no new tab |

**Test count: 20** (20 TC-mapped)

#### `tests/client/components/content-area.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1a | Rendered HTML displayed in content area | Set active tab with html | .markdown-body contains HTML |
| TC-1.1b | Content toolbar appears on first document | Open first tab | contentToolbarVisible: true |
| TC-2.4c | Wide table has horizontal scroll | Render wide table HTML | table container has overflow-x: auto |
| TC-3.1c | Large image constrained to width | Render img in markdown-body | CSS max-width: 100% applied |
| TC-3.1d | Small image at natural size | Render small img | No upscaling |
| TC-7.3a | Deleted file shows last-known content | Set tab status: 'deleted' | Deleted banner + muted content visible |
| TC-1.7a | Recent file click opens file | Click recent file entry | api.readFile called |
| TC-1.7b | Missing recent file shows error | api.readFile → 404 | Error shown, entry removed |

**Test count: 8** (8 TC-mapped)

#### `tests/client/components/content-toolbar.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-6.1a | Toolbar visible with document open | Render with tab open | Toolbar visible |
| TC-6.1b | Toolbar hidden in empty state | Render with no tabs | Toolbar not visible |
| TC-6.2a | Render mode active | Render toolbar | Render button has active class |
| TC-6.2b | Edit button shows coming soon tooltip | Click Edit | Tooltip appears, no mode change |
| TC-6.3a | Default mode picker displayed | Render toolbar | "Opens in: Render" visible |
| TC-6.3b | Edit option disabled in picker | Open dropdown | Edit listed but disabled |
| TC-6.4a | Export dropdown visible | Render toolbar | "Export" button visible |
| TC-6.4b | Export options disabled | Open Export dropdown | PDF, DOCX, HTML listed but disabled |
| TC-6.5a | Warning count shown when warnings exist | Tab with 3 warnings | "⚠ 3 warnings" visible |
| TC-6.5b | Warning count click opens panel | Click warning count | Warning panel appears with details |
| TC-6.5c | No warnings hides indicator | Tab with 0 warnings | No warning indicator |
| TC-1.1c | File path in menu bar status | Tab active | Menu bar shows file path |

**Test count: 12** (12 TC-mapped)

#### `tests/client/utils/link-handler.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.7a | External link opens in browser | Click http:// link | window.open called |
| TC-2.7b | Anchor link scrolls to heading | Click #heading link | scrollIntoView called |
| TC-5.1a | Relative .md link opens in new tab | Click ./other.md link | api.readFile called with resolved path |
| TC-5.1b | Link with anchor opens file and scrolls | Click ./other.md#section | File opened + scrollIntoView |
| TC-5.1c | Already-open linked file activates tab | Link to open file | Existing tab activated |
| TC-5.2a | Broken link shows error | api.readFile → 404 | Error notification shown |
| TC-5.3a | Non-markdown link opens externally | Click ./diagram.svg | api.openExternal called |
| TC-1.4b | Relative link outside root works | Click ../../other/file.md | Resolved path used, file opens |

**Test count: 8** (8 TC-mapped)

#### `tests/client/utils/ws.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-7.2a | File change triggers content refresh | Receive file-change message | api.readFile called for path |
| TC-7.2c | Scroll position approximately preserved on reload | Reload active tab | scrollTop restored after render |
| TC-9.3a | Server disconnect detected | Mock WebSocket close | Error notification shown |
| — | **Non-TC: Reconnect after disconnect** | WebSocket close → reopen | Reconnect after 2s |
| — | **Non-TC: Re-watch tabs on reconnect** | Reconnect with open tabs | Watch sent for each tab |

**Test count: 5** (3 TC-mapped + 2 non-TC)

#### `tests/client/utils/keyboard-epic2.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.5a | Cmd+O triggers file picker | Fire keydown | api.pickFile called |
| TC-4.3b | Cmd+W closes active tab | Fire keydown with tab open | Tab closed |
| TC-4.5a | Cmd+Shift+] goes to next tab | Fire keydown | Next tab activated |
| TC-4.5b | Cmd+Shift+[ goes to previous tab | Fire keydown | Previous tab activated |
| — | **Non-TC: Cmd+W with no tabs is no-op** | Fire keydown, no tabs | No action, no error |

**Test count: 5** (4 TC-mapped + 1 non-TC)

#### `tests/client/components/menu-bar-epic2.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-8.1a | File path shown in status area | Tab active | Path text present |
| TC-8.1b | Full path on hover | Truncated path shown | title attribute has full path |
| TC-8.1c | Path updates on tab switch | Switch tabs | Status updates to new file path |
| TC-8.1d | Path cleared in empty state | Close all tabs | Status area empty |
| TC-1.5a | Open File icon functional | Click icon | api.pickFile called |
| TC-9.1b | Tree file click for deleted file | api.readFile → 404 | Error shown, tree refreshes |

**Test count: 6** (6 TC-mapped)

---

## Test Count Summary

| Test File | TC-Mapped | Non-TC | Total |
|-----------|-----------|--------|-------|
| server/routes/file.test.ts | 11 | 5 | 16 |
| server/routes/file-render.test.ts | 20 | 3 | 23 |
| server/routes/file-images.test.ts | 7 | 1 | 8 |
| server/routes/image.test.ts | 2 | 3 | 5 |
| server/routes/ws.test.ts | 7 | 3 | 10 |
| server/routes/open-external.test.ts | 1 | 2 | 3 |
| server/routes/session-epic2.test.ts | 1 | 4 | 5 |
| client/components/tab-strip.test.ts | 20 | 0 | 20 |
| client/components/content-area.test.ts | 8 | 0 | 8 |
| client/components/content-toolbar.test.ts | 12 | 0 | 12 |
| client/utils/link-handler.test.ts | 8 | 0 | 8 |
| client/utils/ws.test.ts | 3 | 2 | 5 |
| client/utils/keyboard-epic2.test.ts | 4 | 1 | 5 |
| client/components/menu-bar-epic2.test.ts | 6 | 0 | 6 |
| **Total** | **110** | **24** | **134** |

### TC Coverage Verification

| Flow | TCs in Epic | TCs Mapped | Notes |
|------|-------------|------------|-------|
| 1. Opening a Document | 17 | 17 | Split across file.test.ts, tab-strip.test.ts, content-area.test.ts |
| 2. Markdown Rendering | 21 | 21 | Primarily in file-render.test.ts |
| 3. Image Handling | 9 | 9 | Split across file-images.test.ts and image.test.ts |
| 4. Tab Behavior | 17 | 17 | Primarily in tab-strip.test.ts |
| 5. Relative Link Navigation | 6 | 6 | In link-handler.test.ts |
| 6. Content Toolbar | 12 | 12 | In content-toolbar.test.ts |
| 7. File Watching | 8 | 8 | Split across ws.test.ts (server + client) |
| 8. File Path Display | 4 | 4 | In menu-bar-epic2.test.ts |
| 9. Error Handling | 7 | 7 | Distributed across file.test.ts, content-area.test.ts, ws.test.ts |
| **Total** | **101** | **101** | All TCs covered |

---

## Verification Scripts

Epic 2 uses the same script structure as Epic 1. No changes to script definitions — the commands run against the growing test suite:

```json
{
  "scripts": {
    "red-verify": "npm run format:check && npm run lint && npm run typecheck && npm run typecheck:client",
    "verify": "npm run red-verify && npm run test",
    "green-verify": "npm run verify && npm run guard:no-test-changes",
    "verify-all": "npm run verify"
  }
}
```

The test runner (`vitest run`) discovers all test files automatically. New Epic 2 test files are picked up without config changes.

---

## Work Breakdown: Chunks

### Chunk 0: Infrastructure

**Scope:** New dependencies, types, schemas, fixtures, CSS files.

**Deliverables:**

| Deliverable | Path | Contents |
|-------------|------|----------|
| New dependencies | `app/package.json` | markdown-it, markdown-it-anchor, github-slugger, markdown-it-task-lists, isomorphic-dompurify, @fastify/websocket, @types/ws, @types/markdown-it |
| Extended schemas | `app/src/server/schemas/index.ts` | FileReadResponse, RenderWarning, WS messages, session extensions |
| Extended types | `app/src/shared/types.ts` | New type re-exports |
| Test fixtures | `app/tests/fixtures/markdown-samples.ts` | All markdown samples |
| Test fixtures | `app/tests/fixtures/file-responses.ts` | FileReadResponse mocks |
| Test fixtures | `app/tests/fixtures/tab-states.ts` | TabState mocks |
| CSS | `app/src/client/styles/markdown-body.css` | Rendered markdown styling |
| CSS | `app/src/client/styles/content-toolbar.css` | Toolbar styling |
| CSS | `app/src/client/styles/tab-strip.css` | Extended tab styles |
| HTML | `app/src/client/index.html` | Add new CSS link tags |
| Error classes | `app/src/server/utils/errors.ts` | NotMarkdownError, FileTooLargeError, etc. |

**Exit criteria:** `npm run red-verify` passes. No tests yet.

**Relevant tech design sections:** Index §Stack Additions, API §Schemas, UI §Markdown Body Styles, UI §Content Toolbar Styles.

---

### Chunk 1: Server — File Read + Render + Image Proxy

**Scope:** File read endpoint, rendering pipeline, image proxy, file picker, session extensions, error handling.
**ACs:** AC-1.4, AC-1.5, AC-2.1–2.11, AC-3.1–3.3, AC-6.3, AC-9.1–9.3
**TCs:** TC-1.1a (server part), TC-1.3b, TC-1.4a, TC-1.5a–c, TC-2.1a–TC-2.11a, TC-3.1a–TC-3.3b, TC-6.3c, TC-9.1a–b, TC-9.2a–c, TC-9.3b

**Relevant tech design sections:** API §File Service, API §Render Service, API §Image Service, API §File Routes, API §Image Route, API §Session Extensions, API §File Picker, API §Error Classes.

**Non-TC decided tests:** Non-absolute path rejected, non-markdown rejected, file over 5MB rejected, 1-5MB returns size, empty file renders, heading anchor GFM IDs, slugger reset per document, HTML entities in code, multiple images processed, non-absolute image path rejected, missing image 404, SVG content-type, invalid theme mode rejected, tab list persists, active tab persists, default session fields.

#### Skeleton

| File | Stub |
|------|------|
| `src/server/services/file.service.ts` | FileService with readFile throwing NotImplementedError |
| `src/server/services/render.service.ts` | RenderService with render throwing NotImplementedError |
| `src/server/services/image.service.ts` | ImageService with validate throwing NotImplementedError |
| `src/server/routes/file.ts` | GET /api/file, POST /api/file/pick stubs |
| `src/server/routes/image.ts` | GET /api/image stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/file.test.ts | 16 | TC-1.1a, TC-1.3b, TC-1.4a, TC-1.5a–c, TC-1.6a, TC-9.1a–b, TC-9.2c, TC-9.3b + 5 non-TC |
| tests/server/routes/file-render.test.ts | 23 | TC-2.1a–TC-2.11a, TC-9.2a–b + 3 non-TC |
| tests/server/routes/file-images.test.ts | 8 | TC-3.1a–b, TC-3.2a–c, TC-3.3a–b + 1 non-TC |
| tests/server/routes/image.test.ts | 5 | TC-3.1a–b (proxy) + 3 non-TC |
| tests/server/routes/session-epic2.test.ts | 5 | TC-6.3c + 4 non-TC |

**Red exit:** `npm run red-verify` passes. 57 new tests ERROR. Epic 1's 129 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `file.service.ts` | Full: validation chain, readFile, realpath |
| `render.service.ts` | Full: markdown-it config, image processing, DOMPurify, mermaid placeholder |
| `image.service.ts` | Full: path validation, MIME type resolution |
| `routes/file.ts` | GET /api/file with full error classification; POST /api/file/pick with osascript |
| `routes/image.ts` | GET /api/image with streaming + Content-Type |
| `routes/session.ts` | Extensions: default-mode, tabs endpoints |
| `session.service.ts` | Extensions: defaultOpenMode, openTabs, activeTab |
| `app.ts` | Register new routes |

**Green exit:** `npm run green-verify` passes. All 186 tests PASS (129 Epic 1 + 57 new).

**Running total: 186 tests**

---

### Chunk 2: Client — Tab Management + Document Display

**Scope:** Tab strip (active), content area (rendered HTML), tab state, loading indicator, dedup, recent files, keyboard shortcuts, tab persistence.
**ACs:** AC-1.1–1.3, AC-1.6–1.7, AC-4.1–4.5
**TCs:** TC-1.1a–c, TC-1.2a–b, TC-1.3a, TC-1.6a–c, TC-1.7a–b, TC-4.1a–c, TC-4.2a–b, TC-4.3a–g, TC-4.4a–c, TC-4.5a–b

**Relevant tech design sections:** UI §Client State Extensions, UI §Tab Strip, UI §Content Area, UI §Keyboard Shortcuts, UI §Bootstrap Extensions, UI §Tab Strip Styles.

**Non-TC decided tests:** Cmd+W with no tabs is no-op.

#### Skeleton

| File | Stub |
|------|------|
| `src/client/components/tab-strip.ts` | Extend with active tab rendering |
| `src/client/components/content-area.ts` | Extend with HTML display |
| `src/client/components/tab-context-menu.ts` | TabContextMenu class stub |
| `src/client/utils/ws.ts` | WsClient class stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/tab-strip.test.ts | 20 | TC-1.2a–b, TC-1.3a, TC-4.1a–c, TC-4.2a–b, TC-4.3a–g, TC-4.4a–c, TC-4.5a–b |
| tests/client/components/content-area.test.ts | 8 | TC-1.1a–b, TC-2.4c, TC-3.1c–d, TC-7.3a, TC-1.7a–b |
| tests/client/utils/keyboard-epic2.test.ts | 5 | TC-1.5a (Cmd+O), TC-4.3b (Cmd+W), TC-4.5a–b + 1 non-TC |

**Red exit:** `npm run red-verify` passes. 33 new tests ERROR. Previous 186 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `tab-strip.ts` | Full: active tabs, close, overflow, context menu, keyboard nav |
| `content-area.ts` | Full: HTML display, loading, deleted state, empty state transition |
| `tab-context-menu.ts` | Full: Close, Close Others, Close Right, Copy Path |
| `ws.ts` | Full: connect, reconnect, message dispatch |
| `state.ts` | Extensions: tabs, activeTabId, tabContextMenu |
| `api.ts` | Extensions: readFile, pickFile, updateTabs |
| `router.ts` | Wire tab strip, content area, tab context menu |
| `keyboard.ts` | Register Cmd+O, Cmd+W, Cmd+Shift+], Cmd+Shift+[ |
| `app.ts` | WebSocket setup, tab restoration from session |

**Green exit:** `npm run green-verify` passes. All 219 tests PASS.

**Running total: 219 tests**

---

### Chunk 3: Content Toolbar + File Path Display

**Scope:** Content toolbar (mode toggle, default mode picker, export dropdown, warnings), file path in menu bar, warning panel.
**ACs:** AC-6.1–6.5, AC-8.1
**TCs:** TC-6.1a–b, TC-6.2a–b, TC-6.3a–b, TC-6.4a–b, TC-6.5a–c, TC-8.1a–d, TC-1.1c

**Relevant tech design sections:** UI §Content Toolbar, UI §Warning Panel, UI §File Path Display.

**Non-TC decided tests:** None.

Can run in parallel with Chunks 4 and 5.

#### Skeleton

| File | Stub |
|------|------|
| `src/client/components/content-toolbar.ts` | ContentToolbar class stub |
| `src/client/components/warning-panel.ts` | WarningPanel class stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/content-toolbar.test.ts | 12 | TC-6.1a–b, TC-6.2a–b, TC-6.3a–b, TC-6.4a–b, TC-6.5a–c, TC-1.1c |
| tests/client/components/menu-bar-epic2.test.ts | 6 | TC-8.1a–d, TC-1.5a (icon), TC-9.1b |

**Red exit:** `npm run red-verify` passes. 18 new tests ERROR. Previous 219 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `content-toolbar.ts` | Full: mode toggle, default mode picker, export dropdown, warning count |
| `warning-panel.ts` | Full: warning list popover |
| `menu-bar.ts` | Extension: file path display, Open File activation |

**Green exit:** `npm run green-verify` passes. All 237 tests PASS.

**Running total: 237 tests**

---

### Chunk 4: Relative Link Navigation + External Opening

**Scope:** Link click handler, relative link resolution, broken link errors, external file opening.
**ACs:** AC-2.7 (link behavior), AC-5.1–5.3
**TCs:** TC-2.7a–c, TC-5.1a–c, TC-5.2a–b, TC-5.3a, TC-1.4b

**Relevant tech design sections:** UI §Link Handler, API §External Opening Route.

**Non-TC decided tests:** None.

Can run in parallel with Chunks 3 and 5.

#### Skeleton

| File | Stub |
|------|------|
| `src/client/utils/link-handler.ts` | LinkHandler with classifyLink + attach stubs |
| `src/server/routes/open-external.ts` | POST /api/open-external stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/utils/link-handler.test.ts | 8 | TC-2.7a–c, TC-5.1a–c, TC-5.2a, TC-5.3a, TC-1.4b |
| tests/server/routes/open-external.test.ts | 3 | TC-5.3a + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 11 new tests ERROR. Previous 219 tests PASS (or 237 if Chunk 3 completed first).

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `link-handler.ts` | Full: classify, external, anchor, markdown, local-file |
| `routes/open-external.ts` | Full: path validation + exec('open') |
| `api.ts` | Extension: openExternal method |

**Green exit:** `npm run green-verify` passes. All tests PASS.

**Running total: 230–248 tests** (depending on Chunk 3 ordering)

---

### Chunk 5: File Watching

**Scope:** WebSocket server handler, watch service, debounce, atomic save handling, deletion detection, connection cleanup.
**ACs:** AC-7.1–7.4
**TCs:** TC-7.1a–b, TC-7.2a–c, TC-7.3a–b, TC-7.4a

**Relevant tech design sections:** API §Watch Service, API §WebSocket Route, UI §WebSocket Client.

**Non-TC decided tests:** Invalid message format, connection close cleanup, atomic save detection.

Can run in parallel with Chunks 3 and 4.

#### Skeleton

| File | Stub |
|------|------|
| `src/server/services/watch.service.ts` | WatchService class stub |
| `src/server/routes/ws.ts` | WebSocket handler stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/ws.test.ts | 10 | TC-7.1a–b, TC-7.2a–b, TC-7.3a–b, TC-7.4a + 3 non-TC |
| tests/client/utils/ws.test.ts | 5 | TC-7.2a, TC-7.2c, TC-9.3a + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 15 new tests ERROR.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `watch.service.ts` | Full: per-file fs.watch, debounce, rename handling, cleanup |
| `routes/ws.ts` | Full: connection handler, message routing, @fastify/websocket registration |
| `ws.ts` (client) | Full: connect, reconnect, message dispatch |
| `app.ts` | Register WebSocket plugin and route, wire file-change handler |

**Green exit:** `npm run green-verify` passes. All tests PASS.

**Final total: 263 tests** (129 Epic 1 + 134 Epic 2)

---

## Chunk Dependencies

```
Chunk 0 (Infrastructure)
    │
    ▼
Chunk 1 (Server — File Read + Render + Image)
    │
    ▼
Chunk 2 (Client — Tabs + Document Display)
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Chunk 3 (Toolbar)    Chunk 4 (Links)    Chunk 5 (Watch)
```

Chunks 3, 4, and 5 can run in parallel after Chunk 2 completes.

---

## Manual Verification Checklist

After all chunks are Green:

1. [ ] `npm start` — server starts, browser opens, Epic 1 functionality intact
2. [ ] Click a markdown file in the tree — renders in content area, tab appears
3. [ ] Click another file — second tab, switch between them
4. [ ] Scroll in a document, switch tabs, switch back — scroll restored
5. [ ] Open the same file twice — existing tab activated, no duplicate
6. [ ] Right-click a tab → Close Others — only that tab remains
7. [ ] Open 15+ tabs — tab strip scrolls, count indicator shows
8. [ ] Cmd+O — file picker opens, filtered to .md/.markdown
9. [ ] Cmd+W — active tab closes
10. [ ] Cmd+Shift+] / Cmd+Shift+[ — tab navigation works, wraps
11. [ ] Check rendering: headings, bold/italic, tables, code blocks, blockquotes, task lists, links
12. [ ] Local image renders inline, correctly sized
13. [ ] Missing image shows placeholder with path
14. [ ] Remote image (http) shows blocked placeholder
15. [ ] Click an external link — opens in system browser
16. [ ] Click a relative .md link — opens in new tab
17. [ ] Click a relative .svg link — opens with system handler
18. [ ] Click an anchor link — scrolls to heading
19. [ ] Modify an open file externally — tab auto-reloads
20. [ ] Delete an open file — tab shows "file not found" with last content
21. [ ] Content toolbar: mode toggle, export dropdown (disabled), warnings
22. [ ] File path in menu bar status area, updates on tab switch
23. [ ] Refresh browser — tabs restored from session
24. [ ] Check all 4 themes: rendered content looks correct in each
25. [ ] Open a file with `<script>` tag — tag stripped, content renders
