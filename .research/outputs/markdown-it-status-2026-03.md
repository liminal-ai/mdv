# markdown-it: Current Package Status (March 2026)

## Summary

`markdown-it` is at version **14.1.1**, published in February 2026. The package remains actively maintained by its long-standing maintainer (vitaly), receives nearly 10 million weekly downloads, and has no critical security vulnerabilities. Version 14.1.1 is indeed the latest version — there is no 15.x release.

## Key Findings

- **Latest stable version**: 14.1.1 (tagged February 11, 2026 on GitHub)
- **14.1.1 IS the latest** — no newer version exists
- **Weekly downloads**: ~9.85 million (week of March 16–22, 2026)
- **Sole maintainer**: vitaly (vitaly@rcdesign.ru)
- **Open issues**: 43, mostly edge-case parsing bugs and feature requests — no critical security issues

## Version History (14.x)

| Version | Date | Type |
|---------|------|------|
| 14.0.0 | 2023-12-08 | Major (ESM conversion, dropped old browser support) |
| 14.1.0 | 2024-03-19 | Minor (CommonMark 0.31.2 compat, quadratic complexity fixes) |
| 14.1.1 | 2026-02-11 | Patch (security fix for CPU exhaustion in linkify rule) |

### 14.0.0 Breaking Changes
- Codebase converted to ESM with CommonJS fallback
- Removed `dist/` folder from repo (builds happen at publish time)
- Dropped support for ancient browsers (uses `.fromCodePoint`, etc.)
- `punycode.js` set as external dependency
- HTML tokens in image alt text now render as plain text (not HTML)

### 14.1.0 Notable Fixes
- Quadratic complexity when parsing references
- Quadratic output size with pathological table input
- Updated CommonMark spec compatibility to 0.31.2

### 14.1.1 Security Fix
- Fixed regression from v13 in linkify inline rule where specific patterns could cause high CPU use (ReDoS-style)

## Maintenance Status

**Assessment: Moderately maintained, low-frequency updates**

- The gap between 14.1.0 (March 2024) and 14.1.1 (February 2026) is nearly two years, though the 14.1.1 patch shows the maintainer still responds to security issues.
- Single maintainer (vitaly) — this is a bus-factor risk.
- 43 open issues, some dating back years. The project accepts PRs but triage is slow.
- The `punycode` deprecation warning (Node.js) is a known annoyance tracked in issue #1065.

## Dependencies (14.1.1)

- `argparse` — CLI argument parsing
- `entities` — HTML entity encoding/decoding
- `linkify-it` — Link detection
- `mdurl` — URL utilities
- `uc.micro` — Unicode character categories

## Known Issues Worth Noting

1. **punycode deprecation warning** (#1065) — Node.js deprecation of the built-in `punycode` module surfaces warnings. Not a markdown-it bug per se, but affects DX.
2. **Non-BMP punctuation handling** (#1071) — `scanDelims` does not recognize non-BMP Unicode punctuation/symbols.
3. **Chinese punctuation in bold+list** (#1080) — Bold formatting fails when list items start with Chinese punctuation.
4. **HTML comment block parsing** (#1144) — Comments incorrectly ended before `-->`.

None of these are blockers for typical English-language Markdown rendering.

## Sources

- [npm registry API](https://registry.npmjs.org/markdown-it) — Package metadata, version history, maintainers
- [npm downloads API](https://api.npmjs.org/downloads/point/last-week/markdown-it) — Weekly download count
- [GitHub CHANGELOG.md](https://github.com/markdown-it/markdown-it/blob/master/CHANGELOG.md) — Version dates and change details
- [GitHub tags](https://github.com/markdown-it/markdown-it/tags) — Tag dates confirming publish timeline
- [GitHub issues](https://github.com/markdown-it/markdown-it/issues) — Open issue count and recent bugs

## Confidence Assessment

- **Overall confidence**: High — data sourced directly from npm registry and GitHub repository
- **Version number**: High confidence — confirmed via both npm dist-tags and GitHub tags
- **Download count**: High confidence — from official npm downloads API for the week ending March 22, 2026
- **Maintenance assessment**: Medium confidence — publish frequency is factual, but characterizing "moderately maintained" is subjective; the maintainer clearly responds to security issues even if slowly
