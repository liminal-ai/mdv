# Epic 3 Verification Review — Mermaid and Rich Content

**Reviewer:** Claude Sonnet 4.6 (1M context)
**Date:** 2026-03-21
**Method:** Sequential spec read → implementation read → cross-referenced analysis

---

## Documents Reviewed

### Spec
1. `epic.md` — 19 ACs, 55 TCs across 5 flows
2. `tech-design.md` — Hybrid architecture (Shiki server-side, Mermaid client-side)
3. `tech-design-api.md` — Shiki plugin integration, schema extension, fallback strategy
4. `tech-design-ui.md` — Mermaid renderer, theme adaptation, CSS, content pipeline
5. `test-plan.md` — 60 tests, TC mapping, mock strategy, chunk breakdown

### Implementation
- `app/src/server/services/render.service.ts`
- `app/src/server/schemas/index.ts`
- `app/src/client/utils/mermaid-renderer.ts`
- `app/src/client/components/content-area.ts`
- `app/src/client/components/warning-panel.ts`
- `app/src/client/app.ts` (theme observer section)
- `app/src/client/styles/mermaid.css`
- `app/src/client/styles/markdown-body.css`
- `app/esbuild.config.ts`
- `app/tests/server/routes/file.render.test.ts`
- `app/tests/server/routes/file.render-tables.test.ts`
- `app/tests/client/utils/mermaid-renderer.test.ts`
- `app/tests/fixtures/mermaid-samples.ts`
- `app/tests/fixtures/markdown-samples.ts`
- `app/tests/utils/mermaid-dom.ts`

---

## AC Coverage Summary

All 19 ACs walked against implementation before severity classification.

| AC | Title | Coverage | Notes |
|----|-------|----------|-------|
| AC-1.1 | Mermaid blocks render as diagrams | ✅ Full | TC-1.1a–h via mocked render |
| AC-1.2 | Diagrams sized to fit content area | ✅ Full | CSS + `applySvgSizing()` removes fixed attrs |
| AC-1.3 | Diagrams adapt to active theme | ✅ Full | MutationObserver + `reRenderMermaidDiagrams` |
| AC-1.4 | Multiple blocks all render | ✅ Full | Sequential loop tested with 5 placeholders |
| AC-1.5 | Placeholders replaced by diagrams | ✅ Full | Regex-based placeholder wrapping + client replacement |
| AC-1.6 | Diagrams are static | ⚠️ Partial | Config-verification only; actual SVG output not tested |
| AC-2.1 | Failed blocks show error fallback | ✅ Full | TC-2.1a–d; banner + raw source in `<pre><code>` |
| AC-2.2 | Failures added to warning count | ⚠️ Partial | TC-2.2a verifies 1 mermaid warning; combined 3-total (spec) untested |
| AC-2.3 | Failures non-blocking | ✅ Full | TC-2.3a–b; timeout via fake timers |
| AC-3.1 | Language-tagged code blocks highlighted | ✅ Full | Real Shiki in server tests |
| AC-3.2 | 17 baseline languages + aliases | ✅ Full | TC-3.2a–b iterate all samples |
| AC-3.3 | Unknown/missing language → monospace | ✅ Full | TC-3.3a–c |
| AC-3.4 | Highlighting adapts to theme | ✅ Full | CSS dual-theme; TC-3.4a–c |
| AC-3.5 | Highlighting failure → silent fallback | ✅ Full | TC-3.5a–b (private field override) |
| AC-4.1 | Inline markdown in table cells | ✅ Full | TC-4.1a–c |
| AC-4.2 | Complex tables maintain stable layout | ✅ Partial | TC-4.2a–b; TC-4.2c manual-only |
| AC-4.3 | Unsupported table content degrades | ✅ Full | TC-4.3a–c |
| AC-5.1 | Rendering errors don't crash app | ✅ Full | TC-5.1a–b |
| AC-5.2 | File watching works with rich content | ✅ Full | TC-5.2a–b |

---

## Findings by Severity

### MAJOR

---

#### MAJOR-1: TC-1.6b is a structural false-pass

**File:** `app/tests/client/utils/mermaid-renderer.test.ts:220–229`
**Spec:** AC-1.6 (TC-1.6b — No hover interactivity)

The test verifies that the rendered mermaid diagram has no `[onclick]`, `[onmouseover]`, or anchor elements:

```typescript
const diagram = container.querySelector('.mermaid-diagram');
expect(diagram?.querySelector('[onclick]')).toBeNull();
expect(diagram?.querySelector('[onmouseover]')).toBeNull();
expect(diagram?.querySelector('a')).toBeNull();
```

The mock SVG injected in `beforeEach` is `<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>`. This simple geometry has no event handlers, so the assertions trivially pass — the test cannot distinguish between "Mermaid's strict mode stripped the click directives" and "the mock SVG never had them in the first place."

The test plan acknowledges this limitation (§TC Coverage, AC-1.6: "actual SVG output sanitization is verified manually, checklist item 14"), but the test is still labeled `TC-1.6b` without qualification in the test file. A reader of the test results has no indication that this AC is only partially automated.

**Risk:** A future code change that removes `securityLevel: 'strict'` would not cause TC-1.6b to fail, giving false confidence in the security posture.

**Remediation:** Add a comment to the test labeling it config-verification only. The manual checklist item 14 must be executed before each release. Consider adding a test that passes a mock SVG containing an `onclick` attribute and verifies it is absent after `replacePlaceholderWithSvg` — this would at least verify that the client-side code doesn't re-add event handlers, even if it can't verify Mermaid's internal sanitization.

---

#### MAJOR-2: TC-2.2a does not verify the combined warning count specified in the spec

**File:** `app/tests/client/utils/mermaid-renderer.test.ts:331–343`
**Spec:** AC-2.2 (TC-2.2a — "Given: 1 failed Mermaid block and 2 missing images → warning count shows 3")

The test:

```typescript
const result = await renderMermaidBlocks(container);
expect(result.warnings).toHaveLength(1);
```

The test verifies that `renderMermaidBlocks` returns 1 warning. The spec's TC-2.2a is specifically about the **combined** count of 3 (1 mermaid + 2 image warnings). That combined-count integration lives in `content-area.ts` (the merge logic: `serverWarnings + mermaidResult.warnings`), and there is **no automated test** for it.

The merge logic exists at `content-area.ts:233–248`:
```typescript
const serverWarnings = currentTab.warnings.filter(w => w.type !== 'mermaid-error');
const allWarnings = [...serverWarnings, ...mermaidResult.warnings];
```

This code is correct, but untested. The risk is that a future refactor breaks the merge without any test catching it.

**Remediation:** Add an integration test to `content-area.ts` (or a dedicated integration test file) that simulates a tab with 2 pre-existing image warnings plus a failed mermaid block, and verifies the resulting `tab.warnings` has all 3.

---

#### MAJOR-3: TC-2.1b user-select assertion is always true in JSDOM

**File:** `app/tests/client/utils/mermaid-renderer.test.ts:290`
**Spec:** AC-2.1 (TC-2.1b — "raw source is fully visible and selectable")

```typescript
expect(getComputedStyle(source as HTMLElement).userSelect).not.toBe('none');
```

In the JSDOM environment used for client tests, external CSS files are not loaded. The `mermaid.css` file — which sets `user-select: text` on `.mermaid-error__source` — is not applied. `getComputedStyle` returns `''` (empty string, not `'none'`), so the assertion `not.toBe('none')` always passes regardless of whether `user-select: text` is set.

**Risk:** The assertion provides no real coverage of TC-2.1b. If `user-select: none` were accidentally added to `.mermaid-error__source`, the test would not catch it.

**Remediation:** Either inject the mermaid.css content into the JSDOM environment as an inline style tag in the test (similar to how TC-3.4c injects Shiki CSS), or replace the computed-style check with a more direct assertion on the CSS class applied to the source element.

---

### MINOR

---

#### MINOR-1: Mermaid exclusion mechanism deviates from tech design

**File:** `app/src/server/services/render.service.ts:86–111`
**Spec:** `tech-design-api.md` §Mermaid Exclusion

The tech design specified mermaid exclusion via a Shiki **transformer preprocess hook**:

```typescript
// Design spec:
transformers: [{
  preprocess(code, options) {
    if (options.lang === 'mermaid') return undefined; // Skip
    return code;
  },
}]
```

The implementation uses a different mechanism: wrapping `md.options.highlight` to return `''` for mermaid and empty-language blocks:

```typescript
// Implementation (render.service.ts:103–111):
const shikiHighlight = md.options.highlight;
md.options.highlight = (code, lang, attrs) => {
  const normalizedLang = lang.trim().toLowerCase();
  if (!normalizedLang || normalizedLang === 'mermaid') return '';
  return shikiHighlight ? shikiHighlight(code, normalizedLang, attrs) : '';
};
```

**Functional impact:** The non-TC test "leaves mermaid blocks unhighlighted and wrapped in the placeholder container" (file.render.test.ts:691–696) passes, confirming mermaid exclusion works end-to-end. The `processMermaidBlocks` regex successfully matches the `<pre><code class="language-mermaid">` output.

**Mechanism:** This works because `fromHighlighter` from `@shikijs/markdown-it` sets `md.options.highlight` — the production code wraps this, so when Shiki's fence renderer calls `md.options.highlight` for mermaid blocks, it receives `''`, causing the fence renderer to fall through to plain `<pre><code>` output. The tests confirm this chain is correct.

**Assessment:** Functionally equivalent to the design, but architecturally different. The implementation approach is tightly coupled to an assumption about `fromHighlighter`'s internal behavior (that it calls `md.options.highlight`). If a future Shiki version changes this internals, the exclusion might silently break. The tech design's transformer approach, by contrast, intercepts at the plugin level and is more robust to internal changes.

**Remediation:** Document the deviation in a code comment explaining why the `md.options.highlight` wrap is used instead of the transformer approach, and note the dependency on `fromHighlighter`'s call chain.

---

#### MINOR-2: TC-3.5a/b use private field access via TypeScript cast

**File:** `app/tests/server/routes/file.render.test.ts:633–675`
**Spec:** AC-3.5

```typescript
const markdownIt = (
  renderService as RenderService & {
    markdownIt: { options: { highlight?: (...args: unknown[]) => string } };
  }
).markdownIt;
markdownIt.options.highlight = () => { throw new Error('forced shiki failure'); };
```

The tests access the private `markdownIt` field via a TypeScript type cast. This works at runtime (JavaScript doesn't enforce privacy), but:
1. If the field is renamed (e.g., to `md`), TypeScript won't catch the breakage because of the cast.
2. The approach is fragile to refactors that change the internal field structure.

**Functional impact:** The tests do verify the correct fallback path. When `md.options.highlight` throws, the production try-catch in the fence renderer wrapper catches it and falls back to `originalFence`. The test correctly confirms that `pre.shiki` is absent and `pre > code.language-javascript` is present. No false-pass risk here — the test verifies real behavior.

**Remediation:** Consider exposing a `@internal` test hook method on `RenderService`, or use `vi.spyOn` at the module level to intercept the Shiki plugin call. Lower priority since the test is functionally correct.

---

#### MINOR-3: `withRenderedFile` helper is duplicated across two test files

**File:** `app/tests/server/routes/file.render.test.ts:82–125` and `app/tests/server/routes/file.render-tables.test.ts:62–105`
**Spec:** `test-plan.md` §Mock Strategy ("Epic 3 tests use the same helper")

The test plan says the tables test uses the "existing `withRenderedFile()` helper from Epic 2." Instead, the tables test file defines its own identical copy. The two definitions are byte-for-byte the same.

**Risk:** If the helper needs to change (e.g., new mocking needed, different app setup), it must be updated in two places. One copy could drift from the other.

**Remediation:** Extract `withRenderedFile` to a shared test utility (e.g., `tests/utils/render-helper.ts`) imported by both test files.

---

#### MINOR-4: No integration test for MutationObserver theme switch path

**File:** `app/src/client/app.ts:1237–1247`
**Spec:** AC-1.3c (TC-1.3c)

TC-1.3c (`mermaid-renderer.test.ts:153–164`) tests theme switch by directly calling `reRenderMermaidDiagrams()` after `setTheme()`. It does not test the MutationObserver path — the path where `document.documentElement.dataset.theme` changes, the observer fires, and calls `reRenderMermaidDiagrams()`.

The observer setup in `app.ts:1237–1247` is not covered by any automated test. This means that if the observer were accidentally disconnected, removed, or had the wrong `attributeFilter`, TC-1.3c would still pass.

**Risk:** Low — the observer setup is simple and visually obvious. The test does verify the called function's behavior. The gap is in the wiring, not the function.

**Remediation:** Add a lightweight test that simulates an attribute mutation on `document.documentElement` and verifies `reRenderMermaidDiagrams` is called (using a spy). This would require testing the `app.ts` bootstrap path, which may not be practical in the current test architecture.

---

#### MINOR-5: `tableWithFormattingAndLinksMarkdown` is dead code in markdown-samples.ts

**File:** `app/tests/fixtures/markdown-samples.ts:171–176`

A fixture `tableWithFormattingAndLinksMarkdown` is exported but identical to `tableWithFormattingMarkdown` (lines 164–169). It is not imported by any test file reviewed.

**Remediation:** Remove the duplicate export.

---

#### MINOR-6: TC-3.4c computed style verification has limited JSDOM fidelity

**File:** `app/tests/client/utils/mermaid-renderer.test.ts:393–425`
**Spec:** AC-3.4c

The test injects a `<style>` tag and asserts:
```typescript
expect(tokenStyles.color).toBe('var(--shiki-dark)');
expect(tokenStyles.backgroundColor).toBe('var(--shiki-dark-bg)');
```

JSDOM has partial CSS custom property support. The `color: var(--shiki-dark) !important` rule in the injected style will set `color` to the literal string `'var(--shiki-dark)'` in computed styles (since `--shiki-dark` is not defined as a custom property on the element). This means the test verifies that the CSS selector matches and the `var()` reference is applied — but not that the variable actually resolves to a color value.

**Assessment:** This is an acceptable approximation for JSDOM-based tests. Visual theme switching is inherently a browser concern. The test confirms the correct CSS selector activates for `[data-theme^="dark"]`, which is the important structural guarantee.

---

### INFORMATIONAL

---

#### INFO-1: `langAlias` is explicitly configured in `createHighlighter` rather than relying on automatic registration

**File:** `app/src/server/services/render.service.ts:67–73`
**Spec:** `tech-design-api.md` §Language aliases (TC-3.2b)

The tech design stated: "Shiki automatically registers common aliases when a language is loaded." The implementation explicitly sets `langAlias` in `createHighlighter`:

```typescript
langAlias: {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  yml: 'yaml',
},
```

This is a positive deviation — explicit configuration is more reliable than depending on Shiki's internal alias registration, which could change between versions. TC-3.2b tests pass, confirming aliases work correctly.

---

#### INFO-2: `renderForExport` in render.service.ts with mermaid placeholder pass-through

**File:** `app/src/server/services/render.service.ts:322–348`

`renderForExport` (added for Epic 4) calls `processMermaidBlocks`, producing mermaid placeholders in the export HTML. Since the export pipeline is server-side and has no browser DOM, these placeholders are never rendered into SVGs by the client-side mermaid renderer.

This is the expected behavior at this stage — the tech design (Q1) explicitly deferred server-side Mermaid rendering to Epic 4: "For Epic 4 export, the export pipeline will need its own Mermaid rendering strategy." The placeholders in exported output are a known intermediate state.

**Observation:** Exported documents (PDF/DOCX) will show the placeholder text "Mermaid diagram (rendering available in a future update)" rather than rendered diagrams until Epic 4 adds server-side Mermaid rendering. This is a user-visible limitation that should be documented or communicated.

---

#### INFO-3: SVG inserted via innerHTML without DOMPurify in `replacePlaceholderWithSvg`

**File:** `app/src/client/utils/mermaid-renderer.ts:80–87`
**Spec:** `tech-design.md` Q5 (Security)

```typescript
container.innerHTML = svg;
```

The tech design deliberated this choice: `securityLevel: 'strict'` is trusted to strip dangerous content from Mermaid's SVG output. No additional DOMPurify pass is applied.

For a local-only viewer rendering trusted documents from the user's own filesystem, this risk level is appropriate. The trust boundary is the markdown file — if an attacker can control the markdown file, they have filesystem access and this is moot. Still, the choice should remain documented in the code (currently it is not — there's no comment explaining why DOMPurify is intentionally skipped here).

**Remediation:** Add a comment in `replacePlaceholderWithSvg` or `renderWithTimeout` explaining that DOMPurify is intentionally omitted for the SVG because `securityLevel: 'strict'` handles sanitization, per Q5 of the tech design.

---

#### INFO-4: AC-2.2b — warning panel does not surface the `line` field

**File:** `app/src/client/components/warning-panel.ts:31–35`
**Spec:** AC-2.2 (TC-2.2b — "The warning panel lists the Mermaid error with type, error description, and line number if available")

The `RenderWarning` interface includes an optional `line` field. The warning panel's `getWarningDetail` function returns only `warning.message` for mermaid errors — the `line` field is never displayed. Since mermaid warnings are client-side and the markdown line number is lost after server rendering (acknowledged in the tech design), no mermaid warnings currently have a `line` value.

**Current impact:** Zero — no mermaid warning will ever have `line` set. The "if available" clause in AC-2.2b is never satisfied in practice.

**Future impact:** If a future enhancement adds line tracking (e.g., the server encodes line positions in placeholder attributes), the panel UI will not display it without a separate change.

**Remediation:** Low priority. Add a `line` display path to `getWarningDetail` when `warning.line` is defined, so it's ready when line tracking is added.

---

## Contract Consistency

### RenderWarning Type Flow

```
schemas/index.ts
  RenderWarningTypeSchema z.enum([..., 'mermaid-error']) ✓
  → RenderWarning (inferred type, exported)
      → shared/types.ts (re-exports via export type *)
          → mermaid-renderer.ts (imports RenderWarning from shared/types) ✓
          → content-area.ts (imports RenderWarning from shared/types) ✓
          → warning-panel.ts (imports RenderWarning from shared/types) ✓
```

**Status: Correct.** The `mermaid-error` type literal flows correctly from the Zod schema through the shared types module to all consumers. No type mismatch.

### MermaidBlockResult Interface

The epic's `MermaidBlockResult` interface (defined in data contracts) is not present as a standalone TypeScript interface in the implementation. Instead, the mermaid renderer uses `{ svg: string }` inline for the success result. This is a minor deviation — the interface is merged into the function signature rather than declared separately. No functional gap.

### RenderWarning Source Truncation

Epic spec: "truncated to the first 200 characters if the source exceeds 200 characters, with '...' appended."

Implementation (`mermaid-renderer.ts:113`):
```typescript
const truncatedSource = source.length > 200 ? `${source.slice(0, 200)}...` : source;
```

Maximum length: 203 characters. Test verifies this (Non-TC: source truncated at 200 chars, line 487: `expect(result.warnings[0]?.source.length).toBeLessThanOrEqual(203)`). ✓

---

## Integration and Dead Code Analysis

**No dead code found** in the implementation files. All exported functions from `mermaid-renderer.ts` are consumed:
- `renderMermaidBlocks` → `content-area.ts`
- `reRenderMermaidDiagrams` → `app.ts`
- Helper functions (`getMermaidTheme`, `renderWithTimeout`, `replacePlaceholderWithSvg`, `replacePlaceholderWithError`, `createMermaidWarning`) are exported for testing.

**Pipeline end-to-end flow verified:**
1. Server: `markdown-it` + Shiki plugin → code blocks highlighted → mermaid blocks pass through → `processMermaidBlocks` wraps in `.mermaid-placeholder` → DOMPurify → response ✓
2. Client: `innerHTML` inject → `linkHandler.attach` → `renderMermaidBlocks` → placeholder → SVG or error fallback ✓
3. Theme switch: `applyTheme` → `data-theme` attribute → MutationObserver fires → `reRenderMermaidDiagrams` (code highlighting adapts via CSS) ✓
4. File watch reload: full `innerHTML` replace → fresh `renderMermaidBlocks` call → stale-write guard protects tab state ✓

**Stale-write guard correctly implemented** (`content-area.ts:221–226`):
```typescript
const renderingTabId = activeTab.id;
const mermaidResult = await renderMermaidBlocks(markdownBody);
const currentState = store.get();
if (currentState.activeTabId !== renderingTabId) return;
```
Additional guard: checks `currentTab` still exists in the tab list (`content-area.ts:228–231`). ✓

**Replace-not-append correctly implemented** (`content-area.ts:233–236`):
```typescript
const serverWarnings = currentTab.warnings.filter(w => w.type !== 'mermaid-error');
const allWarnings = [...serverWarnings, ...mermaidResult.warnings];
```
Prevents duplicate mermaid warnings on re-renders. ✓

**`warningsEqual` optimization** (`content-area.ts:12–27`): Skips unnecessary state updates when warnings haven't changed. Not in the tech design — this is a positive addition.

---

## Security Assessment

| Concern | Implementation | Status |
|---------|---------------|--------|
| Mermaid XSS via click directives | `securityLevel: 'strict'` in every `mermaid.initialize()` call | ✓ Correct |
| Mermaid XSS via SVG innerHTML | Trusts Mermaid's strict mode; no DOMPurify on SVG | ✓ Design decision (Q5), acceptable for local viewer |
| Shiki XSS via code content | Shiki doesn't execute code; output is CSS-variable spans | ✓ Safe |
| Mermaid source XSS in placeholder | Server HTML-escapes mermaid source in `<code>` element | ✓ Verified by non-TC test (file.render.test.ts:709–716) |
| Shiki output through DOMPurify | `style` attributes with CSS custom properties survive DOMPurify | ✓ Verified by tech design (no config changes needed) |
| `suppressErrors: true` in mermaid config | Set in every `mermaid.initialize()` call | ✓ Prevents mermaid from throwing uncaught errors |
| `logLevel: 'fatal'` in mermaid config | Set in every `mermaid.initialize()` call | ✓ Suppresses console noise |

**One documentation gap:** No code comment in `replacePlaceholderWithSvg` explaining the deliberate omission of DOMPurify on the SVG. Risk of future developer adding an "obvious fix" that adds DOMPurify to SVG when it's not needed, or conversely missing why it's not there.

---

## Architecture Compliance

| Design Decision | Implementation | Compliant? |
|----------------|---------------|-----------|
| Shiki as async markdown-it plugin | `fromHighlighter` + async `createRenderer` | ✓ |
| `RenderService.create()` async factory | Lines 301–305 | ✓ |
| esbuild `splitting: true`, `format: 'esm'` | `esbuild.config.ts:11–13` | ✓ |
| Mermaid via `import()` dynamic import | `mermaid-renderer.ts:13` | ✓ |
| `startOnLoad: false` | `renderWithTimeout` line 51 | ✓ |
| `securityLevel: 'strict'` | `renderWithTimeout` line 52 | ✓ |
| Sequential rendering loop | `renderMermaidBlocks` for-of loop | ✓ |
| `data-mermaid-source` preserved | `replacePlaceholderWithSvg` line 83 | ✓ |
| MutationObserver on `data-theme` | `app.ts:1237–1247` | ✓ |
| `attributeFilter: ['data-theme']` | `app.ts:1246` | ✓ |
| Source truncated at 200 chars | `createMermaidWarning` line 113 | ✓ |
| Shiki dual-theme CSS variables | `markdown-body.css:167–179` | ✓ |
| `!important` on Shiki color rules | CSS lines 171–172, 178–179 | ✓ |
| `[data-theme^="light/dark"]` prefix match | CSS lines 169, 176 | ✓ |
| Mermaid excluded from Shiki | `md.options.highlight` wrap (deviation from transformer approach) | ⚠️ Works, deviates |
| Timeout via `Promise.race` | `renderWithTimeout:60–70` | ✓ |
| Timeout cleanup via `clearTimeout` | `renderWithTimeout:73–75` | ✓ (improvement over design) |

---

## Test Quality Assessment

| TC | Test Approach | Quality |
|----|--------------|---------|
| TC-1.1a–h | Mocked render → placeholder replaced → SVG present | ✅ Sound (tests DOM replacement, not Mermaid internals) |
| TC-1.2a–c | SVG attribute and style assertions | ✅ Sound |
| TC-1.3a–b | `mermaid.initialize` called with correct theme arg | ✅ Sound |
| TC-1.3c | Direct call to `reRenderMermaidDiagrams` after `setTheme` | ⚠️ Doesn't test observer trigger path |
| TC-1.4a–b | 5 placeholders → 5 diagrams; surrounding content unchanged | ✅ Sound |
| TC-1.5a | Placeholder absent, diagram present | ✅ Sound |
| TC-1.6a | `mermaid.initialize` called with `securityLevel: 'strict'` | ✅ Config-verified |
| TC-1.6b | Mock SVG has no event handlers | ❌ False-pass (MAJOR-1) |
| TC-2.1a–c | Mock throw → error fallback DOM present | ✅ Sound |
| TC-2.1b | `userSelect` check | ❌ Always passes in JSDOM (MAJOR-3) |
| TC-2.1d | Empty source → error fallback | ✅ Sound |
| TC-2.2a | 1 warning returned by `renderMermaidBlocks` | ⚠️ Doesn't test combined 3-total (MAJOR-2) |
| TC-2.2b | Warning type and message fields | ✅ Sound |
| TC-2.2c | No warnings for success | ✅ Sound |
| TC-2.3a | Surrounding content preserved on failure | ✅ Sound |
| TC-2.3b | Fake timers + never-resolving promise | ✅ Sound and thorough |
| TC-3.1a–d | Real Shiki integration, token spans present | ✅ Excellent (real integration) |
| TC-3.2a–b | All 17 languages + 5 aliases produce `pre.shiki` | ✅ Excellent |
| TC-3.3a–c | No `.shiki` class for monospace cases | ✅ Sound |
| TC-3.4a–b | CSS variables present in HTML output | ✅ Sound |
| TC-3.4c | Injected CSS + computed style in JSDOM | ⚠️ Limited JSDOM fidelity (MINOR-6) |
| TC-3.5a–b | Private field override → fallback | ⚠️ Fragile access but functionally correct (MINOR-2) |
| TC-4.1a–c | Real markdown-it rendering, element presence | ✅ Sound |
| TC-4.2a–b | Column count assertions | ✅ Sound |
| TC-4.3a–c | Cell content and structure assertions | ✅ Sound |
| TC-5.1a–b | Multiple failure types, re-render scenarios | ✅ Sound |
| TC-5.2a–b | Add diagram / change language on re-render | ✅ Sound |

**Non-TC tests quality:** The non-TC tests (source truncation, data-mermaid-source, error isolation) are high-quality and cover important implementation invariants not captured by ACs.

---

## Summary

Epic 3 is **substantially complete and functionally correct**. The implementation covers all 19 ACs with only partial gaps in AC-1.6 and AC-2.2. The architecture matches the tech design in all meaningful respects, with the mermaid exclusion mechanism being the only structural deviation (functionally confirmed correct by tests).

The primary test quality concerns are two false-pass tests (TC-1.6b and TC-2.1b) and one incomplete integration test (TC-2.2a). These should be addressed before the epic is marked fully verified.

| Severity | Count | Items |
|----------|-------|-------|
| Critical | 0 | — |
| Major | 3 | MAJOR-1 (TC-1.6b false-pass), MAJOR-2 (TC-2.2a combined count), MAJOR-3 (TC-2.1b always-passes) |
| Minor | 6 | MINOR-1 (mermaid exclusion deviation), MINOR-2 (private field access), MINOR-3 (helper duplication), MINOR-4 (no observer test), MINOR-5 (dead fixture), MINOR-6 (JSDOM fidelity) |
| Informational | 4 | INFO-1 (langAlias explicit), INFO-2 (export placeholder), INFO-3 (SVG innerHTML comment), INFO-4 (line field in panel) |

**Verification verdict:** Pass with required follow-up on MAJOR-1, MAJOR-2, MAJOR-3 before final sign-off.
