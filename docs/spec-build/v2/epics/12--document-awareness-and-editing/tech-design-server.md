# Technical Design — Server (Epic 12: Document Awareness and Editing)

Companion to `tech-design.md`. This document covers server-side implementation depth: context injection, conversation persistence, script context extensions, schema extensions, and the edit notification flow.

---

## Context Injection Service

The context injection service reads the active document from disk, applies the token budget, and constructs the full prompt for the CLI provider. It sits between the WebSocket route and the provider manager — the route calls it with a document path and user message, it returns the constructed prompt components.

### Architecture

```
ws-chat.ts
    │ chat:send { text, context: { activeDocumentPath } }
    ▼
context-injection.ts
    │ 1. Read document from disk
    │ 2. Apply token budget (truncate if needed)
    │ 3. Build system prompt (static capabilities)
    │ 4. Build user message (document block + user text)
    ▼
provider-manager.ts
    │ claude -p --system-prompt "..." --resume <id> "message"
    ▼
CLI Process
```

### Implementation

```typescript
// app/src/server/services/context-injection.ts
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';

/** Token budget in characters (~25K tokens at 4 chars/token) */
const TOKEN_BUDGET_CHARS = 100_000;

/**
 * Context injection result — components for the CLI invocation.
 *
 * Covers: AC-1.1 (document in context), AC-1.4 (token budget)
 */
export interface InjectedContext {
  /** System prompt for the CLI (--system-prompt flag) */
  systemPrompt: string;
  /** Composed user message with document block + user text */
  userMessage: string;
  /** Whether the document was truncated */
  truncated: boolean;
  /** Total line count (present when truncated) */
  totalLines?: number;
  /** Relative path of the document */
  relativePath?: string;
}

/**
 * Build the injected context for a CLI invocation.
 *
 * Reads the document from disk, applies the token budget,
 * and constructs the system prompt and user message.
 *
 * Covers: AC-1.1 (TC-1.1a through TC-1.1d), AC-1.4 (TC-1.4a through TC-1.4c)
 */
export async function buildInjectedContext(
  userText: string,
  activeDocumentPath: string | null,
  workspaceRoot: string | null,
): Promise<InjectedContext> {
  const systemPrompt = buildSystemPrompt();

  // AC-1.1c: No document open — send without document context
  if (!activeDocumentPath) {
    return {
      systemPrompt,
      userMessage: userText,
      truncated: false,
    };
  }

  let content: string;
  let relativePath: string;

  try {
    content = await readFile(activeDocumentPath, 'utf-8');
    relativePath = workspaceRoot
      ? relative(workspaceRoot, activeDocumentPath)
      : activeDocumentPath;
  } catch {
    // AC-4.1: Document unavailable — send without context
    // The caller (ws-chat.ts) sends a chat:error with CONTEXT_READ_FAILED
    throw new ContextReadError(activeDocumentPath);
  }

  // AC-1.4: Apply token budget
  const totalLines = content.split('\n').length;
  let truncated = false;

  if (content.length > TOKEN_BUDGET_CHARS) {
    content = truncateDocument(content, TOKEN_BUDGET_CHARS);
    truncated = true;
  }

  // Build the user message with document block
  const documentBlock = buildDocumentBlock(
    relativePath,
    content,
    truncated,
    totalLines,
  );

  return {
    systemPrompt,
    userMessage: `${documentBlock}\n\n${userText}`,
    truncated,
    totalLines: truncated ? totalLines : undefined,
    relativePath,
  };
}

/**
 * Truncate document to fit within character budget.
 * Truncates at a line boundary.
 *
 * Covers: AC-1.4b (truncation with notification)
 */
function truncateDocument(content: string, budget: number): string {
  // Find the last newline before the budget
  const truncateAt = content.lastIndexOf('\n', budget);
  if (truncateAt === -1) {
    return content.slice(0, budget);
  }

  const truncated = content.slice(0, truncateAt);
  const truncatedLines = truncated.split('\n').length;
  const totalLines = content.split('\n').length;

  return `${truncated}\n\n[Document truncated: showing first ${truncatedLines} of ${totalLines} total lines]`;
}

/**
 * Build the XML-delimited document block for the CLI prompt.
 */
function buildDocumentBlock(
  relativePath: string,
  content: string,
  truncated: boolean,
  totalLines: number,
): string {
  return `<active-document path="${relativePath}" truncated="${truncated}" total-lines="${totalLines}">
${content}
</active-document>`;
}

/**
 * Build the system prompt for the Steward.
 * Static across messages — describes capabilities and conventions.
 *
 * Covers: AC-2.1 (edit instructions), Script Context usage
 */
function buildSystemPrompt(): string {
  return `You are the Spec Steward, an AI assistant embedded in MD Viewer. You help the developer work with markdown documents — answering questions, suggesting improvements, and making edits.

## Context

The developer's currently active document is provided in an <active-document> block before their message. Use it to answer questions and make edits. If no document block is present, the developer has no document open.

## Editing Documents

When the developer asks you to edit the active document, use a <steward-script> block to apply the edit. Read the current content, modify it, and write the full replacement:

<steward-script>
const content = await getActiveDocumentContent();
// ... modify content ...
await applyEditToActiveDocument(modifiedContent);
</steward-script>

Always use applyEditToActiveDocument() for edits — do not use your built-in file tools (Read, Write, Edit) on the active document.

## Opening Files

To open a file in the viewer for the developer:

<steward-script>
await openDocument("relative/path/to/file.md");
</steward-script>

## Available Script Methods

- \`getActiveDocumentContent()\` — Read the currently active document from disk
- \`applyEditToActiveDocument(content)\` — Replace the active document's content (full replacement)
- \`openDocument(path)\` — Open a file in the viewer (relative to workspace root)
- \`showNotification(message)\` — Show a notification to the developer

## Guidelines

- Reference the document content when answering questions
- When editing, explain what you changed after the edit
- If the document was truncated, note that you can only see part of it
- Be concise — the developer is working, not chatting`;
}

/**
 * Error thrown when the active document cannot be read.
 */
export class ContextReadError extends Error {
  constructor(public readonly path: string) {
    super(`Cannot read document: ${path}`);
    this.name = 'ContextReadError';
  }
}
```

### Token Budget Details

The 100K character budget (~25K tokens) provides room for typical spec documents while preventing context overflow. The breakdown of the CLI's context usage:

| Component | Approximate Size | Managed By |
|-----------|-----------------|------------|
| System prompt | ~2K chars (~500 tokens) | `buildSystemPrompt()` |
| Conversation history | Variable | CLI via `--resume` (managed internally) |
| Document content | Up to 100K chars (~25K tokens) | Token budget |
| User message | Typically < 1K chars | Direct |
| Response generation | Reserved by CLI | CLI internal |

The CLI (Claude) has a 200K token context window. The CLI manages conversation history internally — when using `--resume`, it loads prior turns from its own session storage. Our token budget applies only to the document content we inject, giving the CLI ample room for conversation history and response generation.

---

## Conversation Persistence Service

The conversation service manages per-workspace conversation state: storing messages as JSON files, loading them on app start or workspace switch, swapping them when the workspace changes, and clearing them when requested. It follows the same persistence patterns established by the session service in Epic 1.

### Architecture

Conversation files live in a `conversations/` subdirectory within the session storage directory:

```
~/Library/Application Support/md-viewer/
├── session.json                         # Existing session state
├── config.json                          # Feature flags (Epic 10)
└── conversations/                       # NEW — Epic 12
    ├── a3f8b2c1d4e5f6a7.json           # SHA-256 prefix of workspace identity
    ├── b7e9c4d2f1a8e3b6.json
    └── ...
```

### Conversation File Format

```typescript
// Matches the epic's PersistedConversation contract
interface PersistedConversation {
  version: 1;
  workspaceIdentity: string;
  cliSessionId: string | null;
  messages: PersistedMessage[];
  updatedAt: string;   // ISO 8601 UTC
}

interface PersistedMessage {
  id: string;
  role: 'user' | 'agent' | 'error';
  text: string;
  timestamp: string;   // ISO 8601 UTC
  activeDocumentPath?: string;
}
```

The `version` field enables future format migration (same pattern as the session schema's Zod union parsing). The `workspaceIdentity` field is stored inside the file for verification — if the file's identity doesn't match the expected identity (hash collision or manual file manipulation), the conversation is discarded.

### Implementation

```typescript
// app/src/server/services/conversation.ts
import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { SessionState } from '../schemas/index.js';

const CONVERSATIONS_DIR = 'conversations';
const CONVERSATION_VERSION = 1;

/**
 * Manages per-workspace conversation persistence.
 *
 * Covers: AC-3.1 (persistence), AC-3.2 (canonical identity),
 *         AC-3.3 (session ID), AC-3.4 (incremental writes),
 *         AC-3.5 (clear), AC-3.6 (corruption recovery)
 */
export class ConversationService {
  private readonly conversationsDir: string;
  private currentIdentity: string | null = null;
  private currentConversation: PersistedConversation | null = null;

  constructor(sessionDir: string) {
    this.conversationsDir = join(sessionDir, CONVERSATIONS_DIR);
  }

  /**
   * Resolve the canonical workspace identity from session state.
   *
   * Covers: AC-3.2 (TC-3.2a folder, TC-3.2b package)
   */
  resolveIdentity(session: SessionState): string | null {
    // Epic 9 adds packageSourcePath when a package is open
    const packagePath = (session as Record<string, unknown>).packageSourcePath;
    if (typeof packagePath === 'string' && packagePath) {
      return packagePath;
    }
    return session.lastRoot;
  }

  /**
   * Load conversation for a workspace identity.
   * Returns null if no conversation exists or the file is corrupted.
   *
   * Covers: AC-3.1d (load on connect), AC-3.6 (corruption recovery)
   */
  async load(identity: string): Promise<PersistedConversation | null> {
    await mkdir(this.conversationsDir, { recursive: true });

    const filePath = this.filePath(identity);
    let raw: string;

    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      // TC-3.6a: Missing file — return null
      return null;
    }

    try {
      const parsed: PersistedConversation = JSON.parse(raw);

      // Verify identity match (guard against hash collision)
      if (parsed.workspaceIdentity !== identity) {
        return null;
      }

      // Verify version
      if (parsed.version !== CONVERSATION_VERSION) {
        return null;
      }

      this.currentIdentity = identity;
      this.currentConversation = parsed;
      return parsed;
    } catch {
      // TC-3.6b: Corrupted file — reset
      try {
        await unlink(filePath);
      } catch {
        // File may have been deleted concurrently
      }
      return null;
    }
  }

  /**
   * Add a user message to the conversation and persist.
   * Creates the conversation file if it doesn't exist.
   *
   * Covers: AC-3.4a (incremental persistence)
   */
  async addUserMessage(
    identity: string,
    message: PersistedMessage,
  ): Promise<void> {
    await this.ensureConversation(identity);
    this.currentConversation!.messages.push(message);
    this.currentConversation!.updatedAt = new Date().toISOString();
    await this.persist();
  }

  /**
   * Add/update an agent message and persist.
   * Called when chat:done is received — the message is finalized.
   *
   * Covers: AC-3.4a (incremental persistence)
   */
  async addAgentMessage(
    identity: string,
    message: PersistedMessage,
  ): Promise<void> {
    await this.ensureConversation(identity);
    this.currentConversation!.messages.push(message);
    this.currentConversation!.updatedAt = new Date().toISOString();
    await this.persist();
  }

  /**
   * Update the CLI session ID. Called when a result event
   * returns a new session_id.
   *
   * Covers: AC-3.3a (session ID persistence)
   */
  async updateSessionId(
    identity: string,
    sessionId: string,
  ): Promise<void> {
    await this.ensureConversation(identity);
    this.currentConversation!.cliSessionId = sessionId;
    await this.persist();
  }

  /**
   * Get the stored CLI session ID for a workspace.
   *
   * Covers: AC-3.3a (session ID passed on restart),
   *         AC-3.3b (workspace switch loads matching session ID)
   */
  getSessionId(identity: string): string | null {
    if (this.currentIdentity !== identity || !this.currentConversation) {
      return null;
    }
    return this.currentConversation.cliSessionId;
  }

  /**
   * Clear the conversation for a workspace.
   * Removes the file and resets in-memory state.
   *
   * Covers: AC-3.5 (TC-3.5a clear removes persisted,
   *                  TC-3.5b new messages persist normally)
   */
  async clear(identity: string): Promise<void> {
    this.currentConversation = null;
    this.currentIdentity = null;

    try {
      await unlink(this.filePath(identity));
    } catch {
      // File may not exist
    }
  }

  /**
   * Convert a workspace identity to a filename.
   * SHA-256 hash prefix (16 hex chars).
   */
  private filePath(identity: string): string {
    const hash = createHash('sha256')
      .update(identity)
      .digest('hex')
      .slice(0, 16);
    return join(this.conversationsDir, `${hash}.json`);
  }

  /**
   * Ensure a conversation exists in memory for the given identity.
   */
  private async ensureConversation(identity: string): Promise<void> {
    if (this.currentIdentity !== identity || !this.currentConversation) {
      const loaded = await this.load(identity);
      if (!loaded) {
        this.currentIdentity = identity;
        this.currentConversation = {
          version: CONVERSATION_VERSION,
          workspaceIdentity: identity,
          cliSessionId: null,
          messages: [],
          updatedAt: new Date().toISOString(),
        };
      }
    }
  }

  /**
   * Persist the current conversation to disk.
   * Uses atomic write: temp file + rename.
   *
   * Consistent with session.service.ts pattern.
   */
  private async persist(): Promise<void> {
    if (!this.currentConversation || !this.currentIdentity) return;

    await mkdir(this.conversationsDir, { recursive: true });

    const filePath = this.filePath(this.currentIdentity);
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const contents = JSON.stringify(this.currentConversation, null, 2) + '\n';

    await writeFile(tempPath, contents, 'utf-8');
    await rename(tempPath, filePath);
  }
}
```

### Workspace Switch Flow

When the developer switches workspaces (changes root or opens a different package), the conversation swaps. The full sequence, coordinated by `ws-chat.ts`:

```
1. Workspace change detected (session update)
2. If streaming → cancelAndWait() on provider manager
3. Save current conversation (persist())
4. Resolve new workspace identity
5. Load new conversation (load())
6. Update provider manager's session ID
7. Send chat:conversation-load to client
```

The cancel-and-wait step (Q10) ensures no tokens from the old conversation leak into the new one. The `cancelAndWait()` method on the provider manager is a new addition that wraps the existing cancel logic with a Promise that resolves on process exit:

```typescript
// Addition to provider-manager.ts
async cancelAndWait(): Promise<void> {
  if (this.state === 'idle') return;

  this.cancel(this.activeMessageId!);

  // Wait for the process to exit (with timeout)
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      this.killProcess();
      resolve();
    }, 6_000); // 2s SIGINT + 2s SIGTERM + 2s SIGKILL

    if (this.process) {
      this.process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    } else {
      clearTimeout(timeout);
      resolve();
    }
  });
}
```

---

## Script Context Extensions

Epic 10 established the script execution lane with a minimal `ScriptContext` containing only `showNotification`. Epic 12 extends this with three document-aware methods.

### Extended ScriptContext

```typescript
// Extensions to app/src/server/services/script-executor.ts

interface ScriptContext {
  // Epic 10 (existing):
  showNotification(message: string): void;

  // Epic 12 (new):
  getActiveDocumentContent(): Promise<string>;
  applyEditToActiveDocument(content: string): Promise<void>;
  openDocument(path: string): Promise<void>;
}
```

### Method Implementations

The script context is constructed per-message, not globally. Each `chat:send` produces a new context object with the active document path captured from the message's context field. This prevents stale paths if the developer switches tabs between messages.

```typescript
/**
 * Build the script context for a message.
 * The context captures the active document path and workspace root
 * from the current message, not from global state.
 *
 * Covers: AC-2.1 (editing), AC-1.5 (open document)
 */
function buildScriptContext(
  activeDocumentPath: string | null,
  workspaceRoot: string | null,
  onFileCreated: (path: string) => void,
  onOpenDocument: (path: string) => void,
  onNotification: (message: string) => void,
): ScriptContext {
  return {
    showNotification: (message: string) => {
      onNotification(message);
    },

    /**
     * Read the currently active document from disk.
     * Returns the on-disk content (not unsaved editor changes).
     *
     * Covers: AC-1.1d (on-disk version, not unsaved edits)
     */
    getActiveDocumentContent: async (): Promise<string> => {
      if (!activeDocumentPath) {
        throw new Error('No active document');
      }
      return readFile(activeDocumentPath, 'utf-8');
    },

    /**
     * Replace the active document's content on disk.
     * Uses atomic write (temp + rename).
     * Triggers chat:file-created notification.
     *
     * Covers: AC-2.1a (edit modifies disk), AC-2.4a (file-created notification)
     */
    applyEditToActiveDocument: async (content: string): Promise<void> => {
      if (!activeDocumentPath) {
        throw new Error('No active document');
      }

      // Atomic write — consistent with session.service.ts
      const tempPath = `${activeDocumentPath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tempPath, content, 'utf-8');
      await rename(tempPath, activeDocumentPath);

      // Notify the client
      onFileCreated(activeDocumentPath);
    },

    /**
     * Open a file in the viewer.
     * Path is resolved relative to the workspace root.
     * Must be within the workspace root (no traversal).
     *
     * Covers: AC-1.5a (open file in tab)
     */
    openDocument: async (path: string): Promise<void> => {
      if (!workspaceRoot) {
        throw new Error('No workspace root');
      }

      const resolved = resolve(workspaceRoot, path);

      // Path traversal safety — must be within root
      if (!resolved.startsWith(workspaceRoot)) {
        throw new Error(`Path outside workspace root: ${path}`);
      }

      onOpenDocument(resolved);
    },
  };
}
```

### Async Script Execution

Epic 10's script executor uses `vm.runInNewContext()` which is synchronous. The new script context methods return Promises. The executor must be extended to handle async scripts:

```typescript
/**
 * Execute a script that may contain async operations.
 * Wraps the script in an async IIFE and awaits the result.
 *
 * Covers: AC-7.2 (sandboxed execution with curated methods)
 */
async executeAsync(
  script: string,
  context: ScriptContext,
  timeoutMs: number,
): Promise<ScriptResult> {
  try {
    // Wrap in async IIFE so top-level await works
    const wrappedScript = `(async () => { ${script} })()`;

    const result = vm.runInNewContext(wrappedScript, context, {
      timeout: timeoutMs,
      filename: 'steward-script',
    });

    // Result is a Promise — await it with a timeout
    const value = await Promise.race([
      result,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Script timeout')), timeoutMs),
      ),
    ]);

    return { success: true, value };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

The `vm.runInNewContext` `timeout` option only covers synchronous execution time. For async scripts, we add a `Promise.race` with a separate timeout to cover the async resolution. Both timeouts use the same `timeoutMs` value (from `ProviderConfig.scriptTimeoutMs`).

---

## Schema Extensions

All schema changes are additive — extending existing Zod discriminated unions and adding optional fields to existing schemas. No breaking changes to existing message types.

### Extended ChatSendMessage Context

```typescript
// Modified in app/src/server/schemas/index.ts

// Replace the empty context object with document-aware fields
export const ProviderContextSchema = z.object({
  activeDocumentPath: z.string().nullable().default(null),
}).optional();

export const ChatSendMessageSchema = z.object({
  type: z.literal('chat:send'),
  messageId: z.string().uuid(),
  text: z.string().min(1),
  context: ProviderContextSchema,
});
```

The `context` field remains optional for backward compatibility. When absent, the behavior is the same as Epic 10 — no document context is injected.

### New Server → Client Messages

```typescript
// Added to app/src/server/schemas/index.ts

export const ChatFileCreatedMessageSchema = z.object({
  type: z.literal('chat:file-created'),
  path: z.string(),
  messageId: z.string().uuid(),
});

export const PersistedMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent', 'error']),
  text: z.string(),
  timestamp: z.string(),
  activeDocumentPath: z.string().optional(),
});

export const ChatConversationLoadMessageSchema = z.object({
  type: z.literal('chat:conversation-load'),
  workspaceIdentity: z.string(),
  messages: z.array(PersistedMessageSchema),
  cliSessionId: z.string().nullable(),
});

export const ChatContextMessageSchema = z.object({
  type: z.literal('chat:context'),
  messageId: z.string().uuid(),
  activeDocument: z.object({
    relativePath: z.string(),
    truncated: z.boolean(),
    totalLines: z.number().optional(),
  }).nullable(),
});

// Extend the ChatServerMessage union
export const ChatServerMessageSchema = z.discriminatedUnion('type', [
  ChatTokenMessageSchema,
  ChatDoneMessageSchema,
  ChatErrorMessageSchema,
  ChatStatusSchema,
  ChatFileCreatedMessageSchema,          // NEW
  ChatConversationLoadMessageSchema,     // NEW
  ChatContextMessageSchema,              // NEW
]);
```

### New Error Codes

```typescript
// Extended ChatErrorCode enum
export const ChatErrorCodeSchema = z.enum([
  // Existing (Epic 10):
  'INVALID_MESSAGE',
  'PROVIDER_NOT_FOUND',
  'PROVIDER_CRASHED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_BUSY',
  'PROVIDER_AUTH_FAILED',
  'SCRIPT_ERROR',
  'SCRIPT_TIMEOUT',
  'CANCELLED',
  // New (Epic 12):
  'CONTEXT_READ_FAILED',
  'EDIT_FAILED',
]);
```

### Persisted Conversation Schema

```typescript
// Added to app/src/server/schemas/index.ts

export const PersistedConversationSchema = z.object({
  version: z.literal(1),
  workspaceIdentity: z.string(),
  cliSessionId: z.string().nullable(),
  messages: z.array(PersistedMessageSchema),
  updatedAt: z.string(),
});

// Inferred types
export type PersistedConversation = z.infer<typeof PersistedConversationSchema>;
export type PersistedMessage = z.infer<typeof PersistedMessageSchema>;
export type ChatFileCreatedMessage = z.infer<typeof ChatFileCreatedMessageSchema>;
export type ChatConversationLoadMessage = z.infer<typeof ChatConversationLoadMessageSchema>;
```

---

## WebSocket Route Extensions

The `/ws/chat` route from Epic 10 is extended to handle context injection, conversation persistence, and file-created notifications. The changes are additive — all existing behavior is preserved.

### Connection Setup — Conversation Load

When a client connects to `/ws/chat`, the route loads the persisted conversation for the current workspace and sends it as a `chat:conversation-load` message. This is sent **always** when the workspace has an identity — even if no persisted conversation exists (empty messages array). This ensures the client can clear stale state from a previous workspace.

```typescript
// In chatWsRoutes() — after origin check, before message handler

// Load persisted conversation on connect
// Covers: AC-3.1d (conversation loads on WebSocket connect)
const session = sessionService.getSession();
const identity = conversationService.resolveIdentity(session);

if (identity) {
  const conversation = await conversationService.load(identity);
  // Always send — empty messages array clears the client display
  sendMessage(socket, {
    type: 'chat:conversation-load',
    workspaceIdentity: identity,
    messages: conversation?.messages ?? [],
    cliSessionId: conversation?.cliSessionId ?? null,
  });
}
```

This "always send" rule also applies during workspace switches (see Workspace Switch Flow below). When the developer switches from workspace A to workspace B, the server always sends `chat:conversation-load` for workspace B — with the persisted messages if they exist, or an empty array if B has no conversation. The client's replace semantics (discard local state, render loaded messages) handles both cases uniformly.

### Message Handler — Context Injection

The `chat:send` handler is extended to read the document, inject context, and pass it to the provider:

```typescript
case 'chat:send': {
  const docPath = msg.context?.activeDocumentPath ?? null;
  const session = sessionService.getSession();
  const identity = conversationService.resolveIdentity(session);
  const root = session.lastRoot;

  try {
    // Build context with document content
    const injected = await buildInjectedContext(
      msg.text,
      docPath,
      root,
    );

    // Send context acknowledgment — server truth for truncation status
    // Covers: TC-1.4c (context indicator shows truncation)
    sendMessage(socket, {
      type: 'chat:context',
      messageId: msg.messageId,
      activeDocument: injected.relativePath
        ? {
            relativePath: injected.relativePath,
            truncated: injected.truncated,
            totalLines: injected.totalLines,
          }
        : null,
    });

    // Inject persisted session ID for --resume continuity
    const sessionId = identity
      ? conversationService.getSessionId(identity)
      : null;
    providerManager.setSessionId(sessionId);

    // Persist user message
    if (identity) {
      await conversationService.addUserMessage(identity, {
        id: msg.messageId,
        role: 'user',
        text: msg.text,
        timestamp: new Date().toISOString(),
        activeDocumentPath: docPath ?? undefined,
      });
    }

    // Send to provider with injected context
    providerManager.send(
      msg.messageId,
      injected.userMessage,
      injected.systemPrompt,
    );
  } catch (err) {
    if (err instanceof ContextReadError) {
      // AC-4.1: Document unavailable — send warning, then proceed
      // without document context but WITH session continuity
      sendMessage(socket, {
        type: 'chat:error',
        messageId: msg.messageId,
        code: 'CONTEXT_READ_FAILED',
        message: `Cannot read document: ${err.path}`,
      });

      // Persist user message even on context failure
      if (identity) {
        await conversationService.addUserMessage(identity, {
          id: msg.messageId,
          role: 'user',
          text: msg.text,
          timestamp: new Date().toISOString(),
          activeDocumentPath: docPath ?? undefined,
        });
      }

      // Inject persisted session ID — don't drop --resume continuity
      const sessionId = identity
        ? conversationService.getSessionId(identity)
        : null;
      providerManager.setSessionId(sessionId);

      // Send without document context but with system prompt and session
      providerManager.send(msg.messageId, msg.text, buildSystemPrompt());
    }
  }
  break;
}
```

### Provider Manager — Extended send() and Session ID Management

The `ProviderManager` continues to own the session ID internally (consistent with Epic 10's design where it captures `session_id` from `result` events and uses it for `--resume`). Epic 12 adds two capabilities:

1. **System prompt support:** `send()` accepts an optional `systemPrompt` parameter for the `--system-prompt` flag.
2. **External session ID injection:** `setSessionId()` allows the route to inject a persisted session ID on workspace switch or app restart.

```typescript
// Modified send() — adds systemPrompt parameter only
// sessionId remains internally owned via this.sessionId
send(
  messageId: string,
  text: string,
  systemPrompt?: string,
): void {
  // ... existing busy check ...

  const args = [...CLI_ARGS];
  if (this.sessionId) {
    args.push('--resume', this.sessionId);
  }
  if (systemPrompt) {
    args.push('--system-prompt', systemPrompt);
  }
  args.push(text);

  // ... existing spawn logic ...
}

/**
 * Inject a session ID from persisted conversation state.
 * Called on workspace switch or app restart to restore
 * multi-turn continuity.
 *
 * Does NOT conflict with the internal session ID capture —
 * the result event callback still updates this.sessionId
 * after each CLI invocation.
 *
 * Covers: AC-3.3a (session ID passed on restart),
 *         AC-3.3b (workspace switch loads matching session ID)
 */
setSessionId(sessionId: string | null): void {
  this.sessionId = sessionId;
}
```

The session ID flow is:
1. Route reads persisted session ID from `conversationService.getSessionId(identity)`
2. Route calls `providerManager.setSessionId(persistedId)` to inject it
3. `send()` uses `this.sessionId` for `--resume` (whether set externally or captured from a result event)
4. After CLI invocation, the `result` event updates `this.sessionId` via the existing internal capture
5. On `onDone`, route reads `providerManager.getSessionId()` and persists via `conversationService.updateSessionId()`

This preserves Epic 10's ownership model while allowing persistence integration.

### Done Handler — Persist Agent Message and Session ID

When a response completes (`chat:done`), the route persists the agent message and updates the session ID:

```typescript
// Wire provider done event — extended for persistence
const unsubDone = providerManager.onDone((messageId, cancelled) => {
  sendMessage(socket, {
    type: 'chat:done',
    messageId,
    ...(cancelled ? { cancelled: true } : {}),
  });

  // Persist agent message
  const identity = conversationService.resolveIdentity(
    sessionService.getSession(),
  );
  if (identity && accumulatedText[messageId]) {
    conversationService.addAgentMessage(identity, {
      id: messageId,
      role: 'agent',
      text: accumulatedText[messageId],
      timestamp: new Date().toISOString(),
    });
  }
});
```

The `accumulatedText` is a per-message buffer that the token handler populates (same pattern as the client's accumulated text for rendering, but on the server side for persistence).

### File-Created Notification

When a script calls `applyEditToActiveDocument`, the `onFileCreated` callback sends a `chat:file-created` message:

```typescript
// In script context construction
const onFileCreated = (path: string) => {
  sendMessage(socket, {
    type: 'chat:file-created',
    path,
    messageId: currentMessageId,
  });
};
```

This message triggers an immediate document reload on the client, bypassing the file watcher's polling interval (AC-2.2, NFR: within 100ms of disk write).

### Clear Handler — Persistence Extension

Epic 10's `chat:clear` handler calls `providerManager.clear()` which discards the stored session ID and resets conversation context. Epic 12 extends this to also clear persisted state:

```typescript
case 'chat:clear': {
  // Epic 10: reset provider context
  providerManager.clear();

  // Epic 12: clear persisted conversation and session ID
  // Covers: AC-3.5 (TC-3.5a clear removes persisted, TC-3.3c clear clears session ID)
  const session = sessionService.getSession();
  const identity = conversationService.resolveIdentity(session);
  if (identity) {
    await conversationService.clear(identity);
  }

  // Send empty conversation-load so client clears its display
  // (client's replaceConversation with empty array produces empty state)
  if (identity) {
    sendMessage(socket, {
      type: 'chat:conversation-load',
      workspaceIdentity: identity,
      messages: [],
      cliSessionId: null,
    });
  }
  break;
}
```

The server sends `chat:conversation-load` with an empty messages array after clearing. This ensures the client replaces its local state with the cleared state, consistent with the replace semantics defined for `chat:conversation-load`. The client does not need a separate "clear" protocol — the replace mechanism handles it.

---

## Provider Manager — Session ID Flow

The provider manager extracts the CLI session ID from the `result` event and stores it internally. This is the existing behavior from Epic 10 — the provider manager already handles `result` events with `parsed.sessionId` in its `handleStreamLine` method. No new event callbacks are needed for the internal capture path.

The persistence integration uses a different mechanism: the **route** reads the session ID from the provider manager after each response completes and passes it to the conversation service.

```
1. First message → route calls setSessionId(persistedId), then send()
2. ProviderManager uses this.sessionId for --resume (if set)
3. CLI result event → { session_id: "sess-abc123" }
4. ProviderManager.handleStreamLine captures parsed.sessionId → this.sessionId
   (existing Epic 10 behavior, no change)
5. chat:done fires → route reads providerManager.getSessionId()
6. Route calls conversationService.updateSessionId(identity, newId)
7. Next message → route calls setSessionId(newId) from conversation service
```

The Epic 10 provider manager already has this in its `handleStreamLine` (see Epic 10 tech-design-server.md lines 756-768):

```typescript
// Existing in provider-manager.ts (Epic 10 — no changes needed)
case 'result':
  if (parsed.sessionId) {
    this.sessionId = parsed.sessionId;  // Internal capture
  }
  this.emitDone(messageId);
  break;
```

Epic 12 adds one accessor so the route can read the captured ID:

```typescript
// New getter in provider-manager.ts (Epic 12)
getSessionId(): string | null {
  return this.sessionId;
}
```

The route wires the persistence in the `onDone` handler:

```typescript
// In ws-chat.ts — done handler (extended for persistence)
const unsubDone = providerManager.onDone((messageId, cancelled) => {
  // ... send chat:done to client ...

  // Persist the session ID captured by the provider manager
  const newSessionId = providerManager.getSessionId();
  if (identity && newSessionId) {
    conversationService.updateSessionId(identity, newSessionId);
  }

  // ... persist agent message ...
});
```

This design avoids inventing new event handlers (`onSessionId`) — it reads the session ID synchronously after the done event, since the provider manager has already captured it from the `result` event that precedes `done`.
