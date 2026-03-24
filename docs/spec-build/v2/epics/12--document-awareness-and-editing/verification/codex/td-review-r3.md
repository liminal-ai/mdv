# Technical Design Review — Epic 12 (Round 3)

## Verdict

Not yet approved for story publishing.

## Verification Summary

I re-read all four updated Epic 12 design documents and re-checked the Round 2 focus areas.

What is now clean:

- The client-store corrections are materially applied in the detailed client design: `changed.includes(...)` is used instead of `changed.has(...)`, and the root lookups now reference `state.session.lastRoot` / `store.get().session.lastRoot` (`docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-client.md:151`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-client.md:154`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-client.md:503`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-client.md:766`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-client.md:801`).
- `chat:conversation-load` empty-array semantics remain consistent across the design set (`docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design.md:348`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-server.md:805-827`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/test-plan.md:247-253`).
- `chat:context` is now present in the top-level contracts, server schema, client listener path, module responsibility matrix, and ws-chat test plan (`docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design.md:350`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design.md:434`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design.md:438`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-server.md:734-753`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-client.md:142-173`, `docs/spec-build/v2/epics/12--document-awareness-and-editing/test-plan.md:253`).
- TC-4.2b is now moved to the server/ws-chat test area, which is the correct boundary for the “no conversation files created when disabled” guarantee (`docs/spec-build/v2/epics/12--document-awareness-and-editing/test-plan.md:294-299`).
- The 81-test / 51-TC bookkeeping now reconciles numerically. The chunk totals sum to 81, and all 51 epic TC IDs appear in the test plan. The repeated TC rows are acceptable because a few TCs are intentionally split across service and integration coverage.
- The top-level Q8 explanation is now aligned: `<50ms` init work is separated from the later 200-500ms rendering pass after the panel is interactive (`docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design.md:244-249`; client detail at `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-client.md:272-287`).

## Remaining Finding

### Major

- The provider-manager/session-ID contract still has one unresolved cross-document drift, and it affects both the design narrative and the test plan. The detailed server design now explicitly says Epic 12 does **not** use new `onSessionId` callbacks; instead, `ProviderManager` captures `parsed.sessionId` internally in the existing Epic 10 `case 'result'` path, exposes `getSessionId()`, and the route persists that value from the `onDone` handler (`docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-server.md:1060-1113`). The client-side sequence diagram was partly updated to show `setSessionId()` then `send()` (`docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-client.md:889-894`), but it still reintroduces the removed callback pattern with `PM-->>Route: onSessionId("sess-new")` (`docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-client.md:903-906`). The test plan repeats the same stale contract: TC-3.6c still says the provider-manager test should assert an `onSessionId` callback firing with the new ID (`docs/spec-build/v2/epics/12--document-awareness-and-editing/test-plan.md:276-280`). There is also one leftover top-level matrix drift: the `provider-manager.ts` row still says “Accept `ProviderContext` in `send()`” (`docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design.md:431`), while the detailed server design says `send()` only takes `messageId`, `text`, and optional `systemPrompt`, with session injection handled by `setSessionId()` (`docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design-server.md:921-975`). The actual implementation shape is now mostly clear in the server companion, but the other documents have not fully converged on it yet.

## Final Assessment

This is very close. I do not see new structural problems beyond the remaining provider-manager/session-ID drift above, and the previous higher-severity issues are materially fixed. Once the stale `onSessionId` references and the top-level `provider-manager.ts` responsibility row are aligned to the detailed server contract, I would expect this to be ready to approve.
