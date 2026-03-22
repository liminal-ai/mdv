# Epic 3 Verification — Cross-Model Meta-Report

**Author:** GPT-5.4 (meta-reviewer)
**Date:** 2026-03-21

---

## Report Rankings

### 1st: Sonnet — Most Rigorous Critical Analysis

**Report:** `verification/sonnet/epic-review.md`
**Findings:** 0 Critical, 3 Major, 6 Minor, 4 Informational (484 lines)

**What's good:**
- Strongest test quality analysis of all four reports. The per-TC quality table (lines 437–466) evaluates every single test condition individually — no other reviewer did this.
- Three unique, actionable Major findings that no other reviewer caught:
  - **MAJOR-1 (TC-1.6b false-pass):** The mock SVG trivially has no event handlers, so the "static diagrams" test can never fail regardless of `securityLevel` config. This is a genuine false-pass that masks a security-relevant AC.
  - **MAJOR-2 (TC-2.2a combined count):** The test verifies 1 mermaid warning in isolation, but the spec's TC-2.2a requires verifying the merged count of 3 (1 mermaid + 2 image). The `content-area.ts` merge logic is untested.
  - **MAJOR-3 (TC-2.1b user-select):** `getComputedStyle` in JSDOM returns `''` (not `'none'`) because CSS files aren't loaded, so `not.toBe('none')` always passes.
- Excellent remediation guidance for every finding — concrete, implementable suggestions.
- Good architectural tracing: the `fromHighlighter` coupling risk in MINOR-1 is a forward-looking observation.

**What's not good:**
- Focused heavily on test quality at the expense of runtime behavioral analysis. Did not identify the same-tab stale-write race (GPT-5.4 M-1) or the in-flight theme switch gap (GPT-5.4 M-2) — both are runtime bugs, not test gaps.
- Verbose. At 484 lines, it's the longest report and has some redundancy between the AC table, the findings section, and the test quality table.

---

### 2nd: GPT-5.4 — Best Runtime Behavioral Analysis

**Report:** `verification/gpt54/epic-review.md`
**Findings:** 0 Critical, 3 Major, 3 Minor (99 lines)

**What's good:**
- Two unique Major findings that no other reviewer identified:
  - **M-1 (stale-write race on same-tab refresh):** The stale-write guard in `content-area.ts:221` checks `activeTabId !== renderingTabId`, but file-watch refreshes preserve the same tab id — so an older `renderMermaidBlocks()` completing after a watch refresh overwrites fresh results. This is a real race condition against the spec's staleness guarantees.
  - **M-2 (theme switch during in-flight render):** The theme is snapshotted once per batch. Placeholders still rendering after a theme switch keep the old theme and are never revisited. This is a genuine AC-1.3c violation.
- Strong signal-to-noise ratio. At 99 lines, every finding is substantive — no padding or low-value observations.
- Clean AC coverage matrix with clear "Partial" callouts tied to specific findings.

**What's not good:**
- Missed the test-quality false-pass issues (Sonnet's MAJOR-1, MAJOR-2, MAJOR-3). These are arguably more actionable because they mean existing tests provide false confidence.
- No contract consistency analysis — didn't trace the `RenderWarning` type flow or verify the `MermaidBlockResult` interface.
- No architecture compliance table. The Informational section briefly confirms alignment but doesn't systematically compare design vs. implementation.
- Thin on remediation guidance — findings describe the problem but don't suggest fixes.

---

### 3rd: Opus — Most Thorough Documentation, Least Critical

**Report:** `verification/opus/epic-review.md`
**Findings:** 0 Critical, 0 Major, 2 Minor, 5 Informational (267 lines)

**What's good:**
- By far the most thorough structural analysis. The contract tracing (lines 70–86), pipeline flow diagram (lines 93–103), architecture compliance table (lines 167–177), and test quality assessment (lines 196–218) are all excellent reference material.
- Identified 5 dead test fixtures that no other reviewer caught — useful cleanup signal.
- Noted positive deviations (explicit `langAlias`, `warningsEqual` optimization, `fromHighlighter` as improvement over spec'd default import) — helpful for understanding where implementation improved on the design.
- False-pass risk assessment table (lines 206–210) is a good idea, though it concluded "Low" for items other reviewers flagged as Major.

**What's not good:**
- Too generous. A "0 Major" verdict with "All 19 ACs covered" and "well-implemented" misses real issues that three other reviewers independently identified as Major:
  - Source trimming (GPT-5.4 M-3, GPT-5.3 m2) — not mentioned at all.
  - Same-tab race condition (GPT-5.4 M-1, GPT-5.3 M3) — the stale-write guard is praised as "well-implemented" (I5) without recognizing the same-tab ID bypass.
  - TC-1.6b false-pass (Sonnet MAJOR-1) — noted as "Low" risk but is actually a structural test gap.
  - TC-2.1b JSDOM always-pass (Sonnet MAJOR-3) — not identified.
  - TC-2.2a combined count (Sonnet MAJOR-2) — not identified.
- Reads more like a verification confirmation than a critical review. The verdict matches the implementation team's expectations rather than challenging them.
- The dead-fixture finding (M1), while valid, is a cleanup item classified as Minor that displaces more impactful findings.

---

### 4th: GPT-5.3 — Competent Baseline, Thinnest Coverage

**Report:** `verification/gpt53/epic-review.md`
**Findings:** 0 Critical, 3 Major, 2 Minor, 2 Informational (106 lines)

**What's good:**
- One unique finding: **M1 (Promise.race can't preempt synchronous Mermaid stalls)**. This is architecturally significant — `Promise.race` around `mermaid.render` cannot interrupt a synchronous main-thread block. The design docs acknowledge this limitation, but GPT-5.3 is the only reviewer to flag it as Major.
- Concise and well-organized. Minimal noise.
- Correctly identified the watched-file integration gap (M3), source trimming (m2), and warning line field (m1).

**What's not good:**
- Thinnest analysis overall. No contract tracing, no type-flow verification, no per-TC test quality assessment, no architecture compliance comparison.
- The sync-stall finding (M1), while technically correct, is explicitly acknowledged as a known limitation in `tech-design.md:141`. Classifying a documented, accepted limitation as Major is arguable.
- SVG innerHTML finding (M2) is classified as Major, while the other three reviewers classified it as Minor or Informational. The reasoning ("mocked tests amplify the risk") is valid but the severity feels inflated given Mermaid's `securityLevel: 'strict'` and the local-viewer trust model.
- Missed the theme-switch race (GPT-5.4 M-2), the stale-write same-tab race (GPT-5.4 M-1), all three of Sonnet's test-quality false-passes, and the dead fixtures.
- AC coverage matrix has the least annotation — "Covered" without qualification for ACs that other reviewers flagged as partial.

---

## Synthesis: What to Take from Each

If building a single best-of review from these four:

| Source | Take |
|--------|------|
| **Sonnet** | Per-TC test quality table. MAJOR-1 (TC-1.6b false-pass), MAJOR-2 (TC-2.2a combined count), MAJOR-3 (TC-2.1b JSDOM always-pass). Remediation guidance pattern. |
| **GPT-5.4** | M-1 (same-tab stale-write race), M-2 (in-flight theme switch). These are the only runtime behavioral bugs found across all four reviews. |
| **Opus** | Contract tracing diagram, pipeline flow visualization, architecture compliance table, dead-fixture inventory. Use as the structural backbone of the report. |
| **GPT-5.3** | M1 (sync stall limitation). Downgrade to Minor/Informational since it's a documented, accepted constraint — but include it as an architectural risk note. |

### Combined Finding Set (de-duplicated, re-severitied)

**Major (5):**
1. Same-tab stale-write race on file-watch refresh (GPT-5.4 M-1)
2. Theme switch during in-flight render leaves mixed themes (GPT-5.4 M-2)
3. TC-1.6b is a structural false-pass (Sonnet MAJOR-1)
4. TC-2.2a doesn't verify combined warning count (Sonnet MAJOR-2)
5. TC-2.1b user-select assertion always passes in JSDOM (Sonnet MAJOR-3)

**Minor (7):**
1. Mermaid source `.trim()` breaks raw-source fidelity (GPT-5.4 M-3 — downgraded: whitespace trimming is benign in practice)
2. Warning panel drops `line` field (GPT-5.4 m-1, Sonnet INFO-4, GPT-5.3 m1)
3. SVG innerHTML without app-owned sanitization (all four reviewers, varying severity)
4. Mermaid exclusion deviates from tech design (Opus M2, Sonnet MINOR-1)
5. Stale server placeholder text (GPT-5.4 m-3, GPT-5.3 I1)
6. `withRenderedFile` helper duplicated (Sonnet MINOR-3)
7. 5 dead test fixtures (Opus M1, Sonnet MINOR-5)

**Informational (4):**
1. Promise.race can't preempt sync stalls — documented limitation (GPT-5.3 M1, downgraded)
2. TC-3.4c CSS test has limited JSDOM fidelity (Sonnet MINOR-6, GPT-5.3 I2)
3. No integration test for MutationObserver path (Sonnet MINOR-4)
4. Positive deviations: explicit langAlias, warningsEqual optimization, fromHighlighter usage (Opus)

---

## Observations on Reviewer Characteristics

| Reviewer | Strength | Blind Spot |
|----------|----------|------------|
| Opus | Structural depth, positive signal | Confirmation bias — validates rather than challenges |
| Sonnet | Test-level rigor, false-pass detection | Runtime behavior — didn't model async race conditions |
| GPT-5.4 | Runtime behavioral analysis, concurrency | Test-level false-pass detection, structural documentation |
| GPT-5.3 | Architecture constraints, conciseness | Breadth — missed findings in areas it didn't deeply probe |

The four reviews are remarkably complementary. No single reviewer found more than ~40% of the combined finding set. The runtime race conditions (GPT-5.4) and the test false-passes (Sonnet) are entirely non-overlapping discovery sets — a synthesized review needs both perspectives.
