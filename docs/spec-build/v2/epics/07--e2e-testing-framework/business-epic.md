# Epic 7: E2E Testing Framework — Business Epic

<!-- Jira: Epic -->

---

## User Profile
<!-- Jira: Epic Description — User Profile section -->

**Primary User:** The developer of MD Viewer, who is also the primary product user
**Context:** Adding new capabilities (packages, chat, streaming) to a 6-epic v1 surface and needing confidence that existing functionality stays intact across each change
**Mental Model:** "I run a command, it opens the app in a real browser, walks through the critical paths, and tells me if anything broke"
**Key Constraint:** Must coexist with the existing test suite (~70 unit/integration tests) without disruption. The app uses Puppeteer for PDF export — the E2E framework is a separate dependency for testing only.

---

## Feature Overview
<!-- Jira: Epic Description — Feature Overview section -->

After this epic, the developer can run `npm run test:e2e` to execute a test suite that launches the server, opens the app in a real browser, and exercises the critical user paths of the v1 surface: workspace browsing, file tree navigation, document rendering, tab management, editing, export, theme switching, and session persistence. The test infrastructure — fixtures, utilities, server lifecycle management, and established patterns — is designed so that each subsequent epic (8–14) can add E2E tests for new features by following conventions without setting up infrastructure.

---

## Scope
<!-- Jira: Epic Description — Scope section -->

### In Scope

E2E test framework and critical-path coverage for the stable v1 surface:

- E2E framework installation and configuration alongside existing test suite
- Test infrastructure: server lifecycle management (start/stop per suite), browser context management, fixture directories with sample markdown files
- Test utilities: page helpers for common interactions (open workspace, wait for tree, click file, wait for content), assertion helpers
- `npm run test:e2e` script that runs the E2E suite independently of unit/integration tests
- Critical path coverage for v1 functionality:
  - App launch and workspace selection
  - File tree navigation and document opening
  - Markdown rendering verification (headings, code blocks, tables, links)
  - Mermaid diagram rendering
  - Tab management (open, switch, close)
  - Edit mode (toggle, edit, save, dirty state indicator)
  - Export (HTML format — initiated and completed)
  - Theme switching (visual change applied)
  - Session persistence (workspace and theme survive server restart)
  - File watching (external file change triggers content reload)
- Established conventions and patterns that subsequent epics follow

### Out of Scope

- Electron-specific E2E testing (browser-based E2E only; Electron E2E is a potential future addition)
- Visual regression testing (screenshot comparison)
- Performance benchmarking within E2E tests
- Exhaustive path coverage — this epic covers critical paths, not every edge case
- Accessibility testing automation
- E2E tests for v2 features (each subsequent epic adds its own)
- Changes to existing unit/integration tests, configuration, or fixtures

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | The E2E framework can drive a browser against the locally-running server without conflicts | Unvalidated | Tech Lead | Standard pattern for web app E2E |
| A2 | The app's file-watching behavior is testable via filesystem writes from the test process | Unvalidated | Tech Lead | Tests write to fixture dirs, expect UI updates |
| A3 | Mermaid diagrams render deterministically enough for presence-based assertions (element exists, SVG rendered) without pixel comparison | Unvalidated | Tech Lead | Mermaid rendering is async; wait strategies needed |
| A4 | The existing server startup function can be used to start a server instance that listens on a port for E2E tests | Unvalidated | Tech Lead | Current test helper starts the server but does not listen on a port |
| A5 | Export operations work when triggered from a browser session driven by the E2E framework | Unvalidated | Tech Lead | HTML export tested; PDF export deferred |
| A6 | E2E test execution time targets under 2 minutes for the v1 critical path suite | Unvalidated | Tech Lead | Acceptable overhead |

---

## Flows & Requirements
<!-- Jira: Epic Description — Requirements section -->

### 1. Test Infrastructure and Server Lifecycle (AC-1.1 through AC-1.5)

The E2E test infrastructure manages the server lifecycle and browser contexts. Tests launch a real server instance, point the E2E framework at it, and tear everything down when done. Fixture directories provide sample content for the tests to operate on. The server uses a temporary session directory so tests never touch the developer's real session data. Each test gets a clean browser context to prevent state leakage. A dedicated `test:e2e` script runs the E2E suite independently — the existing `test` script is unaffected. Test failures produce actionable output including the test name, the assertion that failed, and the file/line of the failure.

*(See Story 0 for detailed ACs and test conditions.)*

### 2. Workspace Browsing and File Tree Navigation (AC-2.1 through AC-2.3)

The app loads and displays the shell — menu bar, sidebar, tab strip, and content area. When a workspace root is set, the file tree populates with markdown files from that directory. Non-markdown files are filtered out. Nested directories appear in the tree and can be expanded. Clicking a file in the tree opens it — rendered markdown content appears in the content area and a tab appears in the tab strip.

*(See Story 0 for AC-2.1 and Story 1 for AC-2.2 through AC-2.3 — detailed ACs and test conditions.)*

### 3. Document Rendering Verification (AC-3.1 through AC-3.6)

The rendering pipeline is verified end-to-end through a real browser. Headings render at correct hierarchy levels (h1, h2, h3). Code blocks render with syntax highlighting. Tables render with proper HTML structure and correct cell content. Links render as clickable anchor elements with correct URLs. Mermaid code blocks render as SVG diagrams; invalid Mermaid syntax shows an error indicator instead. Images referenced via relative paths render and are visible.

*(See Story 2 for detailed ACs and test conditions.)*

### 4. Tab Management (AC-4.1 through AC-4.3)

Opening multiple files creates multiple tabs. Re-clicking an already-open file switches to its existing tab without creating a duplicate. Clicking a tab switches the displayed document. Closing the active tab moves focus to an adjacent tab. Closing the last remaining tab returns to the empty/launch state.

*(See Story 3 for detailed ACs and test conditions.)*

### 5. Edit Mode (AC-5.1 through AC-5.2)

Toggling edit mode switches between the rendered markdown view and a code editor showing raw markdown. Editing content and saving writes changes to disk — the dirty state indicator appears on edit and clears on save. Switching back to render mode after saving shows the updated content.

*(See Story 3 for detailed ACs and test conditions.)*

### 6. Export (AC-6.1)

Exporting a document initiates the export operation and produces an exported file. HTML export is tested end-to-end: the user triggers the export, the operation completes with a success confirmation, and the exported file exists at the output location. Export controls are disabled when no document is open.

*(See Story 3 for detailed ACs and test conditions.)*

### 7. Theme Switching (AC-7.1 through AC-7.2)

Switching themes changes the app's visual appearance immediately. At least two theme options are available. The selected theme persists across server restarts — reloading after a restart shows the previously selected theme.

*(See Story 4 for detailed ACs and test conditions.)*

### 8. Session Persistence (AC-8.1 through AC-8.2)

The workspace root persists across server restarts — the file tree is restored without the user needing to re-select the folder. Multiple session properties persist together — both theme and workspace root survive a restart.

*(See Story 4 for detailed ACs and test conditions.)*

### 9. WebSocket File Watching (AC-9.1)

External file modifications are detected and reflected in the viewer. When a file is modified on disk while open in the viewer, the content area updates to show the new content automatically, without the user clicking anything. The update is detected within 5 seconds.

*(See Story 4 for detailed ACs and test conditions.)*

### 10. Reusable Test Patterns and Conventions (AC-10.1 through AC-10.2)

Shared page helpers abstract common E2E interactions — workspace setup, file opening, and async rendering waits. Test files follow a consistent directory and naming convention so that subsequent epics can add E2E tests by following the pattern.

*(See Story 0 for detailed ACs and test conditions.)*

---

## Data Contracts
<!-- Jira: Epic Description — Data Contracts section -->

No new API endpoints or data shapes are introduced by this epic. E2E tests exercise the existing v1 API surface and UI. The test infrastructure interacts with the server through the same HTTP and WebSocket interfaces that the browser client uses:

- **HTTP:** REST API endpoints for session management (setting workspace root, theme), file tree scanning, file reading, file saving, and export operations
- **WebSocket:** File-watching channel that notifies the client when a file changes on disk

Internal test infrastructure types (server manager, fixture workspace, shared state, page helpers) are defined in the story file's Technical Design sections.

---

## Non-Functional Requirements
<!-- Jira: Epic Description — NFR section -->

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

## Tech Design Questions
<!-- Jira: Epic Description — Tech Design Questions section -->

Questions for the Tech Lead to address during design:

1. How should the server be started for E2E tests — via the existing startup function with an added listen call, or via a child process running the start script?
2. How should workspace root selection be triggered in E2E tests — via the API endpoint directly, or via UI interaction with the folder picker?
3. What configuration settings are needed — browser choice, headless mode, viewport size, timeout defaults?
4. Should E2E tests share a single server instance across all test files or start a fresh server per file?
5. How should the export E2E test handle the file save dialog — intercept it, use an API-level trigger, or verify the export a different way?
6. How should Mermaid rendering wait conditions work — poll for elements, use observers, or hook into the app's rendering completion signal?
7. What is the test project structure — should tests live alongside existing tests or in a separate directory?
8. Should E2E tests that require a server restart mid-test manage the restart while maintaining the browser session, or do a full reload?
9. Should tests run serially or in parallel?
10. Should a debug script be provided for running tests in headed mode (visible browser) for debugging?
11. Should tests monitor browser console for unexpected errors and fail or warn on unexpected console output?

---

## Dependencies
<!-- Jira: Epic Description — Dependencies section -->

Technical dependencies:
- v1 (Epics 1–6) complete and stable
- Node.js runtime
- E2E testing framework (new development dependency)

Process dependencies:
- None

---

## Story Breakdown
<!-- Jira: Epic Description — Story Breakdown section -->

### Story 0: E2E Infrastructure Foundation
Install the E2E framework, configure the test runner, implement server lifecycle management, fixture creation, page helpers, and npm scripts. A smoke test proves the pipeline works. Covers AC-1.1 through AC-1.5, AC-2.1, AC-10.1, AC-10.2.
*(See story file Story 0 for full details and test conditions.)*

### Story 1: Workspace Browsing and File Opening
E2E tests that open a workspace, verify the file tree populates with markdown files, navigate directories, and open files with content rendering and tab creation. Covers AC-2.2 through AC-2.3.
*(See story file Story 1 for full details and test conditions.)*

### Story 2: Rendering and Mermaid
E2E tests that verify the full rendering pipeline — headings, code blocks, tables, links, Mermaid diagrams (valid and invalid), and images. Covers AC-3.1 through AC-3.6.
*(See story file Story 2 for full details and test conditions.)*

### Story 3: Tabs, Editing, and Export
E2E tests for tab management, edit mode round-trip (toggle, edit, save, dirty state, view updated content), and HTML export. Covers AC-4.1 through AC-6.1.
*(See story file Story 3 for full details and test conditions.)*

### Story 4: Theme, Session Persistence, and File Watching
E2E tests for theme switching, session persistence across server restarts, and file change detection. Covers AC-7.1 through AC-9.1.
*(See story file Story 4 for full details and test conditions.)*

---

## Validation Checklist
<!-- Jira: Epic Description — Validation section -->

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Dependencies documented
- [x] Story breakdown covers all 27 ACs
- [x] Stories sequence logically (infrastructure first, read before write, core before cross-cutting)
- [x] Self-review complete
- [x] Verification review complete
