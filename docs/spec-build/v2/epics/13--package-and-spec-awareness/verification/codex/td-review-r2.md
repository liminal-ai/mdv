# Technical Design Re-Review R2

I re-read the updated Epic 13 design set:

- `docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md`
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md`
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md`
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md`

The R1 fixes landed materially: the package-service contract is mostly corrected in the implementation sections, `provider-manager.ts` is now marked modified in the index, `chat:open-document` exists as a distinct message type, and the 128-test chunk math now reconciles correctly. I do **not** see the original R1 criticals still standing in their original form.

I do still see a few blocking inconsistencies introduced or left behind during the fix pass, so I would **not approve for story publishing yet**.

## Major

1. **The `chat:context` fix for `rootPath`/`warning` is only partial, and the route example now contradicts its own schema.**
   - The index says `chat:context` now carries `workspace.rootPath` and optional `workspace.warning` in [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L364) through [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L377).
   - The server schema agrees: `ChatContextMessageSchema.workspace.rootPath` is required and `warning` is optional in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1252) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1265).
   - But `InjectedContext` still exposes only `workspaceType` and `packageTitle` in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L387) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L395), and `buildInjectedContext()` still only returns those two fields in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L457) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L465).
   - The `ws-chat.ts` example then sends a `chat:context` payload without `rootPath` or `warning` in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1173) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1183), even though the schema now requires `rootPath`.
   - The client-side `chat-ws-client.ts` example has the same drift: its `chat:context` case still types `workspace` as `{ type, packageTitle }` only in [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L230) through [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L239), while the later handler expects `rootPath` and `warning` in [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L392) through [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L409).
   - This is a real regression from the fix set, not just wording: as written, the example route would fail its own schema boundary, and AC-8.2’s warning path is still not fully wired.

2. **The old PackageService contract still survives in the test plan and server flow docs, so the fix is not propagated consistently enough for downstream story work.**
   - The spec-validation table correctly says the design was updated away from `reloadManifest()`, `activateDirectoryPackage()`, and `getManifestFilename()` in [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L38).
   - The implementation sections mostly reflect that correction: `MANIFEST_FILENAME` is imported directly in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L925) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L986).
   - But the test-plan mock contract still tells implementers to mock `reloadManifest()`, `activateDirectoryPackage()`, and `getManifestFilename()` on `PackageService` in [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L13) through [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L16).
   - The server flow diagrams also still show the removed methods in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1381) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1387) and [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1410) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1417).
   - Since this design is intended to drive story writing and test scaffolding, leaving the old contract in the mock strategy and flow sequences is still a publishing blocker.

## Minor

1. **`chat:open-document` is mostly wired, but it is not carried through all traceability surfaces yet.**
   - The new message type exists in the index external contracts in [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L310) through [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L315), in the server schema/union in [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1231) through [tech-design-server.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-server.md#L1282), and in the client dispatch/handler in [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L219) through [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L227) and [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L364) through [tech-design-client.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design-client.md#L379).
   - But the client module overview/responsibility matrix still only mentions `chat:package-changed` and extended `chat:context` for `chat-ws-client.ts` / `chat-panel.ts` in [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L428) through [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md#L457).
   - The test plan also has no schema-level or message-level test entry for `ChatOpenDocumentMessageSchema`; TC-3.3 is still described as "reuses Epic 12 behavior" in [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L240) through [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/13--package-and-spec-awareness/test-plan.md#L241), which is no longer quite true after the new message was introduced.

## Verdict

Not approved for story publishing yet.

The good news is that the original R1 blockers are substantially fixed. The remaining problems are fix-propagation issues, not a broken overall architecture:

- finish wiring `rootPath` and `warning` all the way through `InjectedContext`, the `chat:context` emission example, and the client-side parse example
- purge the removed PackageService methods from the test-plan mock boundary and the server flow sequences
- optionally tighten the `chat:open-document` traceability surfaces while you are there

After those are reconciled, I would expect this to be publishable.

## Not Reported

- The 128-test total now reconciles cleanly against the chunk breakdown and the 90 unique TCs.
- The `provider-manager.ts` modification is now clearly reflected in the index/spec-validation material, which resolves the main R1 ownership gap.
- I did not reopen the earlier architectural objections around `openDocument`, PackageService signatures, or extracted fallback repair because the implementation sections now address those at the primary-contract level; the remaining problems are consistency drifts around the updated fixes.
