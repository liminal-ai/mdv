# Story 1: Package Context and Indicator

---

### Summary
<!-- Jira: Summary field -->

The Steward receives the package manifest structure and metadata with each message when a package is open, and the context indicator shows workspace type and package identity alongside the active document.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working within spec packages containing PRDs, epics, tech designs, and stories. The Steward already knows what document is open (Epic 12) but cannot see the broader package structure, read other files, create new files, or understand where the user is in the spec lifecycle.

**Objective:** When a package is open and the developer sends a message, the server reads the package manifest and metadata from the package service, constructs a `<workspace-context>` XML block in the prompt alongside the existing `<active-document>` block, and sends an extended `chat:context` message with workspace info to the client. The context indicator in the chat panel shows the package name and active document. After this story, the Steward can answer "what's in this package?" by referencing the navigation tree in context.

**Scope:**

In scope:
- `PackageContextService`: builds package context from session state and manifest — `buildPackageContext(session, packageService, canonicalIdentity)` returns `FullProviderContext`
- Spec metadata extraction from manifest frontmatter via `js-yaml` (promoted from transitive to direct dependency)
- Extended `buildInjectedContext()`: adds `<workspace-context>` XML block with metadata and navigation tree sections (the block shape supports a spec phase section, but spec-phase population is Story 5)
- Extended `buildSystemPrompt()`: package-aware instructions, new script method documentation
- Extended `chat:context` message with `workspace` field (`type`, `rootPath`, `packageTitle`, `warning`)
- `provider-manager.ts`: new `setScriptContext(ctx)` method to accept per-message context
- Client context indicator: shows workspace type and package title alongside active document
- Client `chat-state.ts`: `workspaceType` and `packageTitle` tracking
- CSS for package indicator: icon, title, chevron separator, truncation badge

Out of scope:
- Script method implementations (Stories 2–6)
- `chat:package-changed` client handling (Story 3)
- Spec phase detection and `spec` field population in provider context (Story 5 — phase detector is in Story 0, but integration into context injection and spec-phase population of the workspace-context block is Story 5)

**Dependencies:**
- Story 0 complete (schemas, types, phase detector)
- Epics 9, 10, 11, 12 complete

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** The package manifest structure and metadata are included in the provider context when a package is open

- **TC-1.1a: Package context included**
  - Given: A package is open with a manifest containing five navigation entries and metadata (title, version)
  - When: The developer sends a message
  - Then: The provider context includes the package metadata and navigation tree (verifiable by inspecting the provider's received context)

- **TC-1.1b: No package context when folder is open**
  - Given: A regular folder is open (not a package)
  - When: The developer sends a message
  - Then: The provider context does not include package-specific fields; workspace type is `folder`

- **TC-1.1c: Package context updates on workspace switch**
  - Given: Package A is open and the developer has been chatting about it
  - When: The developer opens Package B
  - Then: The next message's provider context includes Package B's manifest and metadata, not Package A's

- **TC-1.1d: Manifest-less package provides minimal context**
  - Given: A package is open in filesystem fallback mode (no manifest or unreadable manifest)
  - When: The developer sends a message
  - Then: The provider context includes `manifestStatus: 'missing'` or `'unreadable'`; no navigation tree

**AC-1.2:** The context indicator shows workspace type and package identity alongside the active document

- **TC-1.2a: Package mode indicator**
  - Given: A package with title "My Spec" is open and a document `docs/epic.md` is active
  - When: The developer views the chat panel
  - Then: The context indicator shows the package name and the active document (e.g., "My Spec > docs/epic.md"). Exact layout is a tech design decision.

- **TC-1.2b: Folder mode indicator**
  - Given: A regular folder is open and a document is active
  - When: The developer views the chat panel
  - Then: The context indicator shows the active document as in Epic 12; no package indicator

- **TC-1.2c: Package mode with no document open**
  - Given: A package is open but no document tabs are active
  - When: The developer views the chat panel
  - Then: The context indicator shows the package name without a document path

- **TC-1.2d: Package mode with truncated document**
  - Given: A package is open and the active document was truncated due to token budget
  - When: The developer views the context indicator
  - Then: Both the package identity and the truncation indicator are visible

**AC-1.3:** The Steward can answer questions about the package structure without reading individual files

- **TC-1.3a: "What's in this package?"**
  - Given: A package is open with a manifest containing navigation entries
  - When: The developer asks "what's in this package?"
  - Then: The provider context includes the navigation tree, enabling the Steward to list the package contents (verifiable by confirming the navigation tree is in the context, not by asserting model response quality)

- **TC-1.3b: Package metadata available**
  - Given: A package is open whose manifest has title, version, and author metadata
  - When: The developer asks about the package
  - Then: The provider context includes the metadata fields

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### PackageContextService

New module `app/src/server/services/package-context.ts`. Stateless — reads from session and package services on every call. Returns `FullProviderContext` with `workspace`, optional `package`, optional `spec` fields.

```typescript
export async function buildPackageContext(
  session: SessionState,
  packageService: PackageService,
  canonicalIdentity: string,
): Promise<FullProviderContext>;
```

- Reads `activePackage` from session state
- If no package → returns `{ workspace: { type: 'folder', rootPath, canonicalIdentity } }`
- If manifest missing/unreadable → returns package context with `manifestStatus` and empty navigation
- If manifest present → calls `packageService.getManifest()`, builds full context with metadata, navigation, file count

Spec metadata extraction uses `js-yaml` to parse YAML frontmatter between `---` delimiters:

```typescript
function extractSpecMetadata(rawManifestContent: string): {
  type?: string;
  specPhase?: string;
  specStatus?: string;
} | null;
```

#### Extended Context Injection

Modified `app/src/server/services/context-injection.ts`. Extended `buildInjectedContext()` now accepts `packageService` and builds a `<workspace-context>` XML block:

```xml
<workspace-context type="package" title="My Spec" mode="directory">
## Metadata
title: My Spec
version: 1.0

## Navigation
- [Product Requirements](prd.md)
- [Epic](epic.md)

</workspace-context>
```

Extended `InjectedContext` return type includes: `workspaceType`, `workspaceRootPath`, `packageTitle?`, `warning?`.

Extended `buildSystemPrompt()` includes package-aware instructions and all 11 script method descriptions (4 from Epic 12 + 7 from Epic 13).

#### Extended chat:context Message

`ws-chat.ts` sends extended `chat:context` with workspace info:

```typescript
{
  type: 'chat:context',
  messageId,
  activeDocument: { relativePath, truncated, totalLines? } | null,
  workspace: { type: 'folder' | 'package', rootPath, packageTitle?, warning? }
}
```

#### Context Indicator Layout

CSS flex row in chat panel header:

| Workspace Mode | Indicator Display |
|---|---|
| Folder + document | `docs/epic.md` (Epic 12 behavior, unchanged) |
| Package + document | `[pkg-icon] My Spec › docs/epic.md` |
| Package + document + truncated | `[pkg-icon] My Spec › docs/epic.md [truncated]` |
| Package + no document | `[pkg-icon] My Spec` |
| Folder + no document | (empty) |

Package icon is a CSS `::before` pseudo-element (rectangle outline), not an emoji. Title clamped to `max-width: 200px` with ellipsis.

#### Provider Manager Extension

Modified `app/src/server/services/provider-manager.ts`. New `setScriptContext(ctx)` method accepts per-message script context from `ws-chat.ts` and passes it to the internal `ScriptExecutor`.

See the tech design documents for full architecture, implementation targets, and test mapping.

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `PackageContextService` returns correct context for package, folder, and manifest-less states
- [ ] `buildInjectedContext()` produces `<workspace-context>` block with metadata and navigation
- [ ] `buildSystemPrompt()` includes all 11 script method descriptions
- [ ] `chat:context` message includes workspace type and packageTitle
- [ ] Context indicator renders package title + separator + document path in package mode
- [ ] Context indicator shows only document path in folder mode (Epic 12 behavior preserved)
- [ ] `js-yaml` promoted to direct dependency, `@types/js-yaml` added as devDependency
- [ ] `providerManager.setScriptContext(ctx)` method is callable from route
- [ ] All 10 TC-mapped tests + 6 non-TC tests pass (16 total)
- [ ] `npm run verify` passes
