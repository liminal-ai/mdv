# Test Plan: Package and Spec Awareness (Epic 13)

Companion to `tech-design.md`. This document provides TC→test mapping, mock strategy, test fixtures, and chunk breakdown with test counts.

---

## Mock Strategy

### Mock Boundaries

Following the service mock philosophy established in Epics 1-12: mock at external boundaries, exercise internal code for real.

| Boundary | Mock? | How |
|----------|-------|-----|
| **PackageService** (Epic 9) | Yes | `vi.mock()` — external service boundary. Methods: `getManifest()`, `create(rootDir, overwrite?)`, `export(outputPath, compress?, sourceDir?)`, `markStale()`, `clearStale()`, `getState()` |
| **Epic 8 Library** (manifest/scaffold) | Yes | `vi.mock()` — for `scaffoldManifest()`, `parseManifest()`, `MANIFEST_FILENAME` used directly in fallback repair and updateManifest |
| **SessionService** (Epic 1) | Yes | `vi.mock()` — external service. Method: `getSession()` returns mock `SessionState` |
| **Filesystem** (`node:fs/promises`) | Yes | `vi.mock('node:fs/promises')` — mock `readFile`, `writeFile`, `rename`, `mkdir`, `stat`, `access` |
| **js-yaml** | No | Lightweight, fast, in-process — exercise for real |
| **PhaseDetector** | No | Pure function — exercise for real |
| **PackageContextService** | No | In-process logic — exercise through entry points |
| **ContextInjection** | Partially | Test `buildInjectedContext()` with mocked services, not mocked internal logic |
| **ScriptExecutor context methods** | No | Test through the executor — they ARE the code under test |
| **WebSocket** | Yes | `vi.mock('ws')` or Fastify inject — mock the transport |
| **DOM** (client tests) | Via JSDOM | Standard test DOM from existing test infrastructure |

### Test File Organization

```
tests/
├── server/
│   └── steward/
│       ├── package-context.test.ts       # PackageContextService
│       ├── phase-detector.test.ts        # Pure function tests
│       ├── context-injection-pkg.test.ts # Extended context injection
│       ├── script-file-ops.test.ts       # getFileContent, addFile, editFile
│       ├── script-package-ops.test.ts    # getPackageManifest, updateManifest, createPackage, exportPackage
│       ├── ws-chat-package.test.ts       # WebSocket route extensions
│       └── schemas-package.test.ts       # New Zod schema validation
├── client/
│   └── steward/
│       ├── context-indicator-pkg.test.ts # Extended context indicator
│       └── chat-package-changed.test.ts  # chat:package-changed handling
└── fixtures/
    └── packages/
        ├── spec-package/                 # Package with spec metadata
        │   └── _nav.md                   # Manifest with type: spec, specPhase, specStatus
        ├── general-package/              # Package without spec metadata
        │   └── _nav.md                   # Manifest with title, version only
        ├── no-manifest-package/          # Package with no manifest
        ├── malformed-manifest/           # Package with invalid YAML
        ├── prd-only/                     # Spec package with prd.md only
        ├── prd-and-epic/                 # Spec package with prd.md and epic.md
        ├── full-spec/                    # Spec package with all artifact types
        ├── large-file.md                 # File exceeding truncation budget
        ├── binary-file.png               # Binary file for NOT_TEXT_FILE test
        └── sample-manifest-content.md    # Raw manifest content for parsing tests
```

### Fixture Definitions

```typescript
// tests/fixtures/packages/index.ts

export const SPEC_PACKAGE_MANIFEST = `---
title: Test Spec Package
version: "1.0"
author: Test Author
type: spec
specPhase: epic
specStatus: draft
---

- [Product Requirements](prd.md)
- [Epic](epic.md)
  - [Tech Design](tech-design.md)
- Stories
  - [Story 1](stories/story-1.md)
`;

export const GENERAL_PACKAGE_MANIFEST = `---
title: General Docs
version: "2.0"
---

- [Getting Started](getting-started.md)
- [API Reference](api/reference.md)
`;

export const MALFORMED_MANIFEST = `---
title: Broken
specPhase: [invalid yaml
---

- [Doc](doc.md)
`;

export const mockSessionWithPackage = (overrides?: Partial<unknown>): SessionState => ({
  lastRoot: '/workspace',
  activePackage: {
    sourcePath: '/path/to/project.mpk',
    extractedRoot: '/tmp/md-viewer-pkg-abc123',
    format: 'mpk' as const,
    mode: 'extracted' as const,
    stale: false,
    manifestStatus: 'present' as const,
    ...overrides,
  },
  // ... other session fields
});

export const mockSessionFolder = (): SessionState => ({
  lastRoot: '/workspace',
  activePackage: null,
  // ... other session fields
});

export const mockSessionDirectoryPackage = (): SessionState => ({
  lastRoot: '/workspace',
  activePackage: {
    sourcePath: '/workspace',
    extractedRoot: '/workspace',
    format: 'mpk' as const,
    mode: 'directory' as const,
    stale: false,
    manifestStatus: 'present' as const,
  },
  // ... other session fields
});

export const mockNavigationTree = (): NavigationNode[] => [
  { displayName: 'Product Requirements', filePath: 'prd.md', children: [] },
  { displayName: 'Epic', filePath: 'epic.md', children: [
    { displayName: 'Tech Design', filePath: 'tech-design.md', children: [] },
  ]},
  { displayName: 'Stories', filePath: undefined, isGroup: true, children: [
    { displayName: 'Story 1', filePath: 'stories/story-1.md', children: [] },
  ]},
];
```

---

## TC → Test Mapping

### Chunk 0: Infrastructure (10 tests)

All non-TC tests — schema validation and phase detector unit tests.

| Test | Test File | Test Description |
|------|-----------|------------------|
| Schema-1 | schemas-package.test.ts | ChatPackageChangedMessageSchema validates correct message |
| Schema-2 | schemas-package.test.ts | ChatPackageChangedMessageSchema rejects missing change field |
| Schema-3 | schemas-package.test.ts | Extended ChatContextMessageSchema validates workspace field with rootPath |
| Schema-4 | schemas-package.test.ts | New error codes are valid ChatErrorCode values |
| Schema-5 | schemas-package.test.ts | ChatOpenDocumentMessageSchema validates correct message |
| Phase-1 | phase-detector.test.ts | detectArtifacts with prd.md returns ['prd'] |
| Phase-2 | phase-detector.test.ts | detectArtifacts with epic.md returns ['epic'] |
| Phase-3 | phase-detector.test.ts | detectArtifacts with tech-design.md returns ['tech-design'] |
| Phase-4 | phase-detector.test.ts | detectArtifacts with stories/ dir returns ['stories'] |
| Phase-5 | phase-detector.test.ts | inferPhase with ['prd', 'epic'] returns 'epic' |
| Phase-6 | phase-detector.test.ts | detectArtifacts with empty navigation returns [] |

### Chunk 1: Package Context + Indicator (16 tests)

| TC | Test File | Test Description |
|----|-----------|------------------|
| TC-1.1a | package-context.test.ts | Package context includes metadata and navigation when package open |
| TC-1.1b | package-context.test.ts | No package context when folder is open |
| TC-1.1c | context-injection-pkg.test.ts | Package context updates when session changes to different package |
| TC-1.1d | package-context.test.ts | Manifest-less package provides minimal context with manifestStatus |
| TC-1.2a | context-indicator-pkg.test.ts | Package mode shows icon + title + separator + document path |
| TC-1.2b | context-indicator-pkg.test.ts | Folder mode shows only document path (unchanged from Epic 12) |
| TC-1.2c | context-indicator-pkg.test.ts | Package mode with no document shows only package title |
| TC-1.2d | context-indicator-pkg.test.ts | Package mode with truncated doc shows title + path + badge |
| TC-1.3a | context-injection-pkg.test.ts | Workspace context block includes navigation tree |
| TC-1.3b | context-injection-pkg.test.ts | Workspace context block includes metadata fields |
| (non-TC) | package-context.test.ts | Package context with malformed manifest returns unreadable status |
| (non-TC) | context-injection-pkg.test.ts | Context injection with package but no active document omits document block |
| (non-TC) | context-indicator-pkg.test.ts | Indicator DOM has correct flex structure and classes |
| (non-TC) | context-injection-pkg.test.ts | System prompt includes all 7 new method descriptions |
| (non-TC) | ws-chat-package.test.ts | chat:context message includes workspace type |
| (non-TC) | ws-chat-package.test.ts | chat:context message includes packageTitle when package open |

### Chunk 2: Multi-File Reading (18 tests)

| TC | Test File | Test Description |
|----|-----------|------------------|
| TC-2.1a | script-file-ops.test.ts | getFileContent reads file by relative path |
| TC-2.1b | script-file-ops.test.ts | getFileContent resolves navigation display name path (via Steward, verified by correct path in script call) |
| TC-2.1c | script-file-ops.test.ts | getFileContent returns error for nonexistent file |
| TC-2.1d | script-file-ops.test.ts | getFileContent blocks path traversal (../../etc/passwd) |
| TC-2.2a | script-file-ops.test.ts | Two getFileContent calls in same response both succeed |
| TC-2.2b | script-file-ops.test.ts | Three sequential getFileContent calls all return content |
| TC-2.2c | script-file-ops.test.ts | getFileContent returns error when read budget exceeded |
| TC-2.2d | script-file-ops.test.ts | Read budget resets on new message (new ReadBudgetTracker) |
| TC-2.3a | script-file-ops.test.ts | File within budget returned fully (truncated: false) |
| TC-2.3b | script-file-ops.test.ts | Large file returned truncated with indicator and totalLines |
| TC-2.3c | script-file-ops.test.ts | Binary file returns NOT_TEXT_FILE error |
| TC-2.4a | script-file-ops.test.ts | getFileContent works in folder mode (resolve against lastRoot) |
| TC-2.4b | script-file-ops.test.ts | getFileContent works in extracted package (resolve against extractedRoot) |
| (non-TC) | script-file-ops.test.ts | ReadBudgetTracker.canConsume returns false at limit |
| (non-TC) | script-file-ops.test.ts | Path with symlink escaping root is blocked |
| (non-TC) | script-file-ops.test.ts | Empty file returns empty string with truncated: false |
| (non-TC) | script-file-ops.test.ts | File with mixed encoding reads as UTF-8 |
| (non-TC) | script-file-ops.test.ts | TC-2.1b coverage: getFileContent with path resolved from manifest display name (same mechanism as TC-2.1a but verifies the resolved-path pattern the Steward uses) |

### Chunk 3: File Creation and Non-Active Editing (16 tests)

| TC | Test File | Test Description |
|----|-----------|------------------|
| TC-4.1a | script-file-ops.test.ts | addFile creates new markdown file and sends file-created |
| TC-4.1b | script-file-ops.test.ts | addFile creates intermediate directories |
| TC-4.1c | script-file-ops.test.ts | addFile returns error when file already exists |
| TC-4.1d | script-file-ops.test.ts | addFile blocks path traversal |
| TC-4.1e | script-file-ops.test.ts | addFile returns error on permission denied |
| TC-4.2a | script-file-ops.test.ts | editFile writes content to non-active file and sends file-created |
| TC-4.2b | script-file-ops.test.ts | editFile on clean non-active tab triggers file-created (auto-refresh) |
| TC-4.2c | script-file-ops.test.ts | editFile writes to disk (dirty tab conflict handled by watcher) |
| TC-4.2d | script-file-ops.test.ts | editFile returns error for nonexistent file |
| TC-4.2e | script-file-ops.test.ts | editFile blocks path traversal |
| TC-4.2f | script-file-ops.test.ts | editFile returns error on permission denied |
| TC-4.3a | script-file-ops.test.ts | applyEditToActiveDocument still works (Epic 12 method unchanged) |
| (non-TC) | script-file-ops.test.ts | addFile with empty content creates empty file |
| (non-TC) | script-file-ops.test.ts | editFile on manifest file sends both file-created and package-changed |
| (non-TC) | script-file-ops.test.ts | Atomic write pattern — temp file created then renamed |
| (non-TC) | script-file-ops.test.ts | addFile in extracted package marks stale |

### Chunk 4: Package Operations Through Chat (26 tests)

| TC | Test File | Test Description |
|----|-----------|------------------|
| TC-3.1a | script-package-ops.test.ts | updateManifest adds navigation entry, sends package-changed |
| TC-3.1b | script-package-ops.test.ts | updateManifest removes entry, sidebar shows fewer entries |
| TC-3.1c | script-package-ops.test.ts | updateManifest reorders entries, sidebar reflects new order |
| TC-3.1d | script-package-ops.test.ts | updateManifest with malformed YAML returns error, manifest unchanged |
| TC-3.2a | script-package-ops.test.ts | exportPackage creates .mpk file, sends package-changed |
| TC-3.2b | script-package-ops.test.ts | exportPackage with compress: true creates .mpkz file |
| TC-3.2c | script-package-ops.test.ts | exportPackage with non-writable path returns error |
| TC-3.2d | script-package-ops.test.ts | Export to original source path clears stale indicator |
| TC-3.2e | script-package-ops.test.ts | Export to different path preserves stale indicator |
| TC-3.3a | script-package-ops.test.ts | openDocument sends chat:open-document (not chat:file-created), client calls openFileInTab |
| TC-3.3b | script-package-ops.test.ts | openDocument with path outside root returns error |
| TC-3.4a | chat-package-changed.test.ts | Client re-fetches manifest on manifest-updated |
| TC-3.4b | chat-package-changed.test.ts | Client switches to package mode on created |
| TC-3.4c | chat-package-changed.test.ts | Client shows export success (no sidebar change) |
| TC-3.5a | script-package-ops.test.ts | After createPackage on folder, workspace type becomes package |
| TC-3.5b | script-package-ops.test.ts | Canonical identity preserved (folder path unchanged) after createPackage |
| TC-3.5c | chat-package-changed.test.ts | Context indicator updates to show package mode after create |
| TC-3.6a | script-package-ops.test.ts | addFile in extracted package triggers stale |
| TC-3.6b | script-package-ops.test.ts | editFile in extracted package triggers stale |
| TC-3.6c | script-package-ops.test.ts | updateManifest in extracted package triggers stale |
| TC-3.6d | script-package-ops.test.ts | addFile in directory-mode package does NOT trigger stale |
| (non-TC) | chat-package-changed.test.ts | Client re-fetches manifest after chat:package-changed |
| (non-TC) | script-package-ops.test.ts | exportPackage to existing file overwrites it |
| (non-TC) | script-package-ops.test.ts | createPackage in folder updates session activePackage state |
| (non-TC) | script-package-ops.test.ts | Concurrent updateManifest — second write wins (atomic) |
| (non-TC) | ws-chat-package.test.ts | chat:package-changed arrives before chat:done |

### Chunk 5: Spec Conventions + Phase Awareness (20 tests)

| TC | Test File | Test Description |
|----|-----------|------------------|
| TC-5.1a | package-context.test.ts | Spec metadata (type, specPhase, specStatus) included in context |
| TC-5.1b | package-context.test.ts | No spec metadata → spec field absent from context |
| TC-5.1c | package-context.test.ts | Partial spec metadata (type: spec, no specPhase) → type included, phase absent |
| TC-5.2a | script-package-ops.test.ts | updateManifest changes specPhase, next context reflects update |
| TC-5.2b | script-package-ops.test.ts | updateManifest adds type: spec to general package |
| TC-5.3a | package-context.test.ts | Spec package populates spec field with artifacts and phases |
| TC-5.3b | package-context.test.ts | Non-spec package has no spec field |
| TC-6.1a | phase-detector.test.ts | PRD only → detected phase 'prd', artifacts ['prd'] |
| TC-6.1b | phase-detector.test.ts | PRD + epic → detected phase 'epic', artifacts ['prd', 'epic'] |
| TC-6.1c | phase-detector.test.ts | Full set → detected phase 'stories', artifacts include all types |
| TC-6.1d | phase-detector.test.ts | No recognizable artifacts → no phase, empty artifact list |
| TC-6.1e | package-context.test.ts | Declared metadata overrides detected phase |
| TC-6.2a | context-injection-pkg.test.ts | Context at prd phase includes phase info for guidance |
| TC-6.2b | context-injection-pkg.test.ts | Context at epic phase includes both artifacts |
| TC-6.2c | context-injection-pkg.test.ts | Non-spec package has no phase guidance in context |
| TC-6.3a | context-injection-pkg.test.ts | Phase info is data in context, not enforcement — no operation blocked |
| TC-6.3b | script-file-ops.test.ts | addFile succeeds regardless of detected phase (no gating) |
| (non-TC) | phase-detector.test.ts | Phase detector with duplicate artifact types deduplicates |
| (non-TC) | package-context.test.ts | Spec metadata extraction with malformed YAML returns null |
| (non-TC) | package-context.test.ts | js-yaml parses valid frontmatter correctly |

### Chunk 6: Folder-Mode Chat + Error Handling (22 tests)

| TC | Test File | Test Description |
|----|-----------|------------------|
| TC-7.1a | script-package-ops.test.ts | createPackage in folder mode scaffolds manifest, sends package-changed |
| TC-7.1b | script-package-ops.test.ts | createPackage when manifest exists returns error (no overwrite) |
| TC-7.1c | script-package-ops.test.ts | createPackage with overwrite: true replaces existing manifest |
| TC-7.1d | script-package-ops.test.ts | createPackage in extracted package with missing manifest scaffolds and triggers stale |
| TC-7.1e | script-package-ops.test.ts | createPackage with overwrite in extracted package with unreadable manifest replaces and triggers stale |
| TC-7.2a | script-package-ops.test.ts | exportPackage in folder mode auto-scaffolds manifest in memory |
| TC-7.2b | script-package-ops.test.ts | exportPackage with existing manifest uses it |
| TC-7.3a | script-file-ops.test.ts | addFile works in folder mode |
| TC-7.3b | script-file-ops.test.ts | getFileContent works in folder mode |
| TC-7.3c | script-file-ops.test.ts | editFile works in folder mode |
| TC-8.1a | ws-chat-package.test.ts | getFileContent error returns descriptive result to CLI |
| TC-8.1b | ws-chat-package.test.ts | exportPackage error returns descriptive result, no partial file |
| TC-8.1c | ws-chat-package.test.ts | updateManifest error returns descriptive result, manifest unchanged |
| TC-8.2a | context-injection-pkg.test.ts | Package service failure → message sent without package context |
| TC-8.2b | context-injection-pkg.test.ts | Malformed manifest → context includes manifestStatus: 'unreadable' |
| TC-8.3a | ws-chat-package.test.ts | Feature flag disabled → no package context constructed |
| TC-8.3b | context-indicator-pkg.test.ts | Feature flag disabled → no package indicator present |
| (non-TC) | ws-chat-package.test.ts | All script method errors produce descriptive error results |
| (non-TC) | script-package-ops.test.ts | Export folder with mixed file types includes all |
| (non-TC) | ws-chat-package.test.ts | ReadBudgetTracker created fresh per chat:send |
| (non-TC) | context-injection-pkg.test.ts | Context degradation: package context error does not prevent message dispatch |
| (non-TC) | ws-chat-package.test.ts | Error codes match ChatErrorCodeSchema values |

---

## Test Count Reconciliation

### Per-File Totals

| Test File | Chunk 0 | Chunk 1 | Chunk 2 | Chunk 3 | Chunk 4 | Chunk 5 | Chunk 6 | Total |
|-----------|---------|---------|---------|---------|---------|---------|---------|-------|
| schemas-package.test.ts | 5 | — | — | — | — | — | — | 5 |
| phase-detector.test.ts | 6 | — | — | — | — | 5 | — | 11 |
| package-context.test.ts | — | 4 | — | — | — | 8 | — | 12 |
| context-injection-pkg.test.ts | — | 5 | — | — | — | 4 | 3 | 12 |
| script-file-ops.test.ts | — | — | 18 | 16 | — | 1 | 3 | 38 |
| script-package-ops.test.ts | — | — | — | — | 20 | 2 | 8 | 30 |
| ws-chat-package.test.ts | — | 2 | — | — | 1 | — | 7 | 10 |
| context-indicator-pkg.test.ts | — | 5 | — | — | — | — | 1 | 6 |
| chat-package-changed.test.ts | — | — | — | — | 5 | — | — | 5 |
| **Per-Chunk Total** | **11** | **16** | **18** | **16** | **26** | **20** | **22** | **129** |

Column verification:
- Chunk 0: 5+6 = 11 ✓
- Chunk 1: 4+5+5+2 = 16 ✓
- Chunk 2: 18 = 18 ✓
- Chunk 3: 16 = 16 ✓
- Chunk 4: 20+1+5 = 26 ✓
- Chunk 5: 5+8+4+2+1 = 20 ✓
- Chunk 6: 3+8+7+3+1 = 22 ✓

### Cross-Check

| Metric | Value |
|--------|-------|
| Total TCs in epic | 90 |
| TCs mapped to tests | 90 |
| Non-TC decided tests | 39 |
| **Total tests** | **129** |
| Per-file sum | 5 + 11 + 12 + 12 + 38 + 30 + 10 + 6 + 5 = **129** ✓ |
| Per-chunk sum | 11 + 16 + 18 + 16 + 26 + 20 + 22 = **129** ✓ |
| Index work breakdown sum | 11 + 16 + 18 + 16 + 26 + 20 + 22 = **129** ✓ |

Note: Some TCs appear to have duplicate coverage across chunks (e.g., TC-2.1b is functionally covered by TC-2.1a). These are counted once in the TC total. The 90 TC count matches the epic's stated 90 TCs.

---

## Verification Gates Per Chunk

| Chunk | Red Exit | Green Exit |
|-------|----------|------------|
| 0 | `npm run red-verify` — schemas compile, phase detector compiles | `npm run verify` — schema tests pass, phase detector tests pass |
| 1 | `npm run red-verify` — package context compiles, indicator compiles | `npm run green-verify` — all Chunk 0-1 tests pass, test files unchanged |
| 2 | `npm run red-verify` — getFileContent compiles with budget | `npm run green-verify` — all Chunk 0-2 tests pass |
| 3 | `npm run red-verify` — addFile, editFile compile | `npm run green-verify` — all Chunk 0-3 tests pass |
| 4 | `npm run red-verify` — package ops compile, client handler compiles | `npm run green-verify` — all Chunk 0-4 tests pass |
| 5 | `npm run red-verify` — spec metadata extraction compiles | `npm run green-verify` — all Chunk 0-5 tests pass |
| 6 | `npm run red-verify` — folder-mode tests compile | `npm run verify-all` — all tests pass including E2E |
