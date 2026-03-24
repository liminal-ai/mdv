# Epic 8 Verification Fix List

All 7 items. All make the code better. All low effort.

## Fix 1: readDocument wrong error code
- `src/pkg/tar/read.ts` — When manifest is missing during display name resolution, throw `PackageError(MANIFEST_NOT_FOUND)` instead of `PackageError(FILE_NOT_FOUND)`. Fix error message too — should say "No manifest found" not "No navigation entry matches."
- Add test for this code path.

## Fix 2: CLI info incomplete
- `src/pkg/cli.ts` — `mdvpkg info` must display all metadata fields (title, version, description, author, type, status) and the navigation tree. Match AC-4.1/AC-4.2.
- Add test(s) for the missing fields.

## Fix 3: createPackage raw stream error leak
- `src/pkg/tar/create.ts` — Wrap raw stream errors in `PackageError(WRITE_ERROR)` instead of letting them propagate unwrapped. AC-7.3 requires all errors include error codes.
- Add test for this path.

## Fix 4: Symlink file escape in extraction (VERIFY FIRST)
- `src/pkg/tar/extract.ts` — The S3 review already added realpath verification for directories. Check whether pre-existing symlinked FILES at the output path are also handled. If not, add realpath check before writeFile.
- Add test if the vulnerability is real.

## Fix 5: Empty source check counts dirs not files
- `src/pkg/tar/create.ts` — The empty-dir check uses `readdir` which counts subdirectories as entries. A directory with only empty subdirectories passes the non-empty check but produces a package with only a manifest. Check actual behavior. If real, fix to check for actual files recursively.
- Add test if the issue is real.

## Fix 6: Remove NotImplementedError from public API
- `src/pkg/index.ts` — Remove `NotImplementedError` from exports. No stubs remain.

## Fix 7: Directory headers in file listings
- `src/pkg/tar/shared.ts` or `list.ts`/`inspect.ts` — Verify whether directory entries appear in `listPackage()`/`inspectPackage()` file arrays. If so, filter to files only.
