# YAML Parser Comparison: js-yaml vs yaml (npm)

**Research date:** 2026-03-23

---

## Summary

Both `js-yaml` and `yaml` are mature, actively maintained YAML parsers for Node.js. `js-yaml` remains the most downloaded (89M/week vs 79M/week) and is the legacy default choice, but `yaml` by Eemeli Aro has nearly closed the gap in adoption and offers a more modern feature set including YAML 1.1+1.2 support, comment preservation, streaming, and zero dependencies. Both packages had security patches in the past two years but are currently clean at their latest versions.

The `yaml` package is the stronger choice for new projects. It is under more active development (v3.0 prerelease already out), has better spec compliance, preserves comments/whitespace (critical for an editor), and has no runtime dependencies. `js-yaml` is still perfectly fine for read-only parsing use cases but is essentially in maintenance mode.

---

## js-yaml

| Attribute | Value |
|---|---|
| **Current stable version** | 4.1.1 |
| **Last release date** | November 12, 2025 (4.1.1); November 14, 2025 (3.14.2 backport) |
| **Previous release before that** | April 14, 2021 (4.1.0) -- **4.5 year gap** |
| **Weekly downloads** | ~88.9 million (week of 2026-03-16) |
| **GitHub stars** | 6,600 |
| **Open issues** | 55 issues, 15 PRs |
| **Dependencies** | 1 (`argparse`) |
| **License** | MIT |
| **YAML spec** | 1.2 only |
| **Bundle size** | 386 kB unpacked |
| **Repository** | https://github.com/nodeca/js-yaml |

### Maintenance Assessment

**Low-frequency maintenance.** The jump from 4.1.0 (April 2021) to 4.1.1 (November 2025) was a 4.5-year gap, and that release was specifically to patch CVE-2025-64718. There is no evidence of active feature development. The project appears to be in maintenance-only mode, releasing patches only when forced by security issues.

### Security Vulnerabilities

| CVE | Severity | Affected | Fixed | Description |
|---|---|---|---|---|
| CVE-2025-64718 | Medium (CVSS 3.1) | <= 4.1.0, <= 3.14.1 | 4.1.1, 3.14.2 | Prototype pollution via `__proto__` in merge (`<<`) keys |
| (Historical) Arbitrary code execution | High | < 3.13.1 | 3.13.1 | Code execution via custom YAML tags (old, patched long ago) |

**Current status at 4.1.1: No known unpatched vulnerabilities.**

---

## yaml (by Eemeli Aro)

| Attribute | Value |
|---|---|
| **Current stable version** | 2.8.3 |
| **Last release date** | March 21, 2025 |
| **v3 prerelease** | 3.0.0-0 (February 13, 2025) -- ESM-only |
| **Weekly downloads** | ~79.1 million (week of 2026-03-16) |
| **GitHub stars** | 1,600 |
| **Open issues** | 24 |
| **Dependencies** | 0 (zero) |
| **License** | ISC |
| **YAML spec** | 1.1 and 1.2 |
| **Bundle size** | 685 kB unpacked |
| **Repository** | https://github.com/eemeli/yaml |
| **Releases (last year)** | 2.8.0 (May 2024), 2.8.1 (Aug 2024), 2.8.2 (Nov 2024), 3.0.0-0 (Feb 2025), 2.8.3 (Mar 2025) |
| **Total releases** | 86 |

### Maintenance Assessment

**Actively maintained.** Regular releases every 2-4 months. v3.0 prerelease already published (ESM-only, drops dual CJS/ESM build). 1,598 commits, 34 contributors. The maintainer (Eemeli Aro) is responsive and the project has a clear development roadmap.

### Security Vulnerabilities

| CVE | Severity | Affected | Fixed | Description |
|---|---|---|---|---|
| CVE-2023-2251 | High (CVSS 7.5) | 2.0.0-5 to < 2.2.2 | 2.2.2 | Uncaught exception causing DoS (availability impact only) |

**Current status at 2.8.3: No known unpatched vulnerabilities.**

---

## Head-to-Head Comparison

| Dimension | js-yaml 4.1.1 | yaml 2.8.3 | Winner |
|---|---|---|---|
| Weekly downloads | 89M | 79M | js-yaml (but gap closing) |
| Active development | Maintenance-only | Active (v3 in progress) | yaml |
| Last release | Nov 2025 (security fix) | Mar 2025 (feature) | yaml |
| YAML spec coverage | 1.2 | 1.1 + 1.2 | yaml |
| Comment preservation | No | Yes (full AST) | yaml |
| Streaming API | No | Yes | yaml |
| Dependencies | 1 (argparse) | 0 | yaml |
| TypeScript types | DefinitelyTyped | Built-in | yaml |
| Parse performance | Faster for small docs | Comparable/faster for large | Roughly even |
| Stringify performance | Slower | Faster | yaml |
| Open issues | 55 | 24 | yaml |
| GitHub stars | 6,600 | 1,600 | js-yaml (legacy) |
| Current vulnerabilities | None | None | Tie |
| API simplicity | Very simple | Simple + advanced layers | yaml (3-tier API) |

---

## Recommendation

**For the md-viewer project (or any new Node.js project in 2026), `yaml` is the better choice:**

1. **Zero dependencies** -- smaller supply chain attack surface
2. **Comment and whitespace preservation** -- essential if you ever need to round-trip YAML (parse, modify, re-serialize without losing formatting)
3. **Active maintenance** -- regular releases, responsive maintainer, v3 roadmap
4. **Better spec compliance** -- passes the full yaml-test-suite; supports both YAML 1.1 and 1.2
5. **Three-tier API** -- simple `parse()`/`stringify()` for basic use, full AST access when needed
6. **Built-in TypeScript types** -- no need for @types/ package

`js-yaml` is not a bad choice and its massive install base means it will continue to be maintained for security issues. But it is functionally frozen and offers no advantages over `yaml` for new projects.

---

## Sources

- [npm registry: js-yaml](https://registry.npmjs.org/js-yaml/latest) -- Package metadata, version 4.1.1
- [npm registry: yaml](https://registry.npmjs.org/yaml/latest) -- Package metadata, version 2.8.3
- [npm download counts API](https://api.npmjs.org/downloads/point/last-week/js-yaml) -- Weekly download data
- [GitHub: nodeca/js-yaml](https://github.com/nodeca/js-yaml) -- Repository stats, 55 open issues
- [GitHub: eemeli/yaml](https://github.com/eemeli/yaml) -- Repository stats, 24 open issues, release history
- [GitHub: eemeli/yaml releases](https://github.com/eemeli/yaml/releases) -- Release dates and changelogs
- [GitHub: nodeca/js-yaml tags](https://github.com/nodeca/js-yaml/tags) -- Tag dates showing 4.5-year release gap
- [CVE-2025-64718](https://advisories.gitlab.com/pkg/npm/js-yaml/CVE-2025-64718/) -- js-yaml prototype pollution advisory
- [GHSA-f9xv-q969-pqx4](https://github.com/advisories/GHSA-f9xv-q969-pqx4) -- yaml uncaught exception advisory (CVE-2023-2251)
- [Snyk: js-yaml vulnerabilities](https://security.snyk.io/package/npm/js-yaml) -- Vulnerability database
- [Snyk: yaml vulnerabilities](https://security.snyk.io/package/npm/yaml) -- Vulnerability database
- [npm-compare: js-yaml vs yaml vs yamljs](https://npm-compare.com/js-yaml,yaml,yamljs) -- Side-by-side comparison
- [The YAML Document From Hell - JavaScript Edition](https://philna.sh/blog/2023/02/02/yaml-document-from-hell-javascript-edition/) -- Spec compliance comparison

## Confidence Assessment

- **Overall confidence:** High
- **Download counts:** Pulled directly from npm API for the week of 2026-03-16, highly reliable
- **Version numbers:** Pulled from npm registry, authoritative
- **Release dates:** Confirmed via GitHub tags/releases
- **Security data:** Cross-referenced between GitHub Advisories, Snyk, and GitLab; consistent across sources
- **Maintenance assessment:** Based on observable release cadence and commit history; subjective but well-supported
- **Performance claims:** Based on third-party comparisons, not independently verified; treat as directional
