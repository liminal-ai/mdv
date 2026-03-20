# Node.js 24 Filesystem Watching: Current State (March 2026)

Research conducted March 19, 2026.

---

## Summary

Native `fs.watch()` in Node 24 is viable for watching individual files on macOS and is the right choice for your use case (approximately 20 open tabs, each watching one file). The `recursive` option is now supported on macOS, Linux, and Windows, but your use case does not require it -- you are watching individual files, not directories. On macOS, `fs.watch()` uses FSEvents for directories and kqueue for individual files via libuv. For single-file watching, this is reliable and event-driven (no polling). Chokidar v5 (ESM-only, released Nov 2025) still provides a nicer API and edge-case handling, but for your specific scenario -- watching known individual files for content changes -- native `fs.watch()` is sufficient and avoids the dependency. `fs.glob()` is stable as of Node 24.

---

## 1. `fs.watch()` in Node 24

### Stability Status
- The `node:fs` module overall is **Stability: 2 (Stable)**.
- `fs.watch()` itself is stable and has been for many years.
- The `recursive` option is now supported on **all three major platforms** (macOS, Windows, Linux). It was added to Linux in Node 19 (PR #45098, merged Oct 2022) using a userland inotify-based recursive watcher in `internal/fs/recursive_watch`. A race condition fix for Linux was shipped in early 2024 (PR #51406).

### Options
```typescript
fs.watch(filename: string | Buffer | URL, options?: {
  persistent?: boolean;   // default: true - keep process alive
  recursive?: boolean;    // default: false - watch subdirs (for directory watching)
  encoding?: string;      // default: 'utf8'
  signal?: AbortSignal;   // for cleanup
}, listener?: (eventType: string, filename: string) => void): FSWatcher
```

### Events Emitted
The listener callback receives:
- `eventType`: either `'rename'` or `'change'`
  - `'rename'`: file appeared or disappeared (create, delete, rename)
  - `'change'`: file content was modified
- `filename`: the name of the file that triggered the event

The FSWatcher object itself emits:
- `'change'` event (with eventType and filename)
- `'close'` event
- `'error'` event

### Platform Mechanisms (via libuv)
| Platform | Mechanism | Notes |
|----------|-----------|-------|
| **macOS** | kqueue (files), FSEvents (directories) | kqueue for individual file watches; FSEvents for recursive directory watching |
| **Linux** | inotify | Native for single watches; recursive watching uses a JS-level wrapper that sets up inotify on each subdirectory |
| **Windows** | ReadDirectoryChangesW | Native recursive support |

### Known Issues and Caveats (Current)

**macOS-specific:**
- **Startup timing issue (OPEN, nodejs/node#52601):** On macOS, `fs.watch()` does not begin monitoring until an indeterminate time after the function returns. Events occurring in that window are missed. No "ready" event exists. This is a libuv/FSEvents issue, primarily affecting directory watching. For individual file watching via kqueue, this is less of an issue but not fully documented as exempt.
- **FSEvents can coalesce or drop events** under high-frequency writes (nodejs/node#47058). A Node.js core team member (bnoordhuis) confirmed: "fsevents can coalesce (or simply drop) events. The events you see in node are basically what the operating system reports, no more, no less." This primarily affects rapid writes to the same file (hundreds per second), not typical user-editing scenarios.
- **Flaky recursive tests on macOS** (nodejs/node#55592, closed Nov 2024): Intermittent test failures with `rename` vs `change` event type mismatches in recursive add scenarios. Resolved via libuv updates.
- **Folder deletion not reported** (nodejs/node#52055, closed Jul 2024): Fixed in libuv 1.49.0+.

**Linux-specific:**
- **Recursive watching is a JS-level wrapper** (`internal/fs/recursive_watch`), not native. It creates inotify watchers for each subdirectory. This means:
  - Potential race conditions during setup (fixed in Node 22+ via synchronous directory traversal, PR #51406).
  - Crashes on `.close()` with rapid file operations (nodejs/node#53350, fixed Jun 2024).
  - Crashes when watched files are deleted during recursive watch (nodejs/node#52018, fixed Apr 2024).
- These Linux issues are with **recursive directory watching**, not individual file watching. Individual file watching on Linux via inotify is rock-solid.

**Cross-platform:**
- **Rapid create/delete can miss events** (nodejs/node#60859, closed Mar 2026): Under rapid file operations, events can be missed or reported incorrectly. A Node core contributor clarified this is inherent to OS-level event watchers, not a Node bug. "fs.watch is designed as a thin wrapper around OS events. If the OS drops events due to buffer saturation, Node.js will simply not receive them."
- The `filename` argument in the callback is only reliably provided on Linux and Windows (macOS also provides it, but historically there were edge cases).

### Reliability for Your Use Case
**Watching ~20 individual files for content modifications on macOS: HIGH reliability.** Your use case avoids all the problematic areas:
- No recursive watching needed
- No rapid-fire file creation/deletion
- User-initiated saves (one event per save, seconds apart minimum)
- kqueue is used for individual file watching on macOS, which is reliable

**Key caveat:** When a file is deleted and recreated (some editors do atomic saves this way -- write temp file, delete original, rename temp to original), you may get a `rename` event followed by needing to re-establish the watcher. This is the main edge case to handle.

---

## 2. `fs.watchFile()`

### Status
Still available, still stable. Uses **stat polling** -- it periodically calls `fs.stat()` on the file and compares results.

### API
```typescript
fs.watchFile(filename: string, options?: {
  persistent?: boolean;   // default: true
  interval?: number;      // polling interval in ms, default: 5007
}, listener: (current: fs.Stats, previous: fs.Stats) => void): fs.StatWatcher
```

### Comparison with `fs.watch()` for Single-File Watching

| Aspect | `fs.watch()` | `fs.watchFile()` |
|--------|-------------|-----------------|
| Mechanism | OS events (kqueue/inotify) | Stat polling |
| CPU usage | Near zero when idle | Constant polling overhead |
| Latency | Near-instant | Up to `interval` ms delay |
| Reliability | Platform-dependent edge cases | Very reliable, works everywhere |
| Network filesystems | Unreliable | Works (it's just polling) |
| 20 simultaneous watches | Trivial | 20 stat calls every 5 seconds |
| Cleanup | `watcher.close()` | `fs.unwatchFile()` |
| Event info | eventType + filename | current Stats + previous Stats |

### Recommendation
The Node.js docs themselves say: "`fs.watch()` is more efficient than `fs.watchFile` and `fs.unwatchFile`. `fs.watch` should be used instead of `fs.watchFile` and `fs.unwatchFile` when possible."

For 20 individual files on local filesystem: **use `fs.watch()`**. Only fall back to `fs.watchFile()` if you need to watch files on NFS/SMB mounts or encounter reliability issues.

---

## 3. Chokidar

### Current Version: 5.0.0 (Released November 25, 2025)

### Key Facts
- **ESM-only** as of v5.0.0 (reduced package size from ~150KB to ~80KB)
- **Minimum Node.js:** v20.19
- **Weekly downloads:** 110.8 million (still massively used)
- **Dependencies:** Minimal. **Removed bundled fsevents** in v4 (previously had 13 dependencies, now 1 -- `readdirp`). Chokidar no longer uses the native `fsevents` npm package; it relies solely on Node's core `fs` module.
- **License:** MIT

### What Changed from v3 to v4/v5
- v4 (Oct 2024): Dropped `fsevents` dependency, reduced deps from 13 to 1, ESM+CJS dual
- v5 (Nov 2025): ESM-only, min Node v20.19, improved types, trusted publishing

### Has Native Node Caught Up?
Partially. Chokidar's README (as of March 2026) still lists these advantages over raw `fs.watch`:
1. Events properly reported (no duplicate events, meaningful names: `add`/`change`/`unlink` vs raw `rename`/`change`)
2. Atomic write support (`atomic` option)
3. Chunked write support (`awaitWriteFinish` option for large files)
4. File/dir filtering
5. Symlink support
6. Cross-platform recursive watching normalization

**For your use case** (individual file watching, not directories), the main advantage of chokidar would be:
- `awaitWriteFinish` -- waits for file writes to complete before emitting event (useful for large files)
- Automatic re-watching when files are deleted and recreated (atomic saves)
- Cleaner event semantics (`change` instead of sometimes-confusing `rename`/`change` distinction)

### Verdict
Chokidar is well-maintained and still the go-to for **complex** watching scenarios. But for watching ~20 individual known files for user-initiated content changes, native `fs.watch()` with proper error handling is sufficient. You save a dependency and ~80KB.

---

## 4. `fs.glob()` in Node 24

### Stability: STABLE as of Node 24

A GitHub issue (nodejs/node#58981, July 2025) explicitly confirms: **"fs.glob is stable as of v24"**. The issue was filed specifically because the API graduated to stable but documentation for the `pattern` argument was lacking.

### API Surface
```typescript
// Callback
fs.glob(pattern: string | string[], options?: GlobOptions, callback): void

// Promise
fsPromises.glob(pattern: string | string[], options?: GlobOptions): AsyncIterable<string>

// Sync
fs.globSync(pattern: string | string[], options?: GlobOptions): string[]
```

### Options
- `cwd` -- working directory for the glob
- `exclude` -- supports glob patterns for exclusion (added Jan 2025, PR #56489)

### Limitations (as of March 2026)
- Documentation for the `pattern` argument is incomplete (nodejs/node#58981, still open)
- Does not support all features of userland alternatives like `fast-glob` (e.g., some advanced pattern syntax)
- No option to filter files-only vs directories (requested in nodejs/node#52752)

### Verdict
Stable and usable for standard glob patterns. Suitable replacement for `fast-glob` or `glob` npm packages in most cases.

---

## 5. Platform Behavior on macOS

### Underlying Mechanisms
- **Individual files:** kqueue (via libuv)
- **Directories:** FSEvents (via libuv) -- but only for recursive watching. Non-recursive directory watching also uses kqueue.

### Reliability for File Modifications
- **Modifications (content changes):** Reliable. kqueue monitors the file descriptor. When the file is written to and the fd metadata changes, a `change` event is emitted.
- **Deletions:** Reliable for individual file watches. A `rename` event is emitted. Note: after deletion, the watcher becomes invalid and should be closed.
- **Creations (watching a path that does not yet exist):** `fs.watch()` does NOT support watching a path that doesn't exist yet. You must watch the parent directory or use polling.
- **Atomic saves (delete + rename pattern):** This is the key edge case. Many editors (Vim, some configs of VS Code, etc.) save files by:
  1. Writing to a temp file
  2. Deleting the original
  3. Renaming temp to original

  This will emit a `rename` event and **the watcher will stop working** because the original inode is gone. You must detect this and re-establish the watcher.

### Known Open Issue
- **Startup timing (nodejs/node#52601, STILL OPEN):** On macOS, `fs.watch()` may not begin monitoring immediately. For individual files, the impact is minimal -- by the time your UI is rendered and the user begins editing, the watcher is active. But if you need to catch changes that happen within milliseconds of starting the watcher, this is a concern.

---

## 6. Best Practices for Watching ~20 Individual Files

### Recommended Approach: Native `fs.watch()` with Defensive Handling

```typescript
import { watch, stat } from 'node:fs';
import { stat as statAsync } from 'node:fs/promises';

function watchFile(filePath: string, onChange: () => void): () => void {
  let watcher: ReturnType<typeof watch> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function startWatching() {
    try {
      watcher = watch(filePath, (eventType, filename) => {
        if (eventType === 'change') {
          // Debounce: editors may trigger multiple events per save
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => onChange(), 100);
        }

        if (eventType === 'rename') {
          // File may have been deleted or atomically replaced
          // Close current watcher and try to re-establish
          cleanup();
          retryWatch();
        }
      });

      watcher.on('error', (err) => {
        console.error(`Watch error for ${filePath}:`, err);
        cleanup();
        retryWatch();
      });
    } catch (err) {
      console.error(`Failed to watch ${filePath}:`, err);
      retryWatch();
    }
  }

  function retryWatch() {
    // File may not exist yet (atomic save in progress)
    // Retry after a short delay
    setTimeout(async () => {
      try {
        await statAsync(filePath);
        startWatching();
        // File was recreated, notify of change
        onChange();
      } catch {
        // File still doesn't exist, retry
        retryWatch();
      }
    }, 200);
  }

  function cleanup() {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (watcher) {
      try { watcher.close(); } catch {}
      watcher = null;
    }
  }

  startWatching();

  // Return cleanup function
  return cleanup;
}
```

### Key Patterns

1. **Debounce events** (~50-150ms). Editors often trigger multiple write events per save.

2. **Handle `rename` events as potential atomic saves.** Close the watcher, check if the file still exists, re-establish if so.

3. **Retry on ENOENT.** During an atomic save, there's a brief window where the file doesn't exist. Retry with a short delay (100-200ms).

4. **One watcher per file.** With 20 files, this means 20 kqueue file descriptors on macOS -- trivial for the OS (macOS supports thousands).

5. **Clean up watchers on tab close.** Call `watcher.close()` when a tab is closed to avoid resource leaks.

6. **Consider AbortController for cleanup:**
   ```typescript
   const ac = new AbortController();
   const watcher = watch(filePath, { signal: ac.signal });
   // Later: ac.abort() to clean up
   ```

7. **Do NOT use `fs.watchFile()`** unless you're watching files on network mounts. The polling overhead is unnecessary for local files.

### When to Reach for Chokidar Instead
- If you need `awaitWriteFinish` for very large files (multi-MB markdown is unlikely)
- If you need to watch files that may be on network filesystems
- If you want the simpler event model (`add`/`change`/`unlink` vs raw `rename`/`change`)
- If atomic save handling proves too complex to get right yourself

For your case (desktop app, local files, markdown documents), native `fs.watch()` is the right call.

---

## Sources

### Official Documentation
- [Node.js v24.14.0 fs documentation](https://nodejs.org/docs/latest-v24.x/api/fs.html) - Stable (Stability: 2)

### GitHub Issues (Node.js core)
- [nodejs/node#52601](https://github.com/nodejs/node/issues/52601) - OPEN: fs.watch startup timing on macOS (filed Apr 2024)
- [nodejs/node#60859](https://github.com/nodejs/node/issues/60859) - CLOSED: fs.watch incorrect events with rapid operations (closed Mar 2026)
- [nodejs/node#58981](https://github.com/nodejs/node/issues/58981) - OPEN: fs.glob stable as of v24 but lacks pattern docs (filed Jul 2025)
- [nodejs/node#47058](https://github.com/nodejs/node/issues/47058) - CLOSED: fs.watch event coalescing on macOS (closed Mar 2023)
- [nodejs/node#54450](https://github.com/nodejs/node/issues/54450) - CLOSED: fs-watch test issues on macOS with libuv 1.49.0 (closed Nov 2024)
- [nodejs/node#52055](https://github.com/nodejs/node/issues/52055) - CLOSED: macOS fs.watch folder deletion not reported (closed Jul 2024)
- [nodejs/node#45098](https://github.com/nodejs/node/pull/45098) - MERGED: Add recursive watch for Linux (merged Oct 2022)
- [nodejs/node#51406](https://github.com/nodejs/node/pull/51406) - MERGED: Fix race condition for recursive watch on Linux

### Chokidar
- [chokidar npm](https://www.npmjs.com/package/chokidar) - v5.0.0, 110.8M weekly downloads
- [chokidar GitHub](https://github.com/paulmillr/chokidar) - ESM-only, min Node v20.19
- [chokidar 5.0.0 release notes](https://github.com/paulmillr/chokidar/releases/tag/5.0.0)
- [chokidar#1416](https://github.com/paulmillr/chokidar/issues/1416) - Confirms `useFsEvents` option removed in v4+ (no longer uses native fsevents)

### Community/Blog
- [OneUptime: How to Watch File Changes in Node.js](https://oneuptime.com/blog/post/2026-01-22-nodejs-watch-file-changes/view) - Jan 2026 (note: incorrectly states recursive not supported on Linux -- this was fixed in Node 19)

---

## Confidence Assessment

- **Overall confidence: HIGH** for the recommendation to use native `fs.watch()` for individual file watching on macOS
- **HIGH** confidence that `fs.glob()` is stable in Node 24
- **HIGH** confidence in chokidar status (v5.0.0, ESM-only, no fsevents)
- **MEDIUM** confidence in completeness of macOS edge cases -- the startup timing issue (nodejs/node#52601) is still open and could affect rare scenarios
- **Area of uncertainty:** Exact behavior of kqueue-based watching when editors use different save strategies. This is worth testing empirically with your target editors (VS Code, etc.)
