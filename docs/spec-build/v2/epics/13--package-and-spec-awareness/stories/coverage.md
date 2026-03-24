# Epic 13: Coverage Artifact

Proves every AC and TC from the epic is assigned to exactly one story, with no gaps.

---

## Integration Path Trace

### Path 1: Package-Aware Chat Message

The developer has a package open and sends a message. The Steward receives package context and responds with awareness.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Client sends chat:send with activeDocumentPath | Unchanged from Epic 12 | — (Epic 12) | — |
| Server reads session state for activePackage | Determine workspace type and package mode | Story 1 | TC-1.1a |
| Server reads manifest from PackageService | Build package context with metadata and navigation | Story 1 | TC-1.1a, TC-1.3b |
| Server extracts spec metadata from frontmatter | Populate spec field if type: spec | Story 5 | TC-5.1a |
| Server runs phase detection on navigation entries | Detect artifacts and infer pipeline phase | Story 5 | TC-6.1a |
| Server builds `<workspace-context>` XML block | Include metadata, navigation, spec phase in prompt | Story 1 | TC-1.3a |
| Server sends extended chat:context to client | Workspace type, packageTitle, warning | Story 1 | TC-1.2a |
| Client updates context indicator | Package icon + title + separator + document path | Story 1 | TC-1.2a |
| Steward responds with package awareness | Navigation tree in context enables structure questions | Story 1 | TC-1.3a |

### Path 2: Multi-File Reading and Cross-Document Query

The developer asks a question spanning multiple files. The Steward reads files via script blocks.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Developer asks cross-document question | Question requiring information from multiple files | Story 2 | TC-2.2a |
| Steward emits script block for first file | `getFileContent('docs/prd.md')` | Story 2 | TC-2.1a |
| Server resolves path and validates | Path traversal prevention | Story 2 | TC-2.1d |
| Server reads file from workspace | File content returned | Story 2 | TC-2.1a |
| Server checks and consumes read budget | Budget tracked per response turn | Story 2 | TC-2.2c |
| Steward emits script block for second file | `getFileContent('docs/epic.md')` | Story 2 | TC-2.2a |
| Server reads second file, budget consumed | Both files now available to Steward | Story 2 | TC-2.2b |
| Steward synthesizes response | Uses content from both files | Story 2 | TC-2.2a |

### Path 3: Package Operation Through Chat (Manifest Update)

The developer asks to modify the navigation. The Steward updates the manifest and the sidebar re-syncs.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Developer asks to add file to navigation | "Add docs/api.md to the navigation" | Story 3 | TC-3.1a |
| Steward emits script block for updateManifest | Calls updateManifest with modified content | Story 3 | TC-3.1a |
| Server validates manifest via parseManifest() | Reject malformed content | Story 3 | TC-3.1d |
| Server writes manifest atomically | Temp file + rename | Story 3 | TC-3.1a |
| Server marks stale if extracted package | markStaleIfExtracted() | Story 3 | TC-3.6c |
| Server sends chat:package-changed | `change: 'manifest-updated'` | Story 3 | TC-3.4a |
| Client receives chat:package-changed | Dispatches package-changed event | Story 3 | TC-3.4a |
| Client re-fetches manifest | GET /api/package/manifest | Story 3 | TC-3.4a |
| Client updates sidebar navigation tree | New navigation entry visible | Story 3 | TC-3.1a |

### Path 4: Folder-to-Package Transition

The developer has a regular folder open and asks to create a package.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Developer says "create a package" | Folder mode, no manifest | Story 6 | TC-7.1a |
| Steward emits createPackage() script | Script execution | Story 6 | TC-7.1a |
| Server calls PackageService.create() | Scaffolds manifest | Story 6 | TC-7.1a |
| Session updated to activePackage mode: directory | Workspace type becomes package | Story 3 | TC-3.5a |
| Server sends chat:package-changed created | `change: 'created'` | Story 3 | TC-3.4b |
| Client switches sidebar to package mode | Fetches manifest, activates package navigation | Story 3 | TC-3.4b |
| Next message has package context | workspace.type === 'package', mode: 'directory' | Story 3 | TC-3.5a |
| Context indicator shows package mode | Package title visible | Story 3 | TC-3.5c |

---

## Coverage Gate

Every AC and TC from the epic mapped to exactly one story.

| AC | TC | Story |
|---|---|---|
| AC-1.1 | TC-1.1a, TC-1.1b, TC-1.1c, TC-1.1d | Story 1 |
| AC-1.2 | TC-1.2a, TC-1.2b, TC-1.2c, TC-1.2d | Story 1 |
| AC-1.3 | TC-1.3a, TC-1.3b | Story 1 |
| AC-2.1 | TC-2.1a, TC-2.1b, TC-2.1c, TC-2.1d | Story 2 |
| AC-2.2 | TC-2.2a, TC-2.2b, TC-2.2c, TC-2.2d | Story 2 |
| AC-2.3 | TC-2.3a, TC-2.3b, TC-2.3c | Story 2 |
| AC-2.4 | TC-2.4a, TC-2.4b | Story 2 |
| AC-3.1 | TC-3.1a, TC-3.1b, TC-3.1c, TC-3.1d | Story 3 |
| AC-3.2 | TC-3.2a, TC-3.2b, TC-3.2c, TC-3.2d, TC-3.2e | Story 3 |
| AC-3.3 | TC-3.3a, TC-3.3b | Story 3 |
| AC-3.4 | TC-3.4a, TC-3.4b, TC-3.4c | Story 3 |
| AC-3.5 | TC-3.5a, TC-3.5b, TC-3.5c | Story 3 |
| AC-3.6 | TC-3.6a, TC-3.6b, TC-3.6c, TC-3.6d | Story 3 |
| AC-4.1 | TC-4.1a, TC-4.1b, TC-4.1c, TC-4.1d, TC-4.1e | Story 4 |
| AC-4.2 | TC-4.2a, TC-4.2b, TC-4.2c, TC-4.2d, TC-4.2e, TC-4.2f | Story 4 |
| AC-4.3 | TC-4.3a | Story 4 |
| AC-5.1 | TC-5.1a, TC-5.1b, TC-5.1c | Story 5 |
| AC-5.2 | TC-5.2a, TC-5.2b | Story 5 |
| AC-5.3 | TC-5.3a, TC-5.3b | Story 5 |
| AC-6.1 | TC-6.1a, TC-6.1b, TC-6.1c, TC-6.1d, TC-6.1e | Story 5 |
| AC-6.2 | TC-6.2a, TC-6.2b, TC-6.2c | Story 5 |
| AC-6.3 | TC-6.3a, TC-6.3b | Story 5 |
| AC-7.1 | TC-7.1a, TC-7.1b, TC-7.1c, TC-7.1d, TC-7.1e | Story 6 |
| AC-7.2 | TC-7.2a, TC-7.2b | Story 6 |
| AC-7.3 | TC-7.3a, TC-7.3b, TC-7.3c | Story 6 |
| AC-8.1 | TC-8.1a, TC-8.1b, TC-8.1c | Story 6 |
| AC-8.2 | TC-8.2a, TC-8.2b | Story 6 |
| AC-8.3 | TC-8.3a, TC-8.3b | Story 6 |

---

## Verification

### AC Count

| Metric | Value |
|---|---|
| Total ACs in epic | 28 |
| ACs mapped to stories | 28 |
| Unmapped ACs | 0 |

### TC Count

| Metric | Value |
|---|---|
| Total TCs in epic | 90 |
| TCs mapped to stories | 90 |
| Unmapped TCs | 0 |
| Duplicate-assigned TCs | 0 |

### Per-Story TC Breakdown

| Story | ACs | TC Count |
|---|---|---|
| Story 0 | (infrastructure — no ACs) | 0 TC-mapped |
| Story 1 | AC-1.1, AC-1.2, AC-1.3 | 10 |
| Story 2 | AC-2.1, AC-2.2, AC-2.3, AC-2.4 | 13 |
| Story 3 | AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5, AC-3.6 | 21 |
| Story 4 | AC-4.1, AC-4.2, AC-4.3 | 12 |
| Story 5 | AC-5.1, AC-5.2, AC-5.3, AC-6.1, AC-6.2, AC-6.3 | 17 |
| Story 6 | AC-7.1, AC-7.2, AC-7.3, AC-8.1, AC-8.2, AC-8.3 | 17 |
| **Total** | **28 ACs** | **90 TCs** |

### Test Count Alignment (from test plan)

| Story | Chunk | TC-mapped tests | Non-TC tests | Total tests |
|---|---|---|---|---|
| Story 0 | Chunk 0 | 0 | 11 | 11 |
| Story 1 | Chunk 1 | 10 | 6 | 16 |
| Story 2 | Chunk 2 | 13 | 5 | 18 |
| Story 3 | Chunk 4 | 21 | 5 | 26 |
| Story 4 | Chunk 3 | 12 | 4 | 16 |
| Story 5 | Chunk 5 | 17 | 3 | 20 |
| Story 6 | Chunk 6 | 17 | 5 | 22 |
| **Total** | | **90** | **39** | **129** |

Note: Epic stories and tech design chunks have different numbering for Stories 3/4. Story 3 (Package Operations) = Chunk 4. Story 4 (File Operations) = Chunk 3. This is because the tech design reordered to place file operations before package operations (file ops are a prerequisite). The AC/TC mapping is identical — only the implementation order differs.

### Story Dependency Graph

```
Story 0 (Foundation)
    ↓
Story 1 (Package Context + Indicator)
    ↓
    ├──→ Story 2 (Multi-File Reading)
    │        ↓
    │    Story 4 (File Create/Edit)
    │        ↓
    │    Story 3 (Package Operations) ←─── requires Story 4
    │
    └──→ Story 5 (Spec + Phase)
              ↓
         Story 6 (Folder-Mode + Errors) ←── requires Stories 3 and 5
```

Stories 2→4→3 (file operations) and Story 5 (spec awareness) can proceed in parallel after Story 1. Story 6 depends on both branches.

---

## Validation Checklist

- [x] Every AC from the detailed epic appears in the story file (28/28)
- [x] Every TC from the detailed epic appears in exactly one story (90/90)
- [x] Integration path trace complete with no gaps (4 paths traced)
- [x] Coverage gate table complete with no orphans
- [x] Each story has Jira section markers
- [x] TC wording is exact match to epic (Given/When/Then preserved)
- [x] Each story has a complete narrative (summary, description, AC/TC, tech design, DoD)
- [x] Technical notes surface relevant tech design guidance for each story's scope
- [x] Story dependency graph is consistent with tech design chunk dependencies
- [x] Test count alignment verified against test plan (129 tests)
