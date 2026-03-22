# Followup: Electron Server Crash Recovery (TC-13.2b)

## Context

Epic 6 AC-13.2 / TC-13.2b specifies that when the Fastify server crashes mid-session in Electron, the wrapper should show a "Server disconnected — Restart" button. Clicking it restarts the server and reloads the page.

This was deferred during Story 5 implementation because it requires a 7th IPC channel (`app:server-error` or similar) which conflicts with the 6-channel IPC surface specified in the epic's data contracts. The tech design acknowledged this tension but didn't resolve it.

## Current State

- The client already handles network failures via Epic 2 AC-9.3 (server connection error notifications)
- The Electron main process has no health check or crash detection for the Fastify server
- No restart mechanism exists

## What's Needed

1. **Design decision:** Add a 7th IPC channel or repurpose an existing one
2. **Main process:** Detect server crash (process exit, unhandled rejection, or health check failure)
3. **IPC:** Send crash notification to renderer
4. **Preload + bridge:** Expose restart trigger
5. **Renderer:** Show "Server disconnected — Restart" button (could extend existing error notification with an action button)
6. **Main process:** Restart logic — re-call `startServer()`, update BrowserWindow URL if port changed, reload

## Estimated Scope

~50-80 lines across 5-6 files. Medium complexity due to the server lifecycle management.

## Priority

Low — the client-side error handling from Epic 2 covers the user-visible impact. The restart button is a convenience enhancement for Electron users.
