# Epic 1 Review Meta-Report (Across 4 Reviewers)

## Ranking (Best -> Worst)

1. **Opus** (`verification/opus/epic-review.md`)
2. **Sonnet** (`verification/sonnet/epic-review.md`)
3. **gpt-5.4 Codex** (`verification/gpt54-codex/epic-review.md`)
4. **gpt-5.3 Codex** (`verification/gpt52/epic-review.md`)

## Ranking Rationale

This ranking is based on a balance of:
- literal AC/TC traceability,
- evidence quality (specific file/line references),
- defect signal quality (real bugs vs possible false positives),
- actionability for engineering follow-up.

## Report-by-Report Assessment

### 1) Opus (Rank #1)

**What is good**
- Most complete AC-by-AC and TC-by-TC verification structure.
- Strong endpoint inventory and broad implementation/test mapping.
- Good synthesis of cross-cutting flows (themes, folder entry points, session persistence).
- High practical usefulness for release triage.

**What is not good**
- Misses at least one important API contract issue highlighted by Sonnet (validation-error payload shape on `PUT /api/session/root`).
- Flags some medium-risk architectural concerns that are lower priority than contract/runtime correctness.
- A few conclusions over-credit test coverage on CSS/interaction behaviors that are only indirectly asserted.

**What to take into a single best review**
- Keep Opus as the **backbone format** for final sign-off.
- Keep its AC/TC traceability tables and endpoint checklist style.
- Keep its callout on deleted-root UX gap (`AC-10.2`) as a top defect.

### 2) Sonnet (Rank #2)

**What is good**
- Excellent contract-centric scrutiny.
- Correctly surfaces high-value API-contract risks:
- error code drift (`INVALID_ROOT` vs spec `INVALID_PATH`)
- validation error-shape mismatch on `PUT /api/session/root`
- Clear, actionable remediation language for each finding.
- Good testing-quality critique (vacuous CSS assertions, weak perf bound framing).

**What is not good**
- Severity calibration appears aggressive in places.
- One “critical” claim is likely overstated/ambiguous (bootstrap permission-path behavior), and it may conflate startup healing behavior with interactive error-path requirements.
- Misses/underweights the deleted-root invalid-state nuance emphasized in other reviews.

**What to take into a single best review**
- Keep Sonnet’s **contract-audit lens**.
- Keep C1/C2-style API contract checks as mandatory pre-ship blockers.
- Keep its test-quality caveats for non-behavioral CSS tests.

### 3) gpt-5.4 Codex (Rank #3)

**What is good**
- High-signal concise findings not emphasized elsewhere:
- potential keyboard reachability issue for tree navigation (`AC-2.4b`)
- bootstrap-failure blank-shell behavior
- root/workspace validation gaps (file-path roots, nonexistent workspace persistence)
- Strong practical bug-hunt instincts despite short format.

**What is not good**
- Too terse for full epic-level sign-off by itself.
- Limited AC/TC traceability and less exhaustive evidence chain.
- Some claims need deeper confirmation context to avoid overcalling.

**What to take into a single best review**
- Keep these as a **targeted “additional risk pass”** after main AC coverage review.
- Especially keep: keyboard entry-path realism, bootstrap failure UX fallback, and root/workspace path validation hardening.

### 4) gpt-5.3 Codex (Rank #4)

**What is good**
- Concise and readable.
- Correctly captures major themes from deeper reports.
- Good executive-summary style for quick consumption.

**What is not good**
- Lowest depth and least original coverage.
- Mostly a compressed subset of larger reviews, with fewer net-new insights.
- Not sufficient alone for epic closure decisions.

**What to take into a single best review**
- Keep its short “Requested Checks Summary” format for top-of-doc digest.
- Use as the one-page executive front matter, not as the primary audit body.

## If Synthesizing One Best Final Review

Use this composition strategy:

1. **Base structure from Opus**
- AC/TC matrix
- endpoint existence/coverage matrix
- severity-grouped findings

2. **Contract correctness gates from Sonnet**
- strict error-code conformance to epic contracts
- strict error payload shape checks for all 4xx/5xx paths

3. **Edge-case/runtime realism from gpt-5.4 Codex**
- keyboard reachability (not just synthetic dispatch)
- bootstrap failure rendering fallback
- root/workspace path validation rigor

4. **Executive brevity from gpt-5.3 Codex**
- concise top summary table and ship/no-ship checklist

## Recommended Canonical Defect Set (Merged)

If producing one merged blocker list, prioritize these:
- `AC-10.2` deleted-root invalid-state UX gap.
- `PUT /api/session/root` 400 validation error shape mismatch with documented API error contract.
- `INVALID_ROOT` vs `INVALID_PATH` contract inconsistency.
- Tree keyboard entry/reachability usability risk (`AC-2.4b`) if confirmed in manual UX test.
- Bootstrap failure fallback behavior (render-safe empty shell + visible error) hardening.
- Root/workspace input validation hardening (reject file roots, reject nonexistent workspace pins if contract requires it).

