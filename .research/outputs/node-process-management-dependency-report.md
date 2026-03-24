# Node.js Process Management & Task Orchestration — Dependency Report

**Date:** 2026-03-23
**Context:** Fastify server, Node.js v25, spawning CLI subprocesses (e.g. `claude` CLI), monitoring stdout, detecting exit, sending kill signals. 3-5 concurrent background tasks, in-memory state only.

---

## Summary

For the described use case — spawning long-lived CLI processes and managing their lifecycle — **built-in Node.js APIs are sufficient across the board**. `child_process.spawn` with AbortController integration, `crypto.randomUUID()`, and a plain `Map<string, TaskInfo>` cover all requirements without external dependencies. The only library that could add marginal value is execa, but it brings 12 transitive dependencies and ESM-only constraints in exchange for conveniences (better errors, stream helpers) that matter more for short-lived shell commands than long-running process management.

---

## 1. execa vs child_process.spawn

### Current Status
- **Version:** 9.6.1 (released November 29, 2024)
- **Downloads:** ~95M/week on npm
- **Maintenance:** Healthy but slowing. Last release was Nov 2024. Before that, May 2024. No 2025 or 2026 releases.
- **ESM-only** since v6. `"type": "module"` in package.json.
- **Node requirement:** `^18.19.0 || >=20.5.0`
- **Dependencies:** 12 direct dependencies (cross-spawn, get-stream, human-signals, signal-exit, strip-final-newline, figures, yoctocolors, etc.)

### What execa adds over child_process.spawn
- Promise-based API with async/await
- Better error messages (includes command, exit code, stderr in error object)
- Automatic shell escaping / no shell injection risk
- Cross-platform fixes via `cross-spawn` (Windows shebangs, PATHEXT)
- Stream utilities: piping between subprocesses, line iteration, web streams
- Verbose/debug logging mode
- Graceful termination handling (ensures subprocesses exit even when they intercept signals)

### What execa does NOT meaningfully help with for this use case
- **Long-running process lifecycle management** — spawn gives you the same `ChildProcess` object with `.pid`, `.kill()`, stdout/stderr streams, `exit`/`close` events
- **AbortController** — built-in `spawn` already supports `{ signal }` option since Node 15.5
- **stdout monitoring** — `child.stdout.on('data', cb)` works identically in both
- **Exit detection** — `child.on('exit', cb)` and `child.on('close', cb)` are identical

### Recommendation: Use built-in `child_process.spawn`

The execa advantages (better errors, promise API, cross-spawn) are optimized for the "run a command and get its output" pattern. For long-running processes where you need to hold a reference, stream stdout in real time, and send signals, you are directly using the `ChildProcess` object either way. Adding 12 dependencies for slightly nicer error formatting is not justified. The ESM-only constraint is also a friction point if any part of the toolchain expects CJS.

---

## 2. Node.js child_process Improvements (v22-v25)

### Features relevant to this use case

| Feature | Added In | Status in v25 |
|---|---|---|
| `signal` option (AbortController) on `spawn()` | v15.5.0 / v14.17.0 | Stable |
| `signal` option on `fork()` | v15.6.0 / v14.17.0 | Stable |
| `signal` option on `exec()` / `execFile()` | v15.4.0 / v14.17.0 | Stable |
| `killSignal` option on `spawn()` | v15.11.0 / v14.18.0 | Stable |
| `timeout` option on `spawn()` | v15.13.0 / v14.18.0 | Stable |
| `subprocess[Symbol.dispose]()` | v20.5.0 / v18.18.0 | Stable (non-experimental since v24.2.0) |

### Symbol.dispose (Explicit Resource Management)

The `ChildProcess` object now implements `Symbol.dispose()`, which calls `.kill('SIGTERM')`. This enables the `using` keyword pattern:

```js
{
  using child = spawn('claude', ['--args'], { signal: controller.signal });
  // child is auto-killed with SIGTERM when scope exits
}
```

This became non-experimental in Node v24.2.0, so it is fully stable in v25.

### What has NOT changed

The core streaming and event model (`stdout`, `stderr`, `exit`, `close`, `error` events) is unchanged. The API is mature and stable. No breaking changes in v22-v25 for child_process.

### One deprecation to note

As of v23.11.0 / v22.15.0: passing `args` when `shell: true` is deprecated for `spawn()` and `execFile()`. This does not affect the standard `spawn(command, args)` pattern without shell.

---

## 3. In-Memory Task Management Patterns

### The question: Plain Map vs. a library?

For 3-5 concurrent tasks with in-memory state, the ecosystem offers:

- **p-queue** (v8.x, ESM-only, `>=18`): Promise queue with concurrency control and priority. Project is "feature complete" per maintainers — no planned further development.
- **p-limit** (v6.x, ESM-only): Simpler concurrency limiter. Returns a function that wraps promises.
- No meaningful "lightweight task tracker" library exists in the npm ecosystem that does what a Map cannot.

### Analysis

`p-queue` and `p-limit` solve a different problem: they limit how many async operations run concurrently from a larger pool of queued work. Your use case is not "I have 20 tasks and want to run 5 at a time." It is "I have 3-5 running processes and need to track their state."

What you actually need:
- A container keyed by task ID holding state (pid, status, start time, etc.)
- Ability to look up, iterate, and remove entries
- Event-driven updates when a process exits

### Recommendation: Plain `Map<string, TaskInfo>`

```ts
interface TaskInfo {
  id: string;
  child: ChildProcess;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  command: string;
  abortController: AbortController;
}

const tasks = new Map<string, TaskInfo>();
```

This is the standard approach. A library adds nothing here. If you later need to limit concurrency (e.g., "only 3 claude processes at once, queue the rest"), that is when p-queue would be relevant — but even then, a simple check of `tasks.size` before spawning is sufficient for 3-5 tasks.

---

## 4. crypto.randomUUID()

### Availability
- **Added:** Node.js v15.7.0 (and backported to v14.17.0)
- **Stability:** 2 — Stable. Part of the `node:crypto` module.
- **No flags required.** Available in all Node.js v22+ environments without configuration.

### API
```js
import { randomUUID } from 'node:crypto';
const id = randomUUID(); // e.g. '550e8400-e29b-41d4-a716-446655440000'
```

### Performance comparison
- `crypto.randomUUID()`: ~7.6M ops/sec
- `uuid.v4()`: ~7.4M ops/sec
- `nanoid()`: ~3.7M ops/sec

### When to prefer alternatives
- **uuid (npm):** Only if you need UUID v1, v3, v5, or v7 (time-ordered). For v4, the built-in is equivalent.
- **nanoid:** Only if you need shorter IDs (21 chars vs. 36) for URLs or bandwidth-sensitive contexts. Uses a different alphabet, NOT a UUID.
- **Neither** is needed for generating opaque task identifiers.

### Recommendation: Use built-in `crypto.randomUUID()`

Zero dependencies, fastest option, cryptographically secure, RFC 4122 compliant. There is no reason to add a package for this.

---

## 5. AbortController for Child Process Management

### Confirmed: Fully supported and stable

The `signal` option on `child_process.spawn()` has been stable since Node v15.5.0. In Node v25, it is a mature, well-tested API.

### Usage pattern
```js
import { spawn } from 'node:child_process';

const controller = new AbortController();

const child = spawn('claude', ['--task', 'review'], {
  signal: controller.signal,
  killSignal: 'SIGTERM',  // default, can be changed to 'SIGKILL'
});

child.stdout.on('data', (chunk) => { /* monitor output */ });

child.on('error', (err) => {
  if (err.name === 'AbortError') {
    console.log('Process was cancelled via AbortController');
  }
});

child.on('exit', (code, signal) => {
  console.log(`Exited: code=${code}, signal=${signal}`);
});

// Later: cancel the process
controller.abort();
```

### Behavior details
- Calling `controller.abort()` sends `killSignal` (default SIGTERM) to the child process
- The `error` event fires with an `AbortError` (not the `exit` event's signal)
- You can customize the kill signal via `killSignal` option
- The `timeout` option also uses `killSignal` when the timeout expires
- Pre-aborted signals: if the signal is already aborted when `spawn()` is called, the process is not started and an `AbortError` is thrown immediately

### Known historical issues (resolved)
- There were bugs in early implementations (Node 15.5-15.8 range) where abort behavior was inconsistent. These are long resolved.
- Issue #47814 noted that `signal.reason` was not properly passed through. This is a minor edge case.

### Recommendation: Use AbortController with spawn

This is the idiomatic cancellation pattern in modern Node.js. It integrates cleanly with your task management Map — each `TaskInfo` holds its own `AbortController`, and cancellation is a single `controller.abort()` call.

---

## Overall Dependency Recommendation

| Need | Recommendation | Dependency? |
|---|---|---|
| Spawn & manage CLI processes | `child_process.spawn` | **No** (built-in) |
| Cancel/kill processes | `AbortController` + `signal` option | **No** (built-in) |
| Generate task IDs | `crypto.randomUUID()` | **No** (built-in) |
| Track task state | `Map<string, TaskInfo>` | **No** (built-in) |
| Concurrency limiting | Check `tasks.size` before spawn | **No** (built-in) |

**Total external dependencies needed: 0**

---

## Sources

- [Node.js v25.8.1 child_process Documentation](https://nodejs.org/api/child_process.html) — Official API reference, highly authoritative
- [Node.js v25.8.1 crypto Documentation](https://nodejs.org/api/crypto.html) — Official API reference
- [execa GitHub Repository](https://github.com/sindresorhus/execa) — Source repo, v9.6.1
- [execa npm page](https://www.npmjs.com/package/execa) — Package metadata
- [execa Releases](https://github.com/sindresorhus/execa/releases) — Release history showing Nov 2024 as latest
- [p-queue GitHub Repository](https://github.com/sindresorhus/p-queue) — Maintainers declare "feature complete"
- [V8 Explicit Resource Management](https://v8.dev/features/explicit-resource-management) — Symbol.dispose specification
- [UUID vs Crypto.randomUUID vs NanoID (Medium)](https://medium.com/@matynelawani/uuid-vs-crypto-randomuuid-vs-nanoid-313e18144d8c) — Performance benchmarks
- [AbortController spawn fix commit](https://github.com/nodejs/node/commit/0bcaf9c4d1) — Historical bug fix for spawn abort behavior
- [AbortController Guide (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/understanding-abortcontroller/) — Practical usage patterns

## Confidence Assessment

- **Overall confidence:** High
- **Areas of certainty:** All APIs described are stable, documented in official Node.js docs, and available in v25. The execa status is confirmed from npm and GitHub.
- **Minor uncertainty:** The exact behavior of `Symbol.dispose` with `using` keyword in practice with long-running processes — the `using` pattern auto-kills on scope exit, which may not align with how you want to manage process lifecycle (you probably want explicit control, not scope-based cleanup).
- **No conflicting information** was found across sources.
