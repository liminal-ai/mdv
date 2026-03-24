# isomorphic-dompurify -- Package Status Report (March 2025)

## Summary

isomorphic-dompurify is actively maintained and remains the recommended wrapper for using DOMPurify in isomorphic (server + browser) environments. DOMPurify itself (cure53) has **not** added native isomorphic support -- its README still directs users to isomorphic-dompurify for that use case. The package saw a burst of activity in early 2025 with a major v3.0.0 release (Feb 21) followed by rapid iteration to v3.6.0 (Mar 21). Weekly downloads are in the 1.2M--2M range depending on the tracking source.

## 1. Version Status

| Question | Answer |
|----------|--------|
| Latest stable version | **3.6.0** (released March 21, 2025) |
| Is 3.5.1 current? | **No.** 3.5.1 was a bugfix release on March 17, 2025 (fixed outdated build artifacts in 3.5.0). It was superseded by 3.6.0 four days later. |

### Recent version timeline (2025)

- **3.0.0** (Feb 21) -- Major: ESM support, memory leak fixes
- **3.1.0** (Mar 9) -- Dependency updates
- **3.2.0** (Mar 12) -- DOMPurify bump
- **3.3.0** (Mar 12) -- Dependency updates
- **3.4.0** (Mar 17) -- jsdom v29, Node.js requirement update, perf improvements
- **3.5.0** (Mar 17) -- Factory function support
- **3.5.1** (Mar 17) -- Fix outdated build artifacts from 3.5.0
- **3.6.0** (Mar 21) -- Updated dependencies (jsdom, @types/jsdom, Biome)

## 2. Security Advisories

No vulnerabilities have been filed directly against isomorphic-dompurify itself. However, because it wraps DOMPurify, upstream DOMPurify CVEs are inherited. The relevant recent advisories:

### CVE-2025-15599 -- SAFE_FOR_XML Bypass (MEDIUM, CVSS 6.1)
- **Affected:** DOMPurify 3.1.3 through 3.2.6 (and 2.5.3 through 2.5.8)
- **Fixed in:** DOMPurify 3.2.7
- **Impact:** Attackers can include closing rawtext tags in attribute values to break out of rawtext contexts and execute JavaScript
- **Action:** Ensure isomorphic-dompurify resolves to DOMPurify >= 3.2.7

### CVE-2025-26791 -- Template Literal mXSS (MODERATE, CVSS 4.5)
- **Affected:** DOMPurify < 3.2.4
- **Fixed in:** DOMPurify 3.2.4
- **Impact:** Incorrect template literal regex when SAFE_FOR_TEMPLATES is true allows mXSS
- **Action:** Ensure DOMPurify >= 3.2.4

### CVE-2024-47875 -- Nesting-based mXSS
- **Affected:** DOMPurify < 2.5.0, and 3.0.0 through 3.1.2
- **Fixed in:** DOMPurify 3.1.3

### CVE-2024-45801 -- Prototype Pollution
- **Affected:** DOMPurify < 2.5.4, and < 3.1.3
- **Fixed in:** DOMPurify 2.5.4, 3.1.3

**Current DOMPurify latest is 3.3.3.** isomorphic-dompurify 3.6.0 should pull in a patched DOMPurify, but verify your lockfile resolves to >= 3.2.7 to be safe against all known CVEs.

## 3. NPM Weekly Downloads

Tracking sources report varying figures (measurement methodology differs):

- **~2.0M/week** (Snyk)
- **~1.9M/week** (Socket.dev)
- **~1.2M/week** (npm trends)

For context, DOMPurify itself gets roughly 10-12M weekly downloads, so isomorphic-dompurify represents a significant fraction of the DOMPurify ecosystem.

## 4. Maintenance Status

| Metric | Value |
|--------|-------|
| Last publish | March 21, 2025 (v3.6.0) |
| Total releases | 90 |
| GitHub stars | ~566 |
| Dependents | ~34,500 projects |
| Open issues | 2 (as of report date) |
| Primary maintainer | kkomelin |
| License | MIT |

**Open issues:**
1. **#395** -- Node.js circular dependency warning at runtime via jsdom (Feb 2026)
2. **#394** -- `ERR_REQUIRE_ESM: require() of ES Module @exodus/bytes` (Feb 2026) -- ESM/CJS compatibility issue with jsdom@28+

The jsdom ESM compatibility issue (#394) is notable: jsdom@28 pulls in an ESM-only dependency that breaks `require()` in environments like Next.js on Vercel. The documented workaround is pinning jsdom to 25.0.1. This may have been addressed by the v3.4.0+ releases which upgraded to jsdom v29.

## 5. DOMPurify Native Isomorphic Support

**DOMPurify has NOT added native isomorphic support.** The DOMPurify README (cure53/DOMPurify) explicitly states:

> "Running DOMPurify on the server requires a DOM to be present... Usually, jsdom is the tool of choice"

The DOMPurify README still recommends isomorphic-dompurify as the simplified approach for server-side integration. The manual alternative requires importing jsdom yourself, creating a window instance, and passing it to DOMPurify -- which is exactly what isomorphic-dompurify automates.

**isomorphic-dompurify remains the recommended wrapper** for isomorphic usage.

## 6. Recommendation

For a project using isomorphic-dompurify:

- **Upgrade to 3.6.0** to get the latest DOMPurify patches and jsdom v29 support
- **Verify your lockfile** resolves DOMPurify to >= 3.2.7 (covers all known CVEs)
- **Be aware of the ESM issue** if you are in a CommonJS/Next.js environment -- test that `require()` works in your deployment target
- The package is actively maintained, widely adopted, and still the canonical solution for isomorphic DOMPurify usage

## Sources

- [GitHub: kkomelin/isomorphic-dompurify](https://github.com/kkomelin/isomorphic-dompurify) -- Primary source, README and releases
- [GitHub: kkomelin/isomorphic-dompurify/releases](https://github.com/kkomelin/isomorphic-dompurify/releases) -- Release history and changelogs
- [GitHub: cure53/DOMPurify](https://github.com/cure53/DOMPurify) -- Upstream DOMPurify README confirming no native isomorphic support
- [CVE-2025-15599 / GHSA Advisory](https://advisories.gitlab.com/pkg/npm/dompurify/CVE-2025-15599/) -- SAFE_FOR_XML bypass, fixed in DOMPurify 3.2.7
- [CVE-2025-26791 / GHSA-vhxf-7vqr-mrjg](https://github.com/advisories/GHSA-vhxf-7vqr-mrjg) -- Template literal mXSS, fixed in DOMPurify 3.2.4
- [CVE-2024-47875 / GHSA-gx9m-whjm-85jf](https://github.com/advisories/GHSA-gx9m-whjm-85jf) -- Nesting-based mXSS
- [Snyk: isomorphic-dompurify](https://security.snyk.io/package/npm/isomorphic-dompurify) -- Vulnerability database and download stats
- [npm trends: isomorphic-dompurify](https://npmtrends.com/isomorphic-dompurify) -- Download trend data

## Confidence Assessment

- **Overall confidence: High** -- Data sourced from GitHub releases (primary), multiple vulnerability databases, and the upstream DOMPurify repository
- **Area of uncertainty:** Exact weekly download count varies by source (1.2M--2M range); npm's own page returned a 403 so I could not get the canonical number
- **Minor note:** The open issues (#394, #395) reference dates in Feb 2026 which may reflect the GitHub page's rendering at fetch time; the substance of the ESM/jsdom compatibility concern is real regardless of exact date
