# Epic 8 — Package Format Foundation: Code Review

**Reviewer:** GPT-5.4 (Codex CLI)
**Session:** `019d1da6-25ae-71e3-97b4-4248a6f90747`
**Date:** 2026-03-23
**Model:** gpt-5.4 (high reasoning, fast tier)
**Scope:** Full epic-level review — all source, tests, epic spec, and tech design

---

## Summary

The package library foundation is mostly solid: the module boundary is clean, the manifest/tar core works, and all 94 current `tests/pkg` tests pass. The main problems are epic-level contract drift rather than broad implementation failure: the CLI `info` command does not satisfy the user-facing inspection ACs, `readDocument()` has an error-contract mismatch for display-name reads without a manifest, and `createPackage()` leaks raw write-stream failures instead of normalizing them to typed package errors.

## Coverage Matrix

| Story | AC count | TC count | Implemented | Tested | Gaps |
|---|---:|---:|---|---|---|
| Story 1: Manifest Parsing | 6 | 17 | Yes | Yes | None |
| Story 2: Package Creation | 5 | 12 | Partial | Partial | `AC-2.4` / `TC-2.4b` edge case for "no files" trees with only empty subdirs; create-time `WRITE_ERROR` path for `AC-7.3` not implemented/tested |
| Story 3: Package Extraction | 6 | 10 | Yes | Yes | None |
| Story 4: Inspection & Reading | 6 | 18 | Partial | Partial | `AC-4.1`, `AC-4.2`, `TC-4.1a/b`, `TC-4.2a/b` fail end-to-end in CLI `info`; display-name read without manifest violates tech-design error contract |
| Story 5: CLI + Library API | 7 | 8 | Partial | Partial | `TC-6.1a` bare `mdvpkg` path untested; no CLI assertions for `info`/`ls`/`manifest` output semantics; create write-failure path breaks `AC-7.3` |
| Story 6: Rendering Library | 3 | 6 | Yes | Partial | `TC-8.3a` / `TC-8.3b` are only weakly asserted in-process, not via isolated import/runtime |

## Findings by Severity

### Critical (blocks release)

None found.

### Major (should fix before release)

1. **`mdvpkg info` does not implement the epic's inspection behavior.** It prints only title/version/description plus format/file count, and never renders author/type/status or the navigation tree, so `AC-4.1`, `AC-4.2`, `TC-4.1a/b`, and `TC-4.2a/b` are not met end-to-end. See `src/pkg/cli.ts:65` and `src/pkg/cli.ts:67`. The CLI suite also never exercises `info` output in `tests/pkg/cli.test.ts`.

2. **`readDocument()` returns wrong error code for display-name reads without a manifest.** Returns `FILE_NOT_FOUND` when reading by `displayName` from a package with no manifest, but the tech design's error contract says that path should raise `MANIFEST_NOT_FOUND`. The incorrect branch is in `src/pkg/tar/read.ts:64`. Reproduced: got `{"code":"FILE_NOT_FOUND"...}` from a tar lacking `_nav.md`.

3. **`createPackage()` leaks raw stream errors instead of `PackageError(WRITE_ERROR)`.** Does not normalize output/write failures into `PackageError(WRITE_ERROR)` and can surface a raw stream error instead. The write pipeline starts at `src/pkg/tar/create.ts:143` with no `PackageError` wrapping around output-stream failures. Pointing `outputPath` at an existing directory reproduced a raw `EISDIR` crash, violating the typed-error contract in `AC-7.3`.

4. **Empty source check counts directory entries, not actual files.** A source tree containing only empty subdirectories is packaged successfully instead of failing `SOURCE_DIR_EMPTY`. The problem is at `src/pkg/tar/create.ts:118`. Practical miss against the "no files to package" intent of `AC-2.4` / `TC-2.4b`.

### Minor (nice to fix)

1. **Directory headers included in file listings.** `listPackage()` and `inspectPackage()` treat tar directory headers as `FileEntry` items, even though the spec contract describes file listings, not directory listings. See `src/pkg/tar/list.ts:11` and `src/pkg/tar/inspect.ts:16`.

2. **`ReadTarget` validation incomplete.** Passing both `filePath` and `displayName` is accepted by the library and silently prefers `displayName`, even though the interface says exactly one must be provided. See `src/pkg/tar/read.ts:64`.

3. **Rendering independence tests weaker than TC wording.** `TC-8.3a` is effectively "function exists" in `tests/pkg/render-library.test.ts:34`, and `TC-8.3b` is only an in-process render in `tests/pkg/render-library.test.ts:38`, not an isolated import/runtime check.

4. **`NotImplementedError` still exported publicly.** No remaining stubs use it and it is not part of the tech design's interface inventory. See `src/pkg/errors.ts:29` and `src/pkg/index.ts:22`.

## Detailed Analysis

### Interface Compliance

The required public surface is mostly present: `createPackage`, `extractPackage`, `inspectPackage`, `listPackage`, `getManifest`, `readDocument`, `parseManifest`, `renderMarkdown`, `MANIFEST_FILENAME`, `PackageError`, and `PackageErrorCode` are all exported from `src/pkg/index.ts`. Function signatures generally match the design.

The main interface miss is semantic, not syntactic: `readDocument()` violates the documented error contract for display-name reads without a manifest, and `createPackage()` does not uphold the typed `WRITE_ERROR` behavior on output failures. The barrel also exposes extra items (`MERMAID_DIAGRAM_TYPES`, `NotImplementedError`) beyond the design inventory.

### Architecture Alignment

The structure is very close to the tech design. `src/pkg/` contains the expected modules, with one reasonable additive helper module in `src/pkg/tar/shared.ts`. No imports from `server/`, `client/`, `shared/`, or `electron/` were found — the package boundary is clean.

Dependency usage is also aligned with the design intent: `tar-stream`, `zlib`, `commander`, `markdown-it`, and `shiki` are used where expected. No architectural cross-contamination showed up.

### Security Review

Extraction is the strongest part of the implementation:
- Path traversal is blocked by path normalization in `src/pkg/tar/extract.ts:11`
- Pre-existing symlink escapes are caught via `realpath()` in `src/pkg/tar/extract.ts:38`
- Non-file tar entry types are rejected in `src/pkg/tar/extract.ts:162`, which effectively rejects symlink archive entries

There is no archive size limiting, but that matches the tech design's explicit "no enforced limits" decision rather than an implementation miss. Public API validation is lighter than ideal, especially around `ReadTarget`.

### Test Quality Assessment

The suite is broad and useful: parser, create, extract, inspect, read, CLI, and render all have direct coverage, and the tests exercise real temp directories and real tar archives. `npm test -- --run tests/pkg` passed with 94 tests.

The main weakness is that some high-level TCs are represented by lower-level assertions only. The biggest example is inspection: library return shapes are tested, but the CLI's actual `info` output never is. The render independence tests are also too weak for the TC wording, and there is no coverage for create-time write failures or the missing-manifest display-name read path.

### Boundary Inventory

No `TODO`, `FIXME`, or stubbed implementations were found in the reviewed modules. The only leftover placeholder artifact is the unused `NotImplementedError` class still exposed in the public API.

### Code Quality

TypeScript use is generally disciplined, and the custom error class pattern is consistent in most modules. The main code-quality concern is inconsistent error normalization: extraction and shared tar scanning wrap errors thoughtfully, while creation leaves some filesystem/stream failures raw.

There is also a small maintainability smell in duplicated stream helper logic between `src/pkg/tar/shared.ts` and `src/pkg/tar/extract.ts`. The `js-yaml` import in `src/pkg/manifest/parser.ts:2` relies on `@ts-expect-error`, which works but is brittle.

## Recommendations

1. **Fix `mdvpkg info` first** so it prints the full metadata set and the navigation tree, then add CLI assertions for `info`, `ls`, and `manifest`.
2. **Align `readDocument()` with the tech-design error contract** by returning `MANIFEST_NOT_FOUND` when display-name lookup is impossible because `_nav.md` is absent.
3. **Wrap create-time output failures** in `PackageError(WRITE_ERROR)` and add a regression test for unwritable or directory-valued `outputPath`.
4. **Change the source-emptiness check** to count actual files, not recursive directory entries, and add a test for "only empty subdirectories".
5. **Tighten library input validation** for `ReadTarget` exclusivity and consider filtering directory headers out of `listPackage()` / `inspectPackage()`.
6. **Strengthen render isolation tests** with an actual external-script import check for `TC-8.3a` / `TC-8.3b`.
