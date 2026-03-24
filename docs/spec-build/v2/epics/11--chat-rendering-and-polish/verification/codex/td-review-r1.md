# Technical Design Review — Epic 11

## Sequential Read Reflections

1. `docs/spec-build/v2/prd.md`: This design has to live inside a local-first, no-new-framework product where Spec Steward remains cleanly feature-gated and M3 is explicitly the UX tuning pause point. Epic 11 therefore needs tunable behavior, zero off-flag execution, and a rendering approach that does not create permanent divergence from the rest of the viewer.

2. `docs/spec-build/v2/technical-architecture.md`: The architecture fixes the shape of the solution: client-owned rendering in vanilla JS, throttled full-response re-renders, and Mermaid blocks that stay raw until the fence is complete. Any Epic 11 design that invents a different streaming model or ignores feature isolation is out of bounds.

3. `docs/spec-build/v1/epics/01--app-shell-and-workspace-browsing/tech-design.md`: The foundational pattern is explicit contracts, small named modules, and first-class TC mapping. The design standard here is “resolve ambiguity before implementation,” not “leave it to coding time.”

4. `docs/spec-build/v1/epics/02--document-viewing-and-multi-tab-reading/tech-design.md`: Epic 2 established the canonical markdown pipeline discipline: one renderer, shared configuration, explicit sanitization, and documented deviations when the implementation cannot literally mirror the spec. Epic 11’s client renderer should be judged against that bar.

5. `docs/spec-build/v1/epics/06--hardening-and-electron-wrapper/tech-design.md`: Epic 6 adds two important precedents: performance helpers are deliberate, bounded modules, and Mermaid rendering already has cache/sizing/theme-switch behavior that later work should either reuse or explicitly supersede.

6. `docs/spec-build/v2/epics/10--chat-plumbing/tech-design.md` and `tech-design-client.md`: Epic 11 extends a specific client architecture: dynamic chat mounting, `ChatWsClient`, chat-local state, and a right-side resizer. It is not a greenfield panel.

7. `docs/spec-build/v2/epics/11--chat-rendering-and-polish/epic.md`: The epic is detailed and demanding. The design has to satisfy 27 ACs / 82 TCs, including derived items like feature isolation, cancelled-response final render, shiki cold-start fallback, anchor/mailto behavior, and panel visibility persistence.

8. `ls-tech-design/SKILL.md`: The downstream-consumer bar is clear: answer every tech-design question, keep module ownership explicit, and map every TC to a test in a way that actually proves the TC rather than a weaker proxy.

## Findings

### Critical

No critical findings.

### Major

- Final-render sequencing is internally inconsistent, and the current ordering can invalidate AC-1.4c, AC-1.4d, and AC-1.5. In the main flow, `chat:done` first marks the message complete in state and only then flushes the renderer (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:523-527`). But the same document later defines `completeResponse(messageId, renderedHtml, cancelled?)`, which requires the final rendered HTML before completion is committed (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:544-555`). Those two contracts cannot both be true. This matters because the design also says only the currently streaming message is re-rendered; if `streaming` flips to `false` before the flush, the renderer loses its target for the final pass.

- The “same as server” renderer parity claim is false in two important places. The proposed client `createHighlighter()` omits the server’s language aliases (`js`, `ts`, `py`, `sh`, `yml`) even though the design claims the same language coverage (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:821-842` vs `app/src/server/services/render.service.ts:46-74`). It also captures `originalFence` after the shiki plugin is installed and restores `md.options.highlight = undefined`, whereas the real server fallback captures both pre-shiki fence/highlight hooks and restores the original highlight function (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:864-881` vs `app/src/server/services/render.service.ts:86-135`). That breaks the stated “reference pipeline” alignment and makes TC-1.2a / TC-6.2b much less credible than the document claims.

- The shiki-loading and render-error degradation path does not satisfy the epic and is contradicted by the test plan. The design says `renderChatMarkdown()` returns `escapeHtml(text)` whenever the pipeline is not ready or throws (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:896-913`). But TC-6.2c requires code blocks to render as monospace code while shiki is loading, not raw fenced markdown (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/epic.md:548-551`). The test plan then asserts `<pre><code>` for that same path while simultaneously calling it “escaped text fallback” (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/test-plan.md:349-351`). The same gap exists for TC-6.2a’s “error is logged” clause: neither the design snippet nor the mapped test owns any logging behavior.

- Link behavior is underspecified in the design and under-tested in the plan. The epic requires clicks on `http/https` links to open the system browser and clicks on `mailto:` links to invoke the system mail client (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/epic.md:141-152`). The design only adds `target="_blank"` / `rel="noopener noreferrer"` to `http/https` links and says nothing explicit about `mailto:` beyond letting the markup exist (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:538-540`, `docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:1116-1118`). The test plan is even weaker: TC-1.1g only checks attributes, and TC-1.1i only checks that the `href` survived rendering (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/test-plan.md:253-255`). That is not enough to prove the actual interaction contract, especially in the Electron-wrapped world established by Epic 6.

- The chosen View-menu toggle path has no owning module in the architecture or chunk plan. The design explicitly says the View menu gets a “Toggle Chat Panel ⌘J” item (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:233`, `docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:708`, `docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:1120`), but the module architecture and responsibility matrix list no `menu-bar.ts` or top-level `app.ts` modifications to carry that work (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:396-425`). That is a missing module responsibility, not just a documentation nicety, because the existing menu system is outside the steward module set.

- The Mermaid reuse story drifts from the actual shared utility behavior in a way that can lose safety/sizing guarantees on the cache-hit and theme-rerender paths. The design says existing Mermaid utilities are reused directly (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:194`), but in the cache-hit path it sets `container.innerHTML = cached` and replaces the node directly, and in the theme-rerender path it assigns `diagram.innerHTML = svg` directly (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:976-982`, `docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:1022-1029`). The actual shared utility does more than stringify SVG: it strips inline event handlers and reapplies responsive sizing on insertion (`app/src/client/utils/mermaid-renderer.ts:31-46`, `app/src/client/utils/mermaid-renderer.ts:80-93`, `app/src/client/utils/mermaid-renderer.ts:192-198`). So the design is not actually reusing the full established behavior on the very paths where churn is highest.

### Minor

- There is cross-document/module drift around the Mermaid cache location. Epic 11’s tech design lists `app/src/client/utils/mermaid-cache.ts` as the existing non-reused cache module (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:410-413`), while the related-docs section in the test plan points to `app/src/client/components/mermaid-cache.ts`, which is also the real repository path (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/test-plan.md:468-470`; actual file: `app/src/client/components/mermaid-cache.ts`). This is small, but it is exactly the sort of cross-doc reference drift the review asked to catch.

- Several TC-to-test mappings prove a weaker condition than the TC they cite. TC-4.5c requires persistence across reload and restoration of the previous width, but the mapped test only checks that `localStorage` contains `'false'` after close (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/epic.md:438-441` vs `docs/spec-build/v2/epics/11--chat-rendering-and-polish/test-plan.md:345`). TC-4.1a requires font family, base font size, and line height parity with the document viewer, but the mapped test only checks that `.markdown-body` is applied (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/epic.md:378-381` vs `docs/spec-build/v2/epics/11--chat-rendering-and-polish/test-plan.md:333`). TC-4.3a requires visible hover feedback, but the test plan reduces it to “CSS rule exists” (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/epic.md:408-410` vs `docs/spec-build/v2/epics/11--chat-rendering-and-polish/test-plan.md:339`).

## What I Noticed But Chose Not To Report

- Count reconciliation is clean. I verified 27 ACs and 82 TCs in `epic.md`, and all 82 TC IDs appear in `test-plan.md`. I did not find a count or TC-ID drift worth filing.
- The design does answer all 8 Epic 11 tech-design questions, and the overall high/medium/low-altitude structure is readable.
- The gorilla testing section is generally good. The only notable weakness is that it raises a few ambiguous behavioral questions, such as what should happen if the panel is closed mid-stream, without turning them into explicit design decisions.
- I noticed `field-sizing: content` as the proposed auto-grow mechanism, but I did not report it because I could not justify a defect from the provided artifacts alone.
