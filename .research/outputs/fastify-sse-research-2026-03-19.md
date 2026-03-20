# Server-Sent Events (SSE) in Fastify 5.x -- Research Report

**Date:** 2026-03-19
**Context:** Tech design decision for md-viewer (local-only Fastify 5.8.2 app, file change notifications)

---

## Summary

There are two viable paths for SSE in Fastify 5.x: the official `@fastify/sse` plugin (v0.4.0, released Feb 2026) and the manual `reply.hijack()` + `reply.raw` approach. For a local-only app doing file-change notifications, SSE is the correct choice over WebSockets -- it is simpler, one-directional, auto-reconnects, and requires zero additional protocol handling. The browser `EventSource` API has 97%+ global support and works without issues on localhost.

The official `@fastify/sse` plugin is new (repo created Aug 2025, latest release Feb 2026) and is CJS-only. If your project uses ESM (`"type": "module"`), this is a friction point -- there is a community fork (`@tylerhillery/fastify-sse` v0.4.1) specifically for ESM, but the manual approach avoids the dependency entirely and is roughly 20 lines of code for your use case.

---

## 1. @fastify/sse Plugin

### Current State

| Property | Value |
|---|---|
| Package | `@fastify/sse` |
| Version | 0.4.0 |
| Published | 2026-02-20 |
| npm weekly downloads | ~40K |
| Peer dependency | `fastify ^5.x` |
| Node.js | >= 20 |
| Module format | **CJS only** (uses `require()`) |
| License | MIT |
| Repo | https://github.com/fastify/sse |
| Maintainers | Fastify core team (mcollina, Fdawgs, etc.) |
| Open issues | 2 (neither critical) |

### Origin

Matteo Collina opened a proposal (fastify/fastify#6276) in Aug 2025, citing that SSE in Fastify previously required `reply.hijack()` and manual `reply.raw` manipulation, which bypasses the Fastify request lifecycle. The proposal was accepted and the plugin shipped in Sep 2025. It is now an official Fastify organization package.

### Key API

```javascript
// Registration
await fastify.register(require('@fastify/sse'), {
  heartbeatInterval: 30000,  // ms, default
  serializer: (data) => JSON.stringify(data)
})

// Route -- mark as SSE
fastify.get('/events', { sse: true }, async (request, reply) => {
  // Single message
  await reply.sse.send({ data: 'Hello SSE!' })

  // Full options
  await reply.sse.send({
    id: '123',
    event: 'update',
    data: { message: 'Hello World' },
    retry: 1000
  })
})

// Long-lived: keep connection open, push events over time
fastify.get('/events', { sse: true }, async (request, reply) => {
  reply.sse.keepAlive()  // prevent auto-close
  reply.sse.onClose(() => { /* cleanup watchers */ })
})

// Async generator source
fastify.get('/events', { sse: true }, async (request, reply) => {
  await reply.sse.send(async function* () {
    while (true) {
      const change = await waitForFileChange()
      yield { event: 'change', data: JSON.stringify(change) }
    }
  }())
})
```

### Features

- Route-level `{ sse: true }` -- integrates with Fastify hooks/lifecycle
- `reply.sse.keepAlive()` -- holds connection open
- `reply.sse.onClose(cb)` -- cleanup on disconnect
- `reply.sse.replay(cb)` -- Last-Event-ID reconnection support
- Heartbeat / keep-alive built in
- Backpressure handling
- TypeScript types included

### Gotcha: CJS Only

The official package is CommonJS. There is no ESM entry point as of v0.4.0. A fork exists (`@tylerhillery/fastify-sse` v0.4.1) that adds ESM support, with a note to migrate back once the official package ships ESM. If your Fastify app uses `"type": "module"` in package.json, you would need to either:
- Use dynamic `import()` or `createRequire()` to load the CJS package
- Use the ESM fork temporarily
- Use the manual approach instead

---

## 2. Manual SSE Without a Plugin

For a simple use case like file-change notifications, SSE can be implemented manually in ~20 lines. This was the standard approach before the plugin existed.

### Pattern: reply.hijack() + reply.raw

```javascript
fastify.get('/events', async (request, reply) => {
  reply.hijack()

  const raw = reply.raw
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  // Send initial comment to establish connection
  raw.write(':ok\n\n')

  // Set up file watcher and push events
  const watcher = watchFiles(targetPath)
  watcher.on('change', (filePath) => {
    raw.write(`event: change\n`)
    raw.write(`data: ${JSON.stringify({ file: filePath, ts: Date.now() })}\n\n`)
  })

  // Clean up on client disconnect
  request.raw.on('close', () => {
    watcher.close()
  })
})
```

### What reply.hijack() Does

- Tells Fastify to stop managing the response lifecycle
- Fastify will NOT call `reply.send()`, serializers, or remaining hooks
- You are fully responsible for writing headers, data, and ending the response
- **Exception:** `onResponse` hooks still fire even after hijack
- `reply.raw` gives you the raw Node.js `http.ServerResponse`

### Tradeoffs vs Plugin

| Aspect | @fastify/sse | Manual |
|---|---|---|
| Lines of code | ~5 setup + config | ~20 for basic SSE |
| Lifecycle integration | Full (hooks, error handling) | Bypassed (you manage everything) |
| Heartbeat | Built-in, configurable | DIY (setInterval writing `:keepalive\n\n`) |
| Reconnection (Last-Event-ID) | Built-in replay API | DIY |
| Backpressure | Handled | DIY |
| Dependencies | 1 package | None |
| ESM support | No (CJS only) | N/A |
| Complexity for file watching | Low | Low (it's a simple use case) |

### Recommendation for md-viewer

For a local-only app with a single SSE endpoint for file-change notifications, the manual approach is entirely adequate. You don't need reconnection replay, heartbeat (localhost connections don't go through proxies that would drop idle connections), or backpressure handling (you're sending tiny JSON payloads infrequently). The plugin adds value for production SSE services, not for localhost dev tools.

---

## 3. EventSource Browser API

### Browser Support (March 2026)

**Global support: 97.23%**

| Browser | Supported From | Current |
|---|---|---|
| Chrome | 6+ | 149 |
| Firefox | 6+ | 151 |
| Safari | 5+ | 26.4 |
| Edge | 79+ (Chromium) | 145 |
| IE | Never | Dead |
| iOS Safari | 4.0+ | Full |
| Chrome Android | Full | Full |

This is a "Baseline Widely Available" feature per MDN -- stable since Jan 2020. There are zero browser support concerns for any modern browser.

### Localhost Gotchas

- **None significant.** EventSource works fine with `http://localhost:PORT/events`. No CORS issues because it's same-origin.
- `EventSource` auto-reconnects on disconnect (default retry is ~3 seconds). For a local app, this means the client reconnects seamlessly if the server restarts.
- The `withCredentials` option is irrelevant for localhost same-origin use.
- EventSource only supports GET requests. This is fine for a subscription/watch endpoint.
- EventSource cannot send custom headers (no auth headers). Irrelevant for localhost.

### Basic Client Code

```javascript
const es = new EventSource('/events')

es.addEventListener('change', (e) => {
  const data = JSON.parse(e.data)
  console.log('File changed:', data.file)
})

es.onerror = (e) => {
  // Auto-reconnects. Log if needed.
  console.warn('SSE connection error, will retry')
}
```

---

## 4. SSE vs WebSocket for File Watching (Local-Only)

### Verdict: SSE is the right choice.

For server-to-client file change notifications on localhost, SSE wins on every axis that matters:

| Factor | SSE | WebSocket |
|---|---|---|
| Direction | Server -> Client (exactly what you need) | Bidirectional (overkill) |
| Protocol | Plain HTTP | Requires upgrade handshake |
| Auto-reconnect | Built into EventSource | Must implement yourself |
| Server complexity | ~20 lines, no library | Needs `ws` or `@fastify/websocket` |
| Client complexity | Native `EventSource` API | Native `WebSocket` API (similar) |
| Proxy/firewall issues | None (it's HTTP) | Can be blocked |
| Debugging | curl-friendly (`curl localhost:3000/events`) | Needs wscat or similar |
| Overhead | Near zero for low-frequency events | Connection upgrade + frame overhead |
| Multiple tabs | Each tab gets its own connection (fine for local) | Same |

### Industry Consensus (2025-2026)

Multiple recent sources confirm the shift toward SSE for one-directional use cases:
- "SSE covers 80% of real-time use cases that developers reach for WebSockets for" (PkgPulse, March 2026)
- AI streaming (ChatGPT, Claude, Vercel AI SDK) all use SSE, not WebSockets
- "For one-way server-to-client streams, SSE frequently delivers a lower operational burden" (Dev.to, March 2026)

WebSocket is only justified when you need frequent client-to-server messages (chat, collaborative editing, multiplayer games).

---

## 5. Fastify 5.x Streaming

### How Fastify 5 Handles Long-Lived Streaming

There are no breaking changes to the streaming/hijack model between Fastify 4 and 5. The key mechanisms remain:

1. **`reply.send(stream)`** -- Fastify natively handles Node.js Readable streams. Sets `Content-Type: application/octet-stream` if not specified. Streams are sent unmodified without response validation.

2. **`reply.hijack()`** -- Same behavior as v4. Stops Fastify from managing the response. `onResponse` hooks still fire.

3. **`reply.raw`** -- Direct access to `http.ServerResponse`. Same as v4.

4. **Web Streams API** -- Fastify 5 added support for Web ReadableStream via `reply.send()` (merged in PR #5286, Jan 2024). This is new in v5 but not needed for SSE.

### Fastify 5 Breaking Changes Relevant to Streaming

- **`Response` object handling was removed** in v5.0.0-alpha.4. If you were passing a `fetch()` Response object to `reply.send()`, this no longer works. You must extract the body stream. (Not relevant to SSE, but worth noting.)
- **Node.js 20+ required.** This gives you stable `node:events`, `node:stream/promises`, and other modern APIs.
- **Full JSON Schema required** for querystring/params/body schemas. Not relevant to SSE endpoints (no request body).

### Connection Lifetime

Fastify does not impose its own connection timeout on hijacked responses. The connection lifetime is governed by:
- Node.js `server.keepAliveTimeout` (default 5000ms for idle connections, but does not apply to active SSE streams)
- Client-side `EventSource` behavior (auto-reconnect)
- Your application code (calling `reply.raw.end()` to close)

For a local app, there are no proxy timeouts or load balancer idle connection drops to worry about.

---

## Recommendations for md-viewer

1. **Use SSE, not WebSocket.** Your use case is textbook SSE: one-directional server-to-client file change notifications.

2. **Start with the manual approach.** For a localhost app with one SSE endpoint, `reply.hijack()` + `reply.raw` is the simplest path:
   - No additional dependency
   - No CJS/ESM compatibility concern
   - ~20 lines of straightforward code
   - Perfectly adequate for low-frequency, small-payload events

3. **Consider `@fastify/sse` later** if you add more SSE endpoints or need reconnection replay. The plugin is official, maintained by the core team, and compatible with Fastify 5.x. But it's CJS-only as of v0.4.0.

4. **Client side is trivial.** `new EventSource('/events')` with an event listener. Auto-reconnects for free.

---

## Sources

- [@fastify/sse npm](https://www.npmjs.com/package/@fastify/sse) - Official package, v0.4.0, published 2025-09-16. 40K weekly downloads.
- [fastify/sse GitHub repo](https://github.com/fastify/sse) - Official repo, 22 stars, last push 2026-03-08. Latest release v0.4.0 (2026-02-20).
- [Proposal: Official @fastify/sse Plugin (Issue #6276)](https://github.com/fastify/fastify/issues/6276) - Opened by mcollina Aug 2025, closed Sep 2025 (completed).
- [@tylerhillery/fastify-sse](https://registry.npmjs.org/%40tylerhillery%2Ffastify-sse) - ESM fork, v0.4.1, Dec 2025.
- [fastify-sse-v2 npm](https://www.npmjs.com/package/fastify-sse-v2) - Community plugin, v4.2.2, 50K weekly downloads. Older alternative.
- [Fastify V5 Migration Guide](https://fastify.dev/docs/v5.5.x/Guides/Migration-Guide-V5) - Official migration docs.
- [Fastify Reply docs](https://fastify.dev/docs/latest/Reference/Reply/) - reply.hijack(), reply.raw, streaming behavior.
- [Avoid reply.raw and reply.hijack](https://lirantal.com/blog/avoid-fastify-reply-raw-and-reply-hijack-despite-being-a-powerful-http-streams-tool) - Liran Tal (Fastify ecosystem), June 2023.
- [Can I Use: EventSource](https://caniuse.com/eventsource) - 97.23% global support, March 2026.
- [MDN: EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) - Baseline Widely Available since Jan 2020.
- [SSE vs WebSocket vs Long Polling (PkgPulse)](https://www.pkgpulse.com/blog/sse-vs-websocket-vs-long-polling-real-time-communication-2026) - March 2026 comparison.
- [SSE vs WebSocket for One-Way Push (Dev.to)](https://bizarro.dev.to/harshitsinghal13/sse-vs-websocket-for-one-way-push-runtime-and-operational-tradeoffs-o28) - March 2026.
- [React Server-Side Streaming with Fastify](https://backend.cafe/react-server-side-streaming-with-fastify) - March 2026, shows reply.hijack() pattern with Fastify v5.
- [Web Stream API PR #5286](https://github.com/fastify/fastify/pull/5286) - Fastify 5 Web ReadableStream support, merged Jan 2024.

## Confidence Assessment

- **Overall confidence: High.** All data points are from primary sources (npm registry, GitHub repos, official docs, caniuse) dated within the last 6 months.
- **@fastify/sse compatibility with Fastify 5.8.2:** High confidence. Peer dependency is `^5.x`, and the plugin is maintained by the same team shipping Fastify 5.
- **CJS-only limitation:** High confidence. Confirmed from package.json (`"main": "index.js"`, no `"exports"` or `"type": "module"`), plus the existence of an ESM-specific fork confirms the gap.
- **Manual SSE approach:** High confidence. Well-documented pattern, unchanged between Fastify 4 and 5.
- **EventSource browser support:** High confidence. Baseline Widely Available, 97%+ global support, no localhost-specific issues.
