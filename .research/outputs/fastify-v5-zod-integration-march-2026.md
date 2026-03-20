# Fastify v5 + Zod Integration -- Research Report

**Date:** 2026-03-19
**Confidence:** High (verified against npm, GitHub, and official docs)

---

## Summary

The Fastify + Zod integration story has matured significantly. The primary package is `fastify-type-provider-zod` (currently v6.1.0 on npm), which provides both validation and serialization compilers for Fastify v5 using Zod v4 schemas. Zod itself is at v4.3.6 (stable, released 2026-01-22). Fastify is at v5.8.2 (released 2026-03-07). The integration works but has some rough edges around ESM module resolution and TypeScript configuration that you need to be aware of. For a plain JavaScript / vanilla JS Fastify project, Zod can also be used directly via a custom `setValidatorCompiler` without the type provider package at all.

---

## 1. Latest Stable Versions (as of March 2026)

| Package | Version | Released | Notes |
|---------|---------|----------|-------|
| `zod` | **4.3.6** | 2026-01-22 | Stable. Zod 4 went stable ~July 2025 |
| `fastify` | **5.8.2** | 2026-03-07 | Latest stable Fastify v5 |
| `fastify-type-provider-zod` | **6.1.0** | 2025-10-24 | Latest on npm. Requires zod >=4.1.5 |

### Zod Versioning Note

Zod 4 changed its versioning/import scheme:
- `import { z } from 'zod'` -- now gives you Zod 4 (as of zod@4.0.0, July 2025)
- `import { z } from 'zod/v4'` -- also gives Zod 4 (works on zod >=3.25.0)
- `import { z } from 'zod/v3'` -- gives legacy Zod 3 from the v4 package

The `fastify-type-provider-zod` README examples use `import { z } from 'zod/v4'`, which works whether you're on zod 3.25.x or 4.x. Once on zod@^4.0.0, you can also import from plain `'zod'`.

---

## 2. `fastify-type-provider-zod` -- The Primary Integration Package

### Package Details

- **npm:** https://www.npmjs.com/package/fastify-type-provider-zod
- **GitHub:** https://github.com/turkerdev/fastify-type-provider-zod
- **Latest version:** 6.1.0 (published 2025-10-24)
- **Weekly downloads:** ~282K
- **Maintainers:** kibertoad (Igor Savin -- also a Fastify core team member), turkerd
- **License:** MIT
- **Last push to repo:** 2026-01-26

### Compatibility Matrix

| fastify-type-provider-zod | zod | fastify |
|---------------------------|-----|---------|
| <=4.x | v3 | ^4.0.0 (Fastify 4) |
| >=5.x | v4 | ^5.5.0 (Fastify 5) |

### Peer Dependencies (v6.1.0)

```json
{
  "@fastify/swagger": ">=9.5.1",
  "fastify": "^5.5.0",
  "openapi-types": "^12.1.3",
  "zod": ">=4.1.5"
}
```

Note: `@fastify/swagger` and `openapi-types` are optional peer dependencies (only needed if you use OpenAPI/Swagger features).

### Direct Dependencies

- `@fastify/error`: ^4.2.0 (only runtime dependency)

### Module Format

- `"type": "module"` in package.json
- Ships both ESM and CJS via exports map:
  ```json
  {
    "require": { "types": "./dist/cjs/index.d.cts", "default": "./dist/cjs/index.cjs" },
    "default": { "types": "./dist/esm/index.d.ts", "default": "./dist/esm/index.js" }
  }
  ```

### Is It Maintained?

**Yes, actively.** kibertoad (Fastify core team) is the primary maintainer. The repo had commits as recently as January 2026. There are open issues (78), which reflects active usage more than neglect. The v5.0.0 -> v6.0.0 -> v6.1.0 releases happened between June and October 2025, all targeting Zod 4 + Fastify 5.

However, there is one notable fork/competitor: `@marcalexiei/fastify-type-provider-zod` (v3.0.0), created by a frustrated contributor whose PRs were being slow-merged. It has better CI coverage (Windows tests, vitest typechecking) and cleaner internals, but only ~1 dependent vs 112 for the original. Worth knowing about but the original remains the community standard.

---

## 3. How the Integration Works (Code Examples)

### TypeScript Setup (Recommended Approach)

```ts
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const app = Fastify();

// Set both compilers -- this is required
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Use withTypeProvider for type inference in route handlers
app.withTypeProvider<ZodTypeProvider>().route({
  method: 'GET',
  url: '/',
  schema: {
    querystring: z.object({
      name: z.string().min(4),
    }),
    response: {
      200: z.string(),
    },
  },
  handler: (req, res) => {
    // req.query.name is typed as string
    res.send(req.query.name);
  },
});

app.listen({ port: 4949 });
```

### Plugin Pattern (for route files using FastifyPluginAsyncZod)

```ts
import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

const plugin: FastifyPluginAsyncZod = async function (fastify, _opts) {
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      querystring: z.object({
        name: z.string().min(4),
      }),
      response: {
        200: z.string(),
      },
    },
    handler: (req, res) => {
      res.send(req.query.name);
    },
  });
};

export default plugin;
```

### Custom Error Handling

```ts
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

app.setErrorHandler((error, request, reply) => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.code(400).send({
      error: 'Validation Error',
      details: error.validation,
    });
  }
  // handle other errors...
});
```

### Plain JavaScript Approach (No Type Provider Needed)

For a vanilla JS Fastify project, you do NOT need `fastify-type-provider-zod` at all. The type provider is a TypeScript concept. For JS, you can write a simple custom validator compiler:

```js
import Fastify from 'fastify';
import { z } from 'zod';

const app = Fastify({ logger: true });

// Custom Zod validator compiler
app.setValidatorCompiler(({ schema }) => {
  return (data) => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { value: result.data };
    }
    return { error: result.error };
  };
});

app.route({
  method: 'POST',
  url: '/users',
  schema: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  },
  handler: async (request, reply) => {
    // request.body is validated by Zod
    return { ok: true, user: request.body };
  },
});

app.listen({ port: 3000 });
```

This approach:
- Works in plain JS (no TypeScript needed)
- Uses Zod for runtime validation
- Does NOT give you response serialization (you'd need a custom serializer compiler for that too)
- Does NOT generate JSON Schema for Swagger/OpenAPI (Fastify's native schema features expect JSON Schema)

---

## 4. Alternatives

### `zod-to-json-schema` (DEPRECATED)

- **Version:** 3.25.1 (latest, final)
- **Status:** DEPRECATED as of November 2025
- **Reason:** Zod v4 has built-in `z.toJSONSchema()` and `z.fromJSONSchema()`, making this package unnecessary
- **Note:** Still works with Zod v3 schemas. If you're on Zod 4, use the native `z.toJSONSchema()` instead.

### Zod 4 Native JSON Schema Support

```js
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.number(),
});

z.toJSONSchema(schema);
// => { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name', 'age'], additionalProperties: false }
```

This means you could theoretically:
1. Define schemas in Zod
2. Convert to JSON Schema via `z.toJSONSchema()`
3. Feed the JSON Schema to Fastify's built-in AJV validator

This is a DIY approach but avoids any third-party connector packages.

### `fastify-zod-openapi`

- **npm:** https://www.npmjs.com/package/fastify-zod-openapi
- **Version:** 5.5.0
- **Weekly downloads:** ~60K
- **Description:** Alternative type provider focused on OpenAPI integration via `zod-openapi`
- **Key difference:** Uses `zod-openapi` under the hood for richer OpenAPI metadata support (e.g., `.meta()` on schemas for descriptions/examples)
- **Supports:** Fastify v5, Zod v4

### `@explita/fastify-zod`

- A smaller, newer plugin (v0.4.1) that takes a different approach -- uses a `validation` property instead of `schema`
- Not widely adopted (0 stars)
- Not recommended as a primary choice

---

## 5. Known Issues and Gotchas

### ESM Module Resolution (IMPORTANT)

Issue #168 in the repo documented `ERR_MODULE_NOT_FOUND` errors when resolving `fastify-type-provider-zod` dist modules with certain TypeScript/Node configurations. This was in the v5.0.0 timeframe (June 2025) and related to how Zod 4 changed its own module resolution.

**Resolution:** v5.0.1+ and v6.x addressed this. However, PR #172 (fixing types to import from `fastify` instead of `fastify/types/schema`) is still in draft as of the research date, waiting on a Fastify core release.

**Recommendation:** Use `fastify-type-provider-zod@6.1.0` with `zod@^4.1.5` and `fastify@^5.5.0`. Set your tsconfig to use `"moduleResolution": "bundler"` or `"node16"`. Avoid `"moduleResolution": "node"` (the legacy mode).

### TypeScript `moduleResolution` Configuration

- Zod 4 requires `"moduleResolution": "bundler"` or `"node16"` / `"nodenext"` in tsconfig
- The old `"moduleResolution": "node"` does NOT work properly with Zod 4's subpath exports (`zod/v4`, `zod/mini`)
- This also affects `fastify-type-provider-zod` since it re-exports Zod types

### Type Inference in Separated Handlers

Types do NOT auto-propagate to handler arguments if you explicitly type them. You must either:
1. Use inline handlers without explicit type annotations (let inference work)
2. Use the `FastifyPluginAsyncZod` type for plugin files
3. Manually create a typed `FastifyInstance` alias

This is a known DX friction point (issues #142, #157).

### Response Serialization with `z.object({}).passthrough()`

If you use `.passthrough()` on response schemas, the fast-json-stringify serializer will strip unknown properties. Workaround: use `z.any()` for passthrough objects, or configure a custom serializer using `createSerializerCompiler` with `JSON.stringify`.

### Zod 4 `z.input` vs `z.output` for Serialization

In the current `fastify-type-provider-zod` v6.x, response serialization uses `z.input<>` for the serializer type. There's an open issue (#211) arguing it should use `z.encode()` / `z.output<>` instead. The `@bram-dc/fastify-type-provider-zod` fork (v7.0.1) has already switched to `z.output<>` using Zod 4.3's codec APIs.

### Open Issue Count

78 open issues on the repo. Many are feature requests or questions rather than bugs, but it does indicate that the maintainer (kibertoad) merges PRs in bursts rather than continuously.

---

## 6. ESM Compatibility

**Does it work with ESM?** Yes, with caveats.

- `fastify-type-provider-zod@6.1.0` has `"type": "module"` and dual ESM/CJS exports
- `zod@4.x` has `"type": "module"` and proper subpath exports
- `fastify@5.x` supports ESM

**For plain JS ESM projects:**
```js
// package.json: "type": "module"
import Fastify from 'fastify';
import { z } from 'zod';
// This works fine in Node.js ESM
```

**For TypeScript ESM projects:**
- Use `"module": "node16"` or `"module": "nodenext"` in tsconfig
- Use `"moduleResolution": "node16"`, `"nodenext"`, or `"bundler"`
- Do NOT use `"moduleResolution": "node"` (legacy)

---

## 7. Recommendation for This Project

Given the project direction (browser-first Fastify + vanilla JS):

**Option A -- Minimal / Plain JS:** Skip `fastify-type-provider-zod` entirely. Use Zod directly with a custom `setValidatorCompiler`. You get runtime validation without any TypeScript type provider machinery. Simple, no extra dependencies beyond `zod` itself.

**Option B -- Full Integration (if adding TypeScript later):** Install `fastify-type-provider-zod@6.1.0` alongside `zod@^4.3.6` and `fastify@^5.8.2`. You get validated request handling, response serialization, and Swagger/OpenAPI generation.

**For a vanilla JS project, Option A is the pragmatic choice.** The type provider package exists primarily for TypeScript inference benefits.

### Install Commands

Option A (plain JS):
```bash
npm install zod@^4.3.6
```

Option B (full TypeScript integration):
```bash
npm install zod@^4.3.6 fastify-type-provider-zod@^6.1.0
```

---

## Sources

- [fastify-type-provider-zod npm](https://www.npmjs.com/package/fastify-type-provider-zod) -- v6.1.0, peer deps, compatibility matrix
- [fastify-type-provider-zod GitHub](https://github.com/turkerdev/fastify-type-provider-zod) -- README, issues, releases
- [Zod npm](https://www.npmjs.com/package/zod) -- v4.3.6 latest
- [Zod releases](https://github.com/colinhacks/zod/releases) -- release history
- [Zod v4 versioning docs](https://zod.dev/v4/versioning) -- import path changes
- [Zod JSON Schema docs](https://zod.dev/json-schema) -- native z.toJSONSchema()
- [Fastify Type Providers docs](https://fastify.dev/docs/v5.0.x/Reference/Type-Providers) -- official Fastify docs
- [zod-to-json-schema npm](https://www.npmjs.com/package/zod-to-json-schema) -- deprecated, v3.25.1 final
- [fastify-zod-openapi npm](https://www.npmjs.com/package/fastify-zod-openapi) -- alternative, v5.5.0
- [Issue #168](https://github.com/turkerdev/fastify-type-provider-zod/issues/168) -- v5 ESM/type resolution errors
- [Issue #156](https://github.com/turkerdev/fastify-type-provider-zod/issues/156) -- Zod 4 support tracking
- [PR #172](https://github.com/turkerdev/fastify-type-provider-zod/pull/172) -- module resolution fix (still draft)
- [@marcalexiei/fastify-type-provider-zod](https://www.npmjs.com/package/@marcalexiei/fastify-type-provider-zod) -- maintained fork, v3.0.0
- [Fastify releases](https://github.com/fastify/fastify/releases) -- v5.8.2 latest

---

## Confidence Assessment

- **Overall confidence:** High
- **Version numbers:** Verified against npm registry and GitHub releases
- **Compatibility claims:** Verified against package.json peer dependencies and README compatibility table
- **ESM information:** Verified against package.json exports field and GitHub issues
- **Area of uncertainty:** The PR #172 module resolution fix is still in draft; unclear if there are lingering edge cases with certain tsconfig setups
- **Area of uncertainty:** The `@marcalexiei/fastify-type-provider-zod` fork is new enough that its long-term viability is unclear
