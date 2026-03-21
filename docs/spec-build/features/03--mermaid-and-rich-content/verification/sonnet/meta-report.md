# Epic 3 Verification Meta-Report

**Author:** Claude Sonnet 4.6 (1M context)
**Date:** 2026-03-21
**Reports reviewed:**
1. `verification/opus/epic-review.md` — Opus
2. `verification/sonnet/epic-review.md` — Sonnet (this reviewer's own report)
3. `verification/gpt54/epic-review.md` — GPT-5.4 (high reasoning)
4. `verification/gpt53/epic-review.md` — GPT-5.3 / Codex

---

## Rankings: Best to Worst

### 1. GPT-5.4 — Best

GPT-5.4 found two real behavioral gaps that all other reports missed: the same-tab file-watch race condition (M-1) and the in-flight theme-switch mixed-themes race (M-2). Both are genuinely concurrency issues that exist in the implementation and are not covered by any test.

**The same-tab race (M-1)** is the most significant finding across all four reports. When a file-watch reload fires while a previous `renderMermaidBlocks()` call is still in flight on the same tab, the stale-write guard (`activeTabId !== renderingTabId`) does not protect against it — both renders share the same tab ID. The older render can overwrite the refreshed tab's mermaid warnings after the new render has already written its own results. This is a real async correctness gap.

**The in-flight theme switch (M-2)** is subtler: `renderMermaidBlocks()` captures the theme once before the sequential render loop. If a theme switch fires mid-loop, the MutationObserver calls `reRenderMermaidDiagrams()` which only operates on `.mermaid-diagram` elements that have already been placed. Placeholders still in-flight finish rendering with the old theme and are never revisited by the re-render pass. The result is mixed-theme diagrams that persist until a full reload.

Both findings are correctly characterized as edge cases unlikely in typical usage, and GPT-5.4 says so honestly. The AC coverage matrix (Covered/Partial table with line citations) is clean and actionable.

**Weaknesses:** M-3 (source trimming breaks "raw source" expectation) is overstated as Major. `.trim()` on extracted `textContent` is standard practice — the leading/trailing whitespace in a code block is markdown parser artifact, not part of the diagram definition. "Raw source" in the AC context means the diagram definition, not the whitespace padding. This finding would be more accurately filed as Minor or Informational.

---

### 2. Sonnet — Second

Sonnet's report found the three most actionable test quality issues: TC-1.6b is a structural false-pass (the mock SVG trivially passes the event-handler check), TC-2.1b always passes in JSDOM (computed style for `userSelect` is `''` not `'none'` since no CSS is loaded), and TC-2.2a doesn't verify the combined 3-count specified in the spec (only the 1 mermaid warning, not the merged total with image warnings).

These are meaningful because they represent gaps in the test suite's ability to catch future regressions — a developer who removes `securityLevel: 'strict'` would not see TC-1.6b fail. The TC-2.2a gap (no test for the content-area.ts merge logic) is the most significant test coverage hole identified across all four reports.

The report is also the most detailed on remediation steps, explaining not just what is wrong but how to fix each finding and why it matters.

**Weaknesses:** Missed both of GPT-5.4's concurrency findings entirely. Also missed the TC-3.4c CSS drift observation from GPT-5.3. The report's MINOR-1 (mermaid exclusion deviation) correctly identifies a deviation but calls it out as needing a comment rather than a fix — which is right, but the finding feels stretched to fill space.

---

### 3. Opus — Third

Opus produced the most structurally comprehensive report. The AC coverage table is the best of the four: it maps each AC to its exact implementation file and line, cites the specific test, and gives a one-sentence status. The "Critical Safeguards" section that explicitly verifies the replace-not-append logic, the stale-write guard, the `warningsEqual` optimization, and the theme re-render filter is excellent documentation that confirms these mechanisms work as designed. The RenderWarning flow diagram is clear.

Opus correctly identified the five unused test fixtures (including the duplicate `tableWithFormattingAndLinksMarkdown`) and correctly explained why they are cleanup items rather than gaps.

**Weaknesses:** Opus found no major issues despite there being real ones. The false-pass tests that Sonnet flagged, the race conditions that GPT-5.4 flagged, and the AC-2.2a integration gap — none of these appear. The verdict ("No critical or major issues found") is too clean. A reviewer who read only this report would have a false sense of completeness. This isn't a sign of sloppiness in the analysis of what was examined, but rather a narrower aperture — Opus verified that what's there is correct, without deeply probing the test suite's failure modes or the concurrency edge cases.

---

### 4. GPT-5.3 — Worst

GPT-5.3 produced the thinnest report. Its M1 (timeout can't preempt synchronous stalls) is not a finding — the tech design explicitly documents this limitation in Q4 ("Known limitation: Promise.race() only fires the timeout callback when the event loop gets a turn") and the spec's AC-2.3b says "a timeout elapses" — it doesn't promise the timeout interrupts synchronous work. Calling a documented design trade-off a "Major" finding misreads the spec.

M3 (file-watch not tested through real ws→refresh→render path) is the same gap that GPT-5.4 raised as M-1 but is less precisely described: GPT-5.3 notes the integration test gap without identifying the specific race condition that makes it matter.

The only original finding that doesn't appear in other reports is I2: the TC-3.4c test injects its own ad-hoc CSS rather than loading the actual `markdown-body.css`. This is a legitimate maintenance risk — if the production CSS rule changes, the test would still pass because it's testing against its own injected copy. This is a good catch, buried as Informational.

No remediation suggestions anywhere. The AC coverage summary table is less detailed than the others (no file:line citations, no explanation of why "Covered" or "Partial"). The report reads like it was written at the boundary of the output budget.

---

## What to Take from Each Report for a Synthesized Best Review

### From GPT-5.4
- **The same-tab file-watch race condition** (M-1): the stale-write guard only checks `activeTabId !== renderingTabId`, which doesn't protect against a tab that reloads in-place while the previous render is still in flight. This is the highest-value finding across all four reports.
- **The in-flight theme switch race** (M-2): the theme snapshot in `renderMermaidBlocks()` is taken before the sequential loop, so a mid-loop theme change leaves later diagrams on the old theme with no re-render triggered for them.
- **Honest severity calibration**: explicitly stating findings are "edge cases unlikely in typical usage" — a synthesized report should always estimate practical impact, not just theoretical correctness.

### From Sonnet
- **TC-1.6b false-pass** (MAJOR-1): the mock SVG trivially satisfies the event-handler assertions; the test can never catch a `securityLevel` regression.
- **TC-2.2a combined-count gap** (MAJOR-2): the content-area.ts merge logic (server image warnings + client mermaid warnings = combined count) has no automated test, directly violating the spec's "warning count shows 3" requirement.
- **TC-2.1b always-true in JSDOM** (MAJOR-3): the `userSelect` computed-style assertion is structurally meaningless in the test environment.
- **Detailed remediation steps** for each finding: a synthesized report should not just cite what's wrong but explain what an engineer should do about it.

### From Opus
- **The AC×implementation×test cross-reference table**: the best tool for a reader who wants to verify any single AC end-to-end. File and line citations for both implementation and tests.
- **The "Critical Safeguards" verification section**: explicitly confirming the replace-not-append logic, stale-write guard, `warningsEqual` optimization, and `.mermaid-error` filter behave correctly.
- **The RenderWarning type flow diagram**: clear confirmation of the type contract from schema through shared/types to all consumers.
- **Dead fixture enumeration with explanation**: noting that `unknownTypeMermaid`, `complexFlowchartMermaid`, `multiDiagramMarkdown`, `mixedContentMarkdown`, and `tableWithFormattingAndLinksMarkdown` are unused — and correctly explaining why most are not gaps (Mermaid is mocked so complexity doesn't affect tests).

### From GPT-5.3
- **TC-3.4c CSS drift risk** (I2): the test injects its own `<style>` tag rather than loading `markdown-body.css`, so the test and the production CSS can diverge silently. A change to the production Shiki theme-switching rules would not be caught by this test. A synthesized report should include this as a Minor finding with a note that the fix is to import the actual CSS file in the test environment.

---

## Cross-Report Agreement Summary

These findings appeared independently in multiple reports (higher confidence):

| Finding | Sonnet | Opus | GPT-5.4 | GPT-5.3 |
|---------|--------|------|---------|---------|
| TC-1.6a/b config-only verification | ✓ (Major) | ✓ (Info) | ✓ (Info) | ✓ (Partial) |
| SVG innerHTML without DOMPurify | ✓ (Info) | ✓ (Info) | ✓ (Minor) | ✓ (Major) |
| Unused test fixtures (dead code) | ✓ (Minor) | ✓ (Minor) | — | — |
| Mermaid exclusion deviation from design | ✓ (Minor) | ✓ (Minor) | — | — |
| `RenderWarning.line` never shown in UI | ✓ (Info) | — | ✓ (Minor) | ✓ (Minor) |
| Source `.trim()` affects "raw source" claim | — | — | ✓ (Major) | ✓ (Minor) |
| Stale placeholder text in server HTML | — | — | ✓ (Minor) | ✓ (Info) |

These findings were unique to one report (lower confidence — worth scrutiny):

| Finding | Reporter | Assessment |
|---------|----------|------------|
| Same-tab file-watch race condition | GPT-5.4 only | **Credible** — the guard code confirms the vulnerability; no other report noticed |
| In-flight theme switch race | GPT-5.4 only | **Credible** — the sequential loop + single theme snapshot confirms the gap |
| TC-2.2a combined-count gap | Sonnet only | **Credible** — the test only checks `result.warnings.length === 1`, not merged total |
| TC-2.1b user-select false-pass | Sonnet only | **Credible** — JSDOM without stylesheet loaded returns `''` for all computed styles |
| TC-3.4c uses injected CSS not production CSS | GPT-5.3 only | **Credible** — the test file clearly injects its own `<style>` tag |
| Timeout = documented limitation not a bug | (against GPT-5.3 M1) | **GPT-5.3 is wrong** — this is explicitly documented in tech-design.md Q4 |

---

## Final Verdict

The four reports together paint a complete picture. No report alone is sufficient:

- GPT-5.4 found the only true behavioral correctness gaps (race conditions).
- Sonnet found the most actionable test quality gaps (false-pass tests, missing integration coverage).
- Opus produced the most complete structural verification.
- GPT-5.3 produced one useful catch (TC-3.4c CSS drift) buried under a misclassified finding.

A synthesized review would rate Epic 3 as: **Pass with required follow-up on 2 race-condition edge cases and 3 test quality gaps.** No critical issues. The implementation is architecturally sound and functionally correct for the common case.
