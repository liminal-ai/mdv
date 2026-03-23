# Test Plan: Package Format Foundation

This document maps every Test Condition from the Epic 8 spec to a test file
and description, defines the mock strategy, specifies fixtures, and reconciles
test counts across all chunks.

---

## TC → Test Mapping

### Flow 1: Manifest Parsing — `tests/pkg/manifest-parser.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1a | extracts all metadata fields from frontmatter | Manifest with title, version, author, description, type, status | Each field has correct value in metadata |
| TC-1.1b | missing frontmatter fields are absent, not defaulted | Manifest with only title and version | Other fields are undefined |
| TC-1.1c | manifest with no frontmatter returns empty metadata | Body-only manifest (no `---` delimiters) | metadata is empty object, navigation parsed |
| TC-1.2a | flat list of links becomes flat navigation | 3 top-level `- [Name](path)` items | 3 NavigationNode entries, no children |
| TC-1.2b | nested list produces hierarchical navigation | Top-level with indented sub-items | Tree reflects nesting depth |
| TC-1.2c | three levels of nesting | 3-level deep list items | NavigationNode tree has 3 levels |
| TC-1.3a | non-linked item becomes group label with children | `- Authentication` followed by indented linked items | isGroup=true, filePath undefined, children populated |
| TC-1.3b | group label with no children has empty children array | Non-linked item followed by top-level item | isGroup=true, children=[] |
| TC-1.4a | display name and file path extracted from link | `[Getting Started](getting-started.md)` | displayName="Getting Started", filePath="getting-started.md" |
| TC-1.4b | directory paths preserved in file path | `[OAuth2 Flow](auth/oauth2.md)` | filePath="auth/oauth2.md" |
| TC-1.5a | non-list body throws MANIFEST_PARSE_ERROR | Body with only paragraphs | PackageError with MANIFEST_PARSE_ERROR |
| TC-1.5b | invalid YAML throws MANIFEST_PARSE_ERROR | Malformed YAML between `---` delimiters | PackageError with MANIFEST_PARSE_ERROR |
| TC-1.6a | ordered list items parsed as navigation entries | `1.`, `2.` syntax | Entries parsed in order |
| TC-1.6b | empty link target treated as group label | `[Label]()` | isGroup=true, filePath undefined |
| TC-1.6c | non-markdown link target preserved | `[Data](data.csv)` | filePath="data.csv" |
| TC-1.6d | paragraph text between lists ignored | Paragraphs interspersed between list blocks | Only list items form entries |
| TC-1.6e | frontmatter present but body empty returns empty nav | Valid YAML, no body content | metadata populated, navigation=[] |

### Flow 2: Package Creation — `tests/pkg/create-package.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.1a | creates package with all source files | Dir with _nav.md + 3 .md files | .mpk contains all 4 files |
| TC-2.1b | supporting assets included in package | Dir with images/ subdirectory containing PNGs | .mpk contains images at original relative paths |
| TC-2.1c | directory hierarchy preserved in tar entries | Nested subdirs with .md files | Tar entries match source relative paths |
| TC-2.2a | manifest scaffolded to disk and included in package | Dir with .md files, no _nav.md | _nav.md written to disk AND present in .mpk |
| TC-2.2b | scaffolded manifest contains entries for all markdown files | 3 .md files, no manifest | Scaffold has links to all 3 files |
| TC-2.2c | existing manifest not overwritten | Dir with custom _nav.md | Custom manifest content preserved |
| TC-2.3a | compressed package created and smaller | Source dir, compress: true | .mpkz file smaller than equivalent .mpk |
| TC-2.3b | compressed package is valid gzip containing valid tar | .mpkz file | Standard gzip decompression → valid tar |
| TC-2.4a | source directory not found throws error | Nonexistent path | PackageError with SOURCE_DIR_NOT_FOUND |
| TC-2.4b | empty source directory throws error | Empty directory | PackageError with SOURCE_DIR_EMPTY |
| TC-2.5a | output file overwritten when already exists | Existing .mpk at output path | New package replaces old |
| TC-7.2a | missing required option field produces error | createPackage with missing sourceDir | Validation error |

### Flow 3: Package Extraction — `tests/pkg/extract-package.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | extraction preserves full directory structure | .mpk with manifest + files in subdirs | All files at original relative paths |
| TC-3.1b | extracted files are byte-identical to originals | Create then extract package | Byte comparison of each file |
| TC-3.2a | compressed package extracts correctly | .mpkz file | Result identical to extracting .mpk |
| TC-3.3a | extracting overwrites existing conflicting files | Output dir has file at same path | Package version replaces existing |
| TC-3.4a | non-tar file throws INVALID_ARCHIVE | Plain text file with .mpk extension | PackageError with INVALID_ARCHIVE |
| TC-3.4b | corrupted gzip throws COMPRESSION_ERROR | .mpkz with bad gzip data | PackageError with COMPRESSION_ERROR |
| TC-3.5a | nonexistent output directory created | Nested output path that doesn't exist | Full directory path created, files extracted |
| TC-3.6a | path traversal with .. blocked | Tar with `../../etc/malicious` entry | PackageError with PATH_TRAVERSAL |
| TC-3.6b | absolute path blocked | Tar with `/etc/passwd` entry | PackageError with PATH_TRAVERSAL |
| TC-7.3a | error has code property from PackageErrorCode | Extract invalid archive | error.code exists in PackageErrorCode |

### Flow 4: Package Inspection — `tests/pkg/inspect-package.test.ts`

This file covers inspectPackage(), listPackage(), and getManifest() — all three
inspection operations that scan tar archives without extracting.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-4.1a | info returns metadata from frontmatter | Package with full frontmatter | PackageInfo.metadata has all fields |
| TC-4.1b | info returns empty metadata when no frontmatter | Manifest with no YAML frontmatter | metadata is empty, navigation present |
| TC-4.1c | info on invalid archive throws INVALID_ARCHIVE | Non-tar file | PackageError with INVALID_ARCHIVE |
| TC-4.2a | info returns hierarchical navigation tree | Package with nested manifest | navigation reflects hierarchy and groups |
| TC-4.2b | info returns flat navigation list | Package with flat manifest | Flat list of NavigationNode entries |
| TC-4.3a | ls returns all files with paths and sizes | Package with 5 files | 5 FileEntry items with path and size |
| TC-4.3b | ls returns files sorted by path | Files in multiple directories | Sorted ascending by path |
| TC-4.4a | manifest returns raw content including frontmatter | Package with manifest | content matches original manifest string |
| TC-4.4b | manifest on package with no manifest throws error | Raw tar without _nav.md | PackageError with MANIFEST_NOT_FOUND |
| TC-4.4c | manifest on invalid archive throws INVALID_ARCHIVE | Non-tar file | PackageError with INVALID_ARCHIVE |
| TC-7.2b | inspectPackage returns typed PackageInfo | Valid package | Return value has metadata, navigation, files, format |

### Flow 5: Single Document Reading — `tests/pkg/read-document.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-5.1a | reads document by file path | Package with `auth/oauth2.md` | content matches original file |
| TC-5.1b | file path not found throws FILE_NOT_FOUND | Package without `nonexistent.md` | PackageError with FILE_NOT_FOUND |
| TC-5.1c | read from invalid archive throws INVALID_ARCHIVE | Non-tar file | PackageError with INVALID_ARCHIVE |
| TC-5.2a | reads document by display name via manifest | Manifest maps "OAuth2 Flow" → `auth/oauth2.md` | content of auth/oauth2.md returned |
| TC-5.2b | display name not found throws FILE_NOT_FOUND | No entry named "Nonexistent" | PackageError with FILE_NOT_FOUND |
| TC-5.2c | ambiguous display name throws AMBIGUOUS_DISPLAY_NAME | Two entries with same display name | PackageError with AMBIGUOUS_DISPLAY_NAME |
| TC-7.3b | error message is descriptive | Read nonexistent file | message describes what and where |

### Flow 6: CLI — `tests/pkg/cli.test.ts`

CLI tests run `mdvpkg` as a subprocess via `execFile` or `spawn` and check
stdout, stderr, and exit codes.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-6.1a | top-level help lists all 6 commands | Run `mdvpkg --help` | stdout contains create, extract, info, ls, read, manifest |
| TC-6.2a | command-level help shows arguments | Run `mdvpkg create --help` | stdout lists arguments and options |
| TC-6.3a | successful operation exits with code 0 | Valid create operation | exit code === 0 |
| TC-6.3b | failed operation exits with non-zero code | Extract nonexistent file | exit code !== 0 |
| TC-6.4a | error message includes file path | File not found failure | stderr includes the file path |
| TC-6.4b | error message includes command name | Any failure | stderr starts with command name |
| TC-7.1a | CLI create produces identical output to library | Create via CLI and via library | Package files are byte-identical |
| TC-7.1b | every CLI command has a corresponding library export | Import pkg/index.ts | 6 exported functions exist |

### Flow 8: Rendering Library — `tests/pkg/render-library.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-8.1a | renders heading and paragraph to HTML | `# Title\n\nParagraph text` | HTML contains `<h1>` and `<p>` |
| TC-8.1b | applies syntax highlighting to code blocks | Fenced JS code block | HTML contains `<pre>` with Shiki-highlighted spans |
| TC-8.2a | mermaid code blocks become placeholder markup | Valid mermaid fenced block | HTML has `mermaid-diagram` div, not raw `<pre><code>` |
| TC-8.2b | invalid mermaid block produces error div | Empty mermaid block | HTML has `mermaid-error` div; no exception |
| TC-8.3a | standalone import succeeds | Import renderMarkdown in test | Import resolves without server/viewer modules |
| TC-8.3b | renders without server or browser | Call renderMarkdown("# Hello") | Completes successfully, returns valid HTML |

---

## Mock Strategy

**No mocks.** All tests use real implementations.

| Boundary | Approach | Rationale |
|----------|----------|-----------|
| Filesystem | Real temp directories (per-suite) | Fast local I/O, tests real behavior |
| tar-stream | Real tar operations | Tests actual pack/extract paths |
| Node zlib | Real gzip compress/decompress | Tests actual compression paths |
| markdown-it + Shiki | Real rendering pipeline | Tests actual rendering output |
| Commander (CLI) | Subprocess execution | Tests real CLI behavior, exit codes |

### Why No Mocks

The package library's operations ARE filesystem and tar operations — mocking them
would test mock behavior, not library behavior. The service mock philosophy
says "mock at external boundaries, never at internal module boundaries." For this
library, the "external boundary" is the filesystem, and real temp directories
are faster and more reliable than fs mocks.

The manifest parser is pure (string in, data structure out) — no mocking needed
or possible.

---

## Fixtures

### Manifest String Constants (`tests/pkg/fixtures/manifests.ts`)

| Fixture Name | Purpose | Used By |
|-------------|---------|---------|
| `FULL_MANIFEST` | All 6 frontmatter fields + nested navigation | TC-1.1a, TC-4.1a, TC-4.2a |
| `MINIMAL_MANIFEST` | Title + version only | TC-1.1b |
| `NO_FRONTMATTER_MANIFEST` | Body only, no `---` | TC-1.1c, TC-4.1b |
| `FLAT_MANIFEST` | 3 top-level links, no nesting | TC-1.2a, TC-4.2b |
| `NESTED_MANIFEST` | 2-level nesting with groups | TC-1.2b, TC-1.3a |
| `DEEP_MANIFEST` | 3+ level nesting | TC-1.2c, non-TC deep nesting |
| `GROUP_NO_CHILDREN` | Non-linked item with no sub-items | TC-1.3b |
| `ORDERED_LIST_MANIFEST` | Uses `1.`, `2.` syntax | TC-1.6a |
| `EMPTY_LINK_MANIFEST` | `[Label]()` entries | TC-1.6b |
| `NON_MD_LINK_MANIFEST` | Links to .csv, .pdf | TC-1.6c |
| `PARAGRAPHS_BETWEEN_LISTS` | Paragraph text interspersed | TC-1.6d |
| `EMPTY_BODY_MANIFEST` | Frontmatter only, no body | TC-1.6e |
| `INVALID_YAML_MANIFEST` | Malformed YAML frontmatter | TC-1.5b |
| `PARAGRAPH_ONLY_MANIFEST` | No list items in body | TC-1.5a |
| `AMBIGUOUS_NAMES_MANIFEST` | Two entries with same display name | TC-5.2c |
| `UNICODE_MANIFEST` | Unicode in names and paths | Non-TC |
| `LARGE_MANIFEST` | 100+ entries | Non-TC |

### Workspace Fixtures (`tests/pkg/fixtures/workspaces.ts`)

A `createFixtureWorkspace()` helper creates a temp directory with a configurable
file set. Used by creation, extraction, inspection, and reading tests.

```typescript
interface WorkspaceConfig {
  manifest?: string;         // null = no manifest (trigger scaffold)
  files: Record<string, string>;  // relative path → content
  binaryFiles?: Record<string, Buffer>;  // relative path → binary content
}

function createFixtureWorkspace(config: WorkspaceConfig): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}>;
```

**Standard workspace configurations:**

| Config | Files | Manifest | Used By |
|--------|-------|----------|---------|
| `BASIC_WORKSPACE` | 3 .md files | FULL_MANIFEST | Most creation/extraction tests |
| `NO_MANIFEST_WORKSPACE` | 3 .md files | None (triggers scaffold) | TC-2.2a,b |
| `WITH_IMAGES_WORKSPACE` | 3 .md + 2 PNG files in images/ | FULL_MANIFEST | TC-2.1b |
| `NESTED_WORKSPACE` | Files in nested subdirs | NESTED_MANIFEST | TC-2.1c, TC-3.1a |
| `EMPTY_WORKSPACE` | No files | N/A | TC-2.4b |

### Path-Traversal Fixture

A `createTraversalTar()` helper creates a malicious tar file with path-traversal
entries using tar-stream's pack API directly. Used by TC-3.6a and TC-3.6b.

```typescript
function createTraversalTar(
  outputPath: string,
  entries: Array<{ name: string; content: string }>,
): Promise<void>;
```

### Package Fixture Helper

A `createTestPackage()` helper calls `createPackage()` on a fixture workspace
and returns the package path. Used by extraction, inspection, and reading tests.

```typescript
async function createTestPackage(
  workspace: WorkspaceConfig,
  options?: { compress?: boolean },
): Promise<{ packagePath: string; cleanup: () => Promise<void> }>;
```

---

## Test File Organization

```
tests/pkg/
├── pkg-foundation.test.ts      # Chunk 0: structural tests (4 tests)
├── manifest-parser.test.ts     # Chunk 1: manifest parsing (20 tests)
├── create-package.test.ts      # Chunk 2: package creation (14 tests)
├── extract-package.test.ts     # Chunk 3: package extraction (12 tests)
├── inspect-package.test.ts     # Chunk 4: inspect + list + manifest (12 tests)
├── read-document.test.ts       # Chunk 4: single document read (8 tests — corrected)
├── cli.test.ts                 # Chunk 5: CLI subprocess tests (10 tests)
├── render-library.test.ts      # Chunk 6: rendering library (8 tests)
└── fixtures/
    ├── manifests.ts            # Manifest string constants
    └── workspaces.ts           # Workspace creation helpers
```

Note: `inspect-package.test.ts` and `read-document.test.ts` are both part of
Chunk 4 but are separate files for clarity — inspection operations
(inspectPackage, listPackage, getManifest) are logically distinct from the
read operation (readDocument) even though they share a chunk.

---

## Per-Chunk Test Tables

### Chunk 0: Infrastructure

| Test File | Test Description | TC | Type |
|-----------|------------------|----|------|
| pkg-foundation.test.ts | types module is importable | — | Structural |
| pkg-foundation.test.ts | PackageError instantiation with code and message | — | Structural |
| pkg-foundation.test.ts | PackageErrorCode has all expected values | — | Structural |
| pkg-foundation.test.ts | MANIFEST_FILENAME equals '_nav.md' | — | Structural |

**Chunk 0 Total: 4 tests (0 TC, 4 non-TC)**

### Chunk 1: Manifest Parsing

| Test File | Test Description | TC | Type |
|-----------|------------------|----|------|
| manifest-parser.test.ts | extracts all metadata fields from frontmatter | TC-1.1a | TC |
| manifest-parser.test.ts | missing frontmatter fields are absent | TC-1.1b | TC |
| manifest-parser.test.ts | no frontmatter returns empty metadata | TC-1.1c | TC |
| manifest-parser.test.ts | flat list becomes flat navigation | TC-1.2a | TC |
| manifest-parser.test.ts | nested list produces hierarchy | TC-1.2b | TC |
| manifest-parser.test.ts | three levels of nesting | TC-1.2c | TC |
| manifest-parser.test.ts | non-linked item is group label with children | TC-1.3a | TC |
| manifest-parser.test.ts | group label with no children | TC-1.3b | TC |
| manifest-parser.test.ts | display name and file path from link | TC-1.4a | TC |
| manifest-parser.test.ts | directory paths preserved | TC-1.4b | TC |
| manifest-parser.test.ts | non-list body throws MANIFEST_PARSE_ERROR | TC-1.5a | TC |
| manifest-parser.test.ts | invalid YAML throws MANIFEST_PARSE_ERROR | TC-1.5b | TC |
| manifest-parser.test.ts | ordered list items parsed | TC-1.6a | TC |
| manifest-parser.test.ts | empty link target is group label | TC-1.6b | TC |
| manifest-parser.test.ts | non-markdown link preserved | TC-1.6c | TC |
| manifest-parser.test.ts | paragraph text ignored | TC-1.6d | TC |
| manifest-parser.test.ts | empty body returns empty navigation | TC-1.6e | TC |
| manifest-parser.test.ts | deeply nested manifest (4+ levels) | — | Non-TC |
| manifest-parser.test.ts | large manifest (100+ entries) | — | Non-TC |
| manifest-parser.test.ts | unicode in display names and paths | — | Non-TC |

**Chunk 1 Total: 20 tests (17 TC, 3 non-TC)**

### Chunk 2: Package Creation

| Test File | Test Description | TC | Type |
|-----------|------------------|----|------|
| create-package.test.ts | creates package with all source files | TC-2.1a | TC |
| create-package.test.ts | supporting assets included | TC-2.1b | TC |
| create-package.test.ts | directory hierarchy preserved | TC-2.1c | TC |
| create-package.test.ts | manifest scaffolded to disk and in package | TC-2.2a | TC |
| create-package.test.ts | scaffold contains all markdown entries | TC-2.2b | TC |
| create-package.test.ts | existing manifest not overwritten | TC-2.2c | TC |
| create-package.test.ts | compressed package smaller | TC-2.3a | TC |
| create-package.test.ts | compressed package is valid gzip+tar | TC-2.3b | TC |
| create-package.test.ts | source dir not found | TC-2.4a | TC |
| create-package.test.ts | empty source dir | TC-2.4b | TC |
| create-package.test.ts | output file overwritten | TC-2.5a | TC |
| create-package.test.ts | missing required option produces error | TC-7.2a | TC |
| create-package.test.ts | symlink handling | — | Non-TC |
| create-package.test.ts | source dir with no markdown files | — | Non-TC |

**Chunk 2 Total: 14 tests (12 TC, 2 non-TC)**

### Chunk 3: Package Extraction

| Test File | Test Description | TC | Type |
|-----------|------------------|----|------|
| extract-package.test.ts | full extraction preserves structure | TC-3.1a | TC |
| extract-package.test.ts | extracted files byte-identical | TC-3.1b | TC |
| extract-package.test.ts | compressed package extracts | TC-3.2a | TC |
| extract-package.test.ts | overwrite existing files | TC-3.3a | TC |
| extract-package.test.ts | non-tar file throws INVALID_ARCHIVE | TC-3.4a | TC |
| extract-package.test.ts | corrupted gzip throws COMPRESSION_ERROR | TC-3.4b | TC |
| extract-package.test.ts | output directory created | TC-3.5a | TC |
| extract-package.test.ts | path traversal with .. blocked | TC-3.6a | TC |
| extract-package.test.ts | absolute path blocked | TC-3.6b | TC |
| extract-package.test.ts | error has code from PackageErrorCode | TC-7.3a | TC |
| extract-package.test.ts | unicode filenames in tar | — | Non-TC |
| extract-package.test.ts | very long file path in tar | — | Non-TC |

**Chunk 3 Total: 12 tests (10 TC, 2 non-TC)**

### Chunk 4: Inspection and Reading

| Test File | Test Description | TC | Type |
|-----------|------------------|----|------|
| inspect-package.test.ts | info returns metadata | TC-4.1a | TC |
| inspect-package.test.ts | info returns empty metadata | TC-4.1b | TC |
| inspect-package.test.ts | info on invalid archive | TC-4.1c | TC |
| inspect-package.test.ts | info returns hierarchical navigation | TC-4.2a | TC |
| inspect-package.test.ts | info returns flat navigation | TC-4.2b | TC |
| inspect-package.test.ts | ls returns files with paths and sizes | TC-4.3a | TC |
| inspect-package.test.ts | ls returns files sorted by path | TC-4.3b | TC |
| inspect-package.test.ts | manifest returns raw content | TC-4.4a | TC |
| inspect-package.test.ts | manifest not found throws error | TC-4.4b | TC |
| inspect-package.test.ts | manifest on invalid archive | TC-4.4c | TC |
| inspect-package.test.ts | inspectPackage returns typed PackageInfo | TC-7.2b | TC |
| inspect-package.test.ts | inspect .mpkz (compressed) | — | Non-TC |
| read-document.test.ts | reads by file path | TC-5.1a | TC |
| read-document.test.ts | file path not found | TC-5.1b | TC |
| read-document.test.ts | read from invalid archive | TC-5.1c | TC |
| read-document.test.ts | reads by display name | TC-5.2a | TC |
| read-document.test.ts | display name not found | TC-5.2b | TC |
| read-document.test.ts | ambiguous display name | TC-5.2c | TC |
| read-document.test.ts | error message is descriptive | TC-7.3b | TC |
| read-document.test.ts | read from .mpkz (compressed) | — | Non-TC |

**Chunk 4 Total: 20 tests (18 TC, 2 non-TC)**

### Chunk 5: CLI Interface

| Test File | Test Description | TC | Type |
|-----------|------------------|----|------|
| cli.test.ts | help lists all 6 commands | TC-6.1a | TC |
| cli.test.ts | command-level help shows arguments | TC-6.2a | TC |
| cli.test.ts | successful operation exits 0 | TC-6.3a | TC |
| cli.test.ts | failed operation exits non-zero | TC-6.3b | TC |
| cli.test.ts | error message includes path | TC-6.4a | TC |
| cli.test.ts | error message includes command name | TC-6.4b | TC |
| cli.test.ts | CLI create matches library create | TC-7.1a | TC |
| cli.test.ts | every command has library export | TC-7.1b | TC |
| cli.test.ts | unknown command produces help | — | Non-TC |
| cli.test.ts | --version flag outputs version | — | Non-TC |

**Chunk 5 Total: 10 tests (8 TC, 2 non-TC)**

### Chunk 6: Rendering Library

| Test File | Test Description | TC | Type |
|-----------|------------------|----|------|
| render-library.test.ts | renders heading and paragraph | TC-8.1a | TC |
| render-library.test.ts | syntax highlighting on code blocks | TC-8.1b | TC |
| render-library.test.ts | mermaid block becomes placeholder | TC-8.2a | TC |
| render-library.test.ts | invalid mermaid produces error div | TC-8.2b | TC |
| render-library.test.ts | standalone import succeeds | TC-8.3a | TC |
| render-library.test.ts | renders without server or browser | TC-8.3b | TC |
| render-library.test.ts | empty markdown input | — | Non-TC |
| render-library.test.ts | mermaid: false leaves code blocks unchanged | — | Non-TC |

**Chunk 6 Total: 8 tests (6 TC, 2 non-TC)**

---

## Non-TC Decided Tests

Tests beyond TC coverage that address edge cases, collision scenarios, and
defensive behavior.

| Chunk | Test File | Description | Rationale |
|-------|-----------|-------------|-----------|
| 0 | pkg-foundation.test.ts | types module importable | Validates module boundary |
| 0 | pkg-foundation.test.ts | PackageError instantiation | Validates error class |
| 0 | pkg-foundation.test.ts | PackageErrorCode values | Validates enum completeness |
| 0 | pkg-foundation.test.ts | MANIFEST_FILENAME value | Validates constant |
| 1 | manifest-parser.test.ts | 4+ level nesting | Deep nesting edge case |
| 1 | manifest-parser.test.ts | 100+ entries | Performance/correctness at scale |
| 1 | manifest-parser.test.ts | Unicode characters | Internationalization |
| 2 | create-package.test.ts | Symlink handling | Filesystem edge case |
| 2 | create-package.test.ts | No markdown files in dir | Scaffold edge case |
| 3 | extract-package.test.ts | Unicode filenames | International paths |
| 3 | extract-package.test.ts | Very long paths | Filesystem limits |
| 4 | inspect-package.test.ts | Inspect .mpkz | Compressed inspection path |
| 4 | read-document.test.ts | Read from .mpkz | Compressed read path |
| 5 | cli.test.ts | Unknown command | Error handling |
| 5 | cli.test.ts | --version flag | Standard CLI feature |
| 6 | render-library.test.ts | Empty input | Boundary case |
| 6 | render-library.test.ts | mermaid: false | Option behavior |

**Total Non-TC Tests: 17**

---

## Test Count Reconciliation

### Per-File Totals

| Test File | TC Tests | Non-TC Tests | File Total |
|-----------|----------|-------------- |------------|
| pkg-foundation.test.ts | 0 | 4 | 4 |
| manifest-parser.test.ts | 17 | 3 | 20 |
| create-package.test.ts | 12 | 2 | 14 |
| extract-package.test.ts | 10 | 2 | 12 |
| inspect-package.test.ts | 11 | 1 | 12 |
| read-document.test.ts | 7 | 1 | 8 |
| cli.test.ts | 8 | 2 | 10 |
| render-library.test.ts | 6 | 2 | 8 |
| **Total** | **71** | **17** | **88** |

### Per-Chunk Totals

| Chunk | TC Tests | Non-TC Tests | Chunk Total | Running Total |
|-------|----------|-------------- |-------------|---------------|
| 0 | 0 | 4 | 4 | 4 |
| 1 | 17 | 3 | 20 | 24 |
| 2 | 12 | 2 | 14 | 38 |
| 3 | 10 | 2 | 12 | 50 |
| 4 | 18 | 2 | 20 | 70 |
| 5 | 8 | 2 | 10 | 80 |
| 6 | 6 | 2 | 8 | 88 |
| **Total** | **71** | **17** | **88** | |

### Cross-Check

- Per-file TC total (71) = Per-chunk TC total (71) = Epic TC count (71) ✓
- Per-file non-TC total (17) = Per-chunk non-TC total (17) ✓
- Per-file grand total (88) = Per-chunk grand total (88) = Work breakdown total (88) ✓
- Chunk 4 per-file: inspect (12) + read (8) = 20 = Chunk 4 total ✓

### TC Coverage Completeness

All 71 TCs from the epic are mapped:
- TC-1.1a through TC-1.6e: 17 TCs → manifest-parser.test.ts ✓
- TC-2.1a through TC-2.5a: 11 TCs → create-package.test.ts ✓
- TC-3.1a through TC-3.6b: 9 TCs → extract-package.test.ts ✓
- TC-4.1a through TC-4.4c: 10 TCs → inspect-package.test.ts ✓
- TC-5.1a through TC-5.2c: 6 TCs → read-document.test.ts ✓
- TC-6.1a through TC-6.4b: 6 TCs → cli.test.ts ✓
- TC-7.1a through TC-7.3b: 6 TCs → distributed across create, extract, inspect, read, cli ✓
- TC-8.1a through TC-8.3b: 6 TCs → render-library.test.ts ✓

TC-7.x distribution:
- TC-7.1a → cli.test.ts ✓
- TC-7.1b → cli.test.ts ✓
- TC-7.2a → create-package.test.ts ✓
- TC-7.2b → inspect-package.test.ts ✓
- TC-7.3a → extract-package.test.ts ✓
- TC-7.3b → read-document.test.ts ✓

---

## Gorilla Testing Scenarios

Epic 8 is a standalone library and CLI with no browser UI surface. Gorilla testing is not applicable.

**New capabilities to test:**
- N/A — no browser UI. All capabilities are library functions and CLI commands exercised by the scripted test suite.

**Adjacent features to recheck:**
- N/A — Epic 8 introduces no changes to the viewer. UI-level validation of the package library is deferred to Epic 9 (Package Viewer Integration), whose gorilla scenarios cover rendering, navigation, and round-trip fidelity through the viewer's integration surface.

**Edge cases for agent exploration:**
- N/A
