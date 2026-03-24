# Mermaid NPM Package — Current Status (March 2025)

Research conducted: 2026-03-23 (data reflects state as of research date)

---

## Summary

Mermaid 11.13.0 is the latest stable release, published on **March 9, 2025**. The package is actively maintained, broadly adopted (~2.2M weekly npm downloads, ~86.9k GitHub stars), and licensed under MIT. The 11.x line has been stable, with no major breaking changes between minor versions. The most significant known pain point relevant to vanilla JS usage is **theme switching / re-rendering**, which has been an unresolved design gap since 2021 — Mermaid lacks a first-class API for changing themes on already-rendered diagrams. A documented workaround exists (clear `data-processed`, restore original source, re-call `initialize` + `run`).

---

## 1. Latest Stable Version

| Field               | Value                          |
|---------------------|--------------------------------|
| **Latest version**  | 11.13.0                        |
| **Published**       | March 9, 2025                  |
| **License**         | MIT                            |
| **Commits in release** | 274 to develop branch       |

Version 11.13.0 introduced:
- New diagram types: Venn (beta), Ishikawa / fishbone (beta)
- Half-arrowhead support
- Notes within namespaces in classDiagram
- Deprecation of `flowchart.htmlLabels` in favor of root-level `htmlLabels`
- Fixed gantt chart text color readability in dark mode
- Fixed SVG `viewBox` casing for responsive behavior
- 20+ bug fixes across diagram types

As of the research date (March 2026), version **11.13.0 remains current** — no newer stable release has been published to the main `mermaid` package since March 9, 2025. The `@mermaid-js/parser` sub-package shipped v1.0.0 in February 2025 with a major Langium v4 upgrade (requires TypeScript >= 5.8.0).

---

## 2. Is 11.13.0 Current?

**Yes.** 11.13.0 is the latest release on both npm and GitHub. The prior release was 11.12.2 (December 2, 2024). The develop branch remains active (14,404 total commits, 248 open PRs), suggesting ongoing work toward a future release but no newer stable tag.

---

## 3. Known Issues Relevant to Your Use Case

### 3a. Client-Side Rendering in Vanilla JS (No Framework)

No open issues specifically block vanilla JS client-side rendering. The standard API (`mermaid.initialize()` + `mermaid.run()`) works in browser environments without a framework. However:

- **Issue #6124** — The official "Mermaid with Text Area" CodePen example is broken for re-rendering. Calling `mermaidAPI.render()` a second time on the same container fails to update. Root cause: the render call does not properly clear the previous diagram instance.
- **Issue #6370** — `mermaid.parse()` returns inconsistent results between Node.js and browser environments (returns `false` in Node, truthy in browser for identical input). Relevant if you do any server-side validation.

**Practical guidance**: For vanilla JS, use `mermaid.run({ querySelector: '.mermaid' })` rather than direct `mermaidAPI.render()` calls. When re-rendering, you must manually reset the DOM element (remove `data-processed` attribute, restore original text content) before calling `run()` again.

### 3b. Theme Switching / Re-Rendering

This is the **most significant known gap**. Multiple open issues dating back years:

| Issue | Title | Opened | Status |
|-------|-------|--------|--------|
| **#1945** | Reinitialize with new theme | Mar 2021 | Open, untriaged |
| **#2644** | Light mode/dark mode auto switching | Jan 2022 | Open, needs triage |
| **#6677** | Accept CSS variables for theme | Jun 2025 | Approved, not yet implemented |
| **#7144** | Support automatic light/dark switching in exports | Nov 2025 | Needs discussion |
| **#7173** | Hard-coded styles in SVGs | Recent | Open |

**Key finding from #1945**: `mermaid.mermaidAPI.reinitialize()` was **non-functional** — its implementation was commented out as far back as v8.9.2. There is no official API to change themes on rendered diagrams.

**Known workaround** (from issue #1945, user @barockok):
1. Before initial render, persist the original Mermaid source text for each diagram
2. When theme changes, for each diagram element:
   - Remove the `data-processed` attribute
   - Restore the original source text as the element's `textContent`
3. Call `mermaid.initialize({ theme: 'dark' })` (or whichever theme)
4. Call `mermaid.run()`

This effectively forces a full re-parse and re-render. It works but is not efficient for large numbers of diagrams.

**Issue #6677** (CSS variables for theming) is the most promising future fix — it was approved and labeled "Good first issue" — but has not been implemented yet.

### 3c. Performance of Rendering Small Diagrams

No open issues report performance problems with small diagrams specifically. The search for `performance render slow` returned no directly relevant results. Observations:

- Mermaid's dependency footprint is significant: D3 v7, Cytoscape, dagre-d3-es, KaTeX, DOMPurify, Marked, Rough.js. The bundle is heavy.
- The **initial load/parse** cost is non-trivial due to these dependencies, but individual small diagram renders are generally fast once the library is loaded.
- Issue #2169 (Canvas/SVG renderer, opened 2021) proposes alternative renderers that could improve performance, but it remains unimplemented.
- The v11.12.2 release specifically fixed a UI freeze/crash bug in Gantt diagrams caused by invalid date/tick intervals — indicating the team does address performance-critical issues when they arise.
- For the theme-switch-via-re-render workaround, re-rendering small diagrams should be acceptably fast (sub-second for typical flowcharts/sequence diagrams).

---

## 4. NPM Weekly Downloads

| Metric | Value |
|--------|-------|
| **Weekly downloads** | ~2,200,000 |
| **Trend** | Growing significantly — from ~200K/day (early 2025) to peaks of 800K+/day (early 2026) |
| **Peak single-day** | 812,219 (March 16, 2026) |
| **Ecosystem status** | Classified as "Key ecosystem project" by npm |

---

## 5. Maintenance Status

| Metric | Value |
|--------|-------|
| **Last publish** | March 9, 2025 (11.13.0) |
| **Total commits** | 14,404 |
| **GitHub stars** | ~86,900 |
| **Open issues** | ~1,400-1,600 |
| **Open PRs** | 248 |
| **Age** | 11 years |
| **Security advisories** | 5 tracked |
| **CI/CD** | Active — build CI, Codecov, Argos visual regression |
| **Community** | Discord server, active PR activity on develop branch |

The project is **actively maintained** with continuous development on the `develop` branch. The high open issue count (1,400+) is typical for a project of this scale and popularity. The gap between 11.12.2 (Dec 2024) and 11.13.0 (Mar 2025) — about 3 months — is a normal release cadence. The fact that no release has shipped since March 2025 (12 months ago as of research date) is worth noting, though the develop branch remains active.

---

## Sources

- [GitHub Releases — mermaid-js/mermaid](https://github.com/mermaid-js/mermaid/releases) — Primary source for version history and dates
- [npm registry API — mermaid/latest](https://registry.npmjs.org/mermaid/latest) — Version, license, dependencies
- [npmtrends.com/mermaid](https://npmtrends.com/mermaid) — Download statistics and trends
- [GitHub Issue #1945 — Reinitialize with new theme](https://github.com/mermaid-js/mermaid/issues/1945) — Theme switching workaround
- [GitHub Issue #6677 — Accept CSS variables for theme](https://github.com/mermaid-js/mermaid/issues/6677) — Approved enhancement for CSS variable theming
- [GitHub Issue #6124 — CodePen re-render broken](https://github.com/mermaid-js/mermaid/issues/6124) — Re-rendering problem documentation
- [GitHub Issue #2644 — Light/dark auto switching](https://github.com/mermaid-js/mermaid/issues/2644) — Long-standing theme switching request
- [GitHub mermaid-js/mermaid](https://github.com/mermaid-js/mermaid) — Stars, issues, maintenance indicators
- [npmjs.com/package/mermaid](https://www.npmjs.com/package/mermaid) — Package page (download count cross-reference)
- [mermaid v11.13.0 release notes](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4011.13.0) — Detailed changelog

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Version number & date | **High** | Confirmed via both GitHub releases and npm registry API |
| Download counts | **High** | Cross-referenced npmtrends and npm search results |
| Theme switching issues | **High** | Multiple corroborating issues, workaround tested by community |
| Vanilla JS compatibility | **Medium-High** | No blocking issues found, but the re-render API is clunky |
| Performance of small diagrams | **Medium** | No issues filed, but no benchmarks found either; inference based on architecture |
| Maintenance status | **High** | Direct observation of GitHub activity indicators |

### Areas of Uncertainty

- The 12-month gap since last release (March 2025 to present) could indicate a shift in release cadence or a large upcoming release — unclear from available data.
- Performance characteristics for small diagrams are inferred, not measured. The bundle size impact on initial load is real but not quantified here.
- The CSS variable theming feature (#6677) was approved but the timeline is unknown.
