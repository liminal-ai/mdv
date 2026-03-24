# Epic 13 Review — Round 2

I re-read the updated draft with the R1 dispositions in mind, focusing on regressions from the fixes, coherence of the partial acceptances, the rejected M8 reasoning, cross-reference consistency, and any new issues introduced by the added material.

## Critical

No new Critical findings. The major structural contradiction around directory-mode packages is materially improved, and I do not re-raise M8 on the current text: with A5 rewritten and the methods explicitly scoped to the workspace root, the rejection is now defensible.

## Major

### 1. The multi-file budget problem is only partially fixed; the draft now defines per-file truncation but still leaves the per-response budget undefined

**Location:** AC-2.2 still allows multiple sequential file reads in one turn ([epic.md:187](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L187)-[epic.md:196](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L196)). The new AC-2.3 only specifies truncation for an individual `getFileContent` call ([epic.md:198](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L198)-[epic.md:211](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L211)). Tech Design Q1 still asks whether the server should enforce a per-response file-read budget at all ([epic.md:922](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L922)-[epic.md:923](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L923)).

**Why it matters:** The original gap is narrower now, but it still exists. A response that reads three individually truncated files can still overflow the effective provider context window, and the spec still leaves the resulting user-visible behavior to tech design. That is a product contract question, not just an implementation detail.

### 2. Package-content parity is still incomplete for the extracted fallback path from Epic 9

**Location:** The narrowed scope now says Epic 13 covers "package-content operations from Epic 9" ([epic.md:43](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L43)). Epic 9 includes creating a manifest while an extracted package is in filesystem fallback mode ([epic.md:539](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/09--package-viewer-integration/epic.md#L539)-[epic.md:548](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/09--package-viewer-integration/epic.md#L548)). In the updated Epic 13, `createPackage()` is specified for folder mode ([epic.md:558](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L558)-[epic.md:571](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L571)) and is listed as legal in `folder, package` modes in the method table ([epic.md:807](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L807)-[epic.md:810](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L810)), but there is still no AC/TC for using it on an extracted package with a missing or unreadable manifest.

**Why it matters:** This is now a remaining coverage hole, not an overclaim. The current draft still does not specify the chat equivalent of Epic 9's extracted-package fallback-repair path, even though that is a package-content operation inside the currently open workspace.

### 3. The stale-state fix is incomplete: manifest edits and chat export still do not carry Epic 9's stale lifecycle

**Location:** The new AC-3.6 covers stale indicator appearance after `addFile` and `editFile` in extracted packages ([epic.md:320](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L320)-[epic.md:333](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L333)). But Epic 9 defines stale as applying when extracted content has been modified generally, and it explicitly specifies clear/remain behavior on re-export to the original path vs a different path ([epic.md:369](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/09--package-viewer-integration/epic.md#L369)-[epic.md:382](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/09--package-viewer-integration/epic.md#L382), [epic.md:452](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/09--package-viewer-integration/epic.md#L452)-[epic.md:492](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/09--package-viewer-integration/epic.md#L452)). Epic 13 still has no stale TC for `updateManifest()` in extracted packages ([epic.md:245](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L245)-[epic.md:262](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L262)) and no chat-export stale clear/remain contract in AC-3.2 ([epic.md:264](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L264)-[epic.md:277](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L277)).

**Why it matters:** `updateManifest()` is a file modification to extracted package contents, so it should participate in stale semantics. Likewise, export-through-chat is supposed to be the chat equivalent of Epic 9 export, which includes stale clear/remain behavior. The current fix only covers half of that lifecycle.

## Minor

### 4. AC/TC cross-references regressed in the new AC-2.4 block

**Location:** AC-2.4 is introduced at [epic.md:213](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L213), but its test conditions are still labeled `TC-2.3a` and `TC-2.3b` ([epic.md:215](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L215)-[epic.md:220](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L220)).

**Why it matters:** This is exactly the kind of numbering drift that makes validation and traceability harder. It also undercuts the claim in the validation checklist that AC/TC mapping is complete and consistent.

### 5. The partial C1 fix was not propagated cleanly through the rest of the artifact

**Location:** Out of Scope now correctly defers workspace switching through chat ([epic.md:61](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L61)-[epic.md:62](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L62)), but Assumption A2 still says Epic 13 makes Epic 9 "mode switching" chat-accessible ([epic.md:70](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L70)).

**Why it matters:** The top-level scope fix is directionally right, but this leftover assumption reintroduces the old claim in a quieter form. That should be cleaned up so the artifact states one consistent boundary.

### 6. Story/amendment/checklist references were not fully updated after the AC-5.3 rewrite and AC-count fix

**Location:** Story 5 still maps AC-5.3 as "spec-awareness instructions" ([epic.md:1024](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L1024)-[epic.md:1028](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L1024)), even though AC-5.3 now concerns the `spec` field in `ProviderContext` ([epic.md:457](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L457)-[epic.md:466](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L457)). The amendment section says the AC count was fixed from 27 to 29 ([epic.md:1072](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L1072)), while the body and checklist correctly reflect 28 ACs ([epic.md:1086](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L1086)).

**Why it matters:** These are bookkeeping issues, but they are still regressions introduced by the fixes. They make the amendment log and story traceability less trustworthy than the body of the spec.

## What I Checked But Did Not Re-Raise

- I do not re-raise M8. The current draft now explicitly makes the curated script methods the sole access mechanism ([epic.md:73](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L73), [epic.md:931](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L931)), and the method table scopes file operations to the workspace root with traversal protection ([epic.md:802](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L802)-[epic.md:810](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md#L810)). That does not fully match the architecture's idealized capability facade, but it is now coherent enough that I would not treat it as a remaining review finding.
