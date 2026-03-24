# File Pattern Matching Libraries for Spec Artifact Detection

**Date:** 2026-03-23
**Context:** Epic 13 — Package and Spec Awareness — needs to detect Liminal Spec artifact types from navigation entry names and file paths.

---

## Summary

For the specific patterns needed by Epic 13's artifact detection, a glob matching library is unnecessary overhead. The patterns are finite, enumerable, and simple enough that `path.basename()` combined with literal string comparisons and one or two trivial regexes will cover every case cleanly. Adding minimatch, picomatch, or micromatch would introduce a dependency (with real security surface area — minimatch had a High-severity ReDoS CVE in 2026) to solve a problem that doesn't exist: the artifact patterns aren't user-supplied globs, they're a fixed, known set of filename conventions.

## The Actual Patterns (from Epic 13)

| Artifact Type | Patterns to Match |
|---------------|-------------------|
| `prd` | `prd.md`, `product-requirements.md`, entries containing "PRD" |
| `epic` | `epic.md`, `epic-*.md`, `feature-spec.md` |
| `tech-design` | `tech-design.md`, `technical-design.md`, `technical-architecture.md` |
| `stories` | `stories/` directory, `story-*.md`, files in a `stories` group |
| `implementation` | Not detected from files — declared metadata only |

These are:
- 6 exact filename matches (`prd.md`, `product-requirements.md`, `epic.md`, `feature-spec.md`, `tech-design.md`, `technical-design.md`, `technical-architecture.md`)
- 2 prefix-wildcard patterns (`epic-*.md`, `story-*.md`) — trivially `name.startsWith('epic-') && name.endsWith('.md')`
- 1 directory name check (`stories/`)
- 1 substring check (entry containing "PRD")

No brace expansion, no globstars, no extglobs, no negation, no character classes.

## Library Assessment

### minimatch v10.2.4

- **Weekly downloads:** ~260-470M (varies by source; most downloaded of the three)
- **Last published:** ~1 month ago
- **Dependencies:** 1 (brace-expansion)
- **Status:** Actively maintained by isaacs (npm author)
- **Security:** CVE-2026-26996 — High severity (CVSS 8.7) ReDoS vulnerability via repeated wildcards. Affects versions <10.2.1, <9.0.6, <4.2.4, etc. Patched in 10.2.1+. This is a recurring pattern — minimatch has had multiple ReDoS CVEs over the years.
- **Bundle size:** ~15KB minified (older measurement)
- **Transitive in project:** Yes, v3.1.5 already in node_modules (pulled in by eslint), but that's the legacy branch

### picomatch v4.0.3

- **Weekly downloads:** ~130-220M
- **Last published:** ~7 months ago
- **Dependencies:** 0 (zero dependencies)
- **Status:** Maintained under the micromatch org
- **Security:** No known ReDoS vulnerabilities. Uses a different regex generation strategy that avoids catastrophic backtracking. Has internal limits on brace expansion.
- **Bundle size:** ~20KB minified (older measurement)
- **Notes:** Used by chokidar (which is already in the project's dependencies), so likely already in the dependency tree transitively

### micromatch v4.0.8

- **Weekly downloads:** ~78-118M
- **Last published:** ~2 years ago
- **Dependencies:** 2 (braces, picomatch)
- **Status:** Less actively maintained. Last release was a security backport.
- **Security:** CVE-2024-4067 — ReDoS vulnerability, fixed in 4.0.8. The fix was a backport.
- **Bundle size:** Larger than picomatch (it wraps picomatch + braces)
- **Notes:** Superset of picomatch with additional features (negation, brace expansion, set matching). More API surface than needed.

## Recommendation: No Library Needed

**Use `path.basename()` + plain string/regex matching.**

Here's why:

1. **The pattern set is closed.** These aren't user-supplied globs. They're a fixed, known list of artifact conventions defined by the Liminal Spec format. When the patterns change, you change the detection code — not a glob string.

2. **The "wildcards" are trivial.** `epic-*.md` is `name.startsWith('epic-') && name.endsWith('.md')`, or `/^epic-.+\.md$/`. No library needed.

3. **Security surface area is real.** minimatch has had multiple ReDoS CVEs, including one in 2026. Every glob library that compiles user strings to regexes carries this risk. Since these patterns aren't user-supplied, there's zero reason to accept that risk.

4. **Performance is irrelevant at this scale.** The epic spec says artifact detection must complete in <100ms for packages with up to 100 navigation entries. Even the most naive string matching approach will do this in microseconds.

5. **Dependencies have costs.** Adding a library means tracking CVEs, version upgrades, and transitive dependency changes — all for functionality you can write in ~30 lines.

### Example Implementation Sketch

```typescript
import { basename, dirname } from 'node:path';

type ArtifactType = 'prd' | 'epic' | 'tech-design' | 'stories';

const EXACT_MATCHES: Record<string, ArtifactType> = {
  'prd.md': 'prd',
  'product-requirements.md': 'prd',
  'epic.md': 'epic',
  'feature-spec.md': 'epic',
  'tech-design.md': 'tech-design',
  'technical-design.md': 'tech-design',
  'technical-architecture.md': 'tech-design',
};

function detectArtifactType(entryName: string, entryPath?: string): ArtifactType | null {
  const name = basename(entryName).toLowerCase();

  // Exact filename matches
  const exact = EXACT_MATCHES[name];
  if (exact) return exact;

  // Prefix-wildcard patterns
  if (name.startsWith('epic-') && name.endsWith('.md')) return 'epic';
  if (name.startsWith('story-') && name.endsWith('.md')) return 'stories';

  // Directory detection
  if (entryName === 'stories' || entryName.endsWith('/stories') || entryName.endsWith('/stories/')) {
    return 'stories';
  }

  // Substring check for PRD mentions (entry display name containing "PRD")
  if (entryName.toUpperCase().includes('PRD')) return 'prd';

  // Path-based: file inside a stories/ directory
  if (entryPath) {
    const dir = dirname(entryPath);
    if (basename(dir) === 'stories') return 'stories';
  }

  return null;
}
```

This is:
- Fully testable with simple unit tests
- Zero dependencies
- Zero ReDoS risk (no regex compilation from external input)
- Trivially extensible (add a line to the map or an `if` clause)
- Obviously correct on inspection

### When You Would Need a Library

A glob library would become justified if:
- Users can define custom artifact detection patterns (user-supplied globs)
- The pattern set grows to dozens of complex patterns with negation, brace expansion, or character classes
- You need `.gitignore`-style matching semantics (negation, ordering, directory matching)

None of these apply to the current Epic 13 scope. If they arise later, **picomatch** would be the best choice: zero dependencies, no known ReDoS vulnerabilities, and it's already in the transitive dependency tree via chokidar.

## Sources

- [minimatch on GitHub](https://github.com/isaacs/minimatch) — Primary repo, actively maintained
- [picomatch on GitHub](https://github.com/micromatch/picomatch) — Zero-dependency, ReDoS-resistant
- [micromatch on GitHub](https://github.com/micromatch/micromatch) — Wraps picomatch, less actively maintained
- [CVE-2026-26996 (minimatch ReDoS)](https://github.com/advisories/GHSA-3ppc-4f35-3m26) — High severity, CVSS 8.7, affects most minimatch versions
- [CVE-2024-4067 (micromatch ReDoS)](https://github.com/advisories/GHSA-952p-6rrq-rcjv) — Fixed in 4.0.8
- [npm trends comparison](https://npmtrends.com/glob-vs-micromatch-vs-minimatch-vs-picomatch) — Download and version comparison data
- Epic 13 spec (`docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md`) — Artifact detection patterns table, lines 890-905

## Confidence Assessment

- **Overall confidence:** High
- **Library version/download data:** Medium-High (numbers vary across tracking services; versions confirmed from multiple sources)
- **Security assessment:** High (CVEs are documented in GitHub Advisory Database)
- **Recommendation:** High confidence — the pattern set is explicitly enumerated in the epic spec and is clearly within the scope of simple string matching
