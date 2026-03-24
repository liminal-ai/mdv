# Epic 14 Dependency Research

## Conclusion: No New Dependencies Needed

All Epic 14 capabilities map to Node.js built-ins and existing project dependencies.

| Epic 14 Capability | Implementation Mechanism |
|--------------------|-----------------------|
| Background CLI process spawning | `child_process.spawn()` (built-in, already used in 6+ files) |
| Process cancellation | `AbortController` + `spawn({ signal })` (stable in Node v25) |
| Process cleanup on server shutdown | `process.on('exit')` + `Symbol.dispose` pattern |
| Task state tracking | `Map<string, TaskInfo>` (in-memory, ~100-150 lines) |
| Concurrency limiting | Size check on the Map before dispatch |
| Task/run ID generation | `crypto.randomUUID()` (built-in, already used in project) |
| Elapsed time tracking | `Date.now()` + arithmetic |
| Periodic progress reporting | `setInterval` / `clearInterval` |
| Message schema validation | Zod (existing dep, v4.0.0) |
| WebSocket message transport | @fastify/websocket (existing dep, v11.2.0) |
| Autonomous run sequencing | Simple async state machine (~50-80 lines) |

## Rejected Packages

| Package | Why Rejected |
|---------|-------------|
| execa v9.6.1 | 12 transitive deps; advantages irrelevant for long-lived process management; project uses child_process consistently |
| p-queue v8.x | Solves work-queue concurrency, not process-tracking; Epic 14 dispatches immediately or rejects |
| p-limit v6.x | One-line size check replaces the library |
| uuid v11.1.0 | crypto.randomUUID() is faster, built-in, already used in project |
| nanoid v3.3.11 | Shorter IDs not needed for opaque task/run identifiers |

## Key Technical Notes for Tech Design

- **AbortController + spawn({ signal })**: Each background task holds its own AbortController. Calling `abort()` sends SIGTERM. This maps directly to Epic 14's `cancelTask()` requirement.
- **Symbol.dispose (stable since Node v24.2.0)**: Enables `using child = spawn(...)` for automatic cleanup. Relevant for preventing orphaned processes on server shutdown.
- **Node.js v25.8.0** is the runtime — all referenced built-in APIs are stable.
