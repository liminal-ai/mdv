# Epic 7: E2E Testing Framework — Stories

This file contains all stories for Epic 7, derived from the detailed epic and tech design. Each story is a self-contained implementation unit with full AC/TC detail and relevant technical design content.

**Source documents:**
- Epic: `epic.md`
- Tech Design: `tech-design.md`

---

<!-- ====================================================================== -->
<!-- STORY 0                                                                 -->
<!-- ====================================================================== -->

# Story 0: E2E Infrastructure Foundation

### Summary
<!-- Jira: Summary field -->

Install Playwright, configure the test runner, implement server lifecycle management, fixture creation, page helpers, and npm scripts. A smoke test proves the pipeline works end-to-end.

### Description
<!-- Jira: Description field -->

**User Profile**

**Primary User:** The developer of MD Viewer, who is also the primary product user
**Context:** Adding new capabilities to a 6-epic v1 surface and needing confidence that existing functionality stays intact across each change
**Mental Model:** "I run a command, it opens the app in a real browser, walks through the critical paths, and tells me if anything broke"
**Key Constraint:** Must coexist with the existing Vitest unit/integration suite (~70 tests) without disruption.

**Objective**

Establish the E2E testing infrastructure so that all subsequent stories (and future epics) can add tests by following established patterns. After this story, `npm run test:e2e` starts a Fastify server, opens a browser, verifies the app shell renders, and tears everything down cleanly.

**Scope**

In scope:
- `@playwright/test` installation and Chromium browser binary
- `playwright.config.ts` configuration (Chromium only, serial execution, HTML reporter)
- `globalSetup` / `globalTeardown` for server lifecycle and fixture management
- `ServerManager` class for programmatic server start/stop/restart
- Fixture workspace creation with known markdown content
- Shared state file for communicating port and paths from globalSetup to tests
- Page helpers: `setWorkspaceAndNavigate`, `openFile`, `waitForMermaid`, `enterEditMode`, `enterRenderMode`, `expandDirectory`, `getRenderedContent`
- npm scripts: `test:e2e`, `test:e2e:debug`, updated `verify-all`
- `.gitignore` updates for Playwright artifacts
- Smoke test verifying app shell renders

Out of scope:
- Feature-specific E2E tests (Stories 1–4)
- Changes to existing Vitest tests or configuration

**Dependencies**
- v1 (Epics 1–6) complete and stable
- `npm run build` produces `dist/client/` and `dist/server/`

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** The E2E test suite starts a Fastify server instance and makes it available to all tests in the suite

- **TC-1.1a: Server starts before tests run**
  - Given: The E2E test suite is invoked
  - When: The setup phase runs
  - Then: A Fastify server instance is listening on a port, and the base URL is available to all tests
- **TC-1.1b: Server stops after tests complete**
  - Given: All tests in the suite have finished
  - When: The teardown phase runs
  - Then: The Fastify server is stopped and the port is released
- **TC-1.1c: Server uses an isolated session directory**
  - Given: The E2E test suite starts
  - When: The server is configured
  - Then: The server uses a temporary session directory that does not interfere with the developer's real session data
- **TC-1.1d: Server startup handles port conflict gracefully**
  - Given: The designated port is already in use
  - When: The test suite setup runs
  - Then: The server either falls back to an available port or fails with a clear error message identifying the port conflict
  - *Note: The epic specifies "fails with clear error" as the only outcome. The actual `startServer()` implementation handles `EADDRINUSE` by falling back to port 0 (random available port), which is the preferred behavior. E2E tests use `preferredPort: 0` so this scenario does not arise in normal operation — this TC validates the infrastructure's resilience.*

**AC-1.2:** Each test gets a clean browser context to prevent state leakage between tests

- **TC-1.2a: Fresh browser context per test**
  - Given: Test A has navigated to a workspace and opened files
  - When: Test B starts
  - Then: Test B has a fresh browser context with no cookies, localStorage, or navigation state from Test A
- **TC-1.2b: Browser context is closed after each test**
  - Given: A test completes (pass or fail)
  - When: The test teardown runs
  - Then: The browser context created for that test is closed

**AC-1.3:** Test fixtures provide a workspace directory containing markdown files with known content

- **TC-1.3a: Fixture workspace exists before tests run**
  - Given: The E2E test suite is starting
  - When: The fixture setup runs
  - Then: A temporary directory exists containing markdown files with headings, code blocks, tables, Mermaid diagrams, and linked images, as well as non-markdown files (.txt, .json) for filtering verification
- **TC-1.3b: Fixture workspace is cleaned up after the suite**
  - Given: All tests have completed
  - When: Suite teardown runs
  - Then: The temporary fixture directory is removed
- **TC-1.3c: Fixture content is deterministic**
  - Given: The fixture setup creates markdown files
  - When: Tests assert against rendered content
  - Then: The file contents are identical across every test run (no random or time-dependent content)

**AC-1.4:** A `test:e2e` npm script runs the E2E suite independently of existing tests

- **TC-1.4a: Script runs Playwright tests**
  - Given: The developer runs `npm run test:e2e`
  - When: The command completes
  - Then: Only Playwright E2E tests are executed; Vitest unit/integration tests are not run
- **TC-1.4b: Existing test script is unaffected**
  - Given: The developer runs `npm run test`
  - When: The command completes
  - Then: Only Vitest tests run; Playwright E2E tests are not included
- **TC-1.4c: The verify-all script includes E2E tests**
  - Given: The developer runs `npm run verify-all`
  - When: The command completes
  - Then: Both Vitest tests and Playwright E2E tests have been executed
  - *Note: The epic specifies `npm run verify` but E2E tests are added to `verify-all` instead. During Epic 7, `verify` validates the test infrastructure code; `verify-all` is the comprehensive gate. See tech design Spec Validation for rationale.*

**AC-1.5:** When an E2E test fails, the developer receives actionable failure output including the test name, the assertion that failed, and sufficient context to diagnose the issue

- **TC-1.5a: Failure output is actionable**
  - Given: A test with an intentionally failing assertion exists
  - When: The test suite runs
  - Then: The output includes the test name, the expected vs actual values, and the file/line of the failure

**AC-2.1:** The app loads and displays the shell with sidebar, tab strip, and content area

- **TC-2.1a: Shell elements are present**
  - Given: Playwright navigates to the app URL
  - When: The page loads
  - Then: The menu bar, sidebar, tab strip, and content area are all visible in the DOM
- **TC-2.1b: Empty state is displayed**
  - Given: No workspace is selected
  - When: The page loads
  - Then: The content area shows the launch state (app name, action prompts)
  - *Note: globalSetup sets workspace root before tests. This test intercepts `GET /api/session` via `page.route()` to return `lastRoot: null`, isolating the client's empty-state rendering.*

**AC-10.1:** Shared page helpers abstract common E2E interactions

- **TC-10.1a: Workspace setup helper works**
  - Given: The test utilities module is imported
  - When: The workspace setup helper is called with a page object and directory path
  - Then: The workspace root is set and the file tree populates with entries from that directory
- **TC-10.1b: File opening helper works**
  - Given: The test utilities module is imported and a workspace is set
  - When: The file opening helper is called with a page object and a filename
  - Then: The file's tab appears and rendered content is visible in the content area
- **TC-10.1c: Async rendering wait helper works**
  - Given: The test utilities module is imported
  - When: The async rendering wait helper is called after opening a file with Mermaid content
  - Then: The helper resolves once the expected rendered elements (e.g., SVG for Mermaid) appear in the DOM
  - *Note: Helpers TC-10.1a–c are validated by their usage in Stories 1–4. They are implemented here but exercised downstream.*

**AC-10.2:** Test files follow a consistent directory and naming convention

- **TC-10.2a: Test file organization**
  - Given: The E2E test directory exists
  - When: The directory contents are listed
  - Then: Tests are organized in a dedicated e2e directory with descriptive filenames following the pattern `[feature].spec.ts`

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Key interfaces for this story:**

```typescript
// tests/utils/e2e/state.ts
export interface E2EState {
  baseURL: string;
  port: number;
  fixtureDir: string;
  sessionDir: string;
  exportDir: string;
  files: {
    kitchenSink: string;
    invalidMermaid: string;
    simple: string;
    nested: string;
  };
}
export function writeE2EState(state: E2EState): void;
export function readE2EState(): E2EState;
export function removeE2EState(): void;

// tests/utils/e2e/server-manager.ts
export interface ServerManagerState {
  app: FastifyInstance;
  baseURL: string;
  port: number;
}
export interface ServerStartOptions {
  sessionDir: string;
  preferredPort?: number;
}
export class ServerManager {
  async start(options: ServerStartOptions): Promise<ServerManagerState>;
  async stop(): Promise<void>;
  async restart(): Promise<ServerManagerState>;
  getState(): ServerManagerState;
}

// tests/utils/e2e/fixtures.ts
export interface FixtureWorkspace {
  rootPath: string;
  sessionDir: string;
  files: {
    kitchenSink: string;
    invalidMermaid: string;
    simple: string;
    nested: string;
    image: string;
    nonMarkdown: string[];
  };
  exportDir: string;
}
export async function createFixtureWorkspace(): Promise<FixtureWorkspace>;
export async function cleanupFixtures(workspace: FixtureWorkspace): Promise<void>;

// tests/utils/e2e/helpers.ts
export async function setWorkspaceAndNavigate(page: Page, baseURL: string, workspacePath: string): Promise<void>;
export async function openFile(page: Page, filename: string): Promise<void>;
export async function waitForMermaid(page: Page, timeout?: number): Promise<void>;
export async function enterEditMode(page: Page): Promise<void>;
export async function enterRenderMode(page: Page): Promise<void>;
export async function expandDirectory(page: Page, dirName: string): Promise<void>;
export async function getRenderedContent(page: Page): Promise<string>;
```

**Server lifecycle:** Uses `startServer()` from `src/server/index.ts` with `preferredPort: 0` and `openUrl: async () => {}`. Port conflict (TC-1.1d): `startServer()` already handles `EADDRINUSE` by falling back to port 0 — verify this behavior.

**npm scripts to add:**
- `"test:e2e": "npx playwright test"`
- `"test:e2e:debug": "npx playwright test --headed --timeout=0"`
- `"verify-all": "npm run verify && npm run test:e2e"` (update existing)

**Files to create/modify:** `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/global-teardown.ts`, `tests/utils/e2e/state.ts`, `tests/utils/e2e/server-manager.ts`, `tests/utils/e2e/fixtures.ts`, `tests/utils/e2e/helpers.ts`, `tests/e2e/navigation.spec.ts` (smoke test), `package.json`, `.gitignore`

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `@playwright/test` installed as devDependency
- [ ] `npx playwright install chromium` completes
- [ ] `npm run test:e2e` runs and smoke test passes
- [ ] `npm run test` still runs only Vitest tests
- [ ] `npm run verify-all` runs both Vitest and Playwright suites
- [ ] Temporary directories are created before and cleaned up after the suite
- [ ] Developer's session data is not touched during test runs
- [ ] All page helpers implemented (validated by usage in Stories 1–4)
- [ ] Test files follow `tests/e2e/[feature].spec.ts` convention

---

<!-- ====================================================================== -->
<!-- STORY 1                                                                 -->
<!-- ====================================================================== -->

# Story 1: Workspace Browsing and File Opening

### Summary
<!-- Jira: Summary field -->

E2E tests that open a workspace, verify the file tree, navigate directories, open files, and verify content appears in the content area.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Verify the core entry point flow that every user session begins with: the app loads, the file tree populates with markdown files from a workspace, directories can be expanded, and clicking a file opens it with rendered content and a tab.

**Scope**

In scope:
- File tree population with workspace contents
- Markdown-only filtering (non-markdown files excluded)
- Nested directory expansion
- File opening with content rendering and tab creation

Out of scope:
- Rendering verification beyond "content appears" (Story 2)
- Tab management beyond "tab appears" (Story 3)

**Dependencies:** Story 0 (infrastructure and page helpers)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-2.2:** Selecting a workspace root populates the file tree with markdown files

- **TC-2.2a: File tree shows markdown files from the fixture workspace**
  - Given: The app is loaded
  - When: The fixture workspace path is set as the root
  - Then: The sidebar file tree shows the markdown files from the fixture directory
- **TC-2.2b: Non-markdown files are filtered out**
  - Given: The fixture workspace contains both `.md` files and non-markdown files (`.txt`, `.json`)
  - When: The file tree is populated
  - Then: Only `.md` files appear in the tree
- **TC-2.2c: Nested directories are displayed**
  - Given: The fixture workspace has subdirectories containing markdown files
  - When: The file tree is populated
  - Then: Directories appear in the tree and can be expanded to reveal their contents

**AC-2.3:** Clicking a file in the tree opens it in the content area

- **TC-2.3a: File opens and content renders**
  - Given: The file tree shows markdown files
  - When: The user clicks a file entry
  - Then: The file's rendered markdown content appears in the content area
- **TC-2.3b: A tab appears for the opened file**
  - Given: No files are open
  - When: The user clicks a file in the tree
  - Then: A tab appears in the tab strip with the file's name

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**DOM selectors used:**
- `.tree-node__row[data-path]` — file tree entries (click to open)
- `.tree-node--file` / `.tree-node--directory` — file vs directory entries
- `.tab[data-tab-id]`, `.tab__label` — tab presence and filename
- `#content-area`, `.markdown-body` — rendered content
- `#sidebar` — file tree container

**Workspace setup:** `setWorkspaceAndNavigate()` helper calls `PUT /api/session/root { root: fixturePath }` then navigates to `baseURL`. The client fetches `GET /api/session`, discovers `lastRoot`, and fetches `GET /api/tree?root=<path>` to populate the sidebar.

**Test file:** `tests/e2e/navigation.spec.ts` (extends smoke test from Story 0)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 5 TCs pass (TC-2.2a–c, TC-2.3a–b)
- [ ] File tree shows only `.md` files from fixture workspace
- [ ] Nested directories expand to reveal child markdown files
- [ ] Clicking a file renders content and creates a tab
- [ ] `npm run test:e2e` passes with all navigation tests

---

<!-- ====================================================================== -->
<!-- STORY 2                                                                 -->
<!-- ====================================================================== -->

# Story 2: Rendering and Mermaid

### Summary
<!-- Jira: Summary field -->

E2E tests that verify the full markdown rendering pipeline — headings, code blocks, tables, links, Mermaid diagrams (valid and invalid), and images.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Confirm that the rendering stack works end-to-end through a real browser. Open a "kitchen sink" fixture file containing all content types and verify each renders correctly in the DOM. Separately, verify that invalid Mermaid syntax produces an error indicator rather than an SVG.

**Scope**

In scope:
- Heading rendering at correct hierarchy levels (h1, h2, h3)
- Code blocks with syntax highlighting
- Tables with proper HTML structure
- Links as anchor elements with correct href
- Mermaid diagrams rendering as SVG
- Invalid Mermaid showing error indicator
- Images rendering from relative paths

Out of scope:
- Visual accuracy (pixel-level verification)
- Performance of rendering

**Dependencies:** Story 1 (file opening established)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** Rendered markdown displays headings at correct hierarchy levels

- **TC-3.1a: Heading elements are present**
  - Given: A markdown file with h1, h2, and h3 headings is open
  - When: The content area renders
  - Then: The DOM contains `h1`, `h2`, and `h3` elements with the correct text content

**AC-3.2:** Rendered markdown displays code blocks with syntax highlighting

- **TC-3.2a: Code block is rendered with highlighting**
  - Given: A markdown file with a fenced code block (e.g., ` ```javascript `) is open
  - When: The content area renders
  - Then: The code block is rendered inside a `pre` element, and syntax-highlighted spans are present within it

**AC-3.3:** Rendered markdown displays tables with proper structure

- **TC-3.3a: Table elements are present**
  - Given: A markdown file containing a markdown table is open
  - When: The content area renders
  - Then: A `table` element with `thead`, `tbody`, `tr`, `th`, and `td` elements is present, and cell content matches the source

**AC-3.4:** Rendered markdown displays links that are clickable

- **TC-3.4a: Links are rendered as anchor elements**
  - Given: A markdown file with inline links is open
  - When: The content area renders
  - Then: Anchor (`a`) elements are present with correct `href` attributes and link text

**AC-3.5:** Mermaid code blocks render as diagrams

- **TC-3.5a: Mermaid diagram renders as SVG**
  - Given: A markdown file with a ` ```mermaid ` code block is open
  - When: The content area finishes rendering (including async Mermaid processing)
  - Then: An SVG element is present in the DOM where the Mermaid code block was
- **TC-3.5b: Invalid Mermaid syntax shows an error indicator**
  - Given: A markdown file with an invalid Mermaid block is open
  - When: The content area finishes rendering
  - Then: An error message or fallback is displayed instead of an SVG diagram

**AC-3.6:** Rendered markdown displays images referenced in the document

- **TC-3.6a: Image renders from relative path**
  - Given: A markdown file with an image reference (relative path) is open
  - When: The content area renders
  - Then: An `img` element is present with a valid `src` attribute and the image is visible

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**DOM selectors used:**
- `.markdown-body` — rendered content container
- `h1`, `h2`, `h3` — heading elements
- `pre code` — code blocks; check for syntax-highlighted `span` elements within
- `table`, `thead`, `tbody`, `tr`, `th`, `td` — table structure
- `a[href]` — link elements
- `svg` inside `.markdown-body` — Mermaid SVG output
- `img` — image elements

**Mermaid wait strategy:** Use `waitForMermaid()` helper which calls `page.locator('#content-area svg').waitFor({ state: 'visible', timeout: 10000 })`. The 10-second timeout accounts for first-render Mermaid library initialization.

**Fixture files:** `kitchen-sink.md` (all content types), `invalid-mermaid.md` (broken Mermaid syntax). Content is deterministic — see tech design Fixture Content section.

**Test file:** `tests/e2e/rendering.spec.ts`

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 7 TCs pass (TC-3.1a, TC-3.2a, TC-3.3a, TC-3.4a, TC-3.5a, TC-3.5b, TC-3.6a)
- [ ] Kitchen sink file renders all content types correctly
- [ ] Mermaid SVG appears within 10 seconds
- [ ] Invalid Mermaid shows error indicator (no SVG)
- [ ] `npm run test:e2e` passes with all rendering tests

---

<!-- ====================================================================== -->
<!-- STORY 3                                                                 -->
<!-- ====================================================================== -->

# Story 3: Tabs, Editing, and Export

### Summary
<!-- Jira: Summary field -->

E2E tests for tab management (open, switch, close), edit mode round-trip (toggle, edit, save, dirty state, view updated content), and HTML export.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Verify the interactive document operations: opening multiple files creates tabs, switching tabs changes content, closing tabs handles focus correctly. Edit mode toggles between rendered view and code editor, saving writes to disk, and the dirty indicator tracks unsaved changes. HTML export completes and produces a file.

**Scope**

In scope:
- Multiple tab creation and duplicate prevention
- Tab switching with content change
- Tab closing with focus management and empty state
- Edit mode toggle (render ↔ edit)
- Editing, saving (Cmd+S), and verifying file on disk
- Dirty state indicator visibility
- Saved changes reflected in render mode
- HTML export via UI with mocked save dialog
- Export controls disabled when no document is open

Out of scope:
- PDF and DOCX export (HTML only for this epic)
- Unsaved changes modal (covered by existing Vitest tests)

**Dependencies:** Story 1 (file opening established)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-4.1:** Opening multiple files creates multiple tabs

- **TC-4.1a: Second file opens in a new tab**
  - Given: One file is already open with a tab
  - When: The user clicks a different file in the tree
  - Then: A second tab appears, and the content area shows the newly opened file
- **TC-4.1b: Re-clicking an already-open file switches to its tab**
  - Given: Two files are open with two tabs
  - When: The user clicks the first file in the tree again
  - Then: The first tab becomes active and its content is displayed; no duplicate tab is created

**AC-4.2:** Clicking a tab switches the displayed document

- **TC-4.2a: Tab switch changes content**
  - Given: Two files are open — file A (active) and file B
  - When: The user clicks file B's tab
  - Then: File B's content is displayed, file B's tab is visually active, and file A's tab is visually inactive

**AC-4.3:** Closing a tab removes it and handles focus correctly

- **TC-4.3a: Close the active tab with other tabs remaining**
  - Given: Three tabs are open, the middle tab is active
  - When: The user closes the middle tab
  - Then: The middle tab is removed, and the next tab to the right becomes active with its content displayed, or the previous tab if the closed tab was rightmost
- **TC-4.3b: Close the last remaining tab**
  - Given: One tab is open
  - When: The user closes it
  - Then: The tab strip shows the empty state, and the content area shows the launch state

**AC-5.1:** Toggling edit mode switches between rendered view and code editor

- **TC-5.1a: Enter edit mode**
  - Given: A markdown file is open in view mode
  - When: The user activates the edit toggle
  - Then: The rendered content is replaced by a code editor showing the file's raw markdown text
- **TC-5.1b: Exit edit mode**
  - Given: A file is open in edit mode and has been saved (no unsaved changes)
  - When: The user activates the edit toggle
  - Then: The code editor is replaced by the rendered markdown view

**AC-5.2:** Editing content and saving writes changes to disk

- **TC-5.2a: Edit, save, and verify**
  - Given: A file is open in edit mode
  - When: The user types additional text into the editor and triggers save
  - Then: The dirty indicator clears, and reading the file from disk shows the updated content
- **TC-5.2b: Dirty state indicator appears on edit**
  - Given: A file is open in edit mode with no changes
  - When: The user types into the editor
  - Then: A dirty state indicator (e.g., dot on the tab) becomes visible
- **TC-5.2c: Saved changes render correctly in view mode**
  - Given: The user has saved changes in edit mode
  - When: The user switches back to view mode
  - Then: The rendered content reflects the saved changes

**AC-6.1:** Exporting a document initiates the export operation and produces an exported file

- **TC-6.1a: HTML export completes**
  - Given: A markdown file is open in view mode
  - When: The user triggers an HTML export via the export menu or dropdown
  - Then: The export operation completes, a success confirmation is shown, and the exported HTML file exists at the expected output location
- **TC-6.1b: Export with no document open is not available**
  - Given: No document is open
  - When: The user views the export controls
  - Then: Export actions are disabled or not visible

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**DOM selectors used:**
- `.tab[data-tab-id]`, `.tab--active`, `.tab__label`, `.tab__close` — tab elements
- `.tab__dirty-dot` — dirty indicator on tab
- `.mode-toggle button` — "Render" and "Edit" toggle buttons
- `.dirty-indicator` — unsaved changes indicator in toolbar
- `[data-export-trigger]` — export dropdown trigger button
- `.dropdown [role="menuitem"]` — export format options (text: `PDF`, `DOCX`, `HTML`)
- `.cm-editor` — CodeMirror editor container (edit mode)

**Edit mode interaction:** Click "Edit" button in `.mode-toggle`. CodeMirror editor appears. Type text via `page.locator('.cm-editor .cm-content').fill()` or `page.keyboard.type()`. Save via `page.keyboard.press('Meta+s')`. Verify dirty state via `.tab__dirty-dot` visibility. Verify file on disk via `fs.readFileSync()`.

**Export mock strategy:** Intercept save dialog via `page.route('**/api/save-dialog', route => route.fulfill({ json: { path: exportPath } }))`. The export flow then calls `POST /api/export` with the mocked path. Verify the exported HTML file exists at `exportPath`.

**Test file:** `tests/e2e/interaction.spec.ts`

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 12 TCs pass (TC-4.1a–b, TC-4.2a, TC-4.3a–b, TC-5.1a–b, TC-5.2a–c, TC-6.1a–b)
- [ ] Tab operations handle focus correctly (close middle, close last)
- [ ] Edit round-trip works: toggle → edit → save → verify on disk → toggle → verify in render
- [ ] HTML export produces a file at the mocked save path
- [ ] Export controls disabled with no document open
- [ ] `npm run test:e2e` passes with all interaction tests

---

<!-- ====================================================================== -->
<!-- STORY 4                                                                 -->
<!-- ====================================================================== -->

# Story 4: Theme, Session Persistence, and File Watching

### Summary
<!-- Jira: Summary field -->

E2E tests for theme switching, session persistence across server restarts, and WebSocket-driven file change detection.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Verify the cross-cutting stateful behaviors: theme changes apply visually and persist across server restarts, the workspace root persists across restarts, and external file modifications trigger automatic content updates via WebSocket file watching.

**Scope**

In scope:
- Theme switching via menu bar submenu
- Theme persistence across server restart
- Workspace root persistence across server restart
- Combined persistence (theme + workspace survive together)
- WebSocket file change detection and automatic content update
- File change detection within 5-second window

Out of scope:
- Theme creation or customization
- Session properties beyond theme and workspace root
- File watching for non-markdown files

**Dependencies:** Story 0 (infrastructure — ServerManager.restart()), Story 1 (navigation established)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-7.1:** Switching themes changes the app's visual appearance

- **TC-7.1a: Theme change applies**
  - Given: The app is using the default theme
  - When: The user selects a different theme
  - Then: The app's visual appearance changes to reflect the selected theme
- **TC-7.1b: Multiple themes are available**
  - Given: The user opens the theme selection
  - When: The available options are displayed
  - Then: At least two distinct theme options are available

**AC-7.2:** The selected theme persists across server restarts

- **TC-7.2a: Theme survives restart**
  - Given: The user has selected a non-default theme
  - When: The server is restarted and the app is reloaded
  - Then: The non-default theme is still active

**AC-8.1:** Workspace root persists across server restarts

- **TC-8.1a: Workspace restored after restart**
  - Given: The user has set a workspace root and the file tree is populated
  - When: The server is stopped, restarted, and the page is reloaded
  - Then: The file tree shows the same workspace contents without the user needing to re-select the folder

**AC-8.2:** Multiple session properties persist together

- **TC-8.2a: Theme and workspace both restored**
  - Given: The user has set a non-default theme and a workspace root
  - When: The server is stopped, restarted, and the page is reloaded
  - Then: Both the non-default theme and the workspace root are restored

**AC-9.1:** External file modifications are detected and reflected in the viewer

- **TC-9.1a: File change updates rendered content**
  - Given: A markdown file is open in view mode
  - When: The test process writes new content to the file on disk
  - Then: The content area updates to show the new content without the user clicking anything
- **TC-9.1b: File change is detected within a reasonable time**
  - Given: A markdown file is open
  - When: The file is modified on disk
  - Then: The content area reflects the updated file content within 5 seconds

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Theme UI:** Theme is a submenu under `#menu-bar`. Items are `.menu-bar__item` buttons with text like `Theme: Dark Default`. Clicking calls `PUT /api/session/theme`. The `data-theme` attribute on `<html>` is the assertion target.

**Server restart strategy:** Use `ServerManager.restart()` — stops Fastify instance, waits for port release, starts new instance on same port with same session directory. Browser session stays alive. Call `page.reload()` after restart. Session persists because both instances use the same temp session directory where `session.json` is stored.

**File watching test:** Open a fixture file. Use `fs.writeFileSync()` to overwrite its content with new markdown. The app's chokidar watcher detects the change (debounced at 300ms), sends a `file-change` WebSocket message, and the client re-fetches and re-renders. Assert new content appears within 5 seconds using `page.locator('.markdown-body').waitFor({ timeout: 5000 })` with text content assertion.

**DOM selectors used:**
- `html[data-theme]` — current theme attribute
- `.menu-bar__item` — theme menu items
- `#sidebar .tree-node__row` — file tree entries (verify restoration)
- `.markdown-body` — content area for file watching assertions

**Test file:** `tests/e2e/persistence.spec.ts`

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 7 TCs pass (TC-7.1a–b, TC-7.2a, TC-8.1a, TC-8.2a, TC-9.1a–b)
- [ ] Theme switch visually changes `data-theme` attribute
- [ ] Server restart + reload preserves theme and workspace
- [ ] File change on disk triggers automatic content update within 5 seconds
- [ ] `npm run test:e2e` passes with all persistence tests
- [ ] Full E2E suite completes in under 2 minutes

---

<!-- ====================================================================== -->
<!-- INTEGRATION PATH TRACE                                                  -->
<!-- ====================================================================== -->

# Integration Path Trace

## Path 1: First Session — Browse, Open, View

The most common user path: open the app, browse the workspace, open a file, see it rendered.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| App loads | Shell renders with sidebar, tabs, content area | Story 0 | TC-2.1a |
| Workspace populates | File tree shows markdown files from workspace | Story 1 | TC-2.2a |
| Filter applied | Non-markdown files excluded from tree | Story 1 | TC-2.2b |
| Directory expanded | Nested directories reveal child files | Story 1 | TC-2.2c |
| File opened | Click file → content renders, tab appears | Story 1 | TC-2.3a, TC-2.3b |
| Content verified | Headings, code, tables, links, Mermaid, images render | Story 2 | TC-3.1a–TC-3.6a |

## Path 2: Edit Round-Trip — Open, Edit, Save, View

The developer edits a document and verifies the changes render correctly.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| File opened | Open file from tree | Story 1 | TC-2.3a |
| Enter edit mode | Toggle to editor | Story 3 | TC-5.1a |
| Type content | Editor shows raw markdown, dirty indicator appears | Story 3 | TC-5.2b |
| Save | Cmd+S writes to disk, dirty clears | Story 3 | TC-5.2a |
| Exit edit mode | Toggle to rendered view | Story 3 | TC-5.1b |
| Verify render | Saved changes visible in rendered content | Story 3 | TC-5.2c |

## Path 3: Session Continuity — Set State, Restart, Verify

The developer's workspace and preferences survive a server restart.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Set workspace | File tree populated | Story 1 | TC-2.2a |
| Set theme | Non-default theme applied | Story 4 | TC-7.1a |
| Restart server | Server stops and restarts | Story 4 | TC-8.1a |
| Reload page | Browser reloads | Story 4 | TC-8.2a |
| Verify workspace | File tree restored | Story 4 | TC-8.1a |
| Verify theme | Non-default theme active | Story 4 | TC-7.2a |

No gaps identified. Every segment has an owning story and at least one TC.

---

<!-- ====================================================================== -->
<!-- COVERAGE GATE                                                           -->
<!-- ====================================================================== -->

# Coverage Gate

Every AC and TC from the detailed epic, mapped to exactly one story.

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a, TC-1.1b, TC-1.1c, TC-1.1d | Story 0 |
| AC-1.2 | TC-1.2a, TC-1.2b | Story 0 |
| AC-1.3 | TC-1.3a, TC-1.3b, TC-1.3c | Story 0 |
| AC-1.4 | TC-1.4a, TC-1.4b, TC-1.4c | Story 0 |
| AC-1.5 | TC-1.5a | Story 0 |
| AC-2.1 | TC-2.1a, TC-2.1b | Story 0 |
| AC-2.2 | TC-2.2a, TC-2.2b, TC-2.2c | Story 1 |
| AC-2.3 | TC-2.3a, TC-2.3b | Story 1 |
| AC-3.1 | TC-3.1a | Story 2 |
| AC-3.2 | TC-3.2a | Story 2 |
| AC-3.3 | TC-3.3a | Story 2 |
| AC-3.4 | TC-3.4a | Story 2 |
| AC-3.5 | TC-3.5a, TC-3.5b | Story 2 |
| AC-3.6 | TC-3.6a | Story 2 |
| AC-4.1 | TC-4.1a, TC-4.1b | Story 3 |
| AC-4.2 | TC-4.2a | Story 3 |
| AC-4.3 | TC-4.3a, TC-4.3b | Story 3 |
| AC-5.1 | TC-5.1a, TC-5.1b | Story 3 |
| AC-5.2 | TC-5.2a, TC-5.2b, TC-5.2c | Story 3 |
| AC-6.1 | TC-6.1a, TC-6.1b | Story 3 |
| AC-7.1 | TC-7.1a, TC-7.1b | Story 4 |
| AC-7.2 | TC-7.2a | Story 4 |
| AC-8.1 | TC-8.1a | Story 4 |
| AC-8.2 | TC-8.2a | Story 4 |
| AC-9.1 | TC-9.1a, TC-9.1b | Story 4 |
| AC-10.1 | TC-10.1a, TC-10.1b, TC-10.1c | Story 0 |
| AC-10.2 | TC-10.2a | Story 0 |

**27 ACs, 50 TCs — all mapped. No orphans.**
