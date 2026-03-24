# Story 0: Foundation (Infrastructure)

---

### Summary
<!-- Jira: Summary field -->

Establish shared types, schemas, error codes, and test fixtures for Epic 12's document awareness and editing capabilities.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Reading and working on markdown documents in the viewer while using the chat panel to ask questions about the content, request edits, and iterate on specs.

**Objective:** Define the type-level contracts and test infrastructure that all subsequent stories build on. After this story, the extended schemas compile, the new message types validate, and test fixtures are available for all downstream stories.

**Scope:**

In scope:
- Extended `ProviderContext` schema with document awareness fields (`activeDocumentPath`)
- `ChatFileCreatedMessage` schema (`chat:file-created`)
- `ChatConversationLoadMessage` schema (`chat:conversation-load`)
- `ChatContextMessage` schema (`chat:context`)
- `PersistedConversation` and `PersistedMessage` schemas and types
- Extended `ChatServerMessage` discriminated union with three new message types
- New error codes: `CONTEXT_READ_FAILED`, `EDIT_FAILED`
- Conversation filename hash utility (SHA-256 prefix)
- Test fixtures: sample conversations, document content, workspace identities

Out of scope:
- Service implementations (Stories 1–4)
- Route modifications (Stories 1–4)
- Client-side changes (Stories 1–4)

**Dependencies:**
- Epics 10 and 11 complete (existing `ChatServerMessageSchema`, `ChatSendMessageSchema`, `ChatErrorCodeSchema`)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

Story 0 does not own ACs directly — it establishes infrastructure supporting all 18 ACs. The deliverables are validated through schema compilation, type checking, and fixture sanity tests.

**Deliverables:**

1. Extended `ChatSendMessageSchema` context field with `activeDocumentPath: z.string().nullable().default(null)`
2. `ChatFileCreatedMessageSchema` with `type: 'chat:file-created'`, `path`, `messageId`
3. `ChatConversationLoadMessageSchema` with `type: 'chat:conversation-load'`, `workspaceIdentity`, `messages[]`, `cliSessionId`
4. `ChatContextMessageSchema` with `type: 'chat:context'`, `messageId`, `activeDocument` (nullable object with `relativePath`, `truncated`, `totalLines?`)
5. `PersistedConversationSchema` with `version: 1`, `workspaceIdentity`, `cliSessionId`, `messages[]`, `updatedAt`
6. `PersistedMessageSchema` with `id`, `role`, `text`, `timestamp`, `activeDocumentPath?`
7. Extended `ChatServerMessageSchema` discriminated union including `ChatFileCreatedMessage`, `ChatConversationLoadMessage`, `ChatContextMessage`
8. Extended `ChatErrorCodeSchema` with `CONTEXT_READ_FAILED` and `EDIT_FAILED`
9. Conversation filename hash utility: `conversationFilename(workspaceIdentity: string): string` — SHA-256 prefix (16 hex chars)
10. Test fixture file with `createPersistedConversation()`, `createUserMessage()`, `createAgentMessage()`, `createErrorMessage()`, document content samples (`SMALL_DOCUMENT`, `LARGE_DOCUMENT`), workspace identity samples

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### Extended ChatSendMessage Context

```typescript
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

#### New Server → Client Messages

```typescript
export const ChatFileCreatedMessageSchema = z.object({
  type: z.literal('chat:file-created'),
  path: z.string(),
  messageId: z.string().uuid(),
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
```

#### Persisted Conversation Schema

```typescript
export const PersistedMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent', 'error']),
  text: z.string(),
  timestamp: z.string(),
  activeDocumentPath: z.string().optional(),
});

export const PersistedConversationSchema = z.object({
  version: z.literal(1),
  workspaceIdentity: z.string(),
  cliSessionId: z.string().nullable(),
  messages: z.array(PersistedMessageSchema),
  updatedAt: z.string(),
});
```

#### Extended Error Codes

```typescript
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

#### Conversation Filename Hash

```typescript
import { createHash } from 'node:crypto';

function conversationFilename(workspaceIdentity: string): string {
  const hash = createHash('sha256')
    .update(workspaceIdentity)
    .digest('hex')
    .slice(0, 16);
  return `${hash}.json`;
}
```

*See the tech design document for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All new schemas added to `app/src/server/schemas/index.ts`
- [ ] `ChatServerMessageSchema` discriminated union extended with three new types
- [ ] Inferred TypeScript types exported for all new schemas
- [ ] Conversation filename hash utility implemented and tested
- [ ] Test fixtures created at `app/tests/fixtures/conversation.ts`
- [ ] `npm run build && npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] 8 tests pass (schema validation, hash determinism, fixture sanity)
