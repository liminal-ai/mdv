# Story 0: Foundation (Infrastructure)

---

### Summary
<!-- Jira: Summary field -->

Establish shared types, schemas, error codes, phase detector, and test fixtures for Epic 13's package and spec awareness capabilities.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working within spec packages containing PRDs, epics, tech designs, and stories. The Steward already knows what document is open (Epic 12) but cannot see the broader package structure, read other files, create new files, or understand where the user is in the spec lifecycle.

**Objective:** Define the type-level contracts, phase detection logic, and test infrastructure that all subsequent stories build on. After this story, the extended schemas compile, new message types validate, the phase detector returns correct artifact detections, and test fixtures are available for all downstream stories.

**Scope:**

In scope:
- Extended `ProviderContext` types: `WorkspaceContext`, `PackageContext`, `SpecContext`, `FullProviderContext`
- `ChatPackageChangedMessageSchema` (Zod) with `change: 'created' | 'exported' | 'manifest-updated'`
- `ChatOpenDocumentMessageSchema` (Zod) with `path`, `messageId`
- Extended `ChatContextMessageSchema` with `workspace` field (`type`, `rootPath`, `packageTitle?`, `warning?`)
- Extended `ChatServerMessageSchema` discriminated union with two new message types
- New error codes: `FILE_NOT_FOUND`, `FILE_ALREADY_EXISTS`, `PATH_TRAVERSAL`, `MANIFEST_NOT_FOUND`, `MANIFEST_PARSE_ERROR`, `PERMISSION_DENIED`, `NOT_TEXT_FILE`, `READ_BUDGET_EXCEEDED`, `PACKAGE_EXPORT_FAILED`, `PACKAGE_CREATE_FAILED`
- `PackageManifestInfo`, `CreatePackageOptions`, `ExportPackageOptions`, `FileReadResult` types
- `SpecMetadata` type definitions
- `PhaseDetector` pure functions: `detectArtifacts(navigation)` and `inferPhase(artifacts)`
- Artifact pattern definitions: `prd`, `epic`, `tech-design`, `stories`
- Test fixtures: sample packages with known manifests and spec metadata, packages with various artifact combinations for phase detection, session mocks for folder/package/directory-mode states

Out of scope:
- Service implementations (Stories 1–6)
- Route modifications (Stories 1–6)
- Client-side changes (Stories 1–6)

**Dependencies:**
- Epics 9, 10, 11, and 12 complete (existing `ChatServerMessageSchema`, `ChatSendMessageSchema`, `ChatErrorCodeSchema`, `PackageService`, `SessionService`)
- Epic 8 types (`ManifestMetadata`, `NavigationNode`, `ParsedManifest`)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

Story 0 does not own ACs directly — it establishes infrastructure supporting all 28 ACs. The deliverables are validated through schema compilation, type checking, phase detector unit tests, and fixture sanity tests.

**Deliverables:**

1. `ChatPackageChangedMessageSchema` with `type: 'chat:package-changed'`, `messageId` (UUID), `change` enum (`created`, `exported`, `manifest-updated`), optional `details` object with `manifestPath?` and `exportPath?`
2. `ChatOpenDocumentMessageSchema` with `type: 'chat:open-document'`, `path` (string), `messageId` (UUID)
3. Extended `ChatContextMessageSchema` with optional `workspace` field containing `type: 'folder' | 'package'`, `rootPath` (string), optional `packageTitle`, optional `warning`
4. Extended `ChatServerMessageSchema` discriminated union including `ChatPackageChangedMessage` and `ChatOpenDocumentMessage`
5. Extended `ChatErrorCodeSchema` with 10 new error codes
6. `WorkspaceContext`, `PackageContext`, `SpecContext`, `FullProviderContext` TypeScript interfaces
7. `PackageManifestInfo`, `CreatePackageOptions`, `ExportPackageOptions`, `FileReadResult` TypeScript interfaces
8. `PhaseDetector` module: `detectArtifacts(navigation: NavigationNode[]): string[]` — scans `filePath` of every `NavigationNode` against artifact patterns, returns deduplicated list of detected types. `inferPhase(artifacts: string[]): string | null` — returns highest artifact type in pipeline order (`prd` → `epic` → `tech-design` → `stories`), or `null` if empty.
9. Artifact pattern constants: `prd` (`/prd\.md$/i`, `/product.?requirements/i`), `epic` (`/epic\.md$/i`, `/epic[-_]/i`, `/feature.?spec/i`), `tech-design` (`/tech.?design/i`, `/technical.?(design|architecture)/i`), `stories` (`/stories?\//i`, `/story[-_]/i`)
10. Test fixtures: `SPEC_PACKAGE_MANIFEST`, `GENERAL_PACKAGE_MANIFEST`, `MALFORMED_MANIFEST`, `mockSessionWithPackage()`, `mockSessionFolder()`, `mockSessionDirectoryPackage()`, `mockNavigationTree()`

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### New Schemas

```typescript
export const ChatPackageChangedMessageSchema = z.object({
  type: z.literal('chat:package-changed'),
  messageId: z.string().uuid(),
  change: z.enum(['created', 'exported', 'manifest-updated']),
  details: z.object({
    manifestPath: z.string().optional(),
    exportPath: z.string().optional(),
  }).optional(),
});

export const ChatOpenDocumentMessageSchema = z.object({
  type: z.literal('chat:open-document'),
  path: z.string(),
  messageId: z.string().uuid(),
});
```

#### Extended ChatContextMessage

```typescript
export const ChatContextMessageSchema = z.object({
  type: z.literal('chat:context'),
  messageId: z.string().uuid(),
  activeDocument: z.object({
    relativePath: z.string(),
    truncated: z.boolean(),
    totalLines: z.number().optional(),
  }).nullable(),
  workspace: z.object({
    type: z.enum(['folder', 'package']),
    rootPath: z.string(),
    packageTitle: z.string().optional(),
    warning: z.string().optional(),
  }).optional(),
});
```

#### New Error Codes

```typescript
export const ChatErrorCodeSchema = z.enum([
  // Existing (Epics 10, 12):
  'INVALID_MESSAGE', 'PROVIDER_NOT_FOUND', 'PROVIDER_CRASHED',
  'PROVIDER_TIMEOUT', 'PROVIDER_BUSY', 'PROVIDER_AUTH_FAILED',
  'SCRIPT_ERROR', 'SCRIPT_TIMEOUT', 'CANCELLED',
  'CONTEXT_READ_FAILED', 'EDIT_FAILED',
  // Epic 13 (NEW):
  'FILE_NOT_FOUND', 'FILE_ALREADY_EXISTS', 'PATH_TRAVERSAL',
  'MANIFEST_NOT_FOUND', 'MANIFEST_PARSE_ERROR', 'PERMISSION_DENIED',
  'NOT_TEXT_FILE', 'READ_BUDGET_EXCEEDED', 'PACKAGE_EXPORT_FAILED',
  'PACKAGE_CREATE_FAILED',
]);
```

#### ProviderContext Types

```typescript
interface WorkspaceContext {
  type: 'folder' | 'package';
  rootPath: string;
  canonicalIdentity: string;
}

interface PackageContext {
  mode: 'directory' | 'extracted';
  sourcePath?: string;
  format?: 'mpk' | 'mpkz';
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  manifestStatus: 'present' | 'missing' | 'unreadable';
  fileCount: number;
}

interface SpecContext {
  declaredPhase?: string;
  declaredStatus?: string;
  detectedPhase?: string;
  detectedArtifacts: string[];
}

interface FullProviderContext {
  workspace: WorkspaceContext;
  package?: PackageContext;
  spec?: SpecContext;
}
```

#### Script Method Types

```typescript
interface PackageManifestInfo {
  content: string;
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
}

interface CreatePackageOptions {
  overwrite?: boolean;
}

interface ExportPackageOptions {
  outputPath: string;
  compress?: boolean;
}

interface FileReadResult {
  content: string;
  truncated: boolean;
  totalLines?: number;
}
```

#### Phase Detector

```typescript
const ARTIFACT_PATTERNS: Record<string, RegExp[]> = {
  prd: [/prd\.md$/i, /product.?requirements/i],
  epic: [/epic\.md$/i, /epic[-_]/i, /feature.?spec/i],
  'tech-design': [/tech.?design/i, /technical.?(design|architecture)/i],
  stories: [/stories?\//i, /story[-_]/i],
};

const PHASE_ORDER = ['prd', 'epic', 'tech-design', 'stories'];

function detectArtifacts(navigation: NavigationNode[]): string[];
function inferPhase(artifacts: string[]): string | null;
```

See the tech design documents for full architecture, implementation targets, and test mapping.

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All new Zod schemas compile and validate correct messages
- [ ] All new TypeScript interfaces/types compile
- [ ] `PhaseDetector` passes all 6 unit tests (one per artifact type + inferPhase + empty navigation)
- [ ] Extended `ChatServerMessageSchema` discriminated union includes both new message types
- [ ] Extended `ChatErrorCodeSchema` includes all 10 new error codes
- [ ] Test fixtures provide mock sessions for folder, extracted package, and directory-mode package states
- [ ] Test fixtures provide sample manifest content (spec, general, malformed)
- [ ] `npm run red-verify` passes (format, lint, typecheck)
- [ ] `npm run verify` passes (all tests)
