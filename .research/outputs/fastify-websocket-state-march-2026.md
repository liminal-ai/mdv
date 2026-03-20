# @fastify/websocket -- Current State (March 2026)

Research date: 2026-03-19

## Summary

`@fastify/websocket` v11.x is the current major version and is fully compatible with Fastify 5.x. The plugin is actively maintained, built on `ws@8`, and works in ESM projects via Node's CJS interop despite being a CommonJS package itself. There is one notable open TypeScript typing issue with the full route declaration syntax, but the standard pattern (`{ websocket: true }` on `.get()`) works correctly. Multiplexing multiple event types over a single WebSocket connection is a userland concern -- the plugin gives you a raw `ws` WebSocket object, and you build a JSON message envelope on top.

## 1. Package Details

| Field | Value |
|---|---|
| Package | `@fastify/websocket` |
| Latest version | **11.2.0** (released 2025-07-14) |
| Fastify compat | `fastify: '5.x'` (declared in plugin metadata via `fastify-plugin`) |
| Node.js | Requires Node 20+ (inherited from Fastify 5 requirement) |
| Module format | **CommonJS** (`"type": "commonjs"` in package.json) |
| TypeScript types | Built-in (`types/index.d.ts`), but also requires `@types/ws` as a devDependency |
| License | MIT |

### Dependencies

| Dependency | Version |
|---|---|
| `ws` | `^8.16.0` |
| `duplexify` | `^4.1.3` |
| `fastify-plugin` | `^5.1.0` |

### Version History (Fastify 5 era)

- **v11.2.0** -- 2025-07-14 (latest)
- **v11.1.0** -- 2025-05-26
- **v11.0.2** -- 2025-01-11
- **v11.0.1** -- 2024-09-21 (first release to declare `fastify: ^5.0.0`)
- **v11.0.0** -- 2024-09-04

## 2. Underlying Library

Yes, it still uses the **`ws` package** (version `^8.16.0`). The `ws` library is the de facto standard WebSocket implementation for Node.js -- fast, battle-tested, with no native addon requirement (pure JS by default, optional `bufferutil` and `utf-8-validate` for performance).

The plugin wraps `ws.WebSocketServer` internally and binds it to Fastify's HTTP server. The handler callback receives a raw `ws.WebSocket` instance (not a wrapped stream -- that changed in v11, which dropped the older `SocketStream` wrapper from earlier versions).

## 3. ESM Support

The package itself is CJS (`module.exports`), but it works fine in ESM projects because:

1. Node.js handles CJS-to-ESM interop via default import.
2. The module explicitly sets `module.exports.default = fastifyWebsocket` for this purpose.
3. The Better Stack guide (Aug 2025) demonstrates ESM usage with `"type": "module"` in package.json, confirming this works in practice.

**ESM import pattern:**

```ts
import Fastify from 'fastify';
import websocket from '@fastify/websocket';

const fastify = Fastify();
await fastify.register(websocket);
```

Or with dynamic import:

```ts
await fastify.register(import('@fastify/websocket'));
```

Both patterns confirmed working.

## 4. Route Integration

WebSocket routes coexist alongside regular HTTP routes. The standard pattern:

```ts
import Fastify from 'fastify';
import websocket from '@fastify/websocket';

const fastify = Fastify();
await fastify.register(websocket);

// Regular HTTP route
fastify.get('/api/health', async (request, reply) => {
  return { status: 'ok' };
});

// WebSocket route
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (socket, request) => {
    socket.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      socket.send(JSON.stringify({ type: 'ack', id: msg.id }));
    });

    socket.on('close', () => {
      console.log('client disconnected');
    });
  });
});
```

### Key rules

- **Register the plugin before all routes.** It must intercept the HTTP upgrade request before Fastify's router sends a 404.
- WebSocket routes use Fastify's normal plugin encapsulation -- hooks, decorators, and error handlers scoped to the register context will apply.
- The same path can have both an HTTP handler and a WebSocket handler using the `route()` method with `handler` + `wsHandler`:

```ts
fastify.route({
  method: 'GET',
  url: '/hello',
  handler: (req, reply) => {
    reply.send({ hello: 'world' }); // HTTP requests
  },
  wsHandler: (socket, req) => {
    socket.send('hello client'); // WebSocket connections
  }
});
```

## 5. Multiplexing Multiple Event Types

`@fastify/websocket` does **not** provide built-in multiplexing or event routing. It gives you a raw `ws.WebSocket`. Multiplexing is a userland pattern.

### Recommended approach: JSON envelope

The standard pattern is a JSON message with a `type` discriminator field:

```ts
// Shared types (e.g., src/core/ws-types.ts)
type WsMessage =
  | { type: 'file-change'; path: string; event: 'change' | 'unlink' }
  | { type: 'edit-sync'; delta: unknown }
  | { type: 'chat'; text: string; from: string }
  | { type: 'ping' }
  | { type: 'pong' };

// Server-side dispatch
socket.on('message', (raw) => {
  const msg: WsMessage = JSON.parse(raw.toString());
  switch (msg.type) {
    case 'file-change':
      handleFileChange(msg);
      break;
    case 'edit-sync':
      handleEditSync(msg);
      break;
    case 'chat':
      handleChat(msg);
      break;
    case 'ping':
      socket.send(JSON.stringify({ type: 'pong' }));
      break;
  }
});
```

This is the overwhelmingly standard approach. No library needed. The discriminated union in TypeScript gives you exhaustive type checking on both client and server.

### Alternatives

- **Socket.IO** (`fastify-socket` v5.1.4 or `@wick_studio/fastify-socket.io` v5.1.0): Provides built-in event namespacing (`socket.emit('file-change', data)`) but adds significant overhead, a custom protocol, and a required client library. Overkill for your use case.
- **Protocol-level multiplexing** (RFC 8441, WebSocket over HTTP/2): Not yet supported by `@fastify/websocket` (see open issue #353). Not relevant for your use case anyway.

## 6. Known Issues (Fastify 5.x + @fastify/websocket)

### Open Issues (as of March 2026)

**TypeScript typing bug -- #314 (open, Dec 2024)**
The full route declaration syntax (`fastify.route({ websocket: true, handler: ... })`) has incorrect types -- the handler params are typed as `(FastifyRequest, FastifyReply)` instead of `(WebSocket, FastifyRequest)`. The `wsHandler` property is also ignored when `websocket: true` is set.

**Workaround:** Use the shorthand `.get()` with `{ websocket: true }` instead of `.route()`. This is typed correctly:

```ts
fastify.get('/ws', { websocket: true }, (socket, request) => {
  // socket is correctly typed as WebSocket
});
```

**@types/ws not bundled -- #300 (open, Jun 2024)**
The package has built-in types but depends on `@types/ws` for the `WebSocket` type. You must install it as a devDependency:

```
npm i -D @types/ws
```

**Throwing in wsHandler crashes the process -- #308 (open, Dec 2024)**
Throwing an uncaught error inside a WebSocket handler can crash the Node process. Always wrap handler logic in try/catch.

**Route prefixes not supported -- #298 (open, Jun 2024)**
WebSocket routes may not respect Fastify's route prefix option in all cases.

**onSend hook not called -- #203 (open, May 2022)**
The `onSend` lifecycle hook is not invoked for WebSocket routes. This is because there's no HTTP response being sent.

### Non-issues / Clarifications

- **ESM compatibility**: Works fine via Node's CJS interop. Not a real problem despite the package being CJS.
- **Fastify 5.x compatibility**: Explicitly declared (`fastify: '5.x'`). No known general incompatibility.
- **`duplexify` dependency**: Still present in v11.x despite the removal of the `SocketStream` wrapper in the public API. Used internally.

## 7. Practical Recommendations for Your Stack

Given Fastify 5.8.2 + ESM + TypeScript:

1. **Install:**
   ```
   npm i @fastify/websocket
   npm i -D @types/ws
   ```

2. **Use the `.get()` shorthand** with `{ websocket: true }` to avoid the TypeScript typing bug in `.route()`.

3. **Register the plugin early** -- before any route definitions.

4. **Use a JSON envelope** with a `type` discriminator for multiplexing file-change events, future edit-sync, chat, etc. Define a shared discriminated union type.

5. **Wrap handler logic in try/catch** to avoid process crashes from uncaught errors in WebSocket handlers.

6. **Attach `message` handlers synchronously** in the connection callback. If you need async setup (e.g., auth validation), attach the `message` listener first, buffer messages, then process after async work completes. Otherwise messages arriving during the async gap will be silently dropped.

## Sources

- [@fastify/websocket on npm](https://www.npmjs.com/package/@fastify/websocket) -- Official package page
- [@fastify/websocket on GitHub](https://github.com/fastify/fastify-websocket) -- Source repo, 459 stars, MIT
- [GitHub Issue #314](https://github.com/fastify/fastify-websocket/issues/314) -- TypeScript full declaration syntax bug (open)
- [GitHub Issue #300](https://github.com/fastify/fastify-websocket/issues/300) -- @types/ws missing (open)
- [GitHub Issue #308](https://github.com/fastify/fastify-websocket/issues/308) -- Throwing in wsHandler crashes process (open)
- [GitHub Issue #298](https://github.com/fastify/fastify-websocket/issues/298) -- Route prefix bug (open)
- [GitHub Issue #353](https://github.com/fastify/fastify-websocket/issues/353) -- RFC 8441 support request (open)
- [Getting Started with Fastify WebSockets](https://betterstack.com/community/guides/scaling-nodejs/fastify-websockets/) -- Better Stack, Aug 2025, ESM examples
- [Fastify V5 Migration Guide](https://fastify.io/docs/v5.6.x/Guides/Migration-Guide-V5) -- Official docs
- [JSON event-based convention for WebSockets](https://thoughtbot.com/blog/json-event-based-convention-websockets) -- Thoughtbot, message envelope pattern
- [Fastify WebSocket PR #293](https://github.com/fastify/fastify-websocket/pull/293) -- Fastify v5 update PR (merged)

## Confidence Assessment

- **Overall confidence: High.** Findings are based on the actual npm registry, GitHub source code, and open issues -- not blog speculation.
- **ESM interop: High confidence.** Confirmed via source code (`module.exports.default`) and multiple working examples in ESM projects.
- **TypeScript issue #314: High confidence it's still open.** Last activity May 2026 per GitHub.
- **Multiplexing: High confidence.** JSON envelope is the standard approach; no built-in multiplexing exists in the plugin.
- **Area of uncertainty:** The `duplexify` dependency's continued presence is unclear -- it may be removable in a future version but does not cause problems.
