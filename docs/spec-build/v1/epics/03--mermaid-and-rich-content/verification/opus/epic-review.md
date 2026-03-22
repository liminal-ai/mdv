# Epic 3: Mermaid and Rich Content — Verification Review

**Reviewer:** Opus (epic-level verification)
**Date:** 2026-03-21
**Artifacts reviewed:** epic.md, tech-design.md, tech-design-api.md, tech-design-ui.md, test-plan.md
**Implementation files reviewed:** 10 source files, 6 test/fixture files
**Test run:** 100 tests passing across 3 test files

---

## Verdict

Epic 3 is well-implemented. All 19 ACs are covered. The implementation follows the tech design closely with minor justified deviations. The pipeline is clean, the type system flows correctly, and tests are thorough. No critical or major issues found.

---

## 1. AC Coverage

### Flow 1: Mermaid Diagram Rendering (AC-1.1 through AC-1.6)

| AC | Status | Implementation | Test |
|----|--------|----------------|------|
| AC-1.1 (diagrams render) | PASS | `renderMermaidBlocks()` in `mermaid-renderer.ts:121-153` finds `.mermaid-placeholder`, renders via Mermaid.js, replaces with SVG | TC-1.1a–h all tested; `it.each` for c–h |
| AC-1.2 (sizing) | PASS | `applySvgSizing()` at `mermaid-renderer.ts:27-37`: removes fixed width/height, sets `max-width: 100%`, `height: auto`. CSS in `mermaid.css:7-10` | TC-1.2a (wide), TC-1.2b (small/no upscale), TC-1.2c (tall/no truncation) |
| AC-1.3 (theme adaptation) | PASS | `getMermaidTheme()` at `mermaid-renderer.ts:39-42` maps `data-theme` prefix. `reRenderMermaidDiagrams()` at line 155. MutationObserver in `app.ts:1237-1247` | TC-1.3a, TC-1.3b, TC-1.3c |
| AC-1.4 (multiple diagrams) | PASS | Sequential `for` loop in `renderMermaidBlocks()` processes all placeholders | TC-1.4a (5 diagrams), TC-1.4b (mixed content) |
| AC-1.5 (placeholder replacement) | PASS | `placeholder.replaceWith(container)` in `replacePlaceholderWithSvg()` at line 86 | TC-1.5a |
| AC-1.6 (static diagrams) | PASS | `securityLevel: 'strict'` in `renderWithTimeout()` at line 52 | TC-1.6a (config verification), TC-1.6b (no interactive elements). Manual checklist item 14 covers actual behavior |

### Flow 2: Mermaid Error Handling (AC-2.1 through AC-2.3)

| AC | Status | Implementation | Test |
|----|--------|----------------|------|
| AC-2.1 (error fallback) | PASS | `replacePlaceholderWithError()` at `mermaid-renderer.ts:89-110` creates banner + raw source | TC-2.1a (syntax error), TC-2.1b (banner content), TC-2.1c (partial success), TC-2.1d (empty block) |
| AC-2.2 (warning count) | PASS | `createMermaidWarning()` at line 112 creates warning; merged in `content-area.ts:233-248` | TC-2.2a, TC-2.2b, TC-2.2c |
| AC-2.3 (non-blocking) | PASS | Sequential loop yields between diagrams; 5s timeout via `Promise.race` at `mermaid-renderer.ts:44-78` | TC-2.3a, TC-2.3b (fake timers) |

### Flow 3: Code Syntax Highlighting (AC-3.1 through AC-3.5)

| AC | Status | Implementation | Test |
|----|--------|----------------|------|
| AC-3.1 (highlighting) | PASS | Shiki via `fromHighlighter()` in `render.service.ts:89-98`, registered as markdown-it plugin | TC-3.1a–d |
| AC-3.2 (language support) | PASS | 17 languages in `shikiHighlighterPromise` at line 48-66; aliases in `langAlias` at line 67-73 | TC-3.2a (all 17), TC-3.2b (aliases) |
| AC-3.3 (fallback) | PASS | `md.options.highlight` returns `''` for empty/unknown languages at line 103-111 | TC-3.3a (no tag), TC-3.3b (unknown), TC-3.3c (indented) |
| AC-3.4 (theme adaptation) | PASS | Shiki `defaultColor: false` with dual themes; CSS in `markdown-body.css:166-180` switches via `data-theme` | TC-3.4a, TC-3.4b, TC-3.4c (CSS verification in JSDOM) |
| AC-3.5 (failure fallback) | PASS | Belt-and-suspenders try-catch at `render.service.ts:114-131` wraps Shiki fence renderer | TC-3.5a, TC-3.5b (mocked highlight throw) |

### Flow 4: Rich Table Content (AC-4.1 through AC-4.3)

| AC | Status | Implementation | Test |
|----|--------|----------------|------|
| AC-4.1 (inline markdown) | PASS | markdown-it baseline (Epic 2). No new code needed. | TC-4.1a (formatting), TC-4.1b (links), TC-4.1c (code spans) |
| AC-4.2 (stable layout) | PASS | CSS `table { display: block; overflow-x: auto; }` from Epic 2 | TC-4.2a (mixed widths), TC-4.2b (15 columns). TC-4.2c is manual-only (correctly documented) |
| AC-4.3 (graceful degradation) | PASS | markdown-it pipe-table parser limitation. HTML tables via `html: true` config. | TC-4.3a (list syntax → literal text), TC-4.3b (HTML table with `<ul>`), TC-4.3c (escaped pipes) |

### Flow 5: Error Handling (AC-5.1 through AC-5.2)

| AC | Status | Implementation | Test |
|----|--------|----------------|------|
| AC-5.1 (no crash) | PASS | Error isolation per diagram in `renderMermaidBlocks()` loop | TC-5.1a (multiple failure types), TC-5.1b (re-render error) |
| AC-5.2 (file watching) | PASS | Content area re-injects HTML on tab re-render; `renderMermaidBlocks()` runs on fresh placeholders | TC-5.2a (new diagram), TC-5.2b (language change) |

**All 19 ACs covered. 54 of 55 TCs automated; TC-4.2c manual-only (CSS/layout, not automatable in JSDOM).**

---

## 2. Contract Consistency

### RenderWarning Type Flow

```
server/schemas/index.ts (RenderWarningTypeSchema: includes 'mermaid-error')
  └→ shared/types.ts (re-exports)
      ├→ client/utils/mermaid-renderer.ts (imports RenderWarning)
      ├→ client/components/content-area.ts (imports RenderWarning)
      ├→ client/components/warning-panel.ts (imports RenderWarning, handles 'mermaid-error' case at line 24)
      └→ client/state.ts (TabState.warnings: RenderWarning[])
```

**Verdict:** Type flows correctly across all layers. The warning panel has a dedicated presentation for `'mermaid-error'` (icon: `⚠`, type: `'Mermaid error'`, detail shows `warning.message` instead of `warning.source`). This is correct per the data contract — for mermaid errors, the message is more useful than the (potentially truncated) source.

### MermaidRenderResult

Defined in `mermaid-renderer.ts:3-5`, consumed in `content-area.ts:222`. The `warnings` array is merged with server warnings using replace-not-append logic. Stale-write guard prevents corruption during async gaps.

**No contract inconsistencies found.**

---

## 3. Integration Gaps

### Pipeline Flow: End-to-End

```
Server: md.render() → [Shiki highlights code, skips mermaid]
        → processMermaidBlocks() → [wraps mermaid in .mermaid-placeholder]
        → processImages() → [rewrites URLs, collects warnings]
        → DOMPurify.sanitize() → FileReadResponse { html, warnings }

Client: innerHTML = html → linkHandler.attach()
        → renderMermaidBlocks() → [find .mermaid-placeholder, render each, replace]
        → merge warnings into TabState → toolbar warning count updates
```

**Verified:** No dead steps or stubs. Every pipeline stage is exercised by tests.

### Critical Safeguards

1. **Replace-not-append warnings** (`content-area.ts:233-236`): Correctly filters `type !== 'mermaid-error'` before merging. Prevents duplication on re-render.
2. **Stale-write guard** (`content-area.ts:224-226`): Captures `renderingTabId` before `await`, checks `activeTabId` after. Correctly discards results if tab switched during async render.
3. **Warning equality check** (`content-area.ts:237-239`): `warningsEqual()` prevents unnecessary state updates/re-renders.
4. **Theme re-render** (`mermaid-renderer.ts:155-183`): Only re-renders `.mermaid-diagram` (success), skips `.mermaid-error` (failed diagrams don't retry on theme change — correct per tech design).
5. **Source preservation** (`mermaid-renderer.ts:83`): `data-mermaid-source` attribute persists raw source for theme re-rendering.

### Dead Test Fixtures

5 fixture variables are defined but never imported in any test file:

| Fixture | File | Concern |
|---------|------|---------|
| `unknownTypeMermaid` | `mermaid-samples.ts:83` | Defined for unknown diagram types, but Mermaid error handling is already tested via TC-2.1a with mocked `render()` throws |
| `complexFlowchartMermaid` | `mermaid-samples.ts:92` | Stress test fixture for 50 nodes, but Mermaid is mocked so complexity doesn't matter in tests |
| `multiDiagramMarkdown` | `mermaid-samples.ts:97` | Complete markdown document with 3 diagrams — could be used for server-side placeholder tests, but TC-1.4a tests multiple diagrams via the client |
| `mixedContentMarkdown` | `mermaid-samples.ts:118` | Document with mermaid + code + images — could be used for TC-5.1a server-side |
| `tableWithFormattingAndLinksMarkdown` | `markdown-samples.ts:171` | Duplicate of `tableWithFormattingMarkdown` |

**Verdict:** Not integration gaps — these are test-fixture cleanup items. The coverage provided by the tests that do exist is sufficient.

---

## 4. Security

### securityLevel: 'strict'

**Configured:** `mermaid-renderer.ts:52` — `securityLevel: 'strict'` is set in every `renderWithTimeout()` call (before both initial renders and theme re-renders).

**What 'strict' does:** Strips all `click` event bindings, prevents JavaScript execution from diagram content, disables interactive features, produces static SVG only.

**Test coverage:** TC-1.6a verifies the config is passed. TC-1.6b verifies no `onclick`/`onmouseover`/`<a>` elements in the rendered container. Both are config-verification tests (Mermaid is mocked). Manual checklist item 14 covers actual behavior.

### DOMPurify Compatibility

Shiki output uses inline `style` attributes with CSS custom properties (`--shiki-light:#D73A49`). The test `TC-3.4a` verifies `--shiki-light` survives the full pipeline (including DOMPurify sanitization). The `<pre class="shiki" tabindex="0">` attributes also survive.

**Confirmed:** No DOMPurify configuration changes needed.

### Mermaid SVG Injection

The Mermaid SVG output is injected via `container.innerHTML = svg` in `replacePlaceholderWithSvg()` (line 84) and `reRenderMermaidDiagrams()` (line 177) **without DOMPurify sanitization**. This was a deliberate design decision documented in tech-design.md Q5, with the reasoning:

1. Mermaid's strict mode strips dangerous content
2. SVG inline doesn't have the same XSS surface as HTML
3. The SVG is scoped within `.markdown-body` CSS

**Assessment:** This is acceptable for v1. Mermaid.js is a trusted dependency and `securityLevel: 'strict'` is the highest sanitization setting. A defense-in-depth improvement would be to run `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })` on the output, but this would require adding DOMPurify to the client bundle (currently it's server-side only via `isomorphic-dompurify`). The risk/effort tradeoff is appropriate.

### No Remote Resource Fetching

Mermaid runs in-process in the browser. No network calls. Shiki runs server-side in-process. No external services.

---

## 5. Architecture Compliance

### Module Architecture vs. Tech Design

| Module | Tech Design | Implementation | Status |
|--------|------------|----------------|--------|
| `client/utils/mermaid-renderer.ts` | NEW | Present | MATCH |
| `client/styles/mermaid.css` | NEW | Present | MATCH |
| `server/services/render.service.ts` | MODIFIED: Shiki plugin | Modified correctly | MATCH |
| `server/schemas/index.ts` | MODIFIED: `'mermaid-error'` | Added at line 15 | MATCH |
| `client/components/content-area.ts` | MODIFIED: call mermaid renderer | Calls `renderMermaidBlocks()` at line 222 | MATCH |
| `client/app.ts` | MODIFIED: theme observer | MutationObserver at line 1237-1247 | MATCH |
| `client/styles/markdown-body.css` | MODIFIED: Shiki CSS rules | Added at lines 155-190 | MATCH |
| `esbuild.config.ts` | MODIFIED: splitting | `splitting: true`, `format: 'esm'` | MATCH |
| `client/components/warning-panel.ts` | Not in tech design explicitly | Handles `'mermaid-error'` type correctly | OK — natural extension |

### Noted Deviations (Non-Blocking)

1. **Mermaid exclusion mechanism:** Tech design specifies a Shiki `transformers[].preprocess` approach. Implementation uses `md.options.highlight` interception to return `''` for mermaid language. Both achieve the same result (mermaid blocks bypass Shiki, get standard `<pre><code>` output, then `processMermaidBlocks()` wraps them). The implementation approach is simpler and equally robust. **Functionally equivalent.**

2. **Shiki plugin import:** Tech design references `import markdownItShiki from '@shikijs/markdown-it'`. Implementation uses `import { fromHighlighter } from '@shikijs/markdown-it'` — `fromHighlighter` is the correct API for pre-created highlighters. **Better than designed.**

3. **RenderService async factory:** Tech design specifies `static async create()`. Implementation matches exactly at `render.service.ts:301-305`. **Exact match.**

4. **Export-specific rendering path:** `render.service.ts` includes `renderForExport()` at line 322 with per-theme Shiki configuration and layout hints. This is an Epic 4 addition layered on top of Epic 3's Shiki integration. Not specified in Epic 3 tech design but architecturally clean. **Acceptable evolution.**

---

## 6. Test Quality

### Test Strategy Assessment

| Aspect | Assessment |
|--------|------------|
| Mock boundaries | Correct: Mermaid mocked at import boundary (can't run in JSDOM), Shiki runs for real in server tests, filesystem mocked |
| TC-to-test mapping | All 54 automated TCs have corresponding tests. TC-4.2c correctly deferred to manual |
| Parameterized tests | `it.each` for TC-1.1c–h covers 6 diagram types efficiently |
| Timeout testing | TC-2.3b uses `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(5001)` — correct pattern |
| State isolation | `afterEach(() => cleanupDom())` and `vi.restoreAllMocks()` — proper cleanup |
| Integration tests | TC-5.1a tests mixed failure types in single DOM. TC-2.1c tests partial success (2 valid + 1 invalid). TC-5.1b/5.2a test re-render scenarios |

### False-Pass Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| TC-1.6a/b verify config, not actual Mermaid sanitization | Low | Manual checklist item 14 covers actual behavior. Config verification is the correct test-level assertion given the mock boundary. |
| Mermaid mock always returns same SVG | Low | Tests verify pipeline behavior (placeholder→container, error handling, warning collection), not diagram rendering quality. Diagram rendering quality is Mermaid.js's responsibility. |
| TC-3.4c JSDOM CSS verification limited | Low | `getComputedStyle()` in JSDOM confirms the CSS rules match. Actual visual rendering is manual checklist item 7. |

### Missing Non-TC Tests (Opportunities)

The following would strengthen coverage but are not required:

- Test that `complexFlowchartMermaid` (50 nodes) renders without issues in the pipeline (currently unused fixture — but since Mermaid is mocked, this test would be identical to any other render test)
- Test that `reRenderMermaidDiagrams()` is a no-op when no `.mermaid-diagram` elements exist (currently tested indirectly since the function returns early at line 162-164, but no explicit test)
- Server-side test with `multiDiagramMarkdown` to verify multiple mermaid placeholders are produced (currently tested via the client-side TC-1.4a)

---

## Finding Summary

### Critical

None.

### Major

None.

### Minor

| # | Finding | File | Spec Ref | Gap |
|---|---------|------|----------|-----|
| M1 | 5 unused test fixtures | `mermaid-samples.ts:83,92,97,118`, `markdown-samples.ts:171` | Test Plan fixture definitions | Dead code — defined in fixture files but never imported. `tableWithFormattingAndLinksMarkdown` is a duplicate of `tableWithFormattingMarkdown`. Cleanup opportunity. |
| M2 | Mermaid exclusion mechanism deviates from tech design | `render.service.ts:103-111` vs `tech-design-api.md` transformer approach | Tech Design §Mermaid Exclusion | Implementation uses `md.options.highlight` interception instead of `transformers[].preprocess`. Functionally equivalent but a design-to-implementation divergence. Tests confirm correctness. |

### Informational

| # | Finding | File | Notes |
|---|---------|------|-------|
| I1 | Mermaid SVG not DOMPurify-sanitized | `mermaid-renderer.ts:84,177` | Deliberate design decision (tech-design.md Q5). `securityLevel: 'strict'` provides primary defense. Adding client-side DOMPurify would improve defense-in-depth but requires bundling it client-side. |
| I2 | TC-1.6a/b are config-verification only | `mermaid-renderer.test.ts:210-229` | Tests verify `securityLevel: 'strict'` is passed to `mermaid.initialize()`. Actual SVG sanitization verified manually (checklist item 14). Correct given mock boundary. |
| I3 | Export rendering path layered onto Epic 3 Shiki integration | `render.service.ts:322-348` | `renderForExport()` with per-theme Shiki config and layout hints is an Epic 4 addition that piggybacks on Epic 3's Shiki setup. Clean layering, no architectural concerns. |
| I4 | `warningsEqual()` optimization | `content-area.ts:12-27` | Good optimization — prevents unnecessary state updates when warnings haven't changed. Reduces re-render churn. |
| I5 | stale-write guard is well-implemented | `content-area.ts:221-248` | The async gap between `renderMermaidBlocks()` and warning merge is correctly guarded. Tab ID is captured before `await`, verified after. |

---

## Test Counts

| Test File | Tests | Notes |
|-----------|-------|-------|
| `file.render.test.ts` | ~46 | Epic 2 + Epic 3 Shiki highlighting (18 Epic 3 additions) |
| `file.render-tables.test.ts` | 10 | All Epic 3 table ACs |
| `mermaid-renderer.test.ts` | ~44 | All mermaid ACs + integration TCs (it.each expands to 6) |
| **Total in these files** | **100** | All passing |

Epic 3 adds 60 test functions to the project (18 server + 10 table + 32 client). Combined with 263 from Epics 1-2, the project total is 323 tests. The 100 count above includes the pre-existing Epic 2 tests in `file.render.test.ts`.

---

## Conclusion

Epic 3 is implementation-complete and well-verified. The two minor findings (M1: unused fixtures, M2: deviation from designed mermaid exclusion approach) are cleanup items, not functional gaps. All ACs are satisfied, contracts are consistent, the pipeline is clean end-to-end, and tests are thorough with appropriate mock boundaries.
