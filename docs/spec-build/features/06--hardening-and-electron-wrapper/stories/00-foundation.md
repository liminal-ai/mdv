# Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->

Types, test fixtures, schema migration scaffolding, and Electron project configuration needed by all Epic 6 stories.

### Description
<!-- Jira: Description field -->

**Primary User:** Technical agentic user who has been using MD Viewer daily as a browser-based app.
**Context:** Epic 6 adds performance hardening and an Electron desktop wrapper. This foundation story creates the shared infrastructure all subsequent stories depend on.

**Objective:** Establish type definitions, test fixtures, schema migration, build configuration, and packaging scaffolding so feature stories can begin immediately.

**Scope:**

In scope:
- `PersistedTab` type definition and Zod schema with legacy `string[]` backward compatibility
- `MermaidCacheEntry` type definition (internal)
- `WindowState` type definition (Electron)
- `MenuState` interface for native menu state sync
- Test fixtures: large markdown files (10K lines), large directory trees (1K+ files with symlinks, permissions, deep nesting), Electron mocks, persisted tab samples
- `tsconfig.electron.json` for Electron main process compilation
- `electron-builder.yml` packaging configuration
- `scripts/install-app.sh` install script
- `package.json` scripts: `build:electron`, `test:electron`

Out of scope:
- Any feature implementation (stories 1–7)
- Tests (types and fixtures don't need TDD)

**Dependencies:** Epics 1–5 complete.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

No functional ACs — this is infrastructure. Exit criteria: `npm run typecheck` passes with all new types and configurations in place.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**PersistedTab schema (backward-compatible migration):**

```typescript
const PersistedTabSchema = z.object({
  path: AbsolutePathSchema,
  mode: OpenModeSchema,
  scrollPosition: z.number().nonnegative().optional(),
});

const LegacyOrPersistedTab = z.union([
  AbsolutePathSchema.transform((path) => ({ path, mode: 'render' as const })),
  PersistedTabSchema,
]);

// In SessionStateSchema:
openTabs: z.array(LegacyOrPersistedTab).default([]),
activeTab: AbsolutePathSchema.nullable().default(null),  // unchanged
```

**MenuState interface:**

```typescript
interface MenuState {
  hasDocument: boolean;
  hasDirtyTab: boolean;
  activeTabDirty: boolean;
  activeTheme: string;
  activeMode: 'render' | 'edit';
  defaultMode: 'render' | 'edit';
}
```

**electron-builder.yml** — see tech design UI doc, Packaging and Install section.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All new type definitions compile without errors
- [ ] `npm run typecheck` passes
- [ ] Test fixture files created and importable
- [ ] `tsconfig.electron.json` created
- [ ] `electron-builder.yml` created
- [ ] `scripts/install-app.sh` created
- [ ] `package.json` scripts added: `build:electron`, `test:electron`
- [ ] `npm run build:electron` runs without error (produces `main.js` and `preload.js` stubs)
