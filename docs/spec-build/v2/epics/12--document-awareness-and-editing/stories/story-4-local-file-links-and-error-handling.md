# Story 4: Local File Links and Error Handling

---

### Summary
<!-- Jira: Summary field -->

Local file paths in chat responses are clickable links that open files in the viewer, CLI session continuity enables prior conversation access, and error handling covers context injection failures and feature isolation.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Reading and working on markdown documents in the viewer while using the chat panel to ask questions about the content, request edits, and iterate on specs.

**Objective:** When the Steward mentions a file path in a response, the path is a clickable link that opens the file in the viewer. The CLI session is properly resumed via `--resume` so the Steward has access to prior conversation turns. Context injection failures produce visible feedback without crashing the app. All Epic 12 functionality is gated behind `FEATURE_SPEC_STEWARD`.

**Scope:**

In scope:
- File link post-processor: scan rendered agent message HTML for `<a>` tags with local file paths, validate against cached file tree, add click handlers
- Bare file path detection: text nodes containing paths like `docs/spec.md` wrapped in clickable spans
- Path resolution: relative paths resolved against workspace root, absolute paths validated within root
- Path traversal safety: paths outside workspace root or nonexistent render as plain text
- External link preservation: `http://`, `https://`, `mailto:`, `#` links handled by Epic 11 behavior
- CLI session continuity: `--resume` with stored session ID provides access to prior conversation turns
- Tab switch does not clear CLI session
- Error handling for context injection: `ContextReadError` caught in route, `CONTEXT_READ_FAILED` sent to client, message proceeds without document context
- Feature flag isolation: no context indicator, no conversation persistence, no local file links when `FEATURE_SPEC_STEWARD` is disabled

Out of scope:
- File link processor for non-markdown file types (matches `.md`, `.markdown` extensions only for bare path detection)

**Dependencies:**
- Story 1 complete (context injection — error handling wraps the context injection service)
- Story 3 complete (conversation persistence — session continuity depends on persisted session IDs)
- Story 0 complete (schemas, types)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.3:** The correct CLI session is resumed so the CLI has access to prior conversation turns

- **TC-1.3a: Session ID passed on subsequent messages**
  - Given: The developer has sent a message and received a response (establishing a CLI session)
  - When: The developer sends a follow-up message
  - Then: The CLI is invoked with `--resume` and the stored session ID, providing it access to prior conversation turns

- **TC-1.3b: Tab switch does not clear conversation**
  - Given: The developer has a multi-turn conversation about document A
  - When: The developer switches to document B
  - Then: The conversation history remains visible in the chat panel; the context indicator updates to show document B; prior messages about document A are still visible; the same CLI session is resumed

**AC-1.5:** Local file paths in chat responses navigate within the viewer

- **TC-1.5a: Relative path opens file in tab**
  - Given: An agent response contains a relative file path (e.g., `docs/spec.md`) that references a file within the current root
  - When: The developer clicks the path
  - Then: The file opens in a tab in the viewer (or activates the existing tab if already open)

- **TC-1.5b: Absolute path within root opens file**
  - Given: An agent response contains an absolute path that is within the current root
  - When: The developer clicks the path
  - Then: The file opens in a tab

- **TC-1.5c: Path outside root or nonexistent is not clickable**
  - Given: An agent response contains a file path that is outside the current root or does not exist on disk
  - When: The developer views the response
  - Then: The path renders as plain text, not a clickable link

- **TC-1.5d: External links still open in system browser**
  - Given: An agent response contains both local file paths and http/https URLs
  - When: The developer clicks an http URL
  - Then: The URL opens in the system browser (consistent with Epic 11 behavior); local file links open in the viewer

**AC-4.1:** Document unavailable during context injection produces visible feedback

- **TC-4.1a: Active document deleted externally**
  - Given: The active tab's document was deleted on disk since it was opened
  - When: The developer sends a message
  - Then: The message is sent without document context; the context indicator shows that the document is unavailable

- **TC-4.1b: Document read fails**
  - Given: The active document exists but is unreadable (permission denied)
  - When: The developer sends a message
  - Then: The message is sent without document context; a warning appears in the context indicator

**AC-4.2:** All Epic 12 functionality is absent when the feature flag is disabled

- **TC-4.2a: No context indicator**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: The app loads
  - Then: No context indicator, conversation persistence, or local file link navigation is active

- **TC-4.2b: No conversation files created**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: The app runs
  - Then: No conversation JSON files are created in the session storage directory

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### File Link Processor

New file: `app/src/client/steward/file-link-processor.ts`

```typescript
export function processFileLinks(
  messageEl: HTMLElement,
  workspaceRoot?: string | null,
  fileTreePaths?: Set<string>,
  openFile?: (path: string) => void,
): void;
```

Algorithm:
1. Query all `<a>` elements in the rendered message
2. Skip external links (`http://`, `https://`, `mailto:`, `#`)
3. Resolve remaining hrefs against workspace root
4. Validate: within root AND exists in cached file tree
5. If valid: add `.local-file-link` class, click handler calling `openFile(resolved)`, remove `target="_blank"`
6. If invalid: leave as-is (renders as non-clickable text)

Bare file path detection (`detectBareFilePaths`):
- TreeWalker over text nodes
- Pattern: `\.?(?:[\w.-]+\/)+[\w.-]+\.(?:md|markdown)` (relative paths with `.md`/`.markdown` extensions)
- Skip text inside `<code>` and `<pre>` elements
- Wrap matched paths in clickable `<span class="local-file-link">`
- Apply replacements in reverse order to preserve offsets

#### File Tree Path Cache

```typescript
function collectTreePaths(tree: TreeNode[], root: string): Set<string>;
```

Extracts file paths from the sidebar's cached tree data. Rebuilt on workspace switch and file tree refresh.

#### CSS

```css
.local-file-link {
  color: var(--color-accent);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}
.local-file-link:hover {
  text-decoration-style: solid;
}
```

#### Integration

The file link processor runs after every markdown render — both during streaming (on each debounce cycle) and on conversation restoration. Called from `chat-panel.ts` after inserting rendered HTML into the DOM.

#### Context Injection Error Handling

In the `chat:send` route handler, `ContextReadError` is caught:
1. Send `chat:error` with `CONTEXT_READ_FAILED` code
2. Persist the user message even on context failure
3. Inject persisted session ID (don't drop `--resume` continuity)
4. Send message to CLI without document context but with system prompt and session

The context indicator updates from the `chat:context` message — when the server sends `activeDocument: null`, the indicator reflects "document unavailable."

#### Session Continuity

The session ID flow (from Stories 1 and 3) ensures `--resume` is passed on subsequent messages:
1. First message: no session ID → CLI starts fresh session → result event captures `session_id`
2. Subsequent messages: `providerManager.setSessionId(captured)` → `--resume <id>` in CLI args
3. Tab switch: conversation and indicator update, but session ID is preserved — same CLI session continues

*See the tech design document for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] File link processor detects and activates local file paths in agent messages
- [ ] Bare file paths in text nodes detected and wrapped in clickable spans
- [ ] Paths outside root or nonexistent render as plain text
- [ ] External links preserved with system browser behavior
- [ ] File link CSS styles applied
- [ ] CLI session ID passed via `--resume` on subsequent messages
- [ ] Tab switch does not clear CLI session
- [ ] `ContextReadError` produces visible feedback, message proceeds without context
- [ ] Feature flag disables all Epic 12 functionality
- [ ] `npm run build && npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes — 14 tests (8 file link processor + 5 provider manager + 1 client feature isolation), per test plan Chunk 4. Note: TC-4.2b's test lives in `ws-chat.test.ts` (Chunk 3) because it tests route behavior; the AC is owned by this story.
