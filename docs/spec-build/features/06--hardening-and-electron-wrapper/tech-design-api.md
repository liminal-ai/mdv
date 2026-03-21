# Technical Design: Epic 6 — API (Server)

Epic 6 introduces no new Fastify API endpoints. The server changes are limited to extending the `SessionState` schema for richer tab persistence and hardening the tree scan and file read paths for scale and edge cases.

---

## Schemas: Extended

### PersistedTab Schema Migration

The existing `openTabs` field in `SessionStateSchema` stores tab paths as `string[]`. Epic 6 extends this to `PersistedTab[]` to persist per-tab mode and scroll position. The migration is backward-compatible — the Zod schema accepts both shapes.

**Current schema (Epics 2–5):**

```typescript
// In schemas/index.ts
openTabs: z.array(AbsolutePathSchema).default([]),
activeTab: AbsolutePathSchema.nullable().default(null),
```

**New schema (Epic 6):**

```typescript
export const PersistedTabSchema = z.object({
  path: AbsolutePathSchema,
  mode: OpenModeSchema,
  scrollPosition: z.number().nonnegative().optional(),
});

// Union accepts legacy string OR new object shape.
// Legacy strings default to 'render' at the schema level. The client applies
// session.defaultOpenMode during tab restore — the schema can't reference
// session state at parse time.
const LegacyOrPersistedTab = z.union([
  AbsolutePathSchema.transform((path): z.infer<typeof PersistedTabSchema> => ({
    path,
    mode: 'render',  // default; client overrides with session.defaultOpenMode
  })),
  PersistedTabSchema,
]);

// In SessionStateSchema:
openTabs: z.array(LegacyOrPersistedTab).default([]),
activeTab: AbsolutePathSchema.nullable().default(null),  // unchanged
```

**Migration behavior:** On first load after upgrade, any existing `session.json` with `openTabs: ["/path/a.md", "/path/b.md"]` parses successfully. Each string is transformed to `{ path: "/path/a.md", mode: "render" }`. On next persist, the new object shape is written. No manual migration step needed.

**`activeTab` remains a string.** It identifies the active tab by path. The `PersistedTab` shape carries mode and scroll info — the active tab identity doesn't need these.

### SessionService: updateTabs Modification

The existing `updateTabs(openTabs: string[], activeTab: string | null)` method signature changes to accept `PersistedTab[]`:

```typescript
async updateTabs(
  openTabs: Array<{ path: string; mode: 'render' | 'edit'; scrollPosition?: number }>,
  activeTab: string | null,
): Promise<SessionState> {
  return this.mutate((session) => {
    if (activeTab !== null && !openTabs.some((t) => t.path === activeTab)) {
      activeTab = openTabs.length > 0 ? openTabs[0].path : null;
    }
    session.openTabs = openTabs.map((t) => ({ ...t }));
    session.activeTab = activeTab;
  });
}
```

The route handler at `PUT /api/session/tabs` updates its request schema:

```typescript
const UpdateTabsRequestSchema = z.object({
  openTabs: z.array(PersistedTabSchema),
  activeTab: AbsolutePathSchema.nullable(),
});
```

Note: The route accepts only the new shape (not the legacy union). Legacy parsing is for `session.json` file reads only. The client always sends the new shape.

### Tab Healing: NOT Performed

Unlike workspaces and recent files, open tabs are NOT healed (filtered for missing files) during session load. The epic requires deleted tabs to appear with a "file not found" indicator (TC-11.1d), consistent with Epic 2 AC-7.3 which already shows "file not found" state for tabs whose files are deleted.

The server returns ALL persisted tabs regardless of file existence. The client attempts to load each tab's content via `GET /api/file`. If the file is missing, the server returns 404, and the client shows the "file not found" state — the same handling that already exists for files deleted mid-session.

This means `healOpenTabs()` is NOT added to the `load()` chain. The healing pattern used for `lastRoot` and `recentFiles` does not apply to tabs because the expected behavior on missing files is different (tabs persist with error state; workspaces/recent-files are quietly removed).

---

## Tree Scan: Timeout and Edge Case Hardening

### Timeout for Slow Filesystems (AC-5.3a)

The existing tree scan in `GET /api/tree` walks the directory recursively with no timeout. For network-mounted filesystems, this can hang indefinitely.

Add a configurable timeout (default 10 seconds) using `AbortController`:

```typescript
async function scanDirectory(
  root: string,
  options: { signal?: AbortSignal; maxDepth?: number } = {},
): Promise<TreeNode[]> {
  const { signal, maxDepth = 100 } = options;

  if (signal?.aborted) {
    throw new ScanTimeoutError(root);
  }

  // ... existing recursive scan logic ...
  // Check signal.aborted before each readdir call
}
```

The route handler wraps the scan:

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const tree = await scanDirectory(root, { signal: controller.signal });
  return { root, tree };
} catch (error) {
  if (error instanceof ScanTimeoutError) {
    // Use existing 500 SCAN_ERROR code with timeout flag — no new HTTP status codes
    return reply.status(500).send({
      error: {
        code: 'SCAN_ERROR',
        message: `Tree scan timed out after 10 seconds for ${root}`,
        timeout: true,
      },
    });
  }
  throw error;
} finally {
  clearTimeout(timeout);
}
```

### Symlink Loop Detection (AC-5.2a)

The existing tree scan follows symlinks (per Epic 1 TC-5.1h). To prevent infinite recursion from symlink loops, track visited real paths:

```typescript
async function scanDirectory(
  root: string,
  options: { signal?: AbortSignal; visited?: Set<string> } = {},
): Promise<TreeNode[]> {
  const visited = options.visited ?? new Set<string>();
  const realPath = await fs.realpath(root);

  if (visited.has(realPath)) {
    return []; // Symlink loop detected — skip
  }
  visited.add(realPath);

  // ... continue scan, passing visited to recursive calls ...
}
```

This uses `Set<string>` of resolved real paths. A symlink loop like `a/b/c → a` resolves to the same real path on the second visit and is skipped. The `visited` set is passed through the recursion and is scoped to a single scan — it doesn't persist between requests.

### Deep Nesting Guard (AC-5.4)

Add a `maxDepth` parameter (default 100) to prevent call stack overflow on extremely deep trees:

```typescript
if (depth > maxDepth) {
  return []; // Too deep — skip silently
}
```

100 levels is far beyond any practical directory structure. The guard prevents pathological cases without affecting normal use.

### Permission Error Handling (AC-5.1)

The existing scan already catches `EACCES` and `EPERM` errors on individual `readdir` calls. The hardening ensures:

1. **Unreadable files appear in the tree** (they have a `.md` extension) but produce an error when opened. The scan includes them; the file-read route returns 403.
2. **Unreadable directories are skipped silently.** Their markdown count is 0. No error propagated to the client during tree scan.
3. **Broken symlinks are excluded.** `fs.stat()` on a broken symlink throws `ENOENT`. The scan catches this and skips the entry.

These behaviors are consistent with Epic 1's TC-10.3a/b and Epic 6's hardening ACs.

---

## File Read: Large File Limit Change

The existing `FileService` has `MAX_FILE_SIZE = 5 * 1024 * 1024` (5MB) and throws `FileTooLargeError` for files exceeding it. Epic 6 requires documents over 10,000 lines to render (AC-1.1), and a 10K-line markdown file with code blocks, tables, and images can exceed 5MB.

**Change:** Raise `MAX_FILE_SIZE` to `20 * 1024 * 1024` (20MB). The 20MB hard limit prevents truly pathological files from crashing the server's rendering pipeline. Files between 5MB and 20MB render normally but benefit from chunked DOM insertion on the client.

```typescript
// file.service.ts — change this line:
const MAX_FILE_SIZE = 20 * 1024 * 1024; // was 5MB, now 20MB
```

The client uses `FileReadResponse.size` to decide rendering strategy:
- Under 500KB: standard `innerHTML` assignment (existing behavior)
- 500KB–20MB: chunked DOM insertion (new, Epic 6)

The server's rendering pipeline (markdown-it + Shiki) handles large files without other changes. Shiki's performance on large code blocks is a rendering-time concern — the server returns the rendered HTML; the client handles the display.

---

## Error Classes

### New Error Class

```typescript
export class ScanTimeoutError extends Error {
  constructor(root: string) {
    super(`Tree scan timed out for: ${root}`);
    this.name = 'ScanTimeoutError';
  }
}
```

### Error Response

No new HTTP status codes. Tree timeout uses the existing 500 status with the existing `SCAN_ERROR` code, adding a `timeout: true` field to the error body so the client can distinguish timeout from other scan errors.

---

## Sequence Diagrams

### Flow: Tab Persistence with PersistedTab (AC-11.1)

```
Client                          Server
  │                                │
  ├─ User opens file ──────────────┤
  │  syncTabsToSession()           │
  ├─ PUT /api/session/tabs ────────→
  │  { openTabs: [                 │
  │    { path, mode, scroll }      │
  │  ], activeTab: path }          │
  │                                ├─ Validate via PersistedTabSchema
  │                                ├─ SessionService.updateTabs()
  │                                ├─ Atomic write to session.json
  │  ←── SessionState ─────────────┤
  │                                │
  ├─ App restarts ─────────────────┤
  │                                │
  ├─ GET /api/session ─────────────→
  │                                ├─ SessionService.load()
  │                                ├─ Parse openTabs via LegacyOrPersistedTab union
  │                                │  (NO tab healing — all tabs returned, even for missing files)
  │  ←── AppBootstrapResponse ─────┤
  │     (session.openTabs = PersistedTab[])
  │                                │
  ├─ restoreTabsFromSession()      │
  │  Active tab: load eagerly      │
  │  Other tabs: lazy (load on switch)
```

### Flow: Tree Scan with Timeout (AC-5.3a)

```
Client                          Server
  │                                │
  ├─ GET /api/tree?root=... ───────→
  │                                ├─ AbortController + 10s timeout
  │                                ├─ scanDirectory(root, { signal })
  │                                │   ├─ readdir (checks signal.aborted)
  │                                │   ├─ stat each entry
  │                                │   │   ├─ symlink? realpath → check visited set
  │                                │   │   ├─ EACCES? skip directory silently
  │                                │   │   └─ broken symlink? skip
  │                                │   └─ recurse (depth < maxDepth)
  │                                │
  │  EITHER:                       │
  │  ←── FileTreeResponse ─────────┤  (scan completed within timeout)
  │                                │
  │  OR:                           │
  │  ←── 500 SCAN_ERROR {timeout} ─┤  (scan exceeded 10s)
  │  Show timeout message + retry  │
```

---

## Self-Review Checklist (API)

- [x] Schema migration is backward-compatible (union parsing)
- [x] No new API endpoints — only shape change to existing endpoint
- [x] Tab healing NOT performed — all persisted tabs returned, client handles missing files
- [x] Tree scan timeout uses AbortController (not arbitrary sleep)
- [x] Symlink loop detection uses real-path visited set
- [x] Deep nesting guard prevents stack overflow
- [x] Permission errors handled per-entry, not per-scan
- [x] Error response shape consistent with existing error contract
- [x] Sequence diagrams trace to ACs
