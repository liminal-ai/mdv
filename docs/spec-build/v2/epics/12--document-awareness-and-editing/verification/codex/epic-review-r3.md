# Epic 12 Review R3

The R2 fixes landed cleanly in almost every area. I did not find regressions in the package-identity work, persistence timing is now internally consistent, the undefined `DocumentEdit` type is gone, the `Save Copy` branch is now covered, and the story text is aligned with the session-continuity framing.

One substantive issue remains, so this is not yet approved for tech design.

## Major

### [M] The deterministic rewrite of `TC-2.4a` no longer tests the behavior promised by Flow 2 / AC-2.4

- **Reference:** Flow 2 step 9, AC-2.4, TC-2.4a, Story 2 `Delivers`
- **Issue:** The epic still says "Chat shows confirmation that the edit was applied," AC-2.4 is still titled "An edit confirmation appears in the chat conversation," and Story 2 still says it delivers "Edit confirmation and error reporting in chat." But `TC-2.4a` now verifies only that a `chat:file-created` transport message is emitted. That is a useful deterministic check, but it is not the same behavior as a confirmation appearing in the chat conversation.
- **Why it matters:** This fix over-corrects the R2 finding. A design could now satisfy the TC by emitting `chat:file-created` with no user-visible chat confirmation at all, which would violate the flow and AC as written.
- **Suggested fix:** Choose one behavior and align all references to it. Either:
  1. Keep the "confirmation in chat" requirement, and rewrite `TC-2.4a` as a deterministic chat-state check (for example, a completed agent message exists in the conversation for the edit request), while leaving `chat:file-created` under a separate AC/TC; or
  2. Change Flow 2 step 9, AC-2.4, and Story 2 so they describe a file-change notification contract rather than a chat confirmation.

## Verdict

Not yet approved for tech design. Everything from R2 appears resolved except the AC-2.4 / TC-2.4a mismatch above.
