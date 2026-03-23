# Epic 7: E2E Testing Framework

This epic defines the complete requirements for the end-to-end testing framework
that covers the v1 surface of MD Viewer. It serves as the source of truth for
the Tech Lead's design work.

---

## User Profile

**Primary User:** The developer of MD Viewer, who is also the primary product user
**Context:** Adding new capabilities (packages, chat, streaming) to a 6-epic v1 surface and needing confidence that existing functionality stays intact across each change
**Mental Model:** "I run a command, it opens the app in a real browser, walks through the critical paths, and tells me if anything broke"
**Key Constraint:** Must coexist with the existing Vitest unit/integration suite (~70 tests) without disruption. The app uses Puppeteer for PDF export — Playwright is a separate dependency for E2E only.

---

## Feature Overview

After this epic, the developer can run `npm run test:e2e` to execute a Playwright
test suite that launches the Fastify server, opens the app in a real browser, and
exercises the critical user paths of the v1 surface: workspace browsing, file tree
navigation, document rendering, tab management, editing, export, theme switching,
and session persistence. The test infrastructure — fixtures, utilities, server
lifecycle management, and established patterns — is designed so that each
subsequent epic (8–14) can add E2E tests for its new features by following the
conventions without setting up infrastructure.

---

## Scope

### In Scope

E2E test framework and critical-path coverage for the stable v1 surface:

- Playwright installation and configuration alongside existing Vitest
- Test infrastructure: server lifecycle management (start/stop per suite), browser context management, test fixture directories with sample markdown files
- Test utilities: page helpers for common interactions (open workspace, wait for tree, click file, wait for content), assertion helpers
- `npm run test:e2e` script that runs the E2E suite independently of unit/integration tests
- Critical path coverage for v1 functionality:
  - App launch and workspace selection
  - File tree navigation and document opening
  - Markdown rendering verification (headings, code blocks, tables, links)
  - Mermaid diagram rendering
  - Tab management (open, switch, close)
  - Edit mode (toggle, edit, save, dirty state indicator)
  - Export (at least one format triggered and completed)
  - Theme switching (visual change applied)
  - Session persistence (workspace and theme survive server restart)
  - WebSocket file watching (external file change triggers reload)
- Established conventions and patterns that subsequent epics follow

### Out of Scope

- Electron-specific E2E testing (browser-based E2E only; Electron E2E is a potential future addition)
- Visual regression testing (screenshot comparison)
- Performance benchmarking within E2E tests
- Exhaustive path coverage — this epic covers critical paths, not every edge case
- Accessibility testing automation (future)
- E2E tests for v2 features (each subsequent epic adds its own)
- Changes to existing Vitest tests, configuration, or fixtures

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Playwright can drive a browser against the locally-running Fastify server without conflicts | Unvalidated | Tech Lead | Standard pattern for web app E2E |
| A2 | The app's WebSocket file-watching behavior is testable via filesystem writes from the test process | Unvalidated | Tech Lead | Tests write to fixture dirs, expect WS-driven UI updates |
| A3 | Mermaid diagrams render deterministically enough for presence-based assertions (element exists, SVG rendered) without pixel comparison | Unvalidated | Tech Lead | Mermaid rendering is async; may need wait strategies |
| A4 | The existing `buildApp()` function can be used to start a Fastify instance that listens on a port for E2E tests | Unvalidated | Tech Lead | Current test helper calls `app.ready()` but doesn't call `app.listen()` |
| A5 | Export operations (PDF via Puppeteer) work when triggered from a Playwright-driven browser session | Unvalidated | Tech Lead | Two browser automation tools active simultaneously |
| A6 | E2E test execution time targets under 2 minutes for the v1 critical path suite | Unvalidated | Tech Lead | Acceptable CI overhead |

---

## Flows & Requirements

### 1. Test Infrastructure and Server Lifecycle

The E2E test infrastructure manages the Fastify server lifecycle and browser
contexts. Tests launch a real server instance, point Playwright at it, and
tear everything down when done. Fixture directories provide sample content
for the tests to operate on.

1. Test suite starts
2. Infrastructure creates a temporary session directory and fixture workspace
3. Fastify server starts and listens on a port
4. Playwright launches a browser and navigates to the server URL
5. Tests execute against the live app
6. After the suite completes, the browser closes, server stops, and temporary directories are cleaned up

#### Acceptance Criteria

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
- **TC-1.1d: Server startup fails with clear error on port conflict**
  - Given: The designated port is already in use
  - When: The test suite setup runs
  - Then: The suite fails with a clear error message identifying the port conflict

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
- **TC-1.4c: The verify script includes E2E tests**
  - Given: The developer runs `npm run verify`
  - When: The command completes
  - Then: Both Vitest tests and Playwright E2E tests have been executed

**AC-1.5:** When an E2E test fails, the developer receives actionable failure output including the test name, the assertion that failed, and sufficient context to diagnose the issue

- **TC-1.5a: Failure output is actionable**
  - Given: A test with an intentionally failing assertion exists
  - When: The test suite runs
  - Then: The output includes the test name, the expected vs actual values, and the file/line of the failure

### 2. Workspace Browsing and File Tree Navigation

The user opens the app, selects a workspace, and navigates the file tree to find
and open markdown documents. This is the entry point for every user session.

1. App loads in the browser
2. User selects a folder as the workspace root
3. File tree populates with markdown files from the folder
4. User expands directories and clicks files to open them
5. Opened files appear in the content area

#### Acceptance Criteria

**AC-2.1:** The app loads and displays the shell with sidebar, tab strip, and content area

- **TC-2.1a: Shell elements are present**
  - Given: Playwright navigates to the app URL
  - When: The page loads
  - Then: The menu bar, sidebar, tab strip, and content area are all visible in the DOM
- **TC-2.1b: Empty state is displayed**
  - Given: No workspace is selected
  - When: The page loads
  - Then: The content area shows the launch state (app name, action prompts)

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

### 3. Document Rendering Verification

The content area renders markdown files with full formatting — headings, code
blocks with syntax highlighting, tables, links, and images. This flow verifies
that the rendering pipeline works end-to-end through a real browser.

1. User opens a markdown file containing various content types
2. Content area renders the markdown with full formatting
3. User scrolls through the document to see all content types

#### Acceptance Criteria

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

### 4. Tab Management

The user opens multiple documents and switches between them using the tab strip.
Tabs show the file name, indicate the active tab, and can be closed.

1. User opens multiple files from the tree
2. Each file gets a tab in the tab strip
3. User clicks tabs to switch between documents
4. User closes tabs to dismiss documents

#### Acceptance Criteria

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

### 5. Edit Mode

The user switches between view mode and edit mode to modify markdown files. In
edit mode, a code editor replaces the rendered preview. Saving writes changes to
disk, and the dirty state indicator shows unsaved changes.

1. User opens a markdown file
2. User toggles into edit mode
3. The editor appears with the file's raw markdown
4. User makes changes — dirty indicator appears
5. User saves — dirty indicator clears, and the file on disk is updated
6. User toggles back to view mode — updated content is rendered

#### Acceptance Criteria

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

### 6. Export

The user exports a rendered document to at least one output format. The E2E test
verifies that the export operation completes and produces an exported file.

1. User opens a markdown file
2. User triggers an export action (e.g., HTML export)
3. The export completes and a result is produced

#### Acceptance Criteria

**AC-6.1:** Exporting a document initiates the export operation and produces an exported file

- **TC-6.1a: HTML export completes**
  - Given: A markdown file is open in view mode
  - When: The user triggers an HTML export via the export menu or dropdown
  - Then: The export operation completes, a success confirmation is shown, and the exported HTML file exists at the expected output location
- **TC-6.1b: Export with no document open is not available**
  - Given: No document is open
  - When: The user views the export controls
  - Then: Export actions are disabled or not visible

### 7. Theme Switching

The user changes the app's visual theme. The change applies immediately and
persists across sessions.

1. User opens the theme selection mechanism
2. User selects a different theme
3. The app's appearance changes immediately
4. On next session start, the selected theme is still active

#### Acceptance Criteria

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

### 8. Session Persistence

The app remembers the user's workspace and settings across server restarts.
This flow verifies the round-trip: set state, restart the server, verify state
is restored.

1. User sets a workspace root and theme
2. Server is stopped and restarted
3. App reloads and the previous workspace root and theme are restored

#### Acceptance Criteria

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

### 9. WebSocket File Watching

The app uses WebSocket connections to watch for file changes on disk. When a
file is modified externally, the viewer updates the content without manual
refresh.

1. User opens a markdown file in the viewer
2. An external process modifies the file on disk
3. The viewer detects the change via WebSocket notification
4. The content area updates to reflect the new file content

#### Acceptance Criteria

**AC-9.1:** External file modifications are detected and reflected in the viewer

- **TC-9.1a: File change updates rendered content**
  - Given: A markdown file is open in view mode
  - When: The test process writes new content to the file on disk
  - Then: The content area updates to show the new content without the user clicking anything
- **TC-9.1b: File change is detected within a reasonable time**
  - Given: A markdown file is open
  - When: The file is modified on disk
  - Then: The content area reflects the updated file content within 5 seconds

### 10. Reusable Test Patterns and Conventions

The E2E test suite establishes patterns and conventions that subsequent epics
follow when adding their own E2E tests. The patterns are embodied in test
utility functions, fixture management, and the organizational structure of the
test files.

1. Developer writing E2E tests for a new epic reads the existing tests
2. Developer uses shared utility functions to set up workspace, open files, wait for renders
3. Developer adds new test files following the directory and naming conventions
4. New tests run as part of the same `npm run test:e2e` command without infrastructure changes

#### Acceptance Criteria

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

**AC-10.2:** Test files follow a consistent directory and naming convention

- **TC-10.2a: Test file organization**
  - Given: The E2E test directory exists
  - When: The directory contents are listed
  - Then: Tests are organized in a dedicated e2e directory with descriptive filenames following the pattern `[feature].spec.ts`

---

## Data Contracts

No new API endpoints or data shapes are introduced by this epic. E2E tests
exercise the existing v1 API surface and UI. The test infrastructure interacts
with the Fastify server through the same HTTP and WebSocket interfaces that
the browser client uses.

---

## Dependencies

Technical dependencies:
- v1 (Epics 1-6) complete and stable
- Node.js runtime
- Playwright (new devDependency)

Process dependencies:
- None

---

## Non-Functional Requirements

### Test Execution Time
- The full E2E suite targets completion in under 2 minutes on the developer's machine
- Individual test files target completion in under 30 seconds

### Reliability
- E2E tests produce consistent results across runs (no flaky tests from race conditions or timing issues)
- Tests that depend on async operations (Mermaid rendering, WebSocket events, file system watching) use explicit wait conditions, not arbitrary timeouts

### CI Compatibility
- The `test:e2e` script exits with code 0 on success and non-zero on failure
- Tests run headlessly (no visible browser window required)

### Isolation
- E2E tests do not interfere with the developer's real session data, workspaces, or configuration
- Temporary fixture directories are fully cleaned up after test runs

---

## Notes for Tech Design

**Playwright validated via research.** The E2E framework choice was researched against the full 2026 landscape (`.research/outputs/e2e-testing-landscape-2026.md`). Tools evaluated: Cypress, Puppeteer, WebdriverIO, Vercel Agent Browser, Shortest, Stagehand, Magnitude, Browser Use, Testplane, Maestro, PinchTab, Lightpanda. Playwright was confirmed as the right choice — native WebSocket testing support (`page.routeWebSocket()`, stable since v1.48) is the key differentiator given this project's file-watching and future streaming requirements. Cypress was the nearest competitor but has no native WebSocket support. User reviewed and signed off on the choice.

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. How should the Fastify server be started for E2E tests — via the existing `buildApp()` helper with an added `listen()` call, or via a child process running `npm start`? The former gives more control; the latter tests the real startup path.
2. How should workspace root selection be triggered in E2E tests — via the browse API endpoint directly, or via UI interaction with the folder picker? The folder picker is a server-spawned native dialog that Playwright cannot interact with.
3. What Playwright configuration settings are needed — browser choice (Chromium only or multiple?), headless mode, viewport size, timeout defaults?
4. Should E2E tests share a single server instance across all test files (faster) or start a fresh server per file (more isolated)? What's the tradeoff given the test count?
5. How should the export E2E test handle the file save dialog — intercept it, use an API-level trigger, or verify the export a different way?
6. How should Mermaid rendering wait conditions work — poll for SVG elements, use MutationObserver, or hook into the app's rendering completion signal?
7. What is the Playwright project structure — should tests live in `app/tests/e2e/` alongside existing tests, or in a separate top-level `e2e/` directory?
8. Should E2E tests that require a server restart mid-test (session persistence tests) manage the restart while maintaining the Playwright browser session, or should those tests do a full page reload?
9. Should tests run serially or in parallel? The choice affects the 2-minute execution time target significantly.
10. Should a `test:e2e:debug` script be provided for running tests in headed mode (visible browser) for debugging?
11. Should tests monitor browser console for unexpected errors and fail or warn on unexpected console.error output?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

**Delivers:** Playwright installed, configured, and runnable. Test infrastructure
(server lifecycle, browser context management, fixture setup/teardown, page
helpers) is in place. A single smoke test proves the pipeline works: start the
server, open the app in Playwright, verify the shell renders.

**Prerequisite:** None

**ACs covered:**
- AC-1.1 (server lifecycle management)
- AC-1.2 (browser context isolation)
- AC-1.3 (fixture workspace creation and cleanup)
- AC-1.4 (npm run test:e2e script)
- AC-1.5 (test failure reporting)
- AC-2.1 (app shell renders — smoke test only)
- AC-10.1 (shared page helpers — initial set)
- AC-10.2 (test file organization and naming conventions)

**Estimated test count:** 3–5 tests

### Story 1: Workspace Browsing and File Opening

**Delivers:** E2E tests that open a workspace, verify the file tree, navigate
directories, open files, and verify content appears. Covers the core entry
point flow that every user session begins with.

**Prerequisite:** Story 0

**ACs covered:**
- AC-2.2 (workspace selection populates file tree)
- AC-2.3 (clicking a file opens it with content and tab)

**Estimated test count:** 4–6 tests

### Story 2: Rendering and Mermaid

**Delivers:** E2E tests that verify the full rendering pipeline — headings,
code blocks with syntax highlighting, tables, links, and Mermaid diagrams. Confirms
the rendering stack works end-to-end through a real browser.

**Prerequisite:** Story 1

**ACs covered:**
- AC-3.1 (heading rendering)
- AC-3.2 (code block rendering with syntax highlighting)
- AC-3.3 (table rendering)
- AC-3.4 (link rendering)
- AC-3.5 (Mermaid diagram rendering)
- AC-3.6 (image rendering)

**Estimated test count:** 7–9 tests

### Story 3: Tabs, Editing, and Export

**Delivers:** E2E tests for tab management, edit mode round-trip (toggle, edit,
save, verify on disk, view updated content), and export initiation. Covers the
interactive document operations.

**Prerequisite:** Story 1

**ACs covered:**
- AC-4.1 (opening multiple tabs)
- AC-4.2 (switching tabs)
- AC-4.3 (closing tabs)
- AC-5.1 (edit mode toggle)
- AC-5.2 (edit, save, dirty state, view mode verification)
- AC-6.1 (export operation)

**Estimated test count:** 8–12 tests

### Story 4: Theme, Session Persistence, and File Watching

**Delivers:** E2E tests for theme switching, session persistence across server
restarts, and WebSocket-driven file watching. These are the cross-cutting
behaviors that verify the app's stateful and real-time capabilities.

**Prerequisite:** Story 1

**ACs covered:**
- AC-7.1 (theme switching)
- AC-7.2 (theme persistence across restart)
- AC-8.1 (workspace persistence across restart)
- AC-8.2 (multiple properties persist together)
- AC-9.1 (WebSocket file change detection)

**Estimated test count:** 5–7 tests

---

## Validation Checklist

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Every AC has at least one TC
- [x] TCs cover happy path, edge cases, and errors
- [x] Data contracts addressed (not applicable — no new API surfaces)
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Dependencies documented
- [x] Story breakdown covers all ACs (27 ACs mapped across Stories 0–4)
- [x] Stories sequence logically (infrastructure first, read before write, core before cross-cutting)
- [x] All validator issues addressed (14 minor/major fixes from Opus + Codex review applied)
- [x] Self-review complete
- [x] Verification review complete
