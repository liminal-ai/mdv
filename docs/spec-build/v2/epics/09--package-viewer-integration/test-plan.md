# Test Plan: Package Viewer Integration

This document maps every TC from Epic 9 to a specific test file, provides mock strategy guidance, defines test fixtures, and gives per-chunk test count breakdowns. For system context and work breakdown, see `tech-design.md`. For implementation details, see the server and client companion docs.

---

## Mock Strategy

### Mock Boundary

Mock at the **external boundary** — the API layer and the filesystem. Exercise all internal modules (PackageService, TempDirManager, sidebar components) through their real code paths.

| Layer | Mock? | Why |
|-------|-------|-----|
| Epic 8 library (extractPackage, parseManifest, etc.) | **Yes** | External dependency boundary — control extraction/parsing results |
| Filesystem (fs operations) | **Yes for service tests** | Deterministic temp dir creation and file operations |
| API client (fetch calls) | **Yes for client tests** | Control server responses for UI testing |
| PackageService internal logic | **No** | That's what we're testing |
| TempDirManager internal logic | **No** | Exercise through PackageService |
| Sidebar DOM rendering | **No** | Test real DOM output |
| StateStore | **No** | Exercise state management through real subscriptions |

### Server-Side Mocks

```typescript
// Mock Epic 8 library at module boundary
vi.mock('@md-viewer/package', () => ({
  extractPackage: vi.fn(),
  parseManifest: vi.fn(),
  createPackage: vi.fn(),
  scaffoldManifest: vi.fn(),
  MANIFEST_FILENAME: '_nav.md',
}));

// Mock filesystem for TempDirManager tests
vi.mock('node:fs/promises', () => ({
  mkdtemp: vi.fn(),
  rm: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));
```

### Client-Side Mocks

Client tests use jsdom (via Vitest's `environmentMatchGlobs` for `tests/client/**`) and mock the API client:

```typescript
// Mock API client at fetch boundary
vi.mock('../../src/client/api.js', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    openPackage: vi.fn(),
    getPackageManifest: vi.fn(),
    createPackage: vi.fn(),
    exportPackage: vi.fn(),
    saveDialog: vi.fn(),
  })),
}));
```

### E2E Tests

E2E tests (Playwright) run against the real server with real Epic 8 library operations. Test fixtures include pre-built `.mpk` and `.mpkz` files with known content.

---

## Test Fixtures

### Package Fixtures: `app/tests/fixtures/packages/`

| Fixture | Contents | Used By |
|---------|----------|---------|
| `sample.mpk` | Manifest with 3 entries (flat), 3 .md files | TC-1.1a, TC-1.4a–e, TC-2.1a, TC-2.3a |
| `sample.mpkz` | Same as sample.mpk, gzip-compressed | TC-1.1b |
| `nested.mpk` | Manifest with groups and 3-level nesting | TC-1.5a–b, TC-2.3b–c |
| `no-manifest.mpk` | 3 .md files, no manifest file | TC-8.1a–b |
| `bad-manifest.mpk` | Manifest with malformed YAML | TC-8.1c, TC-8.2c |
| `partial-meta.mpk` | Manifest with title only (no version/author) | TC-2.1b |
| `no-meta.mpk` | Manifest with no YAML frontmatter | TC-2.1c |
| `missing-file.mpk` | Manifest referencing `missing.md` that doesn't exist | TC-1.4d |
| `mermaid.mpk` | Manifest + file with Mermaid diagram and code block | TC-1.4e |
| `corrupt.bin` | Random binary data (not a valid tar) | TC-1.1c |

### Manifest Fixtures

```typescript
// Fixture: flat manifest with 3 entries
export const FLAT_MANIFEST = `---
title: Sample Package
version: "1.0"
author: Test Author
---

- [Getting Started](getting-started.md)
- [API Reference](api-reference.md)
- [FAQ](faq.md)
`;

// Fixture: nested manifest with groups
export const NESTED_MANIFEST = `---
title: Nested Package
---

- [Overview](overview.md)
- Guides
  - [Quick Start](guides/quick-start.md)
  - [Advanced Usage](guides/advanced.md)
- Reference
  - API
    - [Endpoints](reference/api/endpoints.md)
    - [Authentication](reference/api/auth.md)
`;

// Fixture: manifest with malformed YAML
export const MALFORMED_MANIFEST = `---
title: Bad Package
version: [this is invalid YAML
---

- [Page](page.md)
`;
```

---

## TC → Test Mapping

### Flow 1: Opening a Package

#### `tests/server/package/package-service.test.ts`

Server-side tests for PackageService.open(), TempDirManager, and the open route.

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-1.1a | TC-1.1a: open .mpk via POST /api/package/open extracts and returns manifest | Mock extractPackage + parseManifest with flat manifest fixture | Response 200 with 3 navigation entries, metadata present |
| TC-1.1b | TC-1.1b: open .mpkz extracts compressed package | Mock extractPackage for .mpkz | Response 200, extractedRoot populated |
| TC-1.1c | TC-1.1c: invalid archive returns 400 | Mock extractPackage to throw | Response 400, code INVALID_ARCHIVE, state unchanged |
| TC-1.4a | TC-1.4a: navigation entry resolves to extracted file | After open, verify file read from extractedRoot + relative path | File content returned via existing /api/file endpoint |
| TC-1.4d | TC-1.4d: missing file reference returns error | Open package with missing-file fixture | /api/file returns 404 for the missing path |

**Non-TC test:** PackageService.open() integration with real .mpk fixture — verifies full extraction + manifest parse pipeline (1 test).

#### `tests/client/package/package-sidebar.test.ts`

Client-side tests for the package sidebar rendering and interaction.

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-1.4b | TC-1.4b: nested navigation entry opens correct document | Render sidebar with nested navigation, click child entry | onOpenFile called with extractedRoot + auth/oauth2.md |
| TC-1.4c | TC-1.4c: clicking entry creates a tab | Simulate entry click | Tab appears with display name from NavigationNode |
| TC-1.4e | TC-1.4e: rendering parity — Mermaid and code blocks | Open file from package containing Mermaid | Mermaid SVG renders, code block has syntax highlighting |
| TC-1.5a | TC-1.5a: group label is non-clickable heading | Render sidebar with group, click group label | No onOpenFile call; group displayed as heading |
| TC-1.5b | TC-1.5b: group collapse/expand | Render sidebar with expanded group, collapse it | Children hidden; re-expand shows them |
| TC-2.1a | TC-2.1a: full metadata displayed in header | Set packageState with title, version, author | Header shows all three fields |
| TC-2.1b | TC-2.1b: partial metadata — title only | Set packageState with only title | Header shows title, no empty placeholders for version/author |
| TC-2.1c | TC-2.1c: no metadata — package filename fallback | Set packageState with empty metadata, sourcePath ending in "sample.mpk" | Header shows "sample.mpk" as title |
| TC-2.2a | TC-2.2a: package mode indicator present | Set sidebarMode to 'package' | Mode indicator shows "Package" |
| TC-2.2b | TC-2.2b: filesystem mode indicator present | Set sidebarMode to 'filesystem' | Mode indicator shows "Filesystem" |
| TC-2.3a | TC-2.3a: flat list renders 5 entries | Set navigation with 5 flat entries | 5 .pkg-nav__link elements rendered |
| TC-2.3b | TC-2.3b: nested hierarchy | Set navigation with groups + children | Group headings and indented children rendered |
| TC-2.3c | TC-2.3c: three levels of nesting | Set navigation with 3-level deep structure | All three levels rendered with progressive indentation |

**Non-TC test:** Sidebar render performance with 100+ entries — verify renders in <100ms (1 test).

### Flow 2: Mode Switching + Additional Open Methods

#### `tests/server/package/mode-switching.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-3.1a | TC-3.1a: opening folder while in package mode closes package | Package open, then setRoot called | PackageService.close() called, state cleared |
| TC-3.3a | TC-3.3a: opening different package replaces current | Open package A, then open package B | Package A's temp dir cleaned up, state reflects package B |
| TC-9.1a | TC-9.1a: temp directory removed on package switch | Open package A, open package B | Package A's temp dir removed from filesystem |

#### `tests/client/package/mode-switching.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-1.2a | TC-1.2a: drag-and-drop opens package | Simulate drop event with .mpk file | openPackage API called |
| TC-1.2b | TC-1.2b: dropping non-package file does not change mode | Simulate drop event with .txt file | No package API call, sidebar unchanged |
| TC-1.3a | TC-1.3a: CLI argument opens package | Bootstrap with session containing activePackage | Sidebar in package mode |
| TC-1.3b | TC-1.3b: CLI argument with non-existent file | Bootstrap; server returns error for package open | Error shown, no workspace open |
| TC-1.3c | TC-1.3c: CLI argument with non-package file | Bootstrap with regular folder path | Sidebar in filesystem mode |
| TC-3.1b | TC-3.1b: package tabs closed on mode switch | Open package, open tabs, switch to folder | Tabs from package closed |
| TC-3.2a | TC-3.2a: switch from filesystem to package mode | Start in filesystem mode, open package | Sidebar switches to package mode |

### Flow 3: Package Creation

#### `tests/server/package/package-create.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-4.1a | TC-4.1a: manifest scaffolded with discovered files | Mock scaffoldManifest with 3 files | Response contains 3 navigation entries, sorted alphabetically |
| TC-4.1b | TC-4.1b: manifest frontmatter includes directory name | Mock scaffoldManifest for dir "my-project" | Metadata title is "my-project" |
| TC-4.1d | TC-4.1d: dotfiles excluded | Mock scaffoldManifest returns only non-dot files | Response excludes .hidden.md |
| TC-4.2a | TC-4.2a: existing manifest — overwrite confirmed | Call with overwrite: true | Manifest replaced, new navigation returned |
| TC-4.2b | TC-4.2b: existing manifest — no overwrite flag | Call without overwrite, manifest exists | 409 MANIFEST_EXISTS error |
| TC-4.3a | TC-4.3a: empty directory | Mock scaffoldManifest for empty dir | Response has empty navigation, metadata with title |

#### `tests/client/package/package-create.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-4.1c | TC-4.1c: sidebar switches to package mode | Mock createPackage success | packageState.sidebarMode changes to 'package' |
| TC-4.4a | TC-4.4a: New Package disabled for extracted packages | Set packageState with mode 'extracted' and manifestStatus 'present' | New Package menu item is disabled |

**Non-TC test:** Server test for scaffoldManifest with nested directories (verifies recursive discovery). 1 test.

### Flow 4: Export to Package

#### `tests/server/package/package-export.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-5.1a | TC-5.1a: export to .mpk | Mock createPackage | Response with format 'mpk', fileCount > 0 |
| TC-5.1b | TC-5.1b: export to .mpkz | Call with compress: true | Response with format 'mpkz' |
| TC-5.1c | TC-5.1c: export includes all files | Mock createPackage, verify sourceDir passed | createPackage called with correct sourceDir |
| TC-5.2a | TC-5.2a: auto-scaffold on export | Export from dir with no manifest | scaffoldManifest called before createPackage |
| TC-5.2b | TC-5.2b: source directory not modified | Export from dir with no manifest | No writeFile to sourceDir for manifest |
| TC-5.3a | TC-5.3a: re-export after editing | Open package, mark stale, export | Exported package uses current extracted content |

#### `tests/client/package/package-export.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-5.3b | TC-5.3b: stale indicator clears after re-export to original path | Export to sourcePath | packageState.stale becomes false |
| TC-5.3c | TC-5.3c: stale indicator remains after export to different path | Export to different path | packageState.stale remains true |
| TC-5.4a | TC-5.4a: cancel export | Mock saveDialog returning null | No exportPackage call, state unchanged |

**Non-TC test:** Server round-trip test — export .mpk then re-open and verify content. 1 test.

### Flow 5: Manifest Editing

#### `tests/server/package/package-manifest.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-6.1a | TC-6.1a: GET /api/package/manifest returns parsed manifest | Package open with manifest | Response with metadata, navigation, raw |
| TC-6.2a | TC-6.2a: re-parse after adding entry | Write manifest with 4 entries, call getManifest | 4 navigation entries returned |
| TC-6.2b | TC-6.2b: re-parse after removing entry | Write manifest with 2 entries | 2 entries returned |
| TC-6.3a | TC-6.3a: malformed YAML returns 422 | Write malformed manifest, call getManifest | 422 MANIFEST_PARSE_ERROR |
| TC-6.4a | TC-6.4a: empty navigation | Write manifest with frontmatter only | Empty navigation array returned |

#### `tests/client/package/manifest-editing.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-6.1b | TC-6.1b: manifest opens in a tab | Click edit manifest | Tab created for manifest file |
| TC-6.2c | TC-6.2c: reorder entries — sidebar reflects new order | Mock getManifest with reordered entries | Sidebar entries in new order |
| TC-6.2d | TC-6.2d: add group label — sidebar shows group | Mock getManifest with group | Group heading appears in sidebar |

**Non-TC tests:**
- Server: manifest re-parse with 3+ levels of nesting (1 test)
- Client: sidebar re-render performance with 100+ entries (1 test)

### Flow 6: Extracted Package Editing + Stale

#### `tests/server/package/stale-tracking.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-7.1a | TC-7.1a: edit in extracted package modifies temp dir | Open package, save file via /api/file/save | File in temp dir contains updated content |
| TC-7.2a | TC-7.2a: stale flag set after first edit | Open package, save any file | packageService.getState().stale === true |
| TC-7.2b | TC-7.2b: stale remains after multiple edits | Save two different files | stale remains true |

#### `tests/client/package/stale-indicator.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-7.1b | TC-7.1b: rendered view reflects edit | Save edit, switch to render mode | Rendered content matches saved content |
| TC-7.2c | TC-7.2c: stale not shown for directory-mode packages | Set packageState.mode = 'directory', save | No stale indicator visible |

**Non-TC test:** Server — stale flag persists in session state across simulated restart (1 test).

### Flow 7: No-Manifest Fallback + Cleanup

#### `tests/server/package/fallback.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-8.1a | TC-8.1a: no-manifest package returns fallback response | Open package with no manifest | manifestStatus 'missing', empty navigation |
| TC-8.1c | TC-8.1c: unreadable manifest triggers fallback | Open package with malformed manifest | manifestStatus 'unreadable', manifestError present |
| TC-8.3a | TC-8.3a: scaffold manifest in extracted package | Open no-manifest package, create manifest | Manifest created in temp dir, navigation returned |

#### `tests/server/package/temp-cleanup.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-9.1a | TC-9.1a: temp dir removed on package switch | Create temp dir, create new one | First temp dir removed |
| TC-9.2a | TC-9.2a: startup cleanup removes stale dirs | Create multiple mdv-pkg-* dirs, run cleanupStale | All stale dirs removed |

#### `tests/client/package/fallback.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-8.1b | TC-8.1b: files navigable in fallback mode | Set sidebarMode 'fallback', click file | File opens in content area |
| TC-8.2a | TC-8.2a: fallback indicator present | Set sidebarMode 'fallback', manifestStatus 'missing' | "No manifest" indicator visible |
| TC-8.2b | TC-8.2b: indicator not shown for regular folders | Set sidebarMode 'filesystem' | No fallback indicator |
| TC-8.2c | TC-8.2c: unreadable manifest shows distinct indicator | Set manifestStatus 'unreadable' | Indicator says "manifest could not be parsed" |
| TC-8.3b | TC-8.3b: scaffold in fallback with unreadable manifest shows overwrite confirmation | Set manifestStatus 'unreadable', trigger new package | Confirmation dialog shown |

**Non-TC test:** Server — startup cleanup with multiple stale dirs (1 test).

---

## Per-Chunk Test Summary

### Chunk 0: Infrastructure
| Test File | # Tests | TCs |
|-----------|---------|-----|
| `tests/server/package/schemas.test.ts` | 4 | Non-TC: schema validation |
| **Chunk Total** | **4** | |

### Chunk 1: Open Package + Package Sidebar
| Test File | # Tests | TCs |
|-----------|---------|-----|
| `tests/server/package/package-service.test.ts` | 6 | TC-1.1a–c, TC-1.4a, TC-1.4d + 1 non-TC |
| `tests/client/package/package-sidebar.test.ts` | 14 | TC-1.4b–c, TC-1.4e, TC-1.5a–b, TC-2.1a–c, TC-2.2a–b, TC-2.3a–c + 1 non-TC |
| **Chunk Total** | **20** | |
| **Running Total** | **24** | |

### Chunk 2: Mode Switching
| Test File | # Tests | TCs |
|-----------|---------|-----|
| `tests/server/package/mode-switching.test.ts` | 3 | TC-3.1a, TC-3.3a, TC-9.1a |
| `tests/client/package/mode-switching.test.ts` | 7 | TC-1.2a–b, TC-1.3a–c, TC-3.1b, TC-3.2a |
| **Chunk Total** | **10** | |
| **Running Total** | **34** | |

### Chunk 3: Package Creation
| Test File | # Tests | TCs |
|-----------|---------|-----|
| `tests/server/package/package-create.test.ts` | 7 | TC-4.1a–b, TC-4.1d, TC-4.2a–b, TC-4.3a + 1 non-TC |
| `tests/client/package/package-create.test.ts` | 2 | TC-4.1c, TC-4.4a |
| **Chunk Total** | **9** | |
| **Running Total** | **43** | |

### Chunk 4: Export to Package
| Test File | # Tests | TCs |
|-----------|---------|-----|
| `tests/server/package/package-export.test.ts` | 7 | TC-5.1a–c, TC-5.2a–b, TC-5.3a + 1 non-TC |
| `tests/client/package/package-export.test.ts` | 3 | TC-5.3b–c, TC-5.4a |
| **Chunk Total** | **10** | |
| **Running Total** | **53** | |

### Chunk 5: Manifest Editing
| Test File | # Tests | TCs |
|-----------|---------|-----|
| `tests/server/package/package-manifest.test.ts` | 6 | TC-6.1a, TC-6.2a–b, TC-6.3a, TC-6.4a + 1 non-TC |
| `tests/client/package/manifest-editing.test.ts` | 4 | TC-6.1b, TC-6.2c–d + 1 non-TC |
| **Chunk Total** | **10** | |
| **Running Total** | **63** | |

### Chunk 6: Stale Indicator
| Test File | # Tests | TCs |
|-----------|---------|-----|
| `tests/server/package/stale-tracking.test.ts` | 4 | TC-7.1a, TC-7.2a–b + 1 non-TC |
| `tests/client/package/stale-indicator.test.ts` | 2 | TC-7.1b, TC-7.2c |
| **Chunk Total** | **6** | |
| **Running Total** | **69** | |

### Chunk 7: Fallback + Cleanup
| Test File | # Tests | TCs |
|-----------|---------|-----|
| `tests/server/package/fallback.test.ts` | 3 | TC-8.1a, TC-8.1c, TC-8.3a |
| `tests/server/package/temp-cleanup.test.ts` | 3 | TC-9.1a, TC-9.2a + 1 non-TC |
| `tests/client/package/fallback.test.ts` | 5 | TC-8.1b, TC-8.2a–c, TC-8.3b |
| **Chunk Total** | **11** | |
| **Running Total** | **80** | |

---

## Test Count Reconciliation

| Source | Count |
|--------|-------|
| Per-file totals (summed above) | 80 |
| Per-chunk totals (summed above) | 4 + 20 + 10 + 9 + 10 + 10 + 6 + 11 = 80 |
| Index work breakdown summary | 80 |
| TC-mapped test functions | 68 |
| Non-TC decided tests | 12 |
| Arithmetic: 68 + 12 | 80 ✓ |
| Unique TCs from epic | 67 |

**Reconciliation note:** The epic has 67 unique TCs. These map to 68 test functions — nearly 1:1, with one TC (TC-9.1a) tested in two contexts across chunks (Chunk 2's mode-switching context AND Chunk 7's temp-cleanup context — both exercise temp dir removal but from different entry points). This cross-context coverage is intentional: mode-switching tests verify cleanup as a side effect of switching, while cleanup tests verify the TempDirManager directly. The 12 non-TC decided tests cover schema validation (4), integration round-trips (3), performance (1), session persistence (1), and recursive discovery (1), plus startup cleanup with multiple dirs (1) and render parity (1).

The 80 count represents individual test function calls (`it()` / `test()` blocks), not individual assertions.

---

## E2E Test Considerations

E2E tests for package viewer integration will be added as a future chunk or integrated into the epic's story-level E2E coverage. The primary test surface is:

- Open .mpk via File menu → verify sidebar shows manifest navigation
- Click navigation entry → verify document renders
- Switch modes (package ↔ filesystem) → verify sidebar changes
- Create package → verify manifest scaffolded
- Export package → verify file created
- Edit manifest → verify sidebar updates

These E2E tests would go in `tests/e2e/package.spec.ts` and run via `npm run test:e2e`. They build on the Epic 7 E2E infrastructure (global setup, fixture management, helpers). The E2E fixtures need `.mpk` files placed in the fixture workspace.

The E2E tests are not counted in the 80-test total above — they are a separate layer. The 80 tests are service mock tests (Vitest) that run fast in `npm run test`.

---

## Manual Verification Checklist

After TDD Green, verify manually:

1. [ ] Start dev server: `npm run dev`
2. [ ] Open a `.mpk` file via File → Open Package
3. [ ] Verify sidebar shows manifest navigation with correct hierarchy
4. [ ] Click entries — verify documents render (markdown, Mermaid, code blocks)
5. [ ] Verify metadata appears in sidebar header (title, version, author)
6. [ ] Open a regular folder — verify sidebar switches to filesystem mode
7. [ ] Open a different package — verify previous package tabs close
8. [ ] File → New Package in a folder — verify manifest scaffolded, sidebar switches
9. [ ] Edit the manifest — verify sidebar updates after save
10. [ ] Export to .mpk — verify file created
11. [ ] Open a no-manifest package — verify filesystem fallback with indicator
12. [ ] Edit a file in an extracted package — verify stale indicator appears
13. [ ] Re-export to original path — verify stale indicator clears

---

## Gorilla Testing Scenarios

### New capabilities to test:

- **Package sidebar navigation** — open a package with deep nesting (3+ levels), rapidly click through entries, expand/collapse groups, verify tree renders correctly and entries open the right documents. Look for rendering glitches, stale highlight state, or scroll position jumps.
- **Mode switching** — switch between filesystem and package mode repeatedly (open folder → open package → open different folder → open different package). Verify the sidebar fully replaces its content each time, no ghost entries from the previous mode remain, and tabs from the closed mode are cleaned up.
- **Package metadata display** — open packages with varying metadata completeness (full metadata, partial, none). Verify the sidebar header adapts correctly — no empty placeholders, no layout shift, filename fallback works when metadata is absent.
- **Manifest editing round-trip** — open a package, edit the manifest (add entries, remove entries, reorder, add group labels), save, and verify the sidebar updates live. Try malformed YAML — verify error indicator appears without crashing the sidebar.
- **Stale indicator lifecycle** — open an extracted package, edit a content file, verify stale indicator appears. Export to the original path — verify indicator clears. Export to a different path — verify indicator persists. Edit again after export — verify indicator reappears.
- **Package creation from folder** — use New Package on a directory with many files, nested subdirectories, and mixed file types. Verify the scaffolded manifest lists entries alphabetically, uses the directory name as the title, excludes dotfiles, and the sidebar switches to package mode. Try on an empty directory — verify the manifest is created with title but empty navigation. Verify New Package is disabled when viewing an extracted package (AC-4.4a).
- **Export flow** — export as both `.mpk` and `.mpkz`, then re-open the exported file. Verify round-trip fidelity: navigation structure matches, file content is identical, metadata preserved, relative links and images work in the reopened package. Check that export from a directory without a manifest does not create a manifest in the source directory and does not switch the source to package mode.
- **Unreadable manifest recovery** — open a package with a malformed/unreadable manifest. Verify a distinct "manifest could not be parsed" indicator (not the same as "no manifest"). Try New Package to scaffold a replacement — verify overwrite confirmation appears. After confirming, verify the sidebar transitions to package mode with the new manifest.

### Adjacent features to recheck:

- **Tab management during mode switches** — when switching from package mode to filesystem mode (or vice versa), tabs from the previous mode should close. Verify no orphaned tabs remain that reference files in cleaned-up temp directories. Try Cmd+W, Ctrl+Tab, and click-to-close on tabs during and after a mode switch.
- **File rendering in package context** — open package files containing Mermaid diagrams, code blocks with syntax highlighting, relative images, wide tables, and relative markdown links. Verify rendering parity with filesystem mode — the same file should look identical whether opened from a package or from disk. Relative links should open in new tabs. No stuck loading spinners on any document.
- **Session persistence** — open a package, navigate to several files, reload the page. Does the session restore correctly? Does the package sidebar reappear? Do tabs restore to the right files without stuck spinners?
- **File watching in extracted packages** — edit and save a file from an extracted package. Does the rendered view update? Does the dirty indicator behave correctly?
- **Theme switching** — switch themes while in package mode. Verify the package sidebar, metadata header, group headings, and stale indicator all render correctly in every theme.
- **Keyboard shortcuts** — verify Cmd+W, Ctrl+Tab, Cmd+E all work correctly when tabs are opened from package navigation.

### Edge cases for agent exploration:

- **Rapid package switching** — open package A, immediately open package B before A finishes loading. Look for race conditions: stale sidebar content, temp directory cleanup failures, orphaned tabs.
- **Large package stress** — open a package with 100+ navigation entries and many files. Scroll the sidebar rapidly, open many tabs at once. Look for performance degradation, layout breakdowns, or memory pressure.
- **Corrupted/unusual packages** — try opening a `.mpk` that is actually a text file, a zero-byte file, a file with the wrong extension. Verify graceful error handling, no console errors, no stuck loading states.
- **Manifest with edge-case content** — packages where the manifest has Unicode characters in entry names, very long entry names that might overflow the sidebar, or entries pointing to non-markdown files (images, CSVs).
- **Drag-and-drop exploration** — drag various file types onto the app window: `.mpk`, `.mpkz`, `.md`, `.txt`, folders. Verify only valid package files trigger package mode, everything else either falls through to filesystem handling or is ignored gracefully.
- **No-manifest fallback interactions** — open a package without a manifest, verify fallback mode with "no manifest" indicator. Then scaffold a manifest via New Package. Verify the sidebar transitions from fallback to package mode smoothly. Also test fallback with an unreadable manifest — verify a distinct indicator and overwrite confirmation on scaffold.
- **Manifest entry removal with open tab** — open a package, open a document in a tab, then edit the manifest to remove that entry. Save the manifest. Verify the sidebar updates (entry disappears), the open tab still works (file still exists in temp dir), and active tab highlighting doesn't break.
- **Console errors and loading states** — throughout all package interactions, check the browser console for unexpected errors or warnings. Verify no loading spinners get stuck at any point during package open, mode switch, export, or manifest edit.
