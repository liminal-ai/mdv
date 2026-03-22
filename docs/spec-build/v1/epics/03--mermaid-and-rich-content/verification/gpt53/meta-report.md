# Epic 3: Mermaid and Rich Content — Cross-Model Meta-Report

**Author:** GPT-5.3-Codex (meta-analysis)
**Date:** 2026-03-21
**Reports analyzed:** Opus, Sonnet, GPT-5.4, GPT-5.3

---

## Rankings (Best to Worst)

### 1. Sonnet (Best)

**What's good:**
- Most critical and unique test quality analysis of any reviewer. Found three structural false-pass risks that no other report identified: TC-1.6b (mock SVG trivially has no event handlers, so the "static diagrams" assertion is vacuous), TC-2.1b (`getComputedStyle().userSelect` returns `''` in JSDOM, so the `not.toBe('none')` check always passes), and TC-2.2a (tests 1 mermaid warning, but the spec requires verifying the combined count of 3 across warning types).
- TC-by-TC quality assessment table is uniquely valuable — every test condition gets a verdict with specific reasoning, making it easy to audit which tests provide real coverage versus false confidence.
- Remediation suggestions are concrete and actionable (e.g., inject mock SVG with `onclick` to test stripping, inject `mermaid.css` into JSDOM, add integration test for warning merge).
- Found the `withRenderedFile` helper duplication (MINOR-3) and MutationObserver wiring gap (MINOR-4) — small but real maintainability risks.

**What's not good:**
- Rated TC-1.6b as "MAJOR" when the test plan already acknowledges it's config-verification only with manual checklist coverage. This is a known design choice, not a missed defect. Severity is debatable.
- Contract consistency section is shorter and less structured than Opus's. Doesn't trace the full type flow diagram.
- Missed the concurrency/race-condition findings that GPT-5.4 identified (watch refresh overlap, theme switch during render).
- `MermaidBlockResult` interface deviation is noted but is genuinely inconsequential.

### 2. GPT-5.4

**What's good:**
- Found two unique concurrency findings no other reviewer caught: M-1 (stale Mermaid warnings can overwrite refreshed tab state after a same-tab watch refresh, because the stale-write guard only checks tab ID changes, not same-tab content refreshes) and M-2 (theme switch during an in-flight `renderMermaidBlocks` batch leaves early-rendered diagrams in old theme while late-rendered ones get new theme, and `reRenderMermaidDiagrams` only touches `.mermaid-diagram` nodes that already existed).
- These are genuine behavioral race conditions against the spec, not test-structure complaints. They represent the only findings across all four reports that could cause actual user-visible incorrect behavior.
- Concise and well-organized. No padding. Every sentence carries signal.
- Source trimming (M-3) is correctly escalated to Major — this is a fidelity violation against the spec's "raw source" language.

**What's not good:**
- Least detailed of all four reports. Security, contract consistency, and architecture sections are collapsed into brief informational bullets. A reader wanting a comprehensive epic verification would need to supplement with another report.
- No test-by-test quality assessment. Doesn't analyze which tests are structurally sound versus false-pass risks.
- AC coverage matrix provides status but not evidence depth — just file/line references without explaining the gap or quality of coverage.
- No dead code or fixture analysis.

### 3. Opus

**What's good:**
- Most thorough and best-structured report. The pipeline flow diagram (§3 Integration Gaps) is excellent — it traces the full server→client→theme→watch path with specific line references and verification status at each stage.
- Best contract consistency analysis: traces the `RenderWarning` type flow from Zod schema through shared types to all consumers, with a clear verdict.
- Security analysis is the most nuanced: acknowledges the `innerHTML` SVG injection as a deliberate design decision (tech-design.md Q5), weighs the risk/effort tradeoff for adding client-side DOMPurify, and correctly assesses the threat model for a local file viewer. Other reports flag this as a gap; Opus contextualizes it.
- Architecture compliance table is comprehensive — maps every tech design decision to implementation with deviation annotations.
- Identified 5 dead test fixtures with specific analysis of why each is unused.
- Test quality section includes a false-pass risk assessment table — good structure, though less critical than Sonnet's.

**What's not good:**
- Too lenient. Rated the entire epic as "no major issues found" when Sonnet found three structural false-pass tests and GPT-5.4 found two race conditions. The two findings Opus did report (unused fixtures, mermaid exclusion deviation) are the lowest-value items across all four reports.
- The "no contract inconsistencies found" verdict overlooks the `RenderWarning.line` never being populated for Mermaid warnings, which three other reviewers flagged.
- The SVG innerHTML finding is downgraded to Informational when three other reviewers rated it Minor or Major. The contextual reasoning is sound, but the lack of any app-owned sanitization is still a gap worth flagging above Informational.
- "Missing Non-TC Tests" section is speculative — it proposes tests that wouldn't add value because Mermaid is mocked.

### 4. GPT-5.3 (Worst)

**What's good:**
- Correctly identified the three most common cross-report themes: Promise.race timeout limitation (M1), SVG innerHTML without sanitization (M2), and watched-file integration test gap (M3).
- The timeout finding (M1) is the only report to explicitly note that `Promise.race` cannot preempt synchronous main-thread blocking — a fundamental JavaScript limitation that other reports mention less precisely.
- Source trimming (m2) is correctly flagged with specific spec references.
- Clean, readable structure.

**What's not good:**
- Least depth of any report. Findings are stated but not analyzed — no remediation suggestions, no risk assessment, no discussion of design intent or tradeoffs.
- Every finding overlaps with at least one other report. No unique findings discovered.
- AC coverage table marks AC-1.3 as "Covered" when GPT-5.4 found a race-condition gap in in-flight theme switching. Similarly marks AC-2.3 as only "Partial" for the sync stall limitation, but this is acknowledged in the tech design as a known constraint — the coverage gap is in test structure, not implementation.
- No contract consistency analysis, no integration flow tracing, no test-by-test quality assessment.
- No fixture or dead code analysis.

---

## Synthesis: What to Take from Each Report

If composing a single best-of-breed verification review, I would draw:

### From Sonnet:
- **All three Major findings** (TC-1.6b false-pass, TC-2.1b JSDOM always-pass, TC-2.2a combined count gap) — these are the highest-value unique discoveries and represent real test quality risks.
- **TC-by-TC quality assessment table** — essential for any verification review that claims to evaluate test quality rather than just test presence.
- **Remediation suggestions** — concrete enough to act on without further analysis.
- **MINOR-3** (withRenderedFile duplication) and **MINOR-4** (MutationObserver wiring gap).

### From GPT-5.4:
- **M-1** (stale warnings after same-tab watch refresh) and **M-2** (theme switch during in-flight render) — the only behavioral race-condition findings across all reports. These are the most likely to cause actual user-visible bugs.
- The concise, high-signal writing style as a model for the executive summary.

### From Opus:
- **Pipeline flow diagram** (§3) — the best structural artifact for understanding how the system actually works end-to-end.
- **Contract consistency trace** — the RenderWarning type flow analysis is definitive.
- **Security analysis framing** — the SVG innerHTML discussion with threat model context (local file viewer, trusted dependency, design decision Q5) is the most balanced treatment.
- **Architecture compliance table** — complete mapping of design decisions to implementation.
- **Dead fixture inventory** — useful for cleanup.

### From GPT-5.3:
- **M1 framing** of Promise.race vs synchronous blocking — the most precise articulation of why the timeout mechanism has a fundamental limitation. Use this language in the synthesized finding.

---

## Cross-Report Finding Concordance

| Finding | Opus | Sonnet | GPT-5.4 | GPT-5.3 |
|---------|------|--------|---------|---------|
| SVG innerHTML without DOMPurify | Info (I1) | Info (INFO-3) | Minor (m-2) | **Major (M2)** |
| Promise.race can't preempt sync | — | — | — | **Major (M1)** |
| TC-1.6b false-pass (mock SVG) | — | **Major (MAJOR-1)** | — | — |
| TC-2.1b JSDOM always-passes | — | **Major (MAJOR-3)** | — | — |
| TC-2.2a combined count untested | — | **Major (MAJOR-2)** | — | — |
| Watch refresh stale warnings race | — | — | **Major (M-1)** | — |
| Theme switch during in-flight render | — | — | **Major (M-2)** | — |
| Source trimming breaks "raw source" | — | — | **Major (M-3)** | Minor (m2) |
| RenderWarning.line not populated | — | Info (INFO-4) | Minor (m-1) | Minor (m1) |
| Mermaid exclusion deviation | Minor (M2) | Minor (MINOR-1) | — | — |
| Watched-file integration not E2E tested | — | — | Major (M-1 partial) | Major (M3) |
| Dead/duplicate fixtures | Minor (M1) | Minor (MINOR-5) | — | — |
| Stale placeholder copy | — | Info (INFO-2) | Minor (m-3) | Info (I1) |
| TC-3.4c CSS test drift | — | Minor (MINOR-6) | — | Info (I2) |
| withRenderedFile duplication | — | Minor (MINOR-3) | — | — |
| MutationObserver wiring untested | — | Minor (MINOR-4) | — | — |
| Private field access in TC-3.5 | — | Minor (MINOR-2) | — | — |

**Unique findings by model:**
- **Opus:** 0 unique (all findings shared with at least one other report)
- **Sonnet:** 4 unique (MAJOR-1, MAJOR-2, MAJOR-3, MINOR-3)
- **GPT-5.4:** 2 unique (M-1 race condition, M-2 theme race)
- **GPT-5.3:** 0 unique (all findings shared)

---

## Overall Assessment

The four reports collectively surface ~16 distinct findings. No single report captures more than half. The strongest verification review would combine Sonnet's test-quality rigor, GPT-5.4's concurrency analysis, and Opus's structural documentation. GPT-5.3 provides useful framing but no incremental coverage.

**Recommended action:** Synthesize findings from all four into a single consolidated verification report, weighted by the ranking above, before making accept/remediate decisions.
