# Epic 12 Review R2

The R1 fixes materially improved the draft. The major boundary and coherence problems from R1 are mostly resolved: package identity is now in scope, file-creation drift is removed, dirty-tab safety is introduced, the upstream `chat:file-created` contract is restored, and workspace/session swap behavior is now explicitly addressed.

The epic is not yet approved for tech design. A small number of meaningful gaps remain.

## Major

### [M] The new dirty-tab flow still omits the `Save Copy` path, so the Epic 5 integration is only partially specified

- **Reference:** AC-2.3, TC-2.3a, TC-2.3b, TC-2.3c; cross-check with Epic 5 Story 5 AC-6.1
- **Issue:** The revised epic correctly says Steward edits should use the existing external-change conflict modal, and TC-2.3a explicitly lists all three options: `Keep My Changes`, `Reload from Disk`, and `Save Copy`. But Epic 12 only adds TCs for `Keep My Changes` and `Reload from Disk`. The `Save Copy` branch is not covered at all for the Steward-edit trigger path.
- **Why it matters:** This is an integration spec, not a greenfield modal. The missing branch is exactly where trigger-specific regressions can hide: after a Steward edit, `Save Copy` still needs to preserve the user's unsaved buffer, keep the Steward version on the original file, and leave the app in a coherent state.
- **Suggested fix:** Add a TC for the `Save Copy` path under AC-2.3, explicitly covering the expected outcome when the conflict was triggered by a Steward edit rather than a generic external modification.

### [M] The persistence timing contract is internally inconsistent

- **Reference:** Flow 3 prose ("every message send and receive writes to disk"), `Persistence timing` in Data Contracts ("written on every message send and message complete")
- **Issue:** The flow prose says persistence happens on every send and every receive, which reads like per-response-chunk or per-received-message persistence. The data-contract section later narrows that to send plus `chat:done` only. Those are materially different behaviors.
- **Why it matters:** This affects crash-recovery semantics, write frequency, and how to interpret AC-3.4. A tech design built around token-level persistence looks very different from one built around finalized-message persistence.
- **Suggested fix:** Pick one timing model and state it consistently in both places. If the intent is send + completed agent message only, update the flow prose accordingly and make AC-3.4 language match that model.

### [M] `DocumentEdit` is still an exposed contract with no defined shape

- **Reference:** `Extended Script Execution Context`, Tech Design Question 9, Validation Checklist ("Data contracts are fully typed")
- **Issue:** The revised draft improves the method name to `applyEditToActiveDocument(edit: DocumentEdit)`, but `DocumentEdit` itself is left undefined. Because this is presented as a typed contract in the epic, it is now a visible contract gap rather than just an implementation detail.
- **Why it matters:** Downstream consumers still do not know what the script lane is allowed to send or what the server is required to accept. That makes the interface non-traceable and weakens Story 0's "types and schemas" deliverable.
- **Suggested fix:** Either define a minimal required `DocumentEdit` shape in the epic, or avoid naming an unresolved type in the contract and instead specify the observable contract in prose. A small, minimal shape is enough if richer edit forms are meant to stay a tech design choice.

### [M] The model-dependence cleanup is incomplete; two TCs still hinge on Steward wording rather than deterministic system behavior

- **Reference:** TC-2.1b, TC-2.4a
- **Issue:** R1's model-quality problem was fixed in Flow 1 and most of Flow 3, but two Flow 2 TCs still depend on what the Steward "responds" with. `TC-2.1b` requires the Steward to say no document is open, and `TC-2.4a` requires the Steward's response to describe what was changed.
- **Why it matters:** These are weaker acceptance targets than the revised Flow 1 TCs. They can still pass or fail based on prompt/model variance rather than whether the product behavior is correctly implemented.
- **Suggested fix:** Recast these as deterministic checks. For example: no-document edit requests produce a defined app-level error path or blocked edit action; successful edits produce a completed chat message and on-disk modification, without requiring specific descriptive content from the model.

## Minor

### [m] Story 4's description slips back into the old "cross-document reference works" phrasing even though AC-1.3 was correctly rewritten as session continuity

- **Reference:** Story 4 `Delivers`, AC-1.3
- **Issue:** The story description says "Cross-document reference works via `--resume`," while AC-1.3 now more correctly specifies deterministic session continuity behavior.
- **Why it matters:** This is small, but it reintroduces the older model-behavior framing in planning text after the ACs were cleaned up.
- **Suggested fix:** Reword Story 4 to match the revised AC language, for example "CLI session continuity across document switches via `--resume`."

## Verdict

Not yet approved for tech design. The R1 fixes are real, but the remaining contract and coverage gaps above should be closed before handoff.
