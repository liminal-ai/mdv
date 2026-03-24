# Story 5: Spec Awareness and Phase Detection

---

### Summary
<!-- Jira: Summary field -->

The Steward recognizes spec packages, detects the current pipeline phase from package artifacts, and includes spec metadata and phase information in the provider context for conversational guidance.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working within spec packages containing PRDs, epics, tech designs, and stories. The Steward already knows what document is open (Epic 12) but cannot see the broader package structure, read other files, create new files, or understand where the user is in the spec lifecycle.

**Objective:** The manifest frontmatter supports optional metadata fields (`type: spec`, `specPhase`, `specStatus`) that identify spec packages and their pipeline state. The server detects the current pipeline phase from package artifacts (filename patterns in navigation entries) and includes the detected phase, artifact list, and declared metadata in the provider context's `spec` field. The Steward can offer conversational guidance about what to do next based on this data. Phase guidance is informational — it does not gate any operations. After this story, asking "what should I do next?" in a spec package gets a pipeline-aware suggestion.

**Scope:**

In scope:
- Spec metadata recognition: `type: spec`, `specPhase`, `specStatus` fields in manifest frontmatter
- Integration of `extractSpecMetadata()` (from Story 1's `PackageContextService`) with phase detection
- Integration of `PhaseDetector` (from Story 0) into context injection pipeline
- `spec` field in `FullProviderContext`: `declaredPhase?`, `declaredStatus?`, `detectedPhase?`, `detectedArtifacts[]`
- Declared metadata takes precedence over detected phase when present
- Spec-aware system prompt section with phase guidance conventions
- Setting spec metadata through `updateManifest` (the method is from Story 3; this story covers the spec metadata semantics)

Out of scope:
- Phase enforcement — phase detection is informational, not prescriptive
- Pipeline state persistence beyond manifest metadata
- Content-based artifact detection (filename patterns only)
- Autonomous pipeline execution (Epic 14)

**Dependencies:**
- Story 0 complete (PhaseDetector pure functions, SpecContext types)
- Story 1 complete (PackageContextService, spec metadata extraction, context injection)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-5.1:** The Steward receives spec metadata from the manifest frontmatter as part of the provider context

- **TC-5.1a: Spec metadata present**
  - Given: A package manifest has frontmatter with `type: spec`, `specPhase: epic`, `specStatus: draft`
  - When: The developer sends a message
  - Then: The provider context includes the spec metadata fields

- **TC-5.1b: No spec metadata**
  - Given: A package manifest has no spec-specific metadata fields
  - When: The developer sends a message
  - Then: The provider context omits spec-specific fields; the Steward treats it as a general package

- **TC-5.1c: Partial spec metadata**
  - Given: A manifest has `type: spec` but no `specPhase` or `specStatus`
  - When: The developer sends a message
  - Then: The context includes `type: spec`; the Steward can still use artifact detection for phase (Flow 6)

**AC-5.2:** The Steward can set spec metadata through manifest updates

- **TC-5.2a: Set spec phase**
  - Given: A spec package is open with `specPhase: prd`
  - When: The developer says "update the phase to epic" and the Steward calls `updateManifest` with updated frontmatter
  - Then: The manifest frontmatter now contains `specPhase: epic`; the context on the next message reflects the update

- **TC-5.2b: Initialize spec metadata on a general package**
  - Given: A package is open with no spec metadata
  - When: The developer says "this is a spec package" and the Steward adds `type: spec` via `updateManifest`
  - Then: The manifest frontmatter now contains `type: spec`

**AC-5.3:** The `spec` field in the provider context is populated when a spec package is detected, providing the data needed for spec-aware behavior

- **TC-5.3a: Spec package populates spec context**
  - Given: A package manifest has `type: spec`
  - When: The server constructs the provider context
  - Then: The `spec` field is present with `detectedArtifacts` and (if applicable) `declaredPhase`, `declaredStatus`, and `detectedPhase` — all the data the Steward needs for spec-aware behavior

- **TC-5.3b: Non-spec package has no spec context**
  - Given: A package manifest does not have `type: spec`
  - When: The server constructs the provider context
  - Then: The `spec` field is absent; the Steward has no spec-specific data

**AC-6.1:** The server detects the current pipeline phase from package artifacts and includes it in the provider context

- **TC-6.1a: PRD only — PRD phase detected**
  - Given: A spec package contains a file matching PRD patterns (e.g., `prd.md`) but no epic, tech design, or story files
  - When: The developer sends a message
  - Then: The provider context includes a detected phase of `prd` and an artifact list containing `prd`

- **TC-6.1b: PRD + epic — epic phase detected**
  - Given: A spec package contains files matching PRD and epic patterns
  - When: The developer sends a message
  - Then: The detected phase is `epic`; the artifact list contains `prd` and `epic`

- **TC-6.1c: Full artifact set — stories phase detected**
  - Given: A spec package contains PRD, epic, tech design, and story files
  - When: The developer sends a message
  - Then: The detected phase is `stories` (the highest artifact-detectable phase); the artifact list contains all four types. The `implementation` phase is not artifact-detectable — it requires the declared `specPhase: implementation` metadata.

- **TC-6.1d: No recognizable artifacts**
  - Given: A spec package contains files that don't match any known artifact patterns
  - When: The developer sends a message
  - Then: No phase is detected; the artifact list is empty; the Steward has no phase-specific guidance

- **TC-6.1e: Declared metadata overrides detection**
  - Given: A manifest has `specPhase: tech-design` but only contains a PRD file
  - When: The developer sends a message
  - Then: The context uses the declared phase (`tech-design`), not the detected phase

**AC-6.2:** The Steward can suggest the next pipeline step based on the detected phase

- **TC-6.2a: Context supports next-step suggestion**
  - Given: A spec package is at the `prd` phase (PRD exists, no epic)
  - When: The developer asks "what should I do next?"
  - Then: The provider context includes sufficient phase information for the Steward to suggest drafting the epic (verifiable by confirming phase and artifact data are in the context)

- **TC-6.2b: Context at epic phase**
  - Given: A spec package has PRD and epic artifacts
  - When: The developer asks about next steps
  - Then: The context includes phase `epic` and both artifacts, enabling tech design guidance

- **TC-6.2c: Non-spec package — no phase guidance**
  - Given: A general package (no `type: spec`) is open
  - When: The developer asks "what should I do next?"
  - Then: The provider context contains no spec phase information; the Steward cannot offer pipeline guidance

**AC-6.3:** Phase guidance is conversational — the developer can follow, skip, or work in any order

- **TC-6.3a: Phase information is descriptive, not prescriptive**
  - Given: A spec package is at the `prd` phase
  - When: The developer sends a message about implementation (skipping epic and tech design)
  - Then: The Steward has phase information in context but is not programmatically prevented from discussing implementation — the context informs, it does not constrain

- **TC-6.3b: Phase detection does not block operations**
  - Given: A spec package is at the `prd` phase
  - When: The Steward is asked to create a story file (ahead of the detected phase)
  - Then: The `addFile` method succeeds; phase detection does not gate file operations

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### Phase Detection Integration

Story 0 provides the `PhaseDetector` pure functions. This story integrates them into the context injection pipeline:

In `buildPackageContext()` (from Story 1's `PackageContextService`):

```typescript
// After manifest is parsed and spec metadata extracted:
const specMeta = extractSpecMetadata(manifest.raw);
if (specMeta?.type === 'spec') {
  const artifacts = detectArtifacts(manifest.navigation);
  const detectedPhase = inferPhase(artifacts);

  result.spec = {
    declaredPhase: specMeta.specPhase,
    declaredStatus: specMeta.specStatus,
    detectedPhase: detectedPhase ?? undefined,
    detectedArtifacts: artifacts,
  };
}
```

#### Spec Metadata Convention

Optional YAML frontmatter fields in the manifest:

```yaml
---
title: My Spec Package
version: "1.0"
type: spec
specPhase: epic
specStatus: draft
---
```

| Field | Type | Values | Description |
|---|---|---|---|
| `type` | string | `spec` | Identifies this as a spec package |
| `specPhase` | string | `prd`, `epic`, `tech-design`, `stories`, `implementation`, `complete` | Declared pipeline phase |
| `specStatus` | string | `draft`, `in-review`, `approved` | Status within the current phase |

These fields are optional and not validated by the manifest parser. They pass through as part of the metadata. The Steward reads them from the provider context and can set them via `updateManifest`.

#### Declared vs Detected Phase Precedence

The `<workspace-context>` block includes both declared and detected phase when available. The system prompt instructs the Steward to prefer the declared phase:

```
Declared phase: epic         (from manifest specPhase)
Detected phase: prd          (from artifact patterns)
```

#### Spec-Aware System Prompt Extension

Added to `buildSystemPrompt()` when `ctx.spec` is present:

```typescript
if (ctx?.spec) {
  // Append Spec Awareness section with:
  // - Liminal Spec pipeline phases
  // - Current detected/declared phase
  // - Detected artifacts
  // - Guidance convention: suggest, don't enforce
}
```

#### Phase Order

`prd` → `epic` → `tech-design` → `stories`

`implementation` and `complete` are not artifact-detectable — they require declared `specPhase` metadata.

See the tech design documents for full architecture, implementation targets, and test mapping.

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Spec metadata (`type: spec`, `specPhase`, `specStatus`) extracted from manifest frontmatter and included in provider context
- [ ] `spec` field in `FullProviderContext` populated for spec packages with detected artifacts and phases
- [ ] `spec` field absent for non-spec packages
- [ ] Phase detection uses `PhaseDetector` from Story 0 — scans navigation entries, returns highest phase
- [ ] Declared metadata overrides detected phase in context
- [ ] Spec-aware system prompt section included when spec package detected
- [ ] Phase information is data in context — does not gate any operations
- [ ] `addFile` succeeds regardless of detected phase
- [ ] Setting spec metadata via `updateManifest` reflected in next message's context
- [ ] All 17 TC-mapped tests + 3 non-TC tests pass (20 total)
- [ ] `npm run verify` passes
