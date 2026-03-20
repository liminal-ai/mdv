# Epic 1 Verification Meta-Report

**Date:** 2026-03-19
**Scope:** Comparative assessment of four Epic 1 review reports

---

## Overall Ranking

1. **gpt54-codex**
2. **opus**
3. **gpt52**
4. **sonnet**

This ranking is based on four things: factual accuracy against the code/spec set, usefulness of the findings, clarity of prioritization, and how well the report distinguishes real behavioral gaps from merely structural or stylistic deviations.

---

## 1. gpt54-codex

### What is good about it

- Best signal-to-noise ratio of the four reports.
- Finds several high-value issues that are real and actionable:
  - tree keyboard navigation is not actually reachable by keyboard users
  - deleted-root UX is only partially implemented
  - bootstrap failure path renders no fallback shell
  - `PUT /api/session/root` accepts files
  - `POST /api/session/workspaces` accepts nonexistent paths
- Does a good job separating implementation gaps from test-quality gaps.
- Avoids over-crediting shallow tests as proof of full AC satisfaction.
- Its requested-check summary is tight and practical.

### What is not good about it

- It is the least comprehensive of the “full” reviews in presentation.
- It does not provide an AC-by-AC matrix, so traceability is weaker than Opus or Sonnet.
- It misses at least one worthwhile issue that Opus caught: the `shared/types.ts` runtime export leakage risk.
- It is lighter on explicit evidence from tests and on the endpoint-by-endpoint contract table.

### What I would take from it

- The issue selection and severity judgment.
- The distinction between “implemented” and “actually proven.”
- The focus on behavioral correctness over structural conformity.
- The concise requested-check summary format.

---

## 2. opus

### What is good about it

- Strongest overall traceability and completeness of presentation.
- The AC-by-AC verification matrix is very useful for auditability.
- Good endpoint inventory and broad coverage of implementation plus tests.
- Correctly identifies the deleted-root invalid-state gap.
- Correctly notices the `shared/types.ts` runtime value export, which the other reports mostly missed.
- Good test-count accounting and useful summary of where extra coverage exists.

### What is not good about it

- It is too generous in a few places where the tests are weaker than the table implies.
- It overstates some ACs as fully satisfied when the evidence is only indirect or shallow.
- It misses several important issues that `gpt54-codex` caught:
  - keyboard reachability of the tree
  - blank-page bootstrap failure behavior
  - accepting file paths as roots
  - accepting nonexistent workspace paths
- Its “all 43 ACs are addressed with test coverage” framing is slightly too optimistic for a literal verification report.

### What I would take from it

- The AC-by-AC matrix structure.
- The endpoint inventory table.
- The `shared/types.ts` finding.
- The test-count / test-plan variance analysis.
- The overall report shape, but with stricter standards for what counts as “covered.”

---

## 3. gpt52

### What is good about it

- Very concise and easy to scan.
- Mostly accurate on the issues it does raise.
- Correctly calls out the deleted-root UX gap.
- Correctly calls out the invalid-path/error-contract inconsistency across endpoints.
- Good compact summary table for the requested checks.

### What is not good about it

- Too compressed to function as a standalone “comprehensive review.”
- Lacks detailed evidence, line-level reasoning, and test-quality analysis.
- Misses several meaningful issues found by stronger reports:
  - tree keyboard reachability
  - bootstrap blank-page behavior
  - root endpoint accepting files
  - workspace endpoint accepting nonexistent paths
  - `shared/types.ts` runtime export leak
- “Theme flow end-to-end implemented and tested” is stronger than the evidence really supports; the flow is covered in pieces, not as a single end-to-end scenario.

### What I would take from it

- The compact requested-check summary table.
- Its brevity discipline.
- Its emphasis on the two most important contract/UX issues without burying them.

---

## 4. sonnet

### What is good about it

- Very thorough presentation.
- Strongest discussion of vacuous tests and test realism.
- Good structure for separating critical, major, and minor concerns.
- Helpful attention to API error formatting and regression-test quality.
- The test-quality section is one of the best parts of any of the four reports.

### What is not good about it

- It contains enough factual or judgment errors that I would not use it as the primary review.
- The biggest problem is over-asserted severity on findings that are either debatable or incorrect.
- It appears to misread at least one important implementation detail: the bootstrap permission-denied path is presented as a live AC-10.1 startup bug, but `SessionService.pathExists()` treats `EACCES` as non-existent during healing, so the persisted root is cleared on load before bootstrap tree fetch.
- It also contradicts the actual code when it claims `shared/types.ts` uses type-only exports cleanly; it misses the runtime `ErrorCode` export that Opus caught.
- Its endpoint/error-contract analysis is ambitious, but confidence is undermined by those mistakes.

### What I would take from it

- The rigor around test realism and vacuous assertions.
- The discipline of calling out contract-format issues explicitly.
- The quality of its test-assessment narrative.
- I would keep those parts, but only after re-validating every high-severity claim.

---

## Best Single Synthesis

If I were producing one final “best of all four” review, I would combine them like this:

### Core findings to keep

From **gpt54-codex**:
- AC-2.4b tree keyboard reachability gap
- AC-10.2 deleted-root invalid-state gap
- bootstrap blank-page failure path
- `PUT /api/session/root` accepts files
- `POST /api/session/workspaces` accepts nonexistent paths

From **opus**:
- `shared/types.ts` runtime export leakage risk
- AC-by-AC traceability matrix style
- endpoint inventory style
- test-plan-vs-actual-count analysis

From **gpt52**:
- compact requested-check summary style
- concise framing of the most important contract issues

From **sonnet**:
- explicit labeling of vacuous tests
- the stronger test-quality critique language
- contract-format scrutiny, but only after re-validation

### Report shape I would use

1. Executive summary with 4-6 top findings only
2. Severity-ordered findings
3. AC coverage summary split into:
   - fully implemented and meaningfully tested
   - implemented but weakly tested
   - partially implemented
4. Endpoint contract table
5. Test quality section distinguishing:
   - real behavior tests
   - proxy tests
   - vacuous / shallow tests
6. Final requested-check summary table

### Final judgment on the four reports

- **Best primary review:** `gpt54-codex`
- **Best supporting audit appendix:** `opus`
- **Best compact executive summary companion:** `gpt52`
- **Best source of test-quality critique, but not reliable enough to anchor on:** `sonnet`

---

## Recommendation

If one review needs to be treated as the canonical base, use **gpt54-codex** and merge in:

- the `shared/types.ts` finding and AC matrix discipline from **opus**
- the concise summary formatting from **gpt52**
- the vacuous-test language from **sonnet**

That combination would produce the strongest single verification artifact: accurate, severity-focused, traceable, and honest about where the current tests prove real behavior versus where they only gesture at it.
