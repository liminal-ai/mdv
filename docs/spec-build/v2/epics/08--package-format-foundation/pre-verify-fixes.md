# Pre-Verification Cleanup — Fix List

1. **Scaffold ordering sequence test** (tests/pkg/create-package.test.ts) — Add a test that verifies the actual order of entries in a scaffolded manifest, not just their presence. Should confirm alphabetical case-insensitive ordering.

2. **instanceof PackageError assertions** (tests/pkg/create-package.test.ts, tests/pkg/extract-package.test.ts) — Where tests catch errors and check properties, also assert `instanceof PackageError` to catch wrong error types.

3. **isDirectory() check on sourceDir** (src/pkg/tar/create.ts) — After stat() on sourceDir, check isDirectory(). If false, throw PackageError(SOURCE_DIR_NOT_FOUND) with a message like "path is not a directory". Currently a file path causes a raw ENOTDIR from readdir.

4. **inspectPackage throws MANIFEST_NOT_FOUND** (src/pkg/tar/inspect.ts) — When scanning finds no _nav.md in the package, throw PackageError(MANIFEST_NOT_FOUND) instead of returning empty metadata/navigation silently.

5. **read command rejects both --file and --name** (src/pkg/cli.ts) — In the read command's action handler, if both --file and --name are provided, error with "provide --file or --name, not both" and exit 1.
