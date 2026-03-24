# Epic 8: Package Format Foundation — Code Review

**Reviewer:** Claude Opus 4.6
**Date:** 2026-03-23
**Scope:** Full epic-level review of all source files in `app/src/pkg/` and test files in `app/tests/pkg/`
**Artifacts reviewed:** Epic spec (33 ACs, 71 TCs), tech design (7 chunks, 88 planned tests), 14 source files, 8 test files, 2 fixture files

---

## Summary

Epic 8 is a strong implementation. All 94 tests pass. All 33 ACs and 71 TCs from the epic are covered by tests. All function signatures match the tech design. The module boundary is clean — zero imports from `src/server/`, `src/client/`, `src/shared/`, or `src/electron/`. Security protections for path traversal are thorough, including symlink-based escape detection. The `shared.ts` extraction for common tar scanning logic is a good design decision not in the tech design but consistent with its principles.

One major finding: `readDocument` uses the wrong error code when a manifest is missing during display name resolution. Several minor issues around CLI output completeness, code duplication, and public API surface.

**Test count:** 94 tests (vs. 88 planned). The 6 additional tests are edge case coverage: scaffold ordering (TC-2.2d), source-path-is-file (TC-2.4c), read-with-both-flags (TC-6.4c), symlink escape in extraction, nonexistent package READ_ERROR, and inspectPackage MANIFEST_NOT_FOUND.

---

## Critical Findings

None.

---

## Major Findings

### M1: `readDocument` throws wrong error code when manifest is missing from package

**Location:** `app/src/pkg/tar/read.ts:67-73`
**AC:** AC-5.2 | **TC:** TC-5.2b (indirectly)
**Tech Design:** Error contract table — `MANIFEST_NOT_FOUND | getManifest, readDocument (by display name) | No manifest in package`

When reading by display name from a package that has no manifest file, the code throws `FILE_NOT_FOUND` with the message "No navigation entry matches display name" instead of `MANIFEST_NOT_FOUND` with a message indicating the manifest itself is missing.

```typescript
// Current (incorrect)
if (manifestContent === undefined) {
  throw new PackageError(
    PackageErrorCode.FILE_NOT_FOUND,  // Should be MANIFEST_NOT_FOUND
    `No navigation entry matches display name: ${options.target.displayName}`,
    // Message is misleading — the manifest is missing, not the display name
    options.target.displayName,
  );
}
```

**Impact:** Consumers programming against error codes will misinterpret the error. The tech design's error contract explicitly lists `MANIFEST_NOT_FOUND` for `readDocument (by display name)`.

**Fix:**
```typescript
if (manifestContent === undefined) {
  throw new PackageError(
    PackageErrorCode.MANIFEST_NOT_FOUND,
    `Manifest not found in package: ${options.packagePath}`,
    options.packagePath,
  );
}
```

**Test gap:** No test in `read-document.test.ts` exercises reading by display name from a package without a manifest. TC-5.2b only tests "display name not found in manifest" — it uses a package that *has* a manifest. A test for "package has no manifest at all + display name read" is missing.

---

## Minor Findings

### m1: CLI `info` command omits metadata fields and navigation tree

**Location:** `app/src/pkg/cli.ts:62-77`
**AC:** AC-4.1, AC-4.2

The CLI `info` command only outputs `title`, `version`, `description`, `format`, and file count. It omits `author`, `type`, and `status` from metadata, and does not display the navigation tree at all.

The library function `inspectPackage()` returns all this data correctly — the gap is only in the CLI's formatting. AC-4.1 says "the output includes each metadata field and its value" and AC-4.2 says "the output shows the tree with hierarchy indicated by indentation."

The library tests cover the data correctly. The CLI tests (TC-6.1a through TC-6.4b) test help output, exit codes, and error formatting — not content formatting for `info`.

**Impact:** Users of the CLI `info` command see incomplete information. Low severity because the library API is correct and the CLI is described as a "thin wrapper."

### m2: `toPosixPath` duplicated across modules

**Location:** `app/src/pkg/manifest/scaffold.ts:6-8` and `app/src/pkg/tar/create.ts:13-15`

Identical function defined in two places:
```typescript
function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}
```

Should be extracted to a shared utility within `src/pkg/` (e.g., in `shared.ts` or a new `utils.ts`).

### m3: `@ts-expect-error` for js-yaml in parser.ts

**Location:** `app/src/pkg/manifest/parser.ts:3`

```typescript
// @ts-expect-error -- js-yaml is available at runtime in this repo, but typings are not installed.
import yaml from 'js-yaml';
```

The parser depends on `js-yaml` but `@types/js-yaml` is not installed. This suppresses type checking for all yaml API calls in the parser. Adding `@types/js-yaml` to `devDependencies` would provide compile-time safety.

### m4: `NotImplementedError` exported from public API

**Location:** `app/src/pkg/index.ts:22`

```typescript
export { PackageError, PackageErrorCode, NotImplementedError } from './errors.js';
```

`NotImplementedError` is a TDD scaffold artifact. The tech design's public API index does not include it. It should not be part of the public API surface — consumers have no use for it.

### m5: Duplicate `readEntryContent` in extract.ts

**Location:** `app/src/pkg/tar/extract.ts:53-67` and `app/src/pkg/tar/shared.ts:18-32`

`extract.ts` defines its own `readEntryContent` function that is functionally identical to the one in `shared.ts`. The extract module was implemented in Chunk 3 before `shared.ts` was created in Chunk 4. The extract module should import from `shared.ts` instead.

### m6: Default exports alongside named exports

**Location:** `app/src/pkg/manifest/scaffold.ts:39`, `app/src/pkg/tar/create.ts:162`, `app/src/pkg/tar/extract.ts:230`

These modules have both named exports and `export default`. The tech design specifies only named exports. Tests import using `import createPackage from '../../src/pkg/tar/create.js'` (default) rather than `import { createPackage } from '../../src/pkg/tar/create.js'` (named). The public API index uses named imports correctly.

Harmless but inconsistent with the tech design convention. The `default` exports could be removed.

### m7: `readDocument` scans package twice for display name reads

**Location:** `app/src/pkg/tar/read.ts:57-117`

When reading by display name, `readDocument` calls `readManifestFromPackage()` (full tar scan) then `readFileFromPackage()` (second full tar scan). The tech design sequence diagram shows a single scan approach.

Functionally correct. Performance impact negligible for expected package sizes (NFR: "dozens of files, a few MB"). A single-scan approach would be more efficient for large packages but adds complexity.

### m8: Empty directory check edge case

**Location:** `app/src/pkg/tar/create.ts:118-125`

```typescript
const sourceEntries = await readdir(options.sourceDir, { recursive: true });
if (sourceEntries.length === 0) {
  throw new PackageError(PackageErrorCode.SOURCE_DIR_EMPTY, ...);
}
```

`readdir({ recursive: true })` returns subdirectory names in addition to file names. A directory containing only empty subdirectories (no files) would pass this check, then produce a package containing only a scaffolded manifest. This matches the behavior of "no markdown files" (tested), but the "empty directory" error message would be more helpful in this case.

---

## AC/TC Coverage Matrix

All 33 ACs and all 71 TCs are covered by tests. Verification by flow:

| Flow | ACs | TCs | Coverage |
|------|-----|-----|----------|
| 1. Manifest Parsing | AC-1.1 through AC-1.6 | TC-1.1a through TC-1.6e (17) | Complete |
| 2. Package Creation | AC-2.1 through AC-2.5 | TC-2.1a through TC-2.5a (11) | Complete |
| 3. Package Extraction | AC-3.1 through AC-3.6 | TC-3.1a through TC-3.6b (9) | Complete |
| 4. Package Inspection | AC-4.1 through AC-4.4 | TC-4.1a through TC-4.4c (10) | Complete |
| 5. Single Document Reading | AC-5.1, AC-5.2 | TC-5.1a through TC-5.2c (6) | Complete |
| 6. CLI Interface | AC-6.1 through AC-6.4 | TC-6.1a through TC-6.4b (6) | Complete |
| 7. Library API | AC-7.1 through AC-7.3 | TC-7.1a through TC-7.3b (6) | Complete |
| 8. Rendering Library | AC-8.1 through AC-8.3 | TC-8.1a through TC-8.3b (6) | Complete |
| **Total** | **33** | **71** | **Complete** |

---

## Interface Compliance

All function signatures match the tech design exactly:

| Function | Tech Design | Implementation | Match |
|----------|-------------|----------------|-------|
| `parseManifest(content: string): ParsedManifest` | parser.ts | parser.ts:20 | Yes |
| `scaffoldManifest(sourceDir: string): Promise<string>` | scaffold.ts | scaffold.ts:24 | Yes |
| `createPackage(options: CreateOptions): Promise<void>` | create.ts | create.ts:87 | Yes |
| `extractPackage(options: ExtractOptions): Promise<void>` | extract.ts | extract.ts:193 | Yes |
| `inspectPackage(options: InspectOptions): Promise<PackageInfo>` | inspect.ts | inspect.ts:7 | Yes |
| `listPackage(options: ListOptions): Promise<FileEntry[]>` | list.ts | list.ts:4 | Yes |
| `getManifest(options: ManifestOptions): Promise<ManifestResult>` | manifest.ts | manifest.ts:7 | Yes |
| `readDocument(options: ReadOptions): Promise<ReadResult>` | read.ts | read.ts:57 | Yes |
| `renderMarkdown(markdown: string, options?: RenderOptions): Promise<RenderResult>` | render/index.ts | render/index.ts:142 | Yes |

All type interfaces match the epic data contracts exactly:
- `ManifestMetadata`, `NavigationNode`, `ParsedManifest` — match
- `PackageInfo`, `FileEntry` — match
- `CreateOptions`, `ExtractOptions`, `InspectOptions`, `ListOptions`, `ManifestOptions` — match
- `ReadTarget`, `ReadOptions`, `ReadResult` — match
- `ManifestResult` — match
- `RenderOptions`, `RenderResult` — match
- `PackageErrorCode`, `PackageError` — match (const object + type union pattern instead of enum, same values)

---

## Architecture Alignment

### Module Structure

All 13 modules from the tech design are present. One additional module (`tar/shared.ts`) was added as a practical DRY extraction.

| Tech Design Module | Implementation | Status |
|-------------------|----------------|--------|
| `pkg/types.ts` | `src/pkg/types.ts` | Present |
| `pkg/errors.ts` | `src/pkg/errors.ts` | Present |
| `pkg/index.ts` | `src/pkg/index.ts` | Present |
| `pkg/manifest/parser.ts` | `src/pkg/manifest/parser.ts` | Present |
| `pkg/manifest/scaffold.ts` | `src/pkg/manifest/scaffold.ts` | Present |
| `pkg/tar/create.ts` | `src/pkg/tar/create.ts` | Present |
| `pkg/tar/extract.ts` | `src/pkg/tar/extract.ts` | Present |
| `pkg/tar/inspect.ts` | `src/pkg/tar/inspect.ts` | Present |
| `pkg/tar/list.ts` | `src/pkg/tar/list.ts` | Present |
| `pkg/tar/manifest.ts` | `src/pkg/tar/manifest.ts` | Present |
| `pkg/tar/read.ts` | `src/pkg/tar/read.ts` | Present |
| `pkg/render/index.ts` | `src/pkg/render/index.ts` | Present |
| `pkg/cli.ts` | `src/pkg/cli.ts` | Present |
| *(not in design)* | `src/pkg/tar/shared.ts` | Added — DRY extraction |

### Module Boundary

**Zero imports from `src/server/`, `src/client/`, `src/shared/`, or `src/electron/`.** Verified by grep.

### Boundary Inventory

No external dependencies are stubs. All are fully integrated:

| Dependency | Status | Usage |
|------------|--------|-------|
| tar-stream | Integrated | create.ts, extract.ts, shared.ts |
| commander | Integrated | cli.ts |
| markdown-it | Integrated | manifest/parser.ts, render/index.ts |
| shiki | Integrated | render/index.ts |
| js-yaml | Integrated | manifest/parser.ts (without types — see m3) |
| Node zlib | Integrated | create.ts, extract.ts, shared.ts |

---

## Security Assessment

Path traversal protection in `extract.ts` is thorough:

1. **Path segment check** — Rejects entries containing `..` segments (line 16)
2. **Absolute path check** — Rejects entries starting with `/` (line 16)
3. **Resolved path check** — Verifies resolved path starts with output directory prefix (lines 24-33)
4. **Symlink escape check** — After mkdir, verifies realpath stays within output directory (lines 38-51)
5. **Unsupported entry types** — Rejects non-file/non-directory tar entries (lines 162-168)

Tests cover: `../../` traversal (TC-3.6a), absolute paths (TC-3.6b), and symlink-based escape (non-TC test).

No other security concerns identified. The library has no network access, no user input parsing beyond file paths, and no HTML injection vectors (rendering output is downstream consumers' responsibility).

---

## Test Quality Assessment

### Strengths

- **Real I/O, no mocks** — Tests use real temp directories and real tar-stream operations, matching the testing strategy
- **Round-trip verification** — TC-3.1b creates a package then extracts and compares byte-identical content
- **Malicious input coverage** — Path traversal tars are constructed programmatically with `tar-stream.pack()` directly
- **Edge cases** — Unicode filenames, very long paths, symlink escapes, empty manifests, no-markdown directories
- **Clean fixture design** — `createFixtureWorkspace` and manifest string constants are well-organized

### Gaps

1. **No test for readDocument + missing manifest + display name** — As noted in M1, no test exercises the code path where `readManifestFromPackage` returns `undefined` in `readDocument`. This is where the wrong error code is thrown.
2. **CLI `info` output not tested for content** — Tests verify exit codes and error messages but don't assert that the info command's stdout contains metadata or navigation tree content.
3. **`inspectPackage` MANIFEST_NOT_FOUND not traced to a TC** — The test "throws MANIFEST_NOT_FOUND for package without manifest" in inspect-package.test.ts is a good test but isn't traced to any TC from the epic. The tech design error contract table omits `inspectPackage` from the MANIFEST_NOT_FOUND row, but the function's behavior is correct.

---

## Test Count by File

| Test File | TC Tests | Non-TC Tests | Total |
|-----------|----------|-------------- |-------|
| `pkg-foundation.test.ts` | 0 | 4 | 4 |
| `manifest-parser.test.ts` | 17 | 3 | 20 |
| `create-package.test.ts` | 11 + TC-7.2a + TC-2.2d + TC-2.4c | 2 | 16 |
| `extract-package.test.ts` | 9 + TC-7.3a | 4 | 14 |
| `inspect-package.test.ts` | 10 + TC-7.2b | 2 | 13 |
| `read-document.test.ts` | 6 + TC-7.3b | 1 | 8 |
| `cli.test.ts` | 6 + TC-7.1a + TC-7.1b + TC-6.4c | 2 | 11 |
| `render-library.test.ts` | 6 | 2 | 8 |
| **Total** | **71+** | **20+** | **94** |
