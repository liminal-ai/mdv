# Fastify Research Report -- March 2026

## Summary

Fastify v5.8.2 is the latest stable release (published March 7, 2026). It is a CommonJS package that fully supports both CJS and ESM consumers. It requires Node.js v20 or higher. The v4-to-v5 migration includes approximately 22 breaking changes, most of which are cleanup of deprecated APIs rather than fundamental architecture shifts. The Fastify plugin ecosystem for a local web app is mature, with official core plugins for static file serving, CORS, WebSocket, form body parsing, and more.

## Key Findings

- **Latest stable version**: 5.8.2 (March 7, 2026)
- **Module system**: Published as CommonJS (`"type": "commonjs"` in package.json), but works seamlessly with ESM via `import Fastify from 'fastify'`
- **Node.js requirement**: v20+ (hard requirement in v5; v18 support dropped)
- **v4 EOL**: Fastify v4 support ended June 30, 2025
- **v5.0.0 release date**: September 17, 2024

## 1. Latest Stable Version

**v5.8.2** -- released March 7, 2026.

Recent release timeline:
| Version | Date |
|---------|------|
| v5.8.2 | Mar 7, 2026 |
| v5.8.1 | Mar 5, 2026 |
| v5.8.0 | Mar 5, 2026 |
| v5.7.4 | Feb 2, 2026 |
| v5.7.0 | Jan 15, 2026 |
| v5.6.2 | Nov 9, 2025 |
| v5.0.0 | Sep 17, 2024 |

Weekly npm downloads: ~4.8M. Actively maintained with frequent releases.

## 2. Module System: CJS Package, ESM Compatible

Fastify v5 is published as **CommonJS**. Its package.json explicitly declares `"type": "commonjs"` with `"main": "fastify.js"`. There is no `"exports"` field for conditional ESM/CJS resolution.

However, it works perfectly with ESM consumers:

```js
// ESM -- works fine
import Fastify from 'fastify'
const fastify = Fastify({ logger: true })

// CommonJS -- also works
const fastify = require('fastify')({ logger: true })
```

If your project uses ESM (`"type": "module"` in your package.json), you simply use `import` syntax. Fastify's CJS package is importable from ESM because Node.js natively supports importing CJS modules from ESM code.

**For the md-viewer project** (browser-first Fastify + vanilla JS direction): You can use either approach. If you want a modern ESM project, set `"type": "module"` in your package.json and use `import` -- Fastify handles this fine. If you prefer CJS for simplicity and broader compatibility with other tooling, that works too.

## 3. Node.js Version Requirement

**Node.js v20+** is required.

Rationale from the Fastify team:
- Node.js v18 exited LTS on April 30, 2025
- Node.js v20 has better support for `node:test` and other APIs that Fastify leverages
- This simplifies maintenance and enables better developer experience

## 4. Key Plugins for a Local Web App

All plugins below are official core plugins maintained by the Fastify team. Version compatibility with Fastify v5 is confirmed.

### Essential for md-viewer

| Plugin | Version (for Fastify v5) | Purpose |
|--------|--------------------------|---------|
| **@fastify/static** | `>=8.x` (latest: 9.0.0) | Serve static files (HTML, CSS, JS, images). Core need for serving the viewer UI. |
| **@fastify/cors** | `>=10.x` (latest: 11.2.0) | CORS headers. May not be needed if everything is same-origin on localhost, but useful if you split ports. |
| **@fastify/websocket** | `>=11.x` (latest: 11.2.0) | WebSocket support (built on ws@8). Useful for live-reload or file-watching notifications. |
| **@fastify/formbody** | `>=8.x` (latest: 8.0.2) | Parse `application/x-www-form-urlencoded` POST bodies. |

### Potentially Useful

| Plugin | Purpose |
|--------|---------|
| **@fastify/autoload** | Auto-load all plugins/routes from a directory. Keeps project structure clean. |
| **@fastify/sensible** | Adds common utilities (HTTP errors, reply helpers, etc). |
| **@fastify/cookie** | Cookie parsing/setting. |
| **@fastify/compress** | Response compression (gzip, brotli). |
| **@fastify/view** | Template rendering (supports ejs, nunjucks, pug, handlebars, etc). v11.1.1 is latest. Only needed if you want server-side rendering. |
| **@fastify/helmet** | Security headers. Fastify alternative to the `helmet` middleware. |

### Minimal Setup Example

```js
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const fastify = Fastify({ logger: true })

// Serve static files from 'public' directory
fastify.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
})

// API routes
fastify.get('/api/health', async () => ({ status: 'ok' }))

await fastify.listen({ port: 3000 })
```

## 5. Breaking Changes: v4 to v5 Migration

### High-Impact Changes

1. **Full JSON Schema required** -- Schemas for `querystring`, `params`, `body`, and `response` now require complete JSON Schema with `type` property. The `jsonShortHand` option is removed.
   ```js
   // v4 (shorthand -- no longer works)
   schema: { querystring: { name: { type: 'string' } } }

   // v5 (full schema required)
   schema: {
     querystring: {
       type: 'object',
       properties: { name: { type: 'string' } },
       required: ['name']
     }
   }
   ```

2. **Logger constructor changed** -- Custom logger instances must use `loggerInstance` option instead of `logger`. The `logger` option now only accepts pino configuration.

3. **`.listen()` signature changed** -- Variadic form removed. Must use object:
   ```js
   // v4 (no longer works)
   fastify.listen(3000)

   // v5
   fastify.listen({ port: 3000 })
   ```

4. **`reply.redirect()` parameter order reversed**:
   ```js
   // v4
   reply.redirect(301, '/new-url')

   // v5
   reply.redirect('/new-url', 301)
   ```

5. **Decorator reference types prohibited** -- Arrays and Objects as decorator values are banned due to shared-state bugs. Use functions or getters instead.

6. **Plugin API consistency** -- Plugins cannot mix callback and promise patterns. Choose one.

### Medium-Impact Changes

7. **`req.params` has null prototype** -- No more `hasOwnProperty()` on params. Use `Object.hasOwn()`.
8. **Semicolon delimiter disabled by default** in query strings (aligns with RFC 3986).
9. **`reply.sent` is immutable** -- Use `reply.hijack()` instead of setting `reply.sent = true`.
10. **Route versioning** -- `version` and `versioning` options removed. Use `constraints`.
11. **Non-standard HTTP methods removed** -- PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK, TRACE, SEARCH. Re-add via `fastify.addHttpMethod()`.
12. **DELETE with empty body rejected** when Content-Type is `application/json`.

### Low-Impact / Cleanup Changes

13. `request.connection` removed -- use `request.socket`.
14. `reply.getResponseTime()` removed -- use `reply.elapsedTime`.
15. `request.routeSchema`, `request.routeConfig`, `request.routerPath`, `request.routerMethod` removed -- use `request.routeOptions`.
16. `getDefaultRoute()` / `setDefaultRoute()` removed.
17. HEAD routes must register before GET routes (when `exposeHeadRoutes: true`).
18. `hasRoute()` now requires exact route pattern.
19. New distinct properties: `req.host` (with port), `req.hostname` (without port), `req.port`.
20. Type providers distinguish `ValidatorSchema` vs `SerializerSchema`.
21. Trailers must use async callbacks (no direct return).
22. Content-type header parsing is stricter (RFC 9110 compliant as of v5.7.2).

### Migration Advice

- Fix all v4 deprecation warnings first -- they map directly to v5 breaking changes.
- The Fastify team provides a codemod tool to assist migration (referenced in v5.8.2 release notes).
- Most changes are straightforward find-and-replace or minor API adjustments.

## Sources

- [npm: fastify v5.8.2](https://www.npmjs.com/package/fastify) -- Official npm page, highly authoritative. Accessed March 2026.
- [Fastify V5 Migration Guide](https://fastify.dev/docs/v5.5.x/Guides/Migration-Guide-V5) -- Official documentation, highly authoritative.
- [Fastify GitHub Releases](https://releasealert.dev/github/fastify/fastify) -- Release timeline data.
- [GitHub: fastify/fastify package.json](https://raw.githubusercontent.com/fastify/fastify/main/package.json) -- Confirms `"type": "commonjs"`.
- [npm: @fastify/static v9.0.0](https://www.npmjs.com/package/@fastify/static) -- Official plugin page.
- [npm: @fastify/cors v11.2.0](https://www.npmjs.com/package/@fastify/cors) -- Official plugin page.
- [npm: @fastify/websocket v11.2.0](https://www.npmjs.com/package/@fastify/websocket) -- Official plugin page.
- [npm: @fastify/formbody v8.0.2](https://www.npmjs.com/package/@fastify/formbody) -- Official plugin page.
- [npm: @fastify/view v11.1.1](https://www.npmjs.com/package/@fastify/view) -- Official plugin page.
- [Fastify Getting Started Guide](https://fastify.dev/docs/v5.5.x/Guides/Getting-Started) -- Official docs showing ESM/CJS usage.
- [Context7: Fastify Documentation](https://github.com/fastify/fastify) -- Official repo docs on ESM support and plugins.

## Confidence Assessment

- **Overall confidence**: High. All data comes from official npm registry, GitHub releases, and Fastify's own documentation.
- **Module system details**: High confidence. Verified directly from the package.json on GitHub main branch.
- **Plugin compatibility**: High confidence. All listed plugins have explicit Fastify v5 compatibility tables in their npm pages.
- **Breaking changes**: High confidence. Sourced from the official migration guide, cross-referenced across multiple doc versions.
- **No areas of uncertainty or conflict** were encountered.
