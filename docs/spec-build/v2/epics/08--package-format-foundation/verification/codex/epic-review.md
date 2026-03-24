# Epic 8 — Package Format Foundation: Codex Code Review

**Reviewer:** OpenAI Codex CLI (gpt-5.4, reasoning: medium)
**Session:** `019d1da6-b831-7762-a478-438d73c6e274`
**Date:** 2026-03-23
**Tokens:** 1,105,619 in / 10,177 out (1,002,624 cached)

---

## Scope

Full critical review of Epic 8 implementation against:
- `docs/spec-build/v2/epics/08--package-format-foundation/epic.md`
- `docs/spec-build/v2/epics/08--package-format-foundation/tech-design.md`

Files reviewed:
- **Source (14 files):** `src/pkg/types.ts`, `errors.ts`, `index.ts`, `cli.ts`, `manifest/parser.ts`, `manifest/scaffold.ts`, `tar/create.ts`, `tar/extract.ts`, `tar/inspect.ts`, `tar/list.ts`, `tar/manifest.ts`, `tar/read.ts`, `tar/shared.ts`, `render/index.ts`
- **Tests (10 files):** `tests/pkg/manifest-parser.test.ts`, `create-package.test.ts`, `extract-package.test.ts`, `inspect-package.test.ts`, `read-document.test.ts`, `render-library.test.ts`, `cli.test.ts`, `pkg-foundation.test.ts`, `fixtures/manifests.ts`, `fixtures/workspaces.ts`

---

## Critical (Blocks Release)

### C1: Symlink file escape in extraction

**File:** `src/pkg/tar/extract.ts` (~L179)
**Issue:** Extraction validates `path.dirname(outputPath)` via `realpath()` but writes directly to `outputPath`. If the destination file is a pre-existing symlink pointing outside `outputDir`, `writeFile()` follows it, writing content to an arbitrary external location. This was reproduced: extracting `docs/guide.md` overwrote an external target file outside the extraction root.
**Spec Reference:** AC-3.6, TC-3.6a, TC-3.6b; tech design Package Extraction (`PATH_TRAVERSAL` requirement)
**Recommendation:** Before writing, `lstat` the final `outputPath` — if it exists and is a symlink, reject with `PATH_TRAVERSAL`. Alternatively, open with `O_NOFOLLOW` semantics. Add a regression test for pre-existing symlinked file targets.

---

## Major (Should Fix Before Release)

### M1: `mdvpkg info` output incomplete

**File:** `src/pkg/cli.ts` (~L61)
**Issue:** The `info` command prints only a small metadata subset plus format/file count. It never prints the navigation tree, does not show `author`, `type`, or `status` fields, and does not emit a "no metadata" indication when metadata is absent.
**Spec Reference:** AC-4.1, TC-4.1a, TC-4.1b, AC-4.2, TC-4.2a, TC-4.2b; tech design Flow 4 / `inspectPackage()` used by CLI info
**Recommendation:** Render all manifest metadata fields, print an explicit empty-metadata state, and format the parsed navigation tree with indentation and group/file distinctions.

### M2: Wrong error code for display-name lookup without manifest

**File:** `src/pkg/tar/read.ts` (~L65)
**Issue:** `readDocument({ target: { displayName } })` returns `FILE_NOT_FOUND` when the package has no manifest. The tech design's error contract explicitly reserves `MANIFEST_NOT_FOUND` for this case — a distinct error code indicating the operation can't proceed because `_nav.md` is missing, not that the file doesn't exist.
**Spec Reference:** Tech design Error Contract (`MANIFEST_NOT_FOUND` for `readDocument` by display name), `readDocument()` contract in Interface Definitions
**Recommendation:** Throw `PackageErrorCode.MANIFEST_NOT_FOUND` when display-name lookup cannot proceed because `_nav.md` is missing. Add a dedicated test.

### M3: CLI test coverage gaps

**File:** `tests/pkg/cli.test.ts` (~L82)
**Issue:** The subprocess suite never validates `info`, `ls`, `read`, or `manifest` happy paths, and never covers the spec's "`mdvpkg` with no arguments shows help" path. This gap is why the incomplete `info` implementation (M1) currently passes all tests.
**Spec Reference:** TC-6.1a, AC-4.1, AC-4.2, AC-4.4, AC-5.1, AC-5.2, AC-7.1
**Recommendation:** Add end-to-end CLI assertions for all six commands, including exact `info` formatting and the no-args help behavior.

### M4: Missing symlink file extraction test

**File:** `tests/pkg/extract-package.test.ts` (~L332)
**Issue:** Security tests cover `..` traversal, absolute paths, and a symlinked directory, but not the more dangerous pre-existing symlinked file case. The current suite misses a real escape vector (see C1).
**Spec Reference:** AC-3.6, TC-3.6a, TC-3.6b
**Recommendation:** Add a test where `outputDir/safe/file.md` is a symlink to an external file and assert extraction fails with `PATH_TRAVERSAL`.

---

## Minor (Nice to Fix)

### m1: Extra public API exports

**File:** `src/pkg/index.ts` (~L20)
**Issue:** The public API exports `MERMAID_DIAGRAM_TYPES` and `NotImplementedError`, neither of which appears in the tech design's `src/pkg/index.ts` contract.
**Spec Reference:** Tech design Public API section
**Recommendation:** Keep those internal unless intentionally part of the supported API; if so, update the tech design.

### m2: No-args help exits non-zero

**File:** `src/pkg/cli.ts` (~L125)
**Issue:** Running `mdvpkg` with no arguments prints help but exits non-zero under Commander's default behavior. The spec treats "`mdvpkg --help` or `mdvpkg` with no arguments" as the help case, implying a success exit.
**Spec Reference:** TC-6.1a, AC-6.3
**Recommendation:** Make the no-args help path exit `0` explicitly.

---

## Positive Observations

- **Module boundary clean.** `src/pkg/` is cleanly separated into `manifest/`, `tar/`, and `render/` subdirectories with zero imports from `src/server/`, `src/client/`, or `src/electron/`. The independence constraint is fully met.
- **Core contracts match design.** Types in `types.ts` and the error hierarchy in `errors.ts` closely follow the tech design and are consistently used across all package operations.
- **Strong library-side test strategy.** Tests use real temp directories, real tar/gzip operations, and no mocks. Manifest parser coverage in `manifest-parser.test.ts` is thorough.
- **Manifest parsing robust.** The parser handles nested lists, display names, groups, and edge cases well.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| Critical | 1 | Symlink file escape in extraction |
| Major | 4 | CLI output gaps, wrong error code, test coverage holes |
| Minor | 2 | Extra exports, exit code nit |

The implementation is architecturally sound — module boundaries, type contracts, and the core library are well-built. The critical finding is a real security escape in extraction that needs immediate attention. The major findings cluster around CLI completeness and test coverage gaps that allowed incomplete behavior to pass undetected.
