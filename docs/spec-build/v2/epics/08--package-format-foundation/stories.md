# Epic 8: Package Format Foundation — Stories

This file contains all stories for Epic 8, derived from the detailed epic and tech design. Each story is a self-contained implementation unit with full AC/TC detail and relevant technical design content.

**Source documents:**
- Epic: `epic.md`
- Tech Design: `tech-design.md`
- Test Plan: `test-plan.md`

---

<!-- ====================================================================== -->
<!-- STORY 0                                                                 -->
<!-- ====================================================================== -->

# Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->

Project structure for the package library: shared types, error class with error codes, test fixtures, and structural tests validating the foundation is importable.

### Description
<!-- Jira: Description field -->

**User Profile**

**Primary User:** Technical user who works with structured markdown collections — specs, documentation, agent outputs
**Context:** Bundling, sharing, inspecting, and extracting markdown collections from the command line or programmatically, without a viewer or server
**Mental Model:** "I have a folder of markdown files with a manifest that defines the navigation. I collapse it into a single file I can share, and anyone can inspect or extract it."
**Key Constraint:** Must be independently usable — library + CLI only, no viewer or server dependencies

**Objective**

Establish the package library project structure and shared foundations so that all subsequent stories can build on stable types, error handling, and test fixtures. After this story, `npm run typecheck` passes with the new `src/pkg/` directory, and structural tests verify the foundation module is importable.

**Scope**

In scope:
- `src/pkg/types.ts` — all package types, option interfaces, result interfaces, `MANIFEST_FILENAME` constant, `MERMAID_DIAGRAM_TYPES` set
- `src/pkg/errors.ts` — `PackageError` class with `PackageErrorCode` enum, `NotImplementedError`
- `src/pkg/index.ts` — public API re-exports (stub functions from subsequent stories)
- `tests/pkg/fixtures/manifests.ts` — manifest string constants for parser tests
- `tests/pkg/fixtures/workspaces.ts` — `createFixtureWorkspace()` helper for filesystem tests
- `tests/pkg/pkg-foundation.test.ts` — structural import tests
- `tsconfig.json` update — add `src/pkg/**/*.ts` to include
- `package.json` update — add `tar-stream`, `commander` dependencies; add `@types/tar-stream` devDependency; add `bin` field for CLI

Out of scope:
- Implementation of any library functions (Stories 1–6)
- CLI implementation (Story 5)

**Dependencies**
- Epics 1–7 complete (existing project structure and tooling)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

Story 0 has no direct ACs from the epic. It delivers the type definitions, error class, and test fixtures used by all subsequent stories. The structural tests validate:

1. The `src/pkg/types.ts` module is importable and exports all expected types
2. `PackageError` can be instantiated with a code, message, and optional path
3. `PackageErrorCode` contains all 11 expected error code values
4. `MANIFEST_FILENAME` equals `'_nav.md'`

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**All package types (`src/pkg/types.ts`):**

```typescript
export const MANIFEST_FILENAME = '_nav.md';

export const MERMAID_DIAGRAM_TYPES = new Set([
  'graph', 'flowchart', 'sequencediagram', 'classdiagram',
  'statediagram', 'erdiagram', 'pie', 'gantt', 'gitgraph',
  'mindmap', 'timeline', 'quadrantchart', 'requirementdiagram',
  'journey', 'c4context', 'c4container', 'c4component', 'c4deployment',
  'block-beta', 'sankey-beta', 'xychart-beta', 'packet-beta',
]);

interface ManifestMetadata {
  title?: string;
  version?: string;
  author?: string;
  description?: string;
  type?: string;
  status?: string;
}

interface NavigationNode {
  displayName: string;
  filePath?: string;
  children: NavigationNode[];
  isGroup: boolean;
}

interface ParsedManifest {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  raw: string;
}

interface PackageInfo {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  files: FileEntry[];
  format: 'mpk' | 'mpkz';
}

interface FileEntry {
  path: string;
  size: number;
}

interface CreateOptions {
  sourceDir: string;
  outputPath: string;
  compress?: boolean;
}

interface ExtractOptions {
  packagePath: string;
  outputDir: string;
}

interface InspectOptions {
  packagePath: string;
}

interface ListOptions {
  packagePath: string;
}

interface ManifestOptions {
  packagePath: string;
}

interface ManifestResult {
  content: string;
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
}

type ReadTarget =
  | { filePath: string }
  | { displayName: string };

interface ReadOptions {
  packagePath: string;
  target: ReadTarget;
}

interface ReadResult {
  content: string;
  filePath: string;
}

interface RenderOptions {
  syntaxHighlight?: boolean;
  mermaid?: boolean;
}

interface RenderResult {
  html: string;
}
```

**Error types (`src/pkg/errors.ts`):**

```typescript
export const PackageErrorCode = {
  INVALID_ARCHIVE: 'INVALID_ARCHIVE',
  MANIFEST_NOT_FOUND: 'MANIFEST_NOT_FOUND',
  MANIFEST_PARSE_ERROR: 'MANIFEST_PARSE_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  AMBIGUOUS_DISPLAY_NAME: 'AMBIGUOUS_DISPLAY_NAME',
  PATH_TRAVERSAL: 'PATH_TRAVERSAL',
  SOURCE_DIR_NOT_FOUND: 'SOURCE_DIR_NOT_FOUND',
  SOURCE_DIR_EMPTY: 'SOURCE_DIR_EMPTY',
  COMPRESSION_ERROR: 'COMPRESSION_ERROR',
  READ_ERROR: 'READ_ERROR',
  WRITE_ERROR: 'WRITE_ERROR',
} as const;

export type PackageErrorCode =
  (typeof PackageErrorCode)[keyof typeof PackageErrorCode];

export class PackageError extends Error {
  readonly code: PackageErrorCode;
  readonly path?: string;

  constructor(code: PackageErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'PackageError';
    this.code = code;
    this.path = path;
  }
}

export class NotImplementedError extends Error {
  constructor(name: string) {
    super(`Not implemented: ${name}`);
    this.name = 'NotImplementedError';
  }
}
```

**Module structure:**

```
src/pkg/
├── index.ts          # Public API — re-exports all functions and types
├── types.ts          # All package types + constants
├── errors.ts         # PackageError class with error codes
├── manifest/
│   ├── parser.ts     # parseManifest() — stub
│   └── scaffold.ts   # scaffoldManifest() — stub
├── tar/
│   ├── create.ts     # createPackage() — stub
│   ├── extract.ts    # extractPackage() — stub
│   ├── inspect.ts    # inspectPackage() — stub
│   ├── list.ts       # listPackage() — stub
│   ├── manifest.ts   # getManifest() — stub
│   └── read.ts       # readDocument() — stub
├── render/
│   └── index.ts      # renderMarkdown() — stub
└── cli.ts            # mdvpkg CLI — stub
```

The `src/pkg/` directory has zero imports from `src/server/`, `src/client/`, `src/shared/`, or `src/electron/`.

**Stack additions:** `tar-stream` ^3.1.8, `commander` ^14.0.3, `@types/tar-stream` ^3.1.4 (devDep).

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `src/pkg/types.ts` exports all interfaces and constants
- [ ] `src/pkg/errors.ts` exports `PackageError`, `PackageErrorCode`, `NotImplementedError`
- [ ] `src/pkg/index.ts` re-exports all types and stub functions
- [ ] All stub functions throw `NotImplementedError`
- [ ] `tests/pkg/fixtures/manifests.ts` has manifest string constants
- [ ] `tests/pkg/fixtures/workspaces.ts` has `createFixtureWorkspace()` helper
- [ ] `tests/pkg/pkg-foundation.test.ts` — 4 structural tests pass
- [ ] `npm run typecheck` passes with `src/pkg/` included
- [ ] `tar-stream`, `commander`, `@types/tar-stream` installed
- [ ] `package.json` has `bin` field for CLI entry point
- [ ] `src/pkg/` has zero imports from server/client/shared/electron

---

<!-- ====================================================================== -->
<!-- STORY 1                                                                 -->
<!-- ====================================================================== -->

# Story 1: Manifest Parsing

### Summary
<!-- Jira: Summary field -->

The manifest parser: given a manifest markdown string, produces a `ParsedManifest` with structured metadata and a navigation tree.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Implement `parseManifest()` — the foundation function that every package operation depends on. The parser extracts YAML frontmatter into structured metadata and processes the markdown body's nested list structure into a `NavigationNode` tree. Handles group labels, display name/path extraction, and error cases for malformed manifests.

**Scope**

In scope:
- YAML frontmatter extraction (present, partial, absent)
- Navigation tree construction from nested markdown lists
- Group labels from non-linked list items
- Display names and file paths from linked items
- Error handling for malformed manifests
- Edge cases: ordered lists, empty link targets, non-markdown links, paragraph text between lists, empty body

Out of scope:
- Package file operations (Stories 2–4)
- CLI (Story 5)

**Dependencies:** Story 0 (types, error class, fixtures)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** The manifest parser extracts YAML frontmatter fields into structured metadata

- **TC-1.1a: All metadata fields extracted**
  - Given: A manifest with YAML frontmatter containing title, version, author, description, type, and status
  - When: The parser processes the manifest
  - Then: Each field is available in the parsed metadata with its correct value
- **TC-1.1b: Missing frontmatter fields are absent, not defaulted**
  - Given: A manifest with frontmatter containing only title and version
  - When: The parser processes the manifest
  - Then: The parsed metadata contains title and version; other fields are undefined
- **TC-1.1c: Manifest with no frontmatter**
  - Given: A manifest with no YAML frontmatter (body only)
  - When: The parser processes the manifest
  - Then: The parsed metadata is empty; the navigation tree is still parsed from the body

**AC-1.2:** The manifest parser produces a navigation tree from nested markdown links

- **TC-1.2a: Flat list of links**
  - Given: A manifest body with a flat list of markdown links
  - When: The parser processes the manifest
  - Then: The navigation tree is a flat list of entries, each with a display name and file path
- **TC-1.2b: Nested list produces hierarchy**
  - Given: A manifest body with nested lists (top-level items with indented sub-items)
  - When: The parser processes the manifest
  - Then: The navigation tree reflects the nesting — top-level entries contain child entries at the correct depth
- **TC-1.2c: Three levels of nesting**
  - Given: A manifest with three levels of indented list items
  - When: The parser processes the manifest
  - Then: The navigation tree has three levels of hierarchy

**AC-1.3:** Non-linked list items become group labels in the navigation tree

- **TC-1.3a: Group label identified**
  - Given: A manifest with a non-linked list item ("Authentication") followed by indented linked items
  - When: The parser processes the manifest
  - Then: The non-linked item appears in the tree as a group label with no file path, and the indented items are its children
- **TC-1.3b: Group label with no children**
  - Given: A manifest with a non-linked list item followed by another top-level item (no indented children)
  - When: The parser processes the manifest
  - Then: The non-linked item appears as a group label with an empty children list

**AC-1.4:** Link text becomes the display name and link target becomes the file path in each navigation entry

- **TC-1.4a: Display name and file path extracted**
  - Given: A manifest entry `[Getting Started](getting-started.md)`
  - When: The parser processes the manifest
  - Then: The navigation entry has display name "Getting Started" and file path "getting-started.md"
- **TC-1.4b: Paths with directories preserved**
  - Given: A manifest entry `[OAuth2 Flow](auth/oauth2.md)`
  - When: The parser processes the manifest
  - Then: The navigation entry has file path "auth/oauth2.md" with the directory prefix intact

**AC-1.5:** The parser rejects manifests with structurally invalid content and reports what is wrong

- **TC-1.5a: Non-list body content**
  - Given: A manifest where the body contains only paragraphs with no list items
  - When: The parser processes the manifest
  - Then: The parser returns an error indicating the manifest body contains no navigation entries
- **TC-1.5b: Invalid YAML frontmatter**
  - Given: A manifest with malformed YAML between the `---` delimiters
  - When: The parser processes the manifest
  - Then: The parser returns an error identifying the YAML parse failure

**AC-1.6:** The parser handles non-standard list and link formats gracefully

- **TC-1.6a: Ordered list items treated as navigation entries**
  - Given: A manifest body using ordered list syntax (`1.`, `2.`) instead of unordered (`-`)
  - When: The parser processes the manifest
  - Then: The entries are parsed as navigation entries in the order they appear, regardless of numbering
- **TC-1.6b: Empty link target treated as group label**
  - Given: A manifest entry with an empty link target `[Label]()`
  - When: The parser processes the manifest
  - Then: The entry is treated as a group label (no navigable file path)
- **TC-1.6c: Link to non-markdown target preserved**
  - Given: A manifest entry linking to a non-markdown file `[Data](data.csv)`
  - When: The parser processes the manifest
  - Then: The entry is included in the navigation tree with the non-markdown file path intact
- **TC-1.6d: Paragraph text between lists ignored**
  - Given: A manifest body with paragraph text interspersed between list blocks
  - When: The parser processes the manifest
  - Then: The paragraph text is ignored; only list items form navigation entries
- **TC-1.6e: Frontmatter present but body is empty**
  - Given: A manifest with valid YAML frontmatter but no body content after it
  - When: The parser processes the manifest
  - Then: The parser returns metadata with an empty navigation tree (no error)

**AC-7.2:** Library functions accept typed option objects and return typed result objects

*Cross-cutting AC. The manifest parser satisfies this by accepting a `string` input and returning a typed `ParsedManifest`. Representative TCs (TC-7.2a, TC-7.2b) are exercised in Stories 2 and 4.*

**AC-7.3:** Library errors include an error code and a descriptive message

*Cross-cutting AC. The manifest parser satisfies this by throwing `PackageError` with `MANIFEST_PARSE_ERROR` code on malformed content. Representative TCs (TC-7.3a, TC-7.3b) are exercised in Stories 3 and 4.*

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Key interfaces:**

```typescript
interface ManifestMetadata {
  title?: string;
  version?: string;
  author?: string;
  description?: string;
  type?: string;
  status?: string;
}

interface NavigationNode {
  displayName: string;
  filePath?: string;
  children: NavigationNode[];
  isGroup: boolean;  // invariant: isGroup === true implies filePath is undefined
}

interface ParsedManifest {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  raw: string;  // original manifest file content
}
```

**Function signature (`src/pkg/manifest/parser.ts`):**

```typescript
export function parseManifest(content: string): ParsedManifest;
// Throws: PackageError with MANIFEST_PARSE_ERROR on malformed content
```

**Parsing pipeline:** Two stages. First, YAML frontmatter extraction: split on `---` delimiters, parse the YAML portion. Second, navigation tree construction: use markdown-it (already a project dependency) to tokenize the body, walk list_item tokens building the `NavigationNode` tree. Linked items become navigable entries; non-linked items become group labels. Handles ordered and unordered lists uniformly, arbitrary nesting depth, and ignores non-list content.

**Test file:** `tests/pkg/manifest-parser.test.ts` — 17 TC tests + 3 non-TC tests (deep nesting, large manifest, unicode).

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `parseManifest()` implemented in `src/pkg/manifest/parser.ts`
- [ ] All 17 TCs pass (TC-1.1a through TC-1.6e)
- [ ] Parser uses markdown-it for body tokenization
- [ ] `PackageError` with `MANIFEST_PARSE_ERROR` thrown on malformed input
- [ ] No filesystem I/O — pure function (string in, data structure out)
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 2                                                                 -->
<!-- ====================================================================== -->

# Story 2: Package Creation

### Summary
<!-- Jira: Summary field -->

Library function to create `.mpk` and `.mpkz` packages from a source directory, with manifest auto-scaffolding when no manifest exists.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Implement `createPackage()` and `scaffoldManifest()`. The creation function validates the source directory, checks for a manifest (auto-scaffolding one to disk if absent), bundles all files into a tar archive preserving directory hierarchy, and optionally compresses with gzip.

**Scope**

In scope:
- `.mpk` (tar) and `.mpkz` (gzip-compressed tar) package creation
- Auto-scaffolding manifest to disk when no `_nav.md` exists
- Directory hierarchy preservation in tar entries
- Supporting asset inclusion (images, etc.)
- Error handling for missing/empty source directories
- Overwrite existing output files

Out of scope:
- Package extraction (Story 3)
- Package inspection/reading (Story 4)

**Dependencies:** Story 1 (manifest parsing for detection and validation)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-2.1:** Creating a package from a directory produces a `.mpk` tar file containing all source files

- **TC-2.1a: Package created with correct files**
  - Given: A directory with a manifest and three markdown files
  - When: The user creates a package from that directory
  - Then: A `.mpk` file is produced that contains the manifest and all three markdown files
- **TC-2.1b: Supporting assets included**
  - Given: A directory with markdown files and an `images/` subdirectory containing PNG files
  - When: The user creates a package
  - Then: The `.mpk` file contains the image files at their original relative paths
- **TC-2.1c: Directory hierarchy preserved in tar**
  - Given: A directory with files in nested subdirectories (`docs/api/auth.md`, `docs/api/payments.md`)
  - When: The user creates a package
  - Then: The files appear in the tar at the same relative paths they had in the source directory

**AC-2.2:** If the source directory has no manifest file, the tool auto-scaffolds one

- **TC-2.2a: Manifest scaffolded to disk and included in package**
  - Given: A directory with markdown files but no manifest
  - When: The user creates a package
  - Then: A manifest file is written to the source directory on disk and included in the package at the root
- **TC-2.2b: Scaffolded manifest contains entries for all markdown files**
  - Given: A directory with `readme.md`, `guide.md`, and `reference.md` but no manifest
  - When: The tool scaffolds a manifest
  - Then: The manifest body contains navigation entries linking to each markdown file
- **TC-2.2c: Existing manifest is not overwritten**
  - Given: A directory with an existing manifest containing custom navigation
  - When: The user creates a package
  - Then: The existing manifest is included as-is; no scaffolding occurs

**AC-2.3:** Creating with compression produces a `.mpkz` file

- **TC-2.3a: Compressed package created**
  - Given: A source directory with markdown files and a manifest
  - When: The user creates a package with compression enabled
  - Then: A `.mpkz` file is produced that is smaller than the equivalent `.mpk`
- **TC-2.3b: Compressed package is valid gzip**
  - Given: A `.mpkz` file produced by the create command
  - When: The file is decompressed with standard gzip
  - Then: The result is a valid tar archive containing the expected files

**AC-2.4:** Creating a package from a nonexistent or empty directory produces a clear error

- **TC-2.4a: Source directory does not exist**
  - Given: A path that does not exist on the filesystem
  - When: The user attempts to create a package from it
  - Then: The operation fails with an error identifying the missing directory
- **TC-2.4b: Source directory is empty**
  - Given: An empty directory with no files
  - When: The user attempts to create a package from it
  - Then: The operation fails with an error indicating no files to package

**AC-2.5:** Creating a package when the output path already exists overwrites the existing file

- **TC-2.5a: Output file overwritten**
  - Given: An output path where a `.mpk` file already exists
  - When: The user creates a new package with the same output path
  - Then: The existing file is replaced with the new package

**AC-7.2:** Library functions accept typed option objects and return typed result objects

- **TC-7.2a: Typed inputs enforced**
  - Given: A library function call with an options object missing a required field
  - When: The function is called
  - Then: A type error or validation error is produced before the operation runs

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Key interfaces:**

```typescript
interface CreateOptions {
  sourceDir: string;
  outputPath: string;
  compress?: boolean;  // false → .mpk, true → .mpkz
}
```

**Function signatures:**

```typescript
// src/pkg/tar/create.ts
export async function createPackage(options: CreateOptions): Promise<void>;
// Throws: PackageError with SOURCE_DIR_NOT_FOUND or SOURCE_DIR_EMPTY

// src/pkg/manifest/scaffold.ts
export async function scaffoldManifest(sourceDir: string): Promise<string>;
// Discovers *.md files, sorts alphabetically by relative path (case-insensitive),
// generates manifest with navigation entries linking to each file.
```

**Creation flow:** Validate sourceDir exists and is non-empty → check for `_nav.md` → if absent, call `scaffoldManifest()` and write to disk → walk directory recursively → create tar entries with `tar-stream` pack for each file → if `compress: true`, pipe through `zlib.createGzip()` → write to outputPath (overwrite if exists).

**Test file:** `tests/pkg/create-package.test.ts` — 12 TC tests + 2 non-TC tests (symlink handling, no-markdown-files directory).

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `createPackage()` implemented in `src/pkg/tar/create.ts`
- [ ] `scaffoldManifest()` implemented in `src/pkg/manifest/scaffold.ts`
- [ ] All 12 TCs pass (TC-2.1a through TC-2.5a, TC-7.2a)
- [ ] Auto-scaffolded manifest written to disk and included in package
- [ ] Scaffold entries sorted alphabetically by path (case-insensitive)
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 3                                                                 -->
<!-- ====================================================================== -->

# Story 3: Package Extraction

### Summary
<!-- Jira: Summary field -->

Library function to extract `.mpk` and `.mpkz` packages to a target directory, with path traversal safety, directory creation, and overwrite behavior.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Implement `extractPackage()`. The function reads a package file, detects compressed format by extension, decompresses if needed, creates the output directory structure, and writes all entries while validating each path against directory traversal attacks.

**Scope**

In scope:
- `.mpk` tar extraction preserving directory structure
- `.mpkz` gzip decompression before tar extraction
- Overwrite existing files at conflicting paths
- Create nonexistent output directories (including intermediate)
- Path traversal safety — reject `..` segments and absolute paths
- Error handling for invalid/corrupted archives

Out of scope:
- Package creation (Story 2)
- Package inspection/reading (Story 4)

**Dependencies:** Story 2 (needs created packages to extract in tests)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** Extracting a `.mpk` file recreates the original directory structure with all files

- **TC-3.1a: Full extraction preserves structure**
  - Given: A `.mpk` package containing a manifest, markdown files, and images in subdirectories
  - When: The user extracts it to an output directory
  - Then: The output directory contains all files at their original relative paths
- **TC-3.1b: Extracted files match originals**
  - Given: A `.mpk` package created from a source directory
  - When: The user extracts it
  - Then: Each extracted file is byte-identical to the corresponding source file

**AC-3.2:** Extracting a `.mpkz` file decompresses and recreates the directory structure

- **TC-3.2a: Compressed package extracts correctly**
  - Given: A `.mpkz` package
  - When: The user extracts it
  - Then: The output is identical to extracting the equivalent uncompressed `.mpk`

**AC-3.3:** Extracting to a directory with conflicting files overwrites them

- **TC-3.3a: Overwrite behavior**
  - Given: An output directory that already contains a file with the same path as one in the package
  - When: The user extracts the package to that directory
  - Then: The existing file is overwritten with the package version

**AC-3.4:** Extracting an invalid file produces a clear error

- **TC-3.4a: Not a tar archive**
  - Given: A file that is not a valid tar archive (e.g., a plain text file renamed to `.mpk`)
  - When: The user attempts to extract it
  - Then: The operation fails with an error identifying the file as not a valid package
- **TC-3.4b: Corrupted compressed archive**
  - Given: A `.mpkz` file with corrupted gzip data
  - When: The user attempts to extract it
  - Then: The operation fails with an error identifying the compression failure

**AC-3.5:** Extracting to a nonexistent output directory creates the directory and any intermediate directories

- **TC-3.5a: Output directory created**
  - Given: An output path where the directory does not exist (e.g., `output/nested/dir`)
  - When: The user extracts a package to that path
  - Then: The full directory path is created and the package files are extracted into it

**AC-3.6:** Extraction rejects tar entries with paths that would escape the output directory

- **TC-3.6a: Path traversal blocked**
  - Given: A tar archive containing an entry with a path like `../../etc/malicious`
  - When: The user extracts the archive
  - Then: The operation fails with an error identifying the unsafe path entry
- **TC-3.6b: Absolute path blocked**
  - Given: A tar archive containing an entry with an absolute path like `/etc/passwd`
  - When: The user extracts the archive
  - Then: The operation fails with an error identifying the unsafe path entry

**AC-7.3:** Library errors include an error code and a descriptive message

- **TC-7.3a: Error code present**
  - Given: A library function call that fails (e.g., reading from an invalid archive)
  - When: The error is caught
  - Then: The error object has a `code` property with a value from the defined error code set

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Key interfaces:**

```typescript
interface ExtractOptions {
  packagePath: string;
  outputDir: string;
}
```

**Function signature (`src/pkg/tar/extract.ts`):**

```typescript
export async function extractPackage(options: ExtractOptions): Promise<void>;
// Throws: PackageError with INVALID_ARCHIVE, COMPRESSION_ERROR, or PATH_TRAVERSAL
```

**Extraction flow:** Read package file → detect `.mpkz` by extension, pipe through `zlib.createGunzip()` if needed → `mkdir(outputDir, { recursive: true })` → pipe to `tar-stream` extract → for each entry: resolve full output path, verify it starts with outputDir prefix (path traversal check), `mkdir` parent dirs, write content → overwrite existing files.

**Path traversal safety:** Before writing any entry, resolve the full output path and verify it starts with the resolved output directory prefix. Entries with `..` segments or absolute paths are rejected with `PATH_TRAVERSAL` error. A `createTraversalTar()` test helper creates malicious tar files using tar-stream pack API directly.

**Test file:** `tests/pkg/extract-package.test.ts` — 10 TC tests + 2 non-TC tests (unicode filenames, very long paths).

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `extractPackage()` implemented in `src/pkg/tar/extract.ts`
- [ ] All 10 TCs pass (TC-3.1a through TC-3.6b, TC-7.3a)
- [ ] Path traversal validation blocks `..` segments and absolute paths
- [ ] Round-trip fidelity: create then extract produces byte-identical files
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 4                                                                 -->
<!-- ====================================================================== -->

# Story 4: Package Inspection and Reading

### Summary
<!-- Jira: Summary field -->

Library functions for inspecting package contents (info, ls, manifest) and reading individual documents by file path or display name — all without full extraction.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Implement four library functions: `inspectPackage()` returns metadata and navigation tree, `listPackage()` returns all files with paths and sizes, `getManifest()` returns raw manifest content plus parsed data, and `readDocument()` retrieves a single document by file path or navigation display name. All operations read from the tar archive without extracting to disk.

**Scope**

In scope:
- `inspectPackage()` — metadata, navigation tree, file listing, format detection
- `listPackage()` — file paths and sizes, sorted ascending by path
- `getManifest()` — raw manifest content plus parsed metadata and navigation
- `readDocument()` — by file path or by display name via manifest resolution
- Ambiguous display name detection and error
- Error handling for invalid archives, missing manifests, missing files

Out of scope:
- Package creation/extraction (Stories 2–3)
- CLI wrapping (Story 5)

**Dependencies:** Story 2 (needs created packages to inspect and read in tests)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-4.1:** The info operation displays package metadata from the manifest frontmatter

- **TC-4.1a: Metadata fields displayed**
  - Given: A package with manifest frontmatter containing title, version, author, and description
  - When: The user runs info on the package
  - Then: The output includes each metadata field and its value
- **TC-4.1b: Package with no metadata**
  - Given: A package whose manifest has no YAML frontmatter
  - When: The user runs info
  - Then: The output indicates no metadata is present, and the navigation tree is still displayed
- **TC-4.1c: Info on invalid archive**
  - Given: A file that is not a valid tar archive
  - When: The user runs info on it
  - Then: The operation fails with an error identifying the file as not a valid package

**AC-4.2:** The info operation displays the navigation tree structure

- **TC-4.2a: Hierarchical navigation tree shown**
  - Given: A package with a manifest defining a nested navigation tree with group labels
  - When: The user runs info
  - Then: The output shows the tree with hierarchy indicated by indentation; linked entries show their display name and file path; group labels show their name without a file path
- **TC-4.2b: Flat navigation list**
  - Given: A package with a manifest containing only top-level entries (no nesting)
  - When: The user runs info
  - Then: The output shows a flat list of navigation entries

**AC-4.3:** The ls operation lists all files in the package with their paths and sizes

- **TC-4.3a: File listing with sizes**
  - Given: A package containing five files
  - When: The user runs ls on the package
  - Then: The output lists all five files, each with its path and size
- **TC-4.3b: Files sorted by path**
  - Given: A package with files in multiple directories
  - When: The user runs ls
  - Then: The files are listed in ascending sorted order by path

**AC-4.4:** The manifest operation outputs the raw manifest file content

- **TC-4.4a: Raw manifest output**
  - Given: A package with a manifest
  - When: The user runs manifest on the package
  - Then: The output is the exact content of the manifest file, including YAML frontmatter delimiters and markdown body
- **TC-4.4b: Package with no manifest**
  - Given: A package that has no manifest file (e.g., a raw tar of markdown files)
  - When: The user runs manifest
  - Then: The operation fails with an error indicating no manifest was found in the package
- **TC-4.4c: Manifest on invalid archive**
  - Given: A file that is not a valid tar archive
  - When: The user runs manifest on it
  - Then: The operation fails with an error identifying the file as not a valid package

**AC-5.1:** The read operation retrieves a document by its file path within the package

- **TC-5.1a: Read by file path**
  - Given: A package containing `auth/oauth2.md`
  - When: The user reads `auth/oauth2.md`
  - Then: The operation outputs the full content of that file
- **TC-5.1b: File path not found**
  - Given: A package that does not contain `nonexistent.md`
  - When: The user reads `nonexistent.md`
  - Then: The operation fails with an error identifying the missing file path
- **TC-5.1c: Read from invalid archive**
  - Given: A file that is not a valid tar archive
  - When: The user attempts to read a document from it
  - Then: The operation fails with an error identifying the file as not a valid package

**AC-5.2:** The read operation retrieves a document by its navigation display name

- **TC-5.2a: Read by display name**
  - Given: A package whose manifest maps "OAuth2 Flow" to `auth/oauth2.md`
  - When: The user reads by display name "OAuth2 Flow"
  - Then: The operation outputs the content of `auth/oauth2.md`
- **TC-5.2b: Display name not found**
  - Given: A package whose manifest has no entry with display name "Nonexistent"
  - When: The user reads by display name "Nonexistent"
  - Then: The operation fails with an error indicating no navigation entry matches that name
- **TC-5.2c: Ambiguous display name**
  - Given: A package whose manifest has two entries with the same display name in different groups
  - When: The user reads by that display name
  - Then: The operation fails with an error listing the matching entries and their file paths

**AC-7.2:** Library functions accept typed option objects and return typed result objects

- **TC-7.2b: Typed return values**
  - Given: A library function call (e.g., `inspectPackage`)
  - When: The function completes
  - Then: The return value conforms to the documented result type (e.g., `PackageInfo`)

**AC-7.3:** Library errors include an error code and a descriptive message

- **TC-7.3b: Error message is descriptive**
  - Given: A library function call that fails because a file is not found in the package
  - When: The error message is read
  - Then: The message describes what was not found and where it was expected

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Key interfaces:**

```typescript
interface InspectOptions {
  packagePath: string;
}

interface PackageInfo {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  files: FileEntry[];          // sorted ascending by path
  format: 'mpk' | 'mpkz';
}

interface FileEntry {
  path: string;
  size: number;
}

interface ListOptions {
  packagePath: string;
}

interface ManifestOptions {
  packagePath: string;
}

interface ManifestResult {
  content: string;             // raw manifest file content
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
}

type ReadTarget =
  | { filePath: string }
  | { displayName: string };

interface ReadOptions {
  packagePath: string;
  target: ReadTarget;
}

interface ReadResult {
  content: string;
  filePath: string;            // resolved path (always populated)
}
```

**Function signatures:**

```typescript
// src/pkg/tar/inspect.ts
export async function inspectPackage(options: InspectOptions): Promise<PackageInfo>;
// Throws: PackageError with INVALID_ARCHIVE or MANIFEST_NOT_FOUND

// src/pkg/tar/list.ts
export async function listPackage(options: ListOptions): Promise<FileEntry[]>;
// Throws: PackageError with INVALID_ARCHIVE

// src/pkg/tar/manifest.ts
export async function getManifest(options: ManifestOptions): Promise<ManifestResult>;
// Throws: PackageError with INVALID_ARCHIVE or MANIFEST_NOT_FOUND

// src/pkg/tar/read.ts
export async function readDocument(options: ReadOptions): Promise<ReadResult>;
// Throws: PackageError with FILE_NOT_FOUND, AMBIGUOUS_DISPLAY_NAME, or INVALID_ARCHIVE
```

**Display name resolution in `readDocument()`:** When target has `displayName`, the function reads the manifest, parses the navigation tree, and searches for matching entries. If multiple entries share the same display name, it fails with `AMBIGUOUS_DISPLAY_NAME` listing the matches and their file paths.

**Test files:**
- `tests/pkg/inspect-package.test.ts` — 11 TC tests + 1 non-TC (compressed inspection)
- `tests/pkg/read-document.test.ts` — 7 TC tests + 1 non-TC (compressed read)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `inspectPackage()` implemented in `src/pkg/tar/inspect.ts`
- [ ] `listPackage()` implemented in `src/pkg/tar/list.ts`
- [ ] `getManifest()` implemented in `src/pkg/tar/manifest.ts`
- [ ] `readDocument()` implemented in `src/pkg/tar/read.ts`
- [ ] All 18 TCs pass (TC-4.1a through TC-4.4c, TC-5.1a through TC-5.2c, TC-7.2b, TC-7.3b)
- [ ] File listing sorted ascending by path
- [ ] Display name ambiguity detected and reported
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 5                                                                 -->
<!-- ====================================================================== -->

# Story 5: CLI Interface (`mdvpkg`)

### Summary
<!-- Jira: Summary field -->

The `mdvpkg` CLI wrapping all library operations: six commands with help output, argument parsing, exit codes, and error message formatting. Validates library-CLI parity.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Implement the `mdvpkg` CLI as a thin wrapper over the library API. Commander handles argument parsing and help generation. Each command's `.action()` handler calls the corresponding library function, formats the output, and manages exit codes. Every CLI operation produces identical results to the library function.

**Scope**

In scope:
- Six commands: `create`, `extract`, `info`, `ls`, `read`, `manifest`
- Top-level help listing all commands
- Per-command help with argument descriptions
- Exit code 0 on success, non-zero on failure
- Error messages including the command name and relevant file path
- Library-CLI parity validation

Out of scope:
- Library function implementation (Stories 1–4)
- Rendering library (Story 6)

**Dependencies:** Story 4 (all library operations available)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-6.1:** `mdvpkg` provides a top-level help listing all available commands with descriptions

- **TC-6.1a: Help output lists all commands**
  - Given: The user runs `mdvpkg --help` or `mdvpkg` with no arguments
  - When: The output is displayed
  - Then: All six commands are listed, each with a brief description

**AC-6.2:** Each command provides its own help with argument descriptions

- **TC-6.2a: Command-level help**
  - Given: The user runs `mdvpkg create --help`
  - When: The output is displayed
  - Then: The command's required and optional arguments are listed with descriptions

**AC-6.3:** Successful operations exit with code 0; failures exit with non-zero

- **TC-6.3a: Success exit code**
  - Given: A valid create operation
  - When: The operation completes successfully
  - Then: The process exits with code 0
- **TC-6.3b: Failure exit code**
  - Given: An extract operation targeting a nonexistent file
  - When: The operation fails
  - Then: The process exits with a non-zero code

**AC-6.4:** Error messages identify the problem and include the relevant file path or argument

- **TC-6.4a: Error message includes path**
  - Given: An operation that fails because a file is not found
  - When: The error message is displayed
  - Then: The message includes the file path that was not found
- **TC-6.4b: Error message includes operation context**
  - Given: An operation that fails
  - When: The error message is displayed
  - Then: The message identifies which command failed (e.g., "extract: file not found")

**AC-7.1:** Every CLI operation has a corresponding library function

- **TC-7.1a: Library create matches CLI create**
  - Given: A source directory
  - When: The library `createPackage` function is called with the same inputs the CLI would receive
  - Then: The resulting package file is identical to one produced by the CLI
- **TC-7.1b: Library function exists for each command**
  - Given: The six CLI commands (create, extract, info, ls, read, manifest)
  - When: The library API is inspected
  - Then: Each command has a corresponding exported function

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**CLI entry point (`src/pkg/cli.ts`):**

Commander v14 program with six commands. Each `.command().description().argument().option().action()` maps to a library function from `src/pkg/index.ts`.

**Command structure:**

```
mdvpkg create <sourceDir> -o <outputPath> [--compress]
mdvpkg extract <packagePath> -o <outputDir>
mdvpkg info <packagePath>
mdvpkg ls <packagePath>
mdvpkg read <packagePath> --file <filePath> | --name <displayName>
mdvpkg manifest <packagePath>
```

**Error formatting:** Shared error handler extracts `PackageError` code and message, outputs to stderr as `${command}: ${error.message}`, exits with code 1.

**CLI tests:** Run `mdvpkg` as subprocess via `node --import tsx src/pkg/cli.ts` and check stdout, stderr, and exit codes.

**Test file:** `tests/pkg/cli.test.ts` — 8 TC tests + 2 non-TC tests (unknown command, --version flag).

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `src/pkg/cli.ts` implemented with Commander
- [ ] All 8 TCs pass (TC-6.1a through TC-6.4b, TC-7.1a, TC-7.1b)
- [ ] All six commands present with help text
- [ ] Error messages include command name and relevant path
- [ ] Exit code 0 on success, non-zero on failure
- [ ] CLI produces identical results to direct library calls
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 6                                                                 -->
<!-- ====================================================================== -->

# Story 6: Rendering Library Exposure

### Summary
<!-- Jira: Summary field -->

The existing markdown rendering pipeline (markdown-it, Shiki, Mermaid) wrapped and exported as a standalone importable library — no viewer or server dependencies.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Extract the pure markdown-to-HTML transform from the existing `RenderService` and expose it as `renderMarkdown()`. The function uses the same markdown-it + Shiki pipeline but omits server-specific concerns: no image processing, no DOMPurify, no layout hints. Mermaid code blocks become structured placeholder divs with basic structural validation. The rendering library is independently importable — no Fastify, HTTP listener, or browser required.

**Scope**

In scope:
- Markdown-to-HTML rendering with Shiki syntax highlighting
- Mermaid code block processing into placeholder divs
- Basic Mermaid validation (empty blocks, unrecognized diagram types → error div)
- Standalone import without viewer/server/browser
- Configuration options (syntax highlighting on/off, mermaid on/off)

Out of scope:
- Full Mermaid syntax validation (requires browser runtime)
- Image processing, DOMPurify sanitization, layout hints
- Package operations (Stories 1–5)

**Dependencies:** Story 0 (types and error class). Independent of Stories 1–5 — can be implemented in parallel.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-8.1:** The rendering library converts markdown to HTML with syntax highlighting applied to fenced code blocks

- **TC-8.1a: Basic rendering**
  - Given: A markdown string containing a heading and a paragraph
  - When: The rendering library processes it
  - Then: The result is HTML with the corresponding heading and paragraph elements
- **TC-8.1b: Syntax highlighting**
  - Given: A markdown string with a fenced JavaScript code block
  - When: The rendering library processes it
  - Then: The result contains a `pre` element with syntax-highlighted spans

**AC-8.2:** The rendering library processes Mermaid code blocks into diagram markup

- **TC-8.2a: Mermaid processing**
  - Given: A markdown string with a `mermaid` fenced code block containing a valid diagram definition
  - When: The rendering library processes it
  - Then: The result contains rendered diagram markup in place of the raw code block
- **TC-8.2b: Invalid Mermaid rendered as inline error**
  - Given: A markdown string with a `mermaid` fenced code block containing invalid syntax
  - When: The rendering library processes it
  - Then: The returned HTML contains a styled error message in place of the diagram; no exception is thrown

**AC-8.3:** The rendering library is importable independently of the viewer and server

- **TC-8.3a: Standalone import**
  - Given: A Node.js script outside the viewer application
  - When: The script imports the rendering library
  - Then: The import succeeds without requiring viewer or server modules
- **TC-8.3b: No server dependency**
  - Given: The rendering library is imported
  - When: A markdown string is rendered
  - Then: No Fastify server, HTTP listener, or browser is required for the render to complete

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Key interfaces:**

```typescript
interface RenderOptions {
  syntaxHighlight?: boolean;   // default: true
  mermaid?: boolean;           // default: true
}

interface RenderResult {
  html: string;
}
```

**Function signature (`src/pkg/render/index.ts`):**

```typescript
export async function renderMarkdown(
  markdown: string,
  options?: RenderOptions,
): Promise<RenderResult>;
```

**Rendering pipeline:** Lazy-init Shiki highlighter (cached for subsequent calls, same language set as existing `RenderService`). Create markdown-it instance with Shiki plugin. Render markdown to HTML.

**Mermaid handling:** When `mermaid: true` (default), mermaid fenced code blocks are transformed:
- Valid structure (non-empty, first token matches a known diagram type keyword from `MERMAID_DIAGRAM_TYPES`) → wrapped in `<div class="mermaid-diagram">` placeholder
- Invalid structure (empty, or unrecognized first token) → wrapped in `<div class="mermaid-error">` error div
- When `mermaid: false`, mermaid blocks remain as standard `<pre><code class="language-mermaid">` elements

**Spec deviation for TC-8.2b:** Full Mermaid syntax validation requires a runtime (browser or Puppeteer), which contradicts TC-8.3b. The rendering library provides basic structural validation only. Full validation is available via `MermaidSsrService` for consumers with Puppeteer.

**Test file:** `tests/pkg/render-library.test.ts` — 6 TC tests + 2 non-TC tests (empty input, mermaid:false).

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `renderMarkdown()` implemented in `src/pkg/render/index.ts`
- [ ] All 6 TCs pass (TC-8.1a through TC-8.3b)
- [ ] Shiki highlighter lazy-initialized and cached
- [ ] Mermaid placeholder divs generated for valid blocks, error divs for invalid
- [ ] No imports from `src/server/`, `src/client/`, or `src/electron/`
- [ ] Import succeeds without Fastify, HTTP listener, or browser
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- INTEGRATION PATH TRACE                                                   -->
<!-- ====================================================================== -->

# Integration Path Trace

Three critical end-to-end user paths traced through the story breakdown. Every segment has a story owner and at least one TC.

## Path 1: Package Round-Trip (Create → Extract → Verify)

The most important user path: create a package from a directory, extract it elsewhere, and confirm the files are identical.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Manifest exists/parsed | Tool checks for manifest at source root | Story 1 | TC-1.1a |
| Manifest auto-scaffold | No manifest → scaffold one to disk | Story 2 | TC-2.2a, TC-2.2b |
| Bundle all files into tar | Directory → .mpk with all files | Story 2 | TC-2.1a, TC-2.1b, TC-2.1c |
| Optional gzip compression | .mpk → .mpkz | Story 2 | TC-2.3a, TC-2.3b |
| Detect format | .mpkz → decompress before extraction | Story 3 | TC-3.2a |
| Create output directory | Nonexistent output → mkdir recursive | Story 3 | TC-3.5a |
| Path safety validation | Reject traversal and absolute paths | Story 3 | TC-3.6a, TC-3.6b |
| Extract all entries | Tar entries → files at original paths | Story 3 | TC-3.1a |
| Round-trip fidelity | Extracted files byte-identical to originals | Story 3 | TC-3.1b |

## Path 2: Package Inspect and Read (Create → Info/Ls/Read)

User creates a package, then inspects its contents and reads individual documents without extracting.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Create package | Directory → .mpk | Story 2 | TC-2.1a |
| Inspect metadata | Info shows manifest frontmatter fields | Story 4 | TC-4.1a |
| Inspect navigation | Info shows hierarchical navigation tree | Story 4 | TC-4.2a |
| List files | Ls shows all files with paths and sizes | Story 4 | TC-4.3a |
| Get raw manifest | Manifest command outputs raw content | Story 4 | TC-4.4a |
| Read by file path | Read extracts single file by path | Story 4 | TC-5.1a |
| Read by display name | Read resolves display name → file path via manifest | Story 4 | TC-5.2a |
| Ambiguity detection | Multiple display name matches → error | Story 4 | TC-5.2c |

## Path 3: CLI Wraps Library (CLI → Library → Filesystem)

User invokes `mdvpkg` CLI commands — each command calls the corresponding library function with identical behavior.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Top-level help | mdvpkg --help lists all 6 commands | Story 5 | TC-6.1a |
| Command help | mdvpkg create --help shows arguments | Story 5 | TC-6.2a |
| CLI-library parity | CLI create produces identical package to library | Story 5 | TC-7.1a |
| All functions exported | 6 CLI commands → 6 library exports | Story 5 | TC-7.1b |
| Success exit code | Successful operation → exit 0 | Story 5 | TC-6.3a |
| Failure exit code | Failed operation → non-zero exit | Story 5 | TC-6.3b |
| Error formatting | Error includes command name and file path | Story 5 | TC-6.4a, TC-6.4b |

**No gaps identified.** Every segment has a story owner and at least one TC.

---

<!-- ====================================================================== -->
<!-- COVERAGE GATE                                                            -->
<!-- ====================================================================== -->

# Coverage Gate

Every AC and TC from the epic mapped to exactly one story. No orphans.

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a, TC-1.1b, TC-1.1c | Story 1 |
| AC-1.2 | TC-1.2a, TC-1.2b, TC-1.2c | Story 1 |
| AC-1.3 | TC-1.3a, TC-1.3b | Story 1 |
| AC-1.4 | TC-1.4a, TC-1.4b | Story 1 |
| AC-1.5 | TC-1.5a, TC-1.5b | Story 1 |
| AC-1.6 | TC-1.6a, TC-1.6b, TC-1.6c, TC-1.6d, TC-1.6e | Story 1 |
| AC-2.1 | TC-2.1a, TC-2.1b, TC-2.1c | Story 2 |
| AC-2.2 | TC-2.2a, TC-2.2b, TC-2.2c | Story 2 |
| AC-2.3 | TC-2.3a, TC-2.3b | Story 2 |
| AC-2.4 | TC-2.4a, TC-2.4b | Story 2 |
| AC-2.5 | TC-2.5a | Story 2 |
| AC-3.1 | TC-3.1a, TC-3.1b | Story 3 |
| AC-3.2 | TC-3.2a | Story 3 |
| AC-3.3 | TC-3.3a | Story 3 |
| AC-3.4 | TC-3.4a, TC-3.4b | Story 3 |
| AC-3.5 | TC-3.5a | Story 3 |
| AC-3.6 | TC-3.6a, TC-3.6b | Story 3 |
| AC-4.1 | TC-4.1a, TC-4.1b, TC-4.1c | Story 4 |
| AC-4.2 | TC-4.2a, TC-4.2b | Story 4 |
| AC-4.3 | TC-4.3a, TC-4.3b | Story 4 |
| AC-4.4 | TC-4.4a, TC-4.4b, TC-4.4c | Story 4 |
| AC-5.1 | TC-5.1a, TC-5.1b, TC-5.1c | Story 4 |
| AC-5.2 | TC-5.2a, TC-5.2b, TC-5.2c | Story 4 |
| AC-6.1 | TC-6.1a | Story 5 |
| AC-6.2 | TC-6.2a | Story 5 |
| AC-6.3 | TC-6.3a, TC-6.3b | Story 5 |
| AC-6.4 | TC-6.4a, TC-6.4b | Story 5 |
| AC-7.1 | TC-7.1a, TC-7.1b | Story 5 |
| AC-7.2 | TC-7.2a | Story 2 |
| AC-7.2 | TC-7.2b | Story 4 |
| AC-7.3 | TC-7.3a | Story 3 |
| AC-7.3 | TC-7.3b | Story 4 |
| AC-8.1 | TC-8.1a, TC-8.1b | Story 6 |
| AC-8.2 | TC-8.2a, TC-8.2b | Story 6 |
| AC-8.3 | TC-8.3a, TC-8.3b | Story 6 |

**Summary:**
- 33 ACs mapped (all 33 from epic)
- 71 TCs mapped (all 71 from epic), each to exactly one story
- Story 0: 0 TCs (foundation/scaffolding)
- Story 1: 17 TCs
- Story 2: 12 TCs
- Story 3: 10 TCs
- Story 4: 18 TCs
- Story 5: 8 TCs
- Story 6: 6 TCs
