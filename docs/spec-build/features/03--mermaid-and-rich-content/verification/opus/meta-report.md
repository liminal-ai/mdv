# Epic 3 Verification — Meta-Report

**Author:** Opus
**Date:** 2026-03-21
**Reports reviewed:** Opus, Sonnet, GPT-5.4, GPT-5.3

---

## Ranking: Best to Worst

### 1. Sonnet (Best)

**What's good:**

The strongest report by a clear margin. Three genuine, well-calibrated findings that the other reviewers either missed or under-classified:

- **MAJOR-1 (TC-1.6b false-pass):** A structural insight the other reports missed. The mock SVG is `<svg><rect/></svg>` — it trivially has no event handlers. The test can never fail regardless of whether `securityLevel: 'strict'` is configured. This is a real false-pass, not just a "config-verification limitation." Sonnet correctly identifies that removing `securityLevel: 'strict'` would not cause this test to fail.

- **MAJOR-2 (TC-2.2a combined count):** Correctly identifies that the spec says "warning count shows 3 (1 mermaid + 2 image)" but the test only checks `result.warnings.toHaveLength(1)`. The merge logic in `content-area.ts` is untested. This is a genuine integration gap — the code is correct but has no test protection.

- **MAJOR-3 (TC-2.1b JSDOM user-select):** Correctly identifies that JSDOM doesn't load external CSS files, so `getComputedStyle().userSelect` returns `''` (not `'none'`), making the assertion trivially true. The test provides zero coverage of TC-2.1b.

The **test-by-test quality table** (TC-1.1a through TC-5.2b with quality ratings) is the report's best feature — it gives an at-a-glance view of where test quality is strong vs. weak. No other report has this.

Additional novel findings: `withRenderedFile` helper duplication (MINOR-3), `MermaidBlockResult` interface not standalone (contract section), warning panel `line` field gap (INFO-4), MutationObserver integration gap (MINOR-4).

**What's not good:**

- Slightly verbose — could be more concise in the MINOR findings. MINOR-6 (TC-3.4c JSDOM fidelity) is already flagged as limited by the test plan and is self-evident; the assessment paragraph ("This is an acceptable approximation") undermines the finding.
- The architecture compliance section is a flat table without the kind of pipeline flow analysis that would help a reader understand how the pieces connect.
- Missing: dead test fixtures (5 unused exports that Opus and GPT-5.3 variants caught).

---

### 2. Opus

**What's good:**

Most comprehensive structural analysis. Strong in areas that require tracing flows across multiple files:

- **RenderWarning type flow diagram** traces the type from `schemas/index.ts` through `shared/types.ts` to all 4 consumer modules. No other report does this.
- **Pipeline flow** (server → client) is rendered as a clear end-to-end diagram with every stage identified.
- **Critical safeguards section** identifies 5 specific safeguards (replace-not-append, stale-write guard, warningsEqual, theme re-render scope, source preservation) with file:line references.
- **Architecture compliance matrix** maps every module in the tech design to its implementation with match/deviation status.
- **Dead fixture identification** — the only report to identify all 5 unused test fixtures and the duplicate `tableWithFormattingAndLinksMarkdown`.
- **DOMPurify compatibility analysis** traces Shiki CSS custom properties through the sanitization pipeline and cites TC-3.4a as evidence they survive.

**What's not good:**

- **Too lenient on severity.** The TC-1.6b false-pass (which Sonnet correctly flagged as MAJOR) was classified only as Informational. The TC-2.1b JSDOM limitation and TC-2.2a combined-count gap were not identified at all. This is the report's most significant weakness — it demonstrates thoroughness at the structural/architecture level but misses test quality issues at the assertion level.
- The false-pass risk assessment table exists but rates everything "Low" — it describes the risks but doesn't challenge whether the tests actually verify what they claim to.
- The "Missing Non-TC Tests (Opportunities)" section lists tests that would be useless given the mock boundary (e.g., `complexFlowchartMermaid` with mocked Mermaid).

---

### 3. GPT-5.4

**What's good:**

- **M-1 (file-watch refresh race):** The most creative finding across all reports. It identifies a genuine race condition: if `renderMermaidBlocks()` from a previous render completes after a file-watch refresh, the stale-write guard only checks `activeTabId` (tab switch), not whether the HTML was refreshed within the same tab. This is a real edge case that no other reviewer caught.
- **M-2 (theme switch during in-flight render):** Another novel finding about the theme being snapshotted once per render batch. If a theme switch occurs mid-batch, later diagrams render with the old theme and aren't revisited. Clever edge-case analysis.
- **m-3 (stale placeholder text):** Practical observation — "rendering available in a future update" is now incorrect since rendering IS available. No other report caught this stale copy.
- Concise format with spec-ref and test-gap citations on every finding.

**What's not good:**

- **M-3 (source trimming) is over-classified.** The `.trim()` removes leading/trailing whitespace from code block source. The spec says "raw source is fully visible and selectable" — trimming whitespace from a Mermaid definition is reasonable normalization, not a fidelity violation. Mermaid itself would fail on leading/trailing whitespace. This should be Informational at most.
- **M-1 and M-2 are creative but edge-case-y for Major classification.** The file-watch race requires a very specific timing window (old render completing during new render of the same tab). The theme-during-render race requires theme switching while diagrams are actively rendering (sub-second window). Both are real but would be better classified as Minor with a note about hardening.
- **Missing structural analysis.** No type flow tracing, no pipeline diagram, no architecture compliance matrix, no test-by-test quality assessment. The report is findings-only without the systematic coverage walk that would give confidence in completeness.
- **AC coverage matrix marks many ACs as "Partial" based on edge-case concerns** rather than core implementation gaps, which inflates the apparent risk.

---

### 4. GPT-5.3 (Worst)

**What's good:**

- **Concise and well-organized.** Easy to scan. Each finding has category, file references, and spec references.
- **I2 (TC-3.4c CSS test drift):** Unique observation that the test injects ad-hoc CSS rather than asserting against the shipped `markdown-body.css`. If the production CSS changes, the test wouldn't catch the divergence. No other report identifies this.
- **m2 (source trimming):** Correctly identifies the `.trim()` issue at a lower severity than GPT-5.4 (Minor vs. Major), which is a better calibration.

**What's not good:**

- **M1 (timeout for sync stalls) is a misread.** The tech design explicitly acknowledges this limitation in Q4: "The timeout catches genuinely stuck promises but cannot prevent a single complex diagram from blocking the UI during its synchronous rendering phase." Flagging a documented, analyzed limitation as a Major finding suggests the reviewer didn't fully process the tech design.
- **M2 (SVG innerHTML) is a deliberate design decision.** The tech design Q5 explicitly addresses this with rationale. Flagging it as Major without acknowledging the design decision suggests incomplete spec reading.
- **Shortest and least detailed.** No test-by-test analysis, no pipeline tracing, no architecture compliance check, no contract flow analysis. The AC coverage table has no detail column — just "Covered" or "Partial" without explanation of what "Covered" means.
- **Missing findings that other reports caught.** No mention of: TC-1.6b false-pass, TC-2.1b JSDOM limitation, TC-2.2a combined-count gap, dead fixtures, withRenderedFile duplication, stale placeholder text.
- **No remediation suggestions.** Other reports suggest specific fixes; this report only identifies problems.

---

## Synthesis: What I'd Take From Each

If synthesizing a single best review from all four:

### From Sonnet (primary source)

- **TC-1.6b false-pass analysis** — the highest-signal finding across all reports
- **TC-2.2a combined-count gap** — real integration testing gap
- **TC-2.1b JSDOM user-select limitation** — zero-coverage test
- **Test-by-test quality table** — best-in-class format for test quality assessment
- **withRenderedFile helper duplication** — practical code quality finding
- **MermaidBlockResult not standalone** — contract precision
- **Warning panel line field gap** — future-proofing observation
- **MutationObserver integration gap** — wiring not tested

### From Opus (structural framework)

- **RenderWarning type flow diagram** — traced through all layers
- **Pipeline flow end-to-end** — server through client with every stage
- **Critical safeguards section** — 5 specific safeguards analyzed
- **Architecture compliance matrix** — module-by-module design vs. implementation
- **Dead fixture identification** — 5 unused exports
- **DOMPurify compatibility analysis** — Shiki CSS properties through sanitization
- **Security analysis structure** — systematic concern-by-concern assessment

### From GPT-5.4 (creative edge cases)

- **File-watch refresh race condition (M-1)** — reclassified as Minor with hardening note. The stale-write guard doesn't protect against same-tab refreshes — a genuine gap in the concurrency model.
- **Theme during in-flight render (M-2)** — reclassified as Minor. Novel timing analysis.
- **Stale placeholder text (m-3)** — practical product quality catch.

### From GPT-5.3 (targeted precision)

- **TC-3.4c CSS test drift (I2)** — unique observation about test CSS vs. production CSS divergence potential.
- **Source trimming at correct severity (Minor)** — better calibration than GPT-5.4's Major.

### What I'd drop from each

- **Opus:** The too-lenient severity on test quality issues. The "Missing Non-TC Tests" suggestions for tests that would be identical to existing ones under mock.
- **Sonnet:** MINOR-6 (JSDOM fidelity) — self-undermining. MINOR-2 (private field access) — standard testing pattern.
- **GPT-5.4:** M-3 at Major severity. The overly-partial AC coverage matrix.
- **GPT-5.3:** M1 (documented limitation as Major) and M2 (deliberate design decision as Major) — both suggest incomplete spec reading.

---

## Cross-Report Finding Concordance

| Finding | Opus | Sonnet | GPT-5.4 | GPT-5.3 | Correct Severity |
|---------|------|--------|---------|---------|-----------------|
| TC-1.6b false-pass (mock SVG trivially clean) | I2 (too low) | **MAJOR-1** | — | Partial note | **Major** |
| TC-2.2a combined count not integration-tested | — | **MAJOR-2** | — | — | **Major** |
| TC-2.1b user-select always passes in JSDOM | — | **MAJOR-3** | — | — | **Major** |
| File-watch race (same-tab stale write) | — | — | M-1 (too high) | M3 (too high) | **Minor** |
| Theme during in-flight render | — | — | M-2 (too high) | — | **Minor** |
| Source `.trim()` fidelity | — | — | M-3 (too high) | m2 | **Minor** |
| Mermaid exclusion deviation | M2 | MINOR-1 | — | — | **Minor** |
| SVG innerHTML without DOMPurify | I1 | INFO-3 | m-2 | M2 (too high) | **Informational** (design decision) |
| Warning panel drops `line` field | — | INFO-4 | m-1 | m1 | **Minor** |
| Dead fixtures | M1 | MINOR-5 (partial) | — | — | **Minor** |
| withRenderedFile duplication | — | MINOR-3 | — | — | **Minor** |
| Stale placeholder text | — | — | m-3 | I1 | **Informational** |
| Timeout can't preempt sync blocking | — | — | — | M1 (misread) | **Not a finding** (documented) |
| MutationObserver not integration-tested | — | MINOR-4 | — | — | **Minor** |
| TC-3.4c CSS test drift | — | — | — | I2 | **Informational** |
| Private field access in TC-3.5 tests | — | MINOR-2 | — | — | **Informational** |
| `langAlias` explicit config | — | INFO-1 | — | — | **Informational** (positive) |
| Export placeholder pass-through | I3 | INFO-2 | — | — | **Informational** |

---

## Overall Assessment

Sonnet produced the best verification review — it found the three highest-signal issues (all test quality false-passes) that directly affect the reliability of the test suite as a regression safety net. These findings are actionable and have clear remediation paths.

Opus produced the best structural analysis but was too lenient on test quality, missing assertion-level false-passes that Sonnet caught. The architecture and contract analysis from Opus would form the skeleton of a synthesized report.

GPT-5.4 contributed creative edge-case analysis (race conditions) but over-classified severity, and GPT-5.3 was too brief and misread documented limitations as novel findings.
