# Technical Design Re-Review R3

I re-read the updated Epic 13 design set:

- `docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md`
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md`
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md`
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md`

I also re-checked the fix areas from R2:

- `chat:context` propagation for `rootPath` and `warning`
- PackageService/Epic 8 contract references in the test plan and flow docs
- `chat:open-document` wiring and traceability
- provider-manager modification references
- 129-test reconciliation

## Findings

No blocking issues found.

The previously-open R2 issues are resolved:

1. `chat:context` propagation is now aligned across index, server schema, route emission, client parse example, and client handler.
   - The index contract requires `workspace.rootPath` and optional `warning` in [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L364) through [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L377).
   - `InjectedContext` now carries `workspaceRootPath` and `warning` in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L387) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L396), and `buildInjectedContext()` returns them in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L459) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L476).
   - The route example now sends `rootPath` and conditional `warning` in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1188) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1197).
   - The client parse and handler examples now account for those fields in [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L230) through [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L239) and [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L392) through [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L409).

2. The PackageService/Epic 8 contract cleanup is now propagated where it matters.
   - The test-plan mock boundary now matches the corrected split: Epic 9 `PackageService` plus direct Epic 8 library mocks in [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L13) through [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L18).
   - The implementation sections use `MANIFEST_FILENAME`, `parseManifest()`, and `scaffoldManifest()` directly in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L937) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L998).
   - The flow diagrams were updated away from the removed methods in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1397) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1401) and [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1424) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1430).

3. `chat:open-document` is now consistently represented across the core design surfaces.
   - It appears in the index external contracts in [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L310) through [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L315).
   - It exists in the server schema/union in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1248) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1295).
   - The route emits it in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1152) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1160).
   - The client dispatches and handles it in [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L219) through [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L227) and [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L364) through [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L379).
   - It is now reflected in the client module responsibility matrix in [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L454) through [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L456), and the test plan now includes the schema and AC-3.3 wording update in [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L150) through [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L156) and [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L242) through [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L243).

4. The revised test math is consistent.
   - The test plan now lists 90 mapped TCs and 39 non-TC tests for a total of 129 in [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L342) through [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L350).
   - The per-chunk total is 129 in [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L329).
   - The index work breakdown matches that 129 total in [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L548) through [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L549).
   - I also checked the epic/test-plan IDs directly: 28 unique ACs, 90 unique TCs, and 90 mapped TCs with no missing or extra IDs.

## Verdict

Approved for story publishing.

The remaining issues I noticed are minor documentation nits, not blockers:

- the client module tree comment block in the index still mentions `chat:package-changed` / extended `chat:context` but not `chat:open-document`, even though the responsibility matrix does
- the message-sequencing sketch in the index still only lists `chat:file-created` and `chat:package-changed` as the script-time side-channel messages; `chat:open-document` could be added there for completeness

Neither affects implementability or AC/TC/test traceability at this point.

## Not Reported

- I did not re-open the earlier R1/R2 architecture objections because the corrected implementation sections now address them sufficiently.
- I noticed a few small presentational inconsistencies in prose/examples, but they are below the threshold for holding story publishing.
