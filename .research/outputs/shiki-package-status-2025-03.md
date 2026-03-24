# Shiki Package Status Research — March 2025

**Research date:** 2025-03-23

---

## Summary

Shiki is actively maintained and recently underwent a major version bump from 3.x to 4.0. Version **4.0.2** is the latest stable release as of March 2025, published on March 9, 2025. The v3-to-v4 upgrade is intentionally minimal — it drops Node.js 18 support and removes a handful of deprecated/misspelled APIs. The `@shikijs/markdown-it` package versions in lockstep with the main `shiki` package (also at 4.0.2). The project is healthy with ~3-4 million weekly downloads and active maintenance by Anthony Fu (antfu).

---

## Key Findings

- **Latest stable version:** `shiki@4.0.2` (released March 9, 2025)
- **4.0.2 is current.** There are no newer versions as of this research date.
- **`@shikijs/markdown-it` is also at 4.0.2** — all `@shikijs/*` packages version together in the monorepo.
- **v3-to-v4 migration is trivial** — no functional changes, only cleanup of deprecated APIs and a Node.js version floor bump.
- **Weekly downloads:** ~2.9–4.1 million (sources vary by measurement window)
- **Last publish:** March 9, 2025 (14 days before this research)
- **Depended on by:** ~415,000 projects

---

## Detailed Analysis

### 1. Version History (Recent)

| Version | Date | Notes |
|---------|------|-------|
| 4.0.2 | 2025-03-09 | Bug fix: ANSI language with multiple themes |
| 4.0.1 | 2025-03-02 | Bug fix: dts bundle issues |
| 4.0.0 | 2025-02-27 | **Major**: Drop Node 18, remove deprecated APIs, new packages |
| 3.23.0 | 2025-02-25 | Grammar/theme updates, CLI stdin support |
| 3.22.0 | 2025-01-30 | Grammar/theme updates |

### 2. Breaking Changes: v3.x to v4.0

The v4.0 release is explicitly designed as a cleanup release, not a feature release. From the official migration guide:

> "v4.0 only drops support for Node.js 18 and removes deprecated APIs, so you should be able to directly bump to v4.0."

**Specific removals:**

1. **`CreatedBundledHighlighterOptions`** (typo) — use `CreateBundledHighlighterOptions`
2. **`createdBundledHighlighter`** (typo) — use `createBundledHighlighter`
3. **`theme` option in `TwoslashFloatingVue`** — use `themes` (plural)
4. **CSS class `twoslash-query-presisted`** (typo) — use `twoslash-query-persisted`
5. **Node.js 18** — minimum is now Node.js >= 20

**New in v4.0.0:**
- `@shikijs/primitive` — leaner sub-package
- `@shikijs/markdown-exit` — new package

### 3. `@shikijs/markdown-it` Package

- **Latest version:** 4.0.2
- **Versions in sync:** All `@shikijs/*` packages are published from the same monorepo and share version numbers.
- Note: Some npm index caches may show stale version "3.20.0" but jsDelivr and the GitHub releases confirm 4.0.2 is published.

### 4. Download Statistics

| Metric | Value | Source |
|--------|-------|--------|
| Weekly downloads (shiki) | ~2.9M – 4.1M | npm / npmtrends |
| GitHub stars | 13,100+ | GitHub |
| Dependents | ~415,000 | GitHub |
| Open issues | 68 | GitHub |

### 5. Maintenance Status

- **Primary maintainer:** Anthony Fu (antfu) — prolific open-source author (also maintains Vitest, UnoCSS, Slidev, etc.)
- **npm maintainers:** antfu, orta, octref, shiki-deploys
- **Last publish:** March 9, 2025
- **Release cadence:** Very active. Multiple releases per month throughout 2024-2025.
- **Total releases:** 151
- **Commit count:** 2,656+ on main branch

The project is in excellent health by all standard maintenance signals.

---

## Sources

- [Shiki on npm](https://www.npmjs.com/package/shiki) — Package registry listing
- [@shikijs/markdown-it on npm](https://www.npmjs.com/package/@shikijs/markdown-it) — Sub-package listing
- [GitHub Releases — shikijs/shiki](https://github.com/shikijs/shiki/releases) — Full release history, confirmed v4.0.2 as latest
- [Shiki Migration Guide](https://shiki.style/guide/migrate) — Official v3-to-v4 migration docs
- [Shiki v4.0 Blog Post](https://shiki.style/blog/v4) — Breaking changes and rationale
- [GitHub Repository — shikijs/shiki](https://github.com/shikijs/shiki) — Stars, issues, maintenance signals
- [npmtrends.com/shiki](https://npmtrends.com/shiki) — Download trend data
- [jsDelivr — @shikijs/markdown-it](https://www.jsdelivr.com/package/npm/@shikijs/markdown-it) — Version verification, confirmed 4.0.2

---

## Confidence Assessment

- **Overall confidence:** High
- **Version numbers (4.0.2):** Confirmed across GitHub releases, jsDelivr, and npm search snippets.
- **Breaking changes:** Confirmed via official migration guide and blog post. The list is small and well-documented.
- **Download numbers:** Medium confidence — different sources report 2.9M to 4.1M weekly. The variance is likely due to measurement window differences. The order of magnitude is solid.
- **`@shikijs/markdown-it` version parity:** Confirmed via jsDelivr; initial npm search results showed a stale cached value (3.20.0) which was contradicted by the CDN's version listing.
