# Epic 8: Package Format Foundation

This epic defines the complete requirements for the markdown package format
library and CLI tool. It serves as the source of truth for the Tech Lead's
design work.

---

## User Profile

**Primary User:** Technical user who works with structured markdown collections — specs, documentation, agent outputs
**Context:** Bundling, sharing, inspecting, and extracting markdown collections from the command line or programmatically, without a viewer or server
**Mental Model:** "I have a folder of markdown files with a manifest that defines the navigation. I collapse it into a single file I can share, and anyone can inspect or extract it."
**Key Constraint:** Must be independently usable — library + CLI only, no viewer or server dependencies

---

## Feature Overview

After this epic, the user can create `.mpk` (tar) and `.mpkz` (compressed tar)
packages from directories of markdown files, where a manifest file at the
package root defines metadata and a navigation tree. They can inspect packages
to see metadata, navigation structure, and file listings without extracting.
They can extract packages back to directories, preserving the original
structure. They can read individual documents from packages by file path or
navigation display name. All operations are available as both a CLI tool and a
programmatic library API. The markdown rendering pipeline (markdown-to-HTML with
syntax highlighting and Mermaid support) is also exposed as a standalone library
for external use.

---

## Scope

### In Scope

Package format specification, manifest convention, parsing, tar read/write, CLI
tooling, and library API — everything needed to create, inspect, extract, and
read markdown packages without the viewer:

- Package format: `.mpk` as tar, `.mpkz` as gzip-compressed tar. A manifest file at the root, markdown files, and supporting assets (images, etc.), preserving directory hierarchy.
- Manifest convention: a markdown file at the package root with optional YAML frontmatter (title, version, author, description, type, status) and a markdown body of nested lists with links defining the navigation tree.
- Manifest parser: produces a structured navigation tree from the manifest markdown — hierarchy from nesting, display names from link text, file paths from link targets, group labels from non-linked list items.
- Package creation from a directory, with auto-scaffolded manifest if none exists. Compression to `.mpkz`.
- Package extraction to a directory, preserving original structure.
- Package inspection: metadata, navigation tree, file listings — all without extracting.
- Single document reading by file path or navigation display name.
- `mdvpkg` CLI wrapping all library operations: `create`, `extract`, `info`, `ls`, `read`, `manifest`.
- Library API: programmatic access to all operations with typed inputs and outputs.
- Rendering library exposure: the existing markdown-to-HTML pipeline (markdown-it, Shiki, Mermaid) accessible as an importable library. Additive to the package core and non-gating for Epic 9.

### Out of Scope

- Viewer integration — opening packages in the viewer UI (Epic 9)
- Package-mode sidebar navigation (Epic 9)
- Manifest editing within the viewer (Epic 9)
- Batch operations across multiple packages
- Package versioning or diffing
- Publishing packages to a registry
- LLM preamble / agent-optimized summaries (future)
- Streaming tar reads (optimization — extract-to-temp is sufficient for expected package sizes)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | tar-stream handles expected package sizes (dozens of files, a few MB) without performance issues | Unvalidated | Tech Lead | From TA1 in Technical Architecture |
| A2 | Node built-in zlib is sufficient for .mpkz compression/decompression | Unvalidated | Tech Lead | No external compression dependency needed |
| A3 | The manifest convention covers the navigation needs of the target use cases (specs, docs, agent outputs) | Unvalidated | Product | May need revision after real-world usage |
| A4 | A single canonical manifest file name is sufficient (no fallback chain) | Unvalidated | Tech Lead | Candidates: `_nav.md`, `_index.md`, `manifest.md` |
| A5 | Supporting assets (images) referenced by relative paths from markdown files have those paths preserved in the tar structure | Unvalidated | Tech Lead | Standard tar behavior |

---

## Flows & Requirements

### 1. Manifest Structure and Parsing

The manifest is a markdown file at the package root. It has two parts: optional
YAML frontmatter containing package metadata, and a markdown body containing
nested lists with links that define the navigation tree. The parser reads this
file and produces a structured navigation tree that downstream consumers (the
viewer, CLI inspection commands, other tools) use directly.

A manifest looks like this:

```markdown
---
title: API Documentation
version: 2.1.0
author: Platform Team
description: REST API reference for the payment service
type: reference
status: published
---

- [Getting Started](getting-started.md)
- Authentication
  - [OAuth2 Flow](auth/oauth2.md)
  - [API Keys](auth/api-keys.md)
- Endpoints
  - [Payments](endpoints/payments.md)
  - [Refunds](endpoints/refunds.md)
  - [Webhooks](endpoints/webhooks.md)
- [Changelog](changelog.md)
```

In this example, "Authentication" and "Endpoints" are group labels (non-linked
items). Everything else is a navigable entry (linked item with display name and
file path).

1. Tool reads the manifest file from the package root
2. Parser extracts YAML frontmatter into structured metadata
3. Parser processes the markdown body — nested lists become the navigation tree
4. Linked items become navigable entries (display name from link text, file path from link target)
5. Non-linked items become group labels
6. Parser returns a `ParsedManifest` with metadata and navigation tree

#### Acceptance Criteria

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

### 2. Package Creation

Package creation takes a source directory and produces a `.mpk` (tar) or
`.mpkz` (compressed tar) file. The package includes all markdown files,
supporting assets, and the manifest. If the source directory has no manifest,
the tool auto-scaffolds one with navigation entries for every markdown file
found.

1. User points the tool at a source directory
2. The tool checks for a manifest file at the directory root
3. If no manifest exists, the tool scaffolds one with entries for all markdown files
4. The tool bundles all files into a tar archive, preserving directory hierarchy
5. If compression is requested, the tool gzip-compresses the tar into a `.mpkz` file
6. The resulting package file is written to the specified output path

#### Acceptance Criteria

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

### 3. Package Extraction

Package extraction takes a `.mpk` or `.mpkz` file and writes its contents to a
target directory, recreating the original directory structure.

1. User points the tool at a package file and an output directory
2. If the package is `.mpkz`, the tool decompresses it
3. The tool reads the tar archive and writes each entry to the output directory
4. The original directory hierarchy is preserved

#### Acceptance Criteria

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

### 4. Package Inspection

Package inspection displays information about a package without extracting it.
Three operations cover different levels of detail: `info` shows metadata and
navigation tree, `ls` lists all files with paths and sizes, and `manifest`
outputs the raw manifest content.

1. User points `mdvpkg` at a package file with an inspection command
2. The tool reads the tar archive without extracting to disk
3. For `info`: the tool parses the manifest and displays metadata and navigation tree
4. For `ls`: the tool lists all tar entries with paths and sizes
5. For `manifest`: the tool extracts and outputs the raw manifest file content

#### Acceptance Criteria

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

### 5. Single Document Reading

The read operation extracts and outputs a single document from a package by file
path or by navigation display name. This retrieves individual files without
extracting the entire package.

1. User specifies a package file and a target document (by file path or display name)
2. If by display name, the tool resolves the name to a file path via the manifest navigation tree
3. The tool scans the tar archive for the matching entry
4. The tool outputs the document content

#### Acceptance Criteria

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

### 6. CLI Interface

`mdvpkg` wraps all library operations as CLI commands. It provides help output,
consistent argument patterns, and clear error messages. `mdvpkg` is a thin
wrapper — all logic lives in the library.

Commands: `create`, `extract`, `info`, `ls`, `read`, `manifest`.

1. User invokes `mdvpkg` with a command and arguments
2. `mdvpkg` parses arguments and validates required inputs
3. `mdvpkg` calls the corresponding library function
4. On success, `mdvpkg` outputs the result and exits with code 0
5. On failure, `mdvpkg` outputs an error message and exits with non-zero code

#### Acceptance Criteria

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

### 7. Library API

All CLI operations are backed by library functions that can be imported and used
programmatically. Library functions accept typed option objects and return typed
results. Errors are thrown as typed error objects with error codes and
descriptive messages.

1. Consumer imports the package library
2. Consumer calls a library function with a typed options object
3. The function validates inputs, performs the operation, and returns a typed result
4. On failure, the function throws a `PackageError` with a code and descriptive message

#### Acceptance Criteria

**AC-7.1:** Every CLI operation has a corresponding library function

- **TC-7.1a: Library create matches CLI create**
  - Given: A source directory
  - When: The library `createPackage` function is called with the same inputs the CLI would receive
  - Then: The resulting package file is identical to one produced by the CLI
- **TC-7.1b: Library function exists for each command**
  - Given: The six CLI commands (create, extract, info, ls, read, manifest)
  - When: The library API is inspected
  - Then: Each command has a corresponding exported function

**AC-7.2:** Library functions accept typed option objects and return typed result objects

- **TC-7.2a: Typed inputs enforced**
  - Given: A library function call with an options object missing a required field
  - When: The function is called
  - Then: A type error or validation error is produced before the operation runs
- **TC-7.2b: Typed return values**
  - Given: A library function call (e.g., `inspectPackage`)
  - When: The function completes
  - Then: The return value conforms to the documented result type (e.g., `PackageInfo`)

**AC-7.3:** Library errors include an error code and a descriptive message

- **TC-7.3a: Error code present**
  - Given: A library function call that fails (e.g., reading from an invalid archive)
  - When: The error is caught
  - Then: The error object has a `code` property with a value from the defined error code set
- **TC-7.3b: Error message is descriptive**
  - Given: A library function call that fails because a file is not found in the package
  - When: The error message is read
  - Then: The message describes what was not found and where it was expected

### 8. Rendering Library Exposure

The existing markdown rendering pipeline — markdown-it with Shiki syntax
highlighting and Mermaid diagram processing — is exposed as an importable
library. External tools can convert markdown to HTML with the same rendering
quality as the viewer, without running the viewer or server. This is additive to
the package core and not on the critical path for Epic 9.

1. Consumer imports the rendering library
2. Consumer calls the render function with a markdown string and optional configuration
3. The library processes markdown through the rendering pipeline (parsing, syntax highlighting, Mermaid)
4. The library returns the resulting HTML

#### Acceptance Criteria

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

---

## Data Contracts

### Manifest Types

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
  filePath?: string;       // present for linked entries, absent for group labels
  children: NavigationNode[];
  isGroup: boolean;        // invariant: isGroup === true implies filePath is undefined
}

interface ParsedManifest {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  raw: string;             // the original manifest file content
}
```

### Package Types

```typescript
interface PackageInfo {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  files: FileEntry[];          // sorted ascending by path
  format: 'mpk' | 'mpkz';
}

interface FileEntry {
  path: string;
  size: number;                // bytes
}
```

### Library API Types

```typescript
interface CreateOptions {
  sourceDir: string;
  outputPath: string;
  compress?: boolean;          // false → .mpk, true → .mpkz
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
  content: string;             // raw manifest file content
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
}

// Read target — exactly one must be provided
type ReadTarget =
  | { filePath: string }       // read by file path within the package
  | { displayName: string };   // read by navigation display name

interface ReadOptions {
  packagePath: string;
  target: ReadTarget;
}

interface ReadResult {
  content: string;
  filePath: string;            // the resolved file path within the package
}

interface RenderOptions {
  syntaxHighlight?: boolean;   // default: true
  mermaid?: boolean;           // default: true
}

interface RenderResult {
  html: string;
}
```

### Error Types

```typescript
type PackageErrorCode =
  | 'INVALID_ARCHIVE'
  | 'MANIFEST_NOT_FOUND'
  | 'MANIFEST_PARSE_ERROR'
  | 'FILE_NOT_FOUND'
  | 'AMBIGUOUS_DISPLAY_NAME'
  | 'PATH_TRAVERSAL'
  | 'SOURCE_DIR_NOT_FOUND'
  | 'SOURCE_DIR_EMPTY'
  | 'COMPRESSION_ERROR'
  | 'READ_ERROR'
  | 'WRITE_ERROR';

interface PackageError {
  code: PackageErrorCode;
  message: string;
  path?: string;           // the relevant file or package path
}
```

---

## Dependencies

Technical dependencies:
- Epics 1–6 complete (existing rendering pipeline for rendering library exposure)
- Epic 7 complete (E2E test infrastructure available for any E2E tests)
- Node.js runtime
- tar-stream (new dependency — tar read/write)

Process dependencies:
- None

---

## Non-Functional Requirements

### Performance
- Package creation and extraction complete within 5 seconds for packages up to 50 files / 10 MB
- Manifest parsing completes within 100ms for manifests up to 500 navigation entries
- Single document read completes within 2 seconds for packages up to 50 files

### Correctness
- Round-trip fidelity: create then extract produces byte-identical files to the originals
- Manifest parsing is deterministic — same input always produces the same navigation tree

### Portability
- Package files created on one platform can be extracted on another (standard tar/gzip)
- No platform-specific path separators stored in tar entries

---

## Notes for Tech Design

**tar-stream is the confirmed library.** The Technical Architecture specifies
tar-stream for streaming tar read/write and Node built-in zlib for gzip
compression/decompression.

**Extract-to-temp is the viewer strategy, not the library's concern.** The
Technical Architecture confirms that the viewer extracts packages to a temp
directory (Epic 9). The package library itself reads and writes tar archives.
The CLI extracts to user-specified directories. Temp directory lifecycle is a
viewer concern.

**Rendering library is additive.** The PRD states that rendering library
exposure must not delay package core completion. If the two concerns blur during
planning, split them. The rendering library wraps existing code (markdown-it,
Shiki, Mermaid setup) — it is an extraction and re-export, not new rendering
logic.

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **Manifest file name:** `_nav.md`, `_index.md`, or `manifest.md`? The Technical Architecture requires a single canonical name. The underscore prefix signals metadata and sorts to the top of directory listings.

2. **Package library module boundary:** The PRD requires the library to be independently usable without the viewer. Should this be a separate workspace package (e.g., `packages/mdvpkg/`), a separate directory within the existing project with its own entrypoint, or another arrangement? The current `shared/types.ts` re-exports server schemas directly — the package library needs cleaner separation to be genuinely reusable.

3. **CLI framework choice:** Should the CLI use a lightweight argument parser (e.g., commander, yargs) or hand-rolled argument parsing? The CLI has six commands with straightforward arguments.

4. **Manifest auto-scaffold ordering:** When auto-scaffolding a manifest from a directory, how should the discovered markdown files be ordered as navigation entries? Alphabetical by path, by directory depth, or another ordering?

5. **Rendering library Mermaid runtime:** Mermaid rendering in the viewer runs in the browser. The rendering library is a Node.js module. How should Mermaid diagrams be handled in the server-side rendering context? Options include JSDOM-based rendering, placeholder markup for later client-side rendering, or omitting Mermaid from the Node library.

6. **Binary file handling in tar:** Should the library explicitly handle binary assets (images, PDFs) differently from text files in the API, or treat all entries as opaque byte streams?

7. **Package size limits:** Should the library enforce any size limits on packages (total size, file count, individual file size)? The assumption is dozens of files and a few MB, but larger packages may work without explicit limits.

8. **ReadResult content type for binary assets:** `ReadResult.content` is typed as `string`. Should this be `string | Buffer` to support binary asset reads (images, PDFs), or should binary reads use a separate API function?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

**Delivers:** Project structure for the package library. Shared types
(ManifestMetadata, NavigationNode, ParsedManifest, PackageInfo, FileEntry,
CreateOptions, ExtractOptions, InspectOptions, ListOptions, ManifestOptions,
ReadOptions, ReadTarget, ReadResult, ManifestResult, RenderOptions,
RenderResult), error class with error codes, and test fixtures (sample
directories with manifests, markdown files, and images). A structural test
validates that the foundation module is importable.

**Prerequisite:** None

**ACs covered:**
- Foundation types and error class scaffolding used by all subsequent stories

**Note:** Story 0 delivers the type definitions and `PackageError` class. AC-7.2
(typed inputs/outputs) and AC-7.3 (typed errors) are runtime behaviors verified
in Stories 1–5 as each library function is implemented.

**Estimated test count:** 3–5 tests

### Story 1: Manifest Parsing

**Delivers:** The manifest parser. Given a manifest markdown string, it produces
a `ParsedManifest` with structured metadata and a navigation tree. Handles
frontmatter extraction, nested list parsing, group labels, display name/path
extraction, and error cases for malformed manifests.

**Prerequisite:** Story 0

**ACs covered:**
- AC-1.1 (YAML frontmatter extraction)
- AC-1.2 (navigation tree from nested links)
- AC-1.3 (group labels from non-linked items)
- AC-1.4 (display names and file paths from links)
- AC-1.5 (malformed manifest error handling)
- AC-1.6 (non-standard list/link format edge cases)
- AC-7.2 (typed option and result objects — manifest parser)
- AC-7.3 (typed errors — manifest parse errors)

**Estimated test count:** 15–20 tests

### Story 2: Package Creation

**Delivers:** The library function to create `.mpk` and `.mpkz` packages from a
source directory. Includes manifest auto-scaffolding when no manifest exists,
file bundling with directory hierarchy preservation, and gzip compression.

**Prerequisite:** Story 1 (manifest parsing for detection and scaffolding)

**ACs covered:**
- AC-2.1 (create .mpk from directory with all files)
- AC-2.2 (auto-scaffold manifest to disk when missing)
- AC-2.3 (create compressed .mpkz)
- AC-2.4 (error on missing/empty source directory)
- AC-2.5 (overwrite existing output file)
- AC-7.2 (typed option and result objects — create functions)
- AC-7.3 (typed errors — create error handling)

**Estimated test count:** 11–15 tests

### Story 3: Package Extraction

**Delivers:** The library function to extract `.mpk` and `.mpkz` packages to a
target directory. Preserves directory structure, handles decompression, manages
overwrite of existing files, and reports errors for invalid or corrupted
archives.

**Prerequisite:** Story 2 (needs created packages to extract)

**ACs covered:**
- AC-3.1 (extract .mpk with full directory structure)
- AC-3.2 (extract .mpkz with decompression)
- AC-3.3 (overwrite behavior for existing files)
- AC-3.4 (error on invalid or corrupted archives)
- AC-3.5 (create nonexistent output directory)
- AC-3.6 (path traversal safety)
- AC-7.2 (typed option and result objects — extract functions)
- AC-7.3 (typed errors — extract error handling)

**Estimated test count:** 10–13 tests

### Story 4: Package Inspection and Reading

**Delivers:** Library functions for inspecting package contents (info, ls,
manifest) and reading individual documents by file path or display name — all
without full extraction.

**Prerequisite:** Story 2 (needs created packages to inspect and read)

**ACs covered:**
- AC-4.1 (info displays metadata)
- AC-4.2 (info displays navigation tree)
- AC-4.3 (ls lists files with paths and sizes)
- AC-4.4 (manifest outputs raw manifest content)
- AC-5.1 (read document by file path)
- AC-5.2 (read document by display name)
- AC-7.2 (typed option and result objects — inspect/list/manifest/read functions)
- AC-7.3 (typed errors — inspect/read error handling)

**Estimated test count:** 12–16 tests

### Story 5: CLI Interface (`mdvpkg`)

**Delivers:** The `mdvpkg` CLI wrapping all library operations. Six commands
(create, extract, info, ls, read, manifest), help output, argument parsing, exit
codes, and error message formatting. Validates library-CLI parity.

**Prerequisite:** Story 4 (all library operations available)

**ACs covered:**
- AC-6.1 (top-level help)
- AC-6.2 (command-level help)
- AC-6.3 (exit codes)
- AC-6.4 (error message formatting)
- AC-7.1 (library-CLI parity)

**Estimated test count:** 12–16 tests

### Story 6: Rendering Library Exposure

**Delivers:** The existing markdown rendering pipeline (markdown-it, Shiki,
Mermaid) wrapped and exported as a standalone importable library. No viewer or
server dependencies required.

**Prerequisite:** Story 0 (independent of package stories 1–5)

**ACs covered:**
- AC-8.1 (markdown to HTML with syntax highlighting)
- AC-8.2 (Mermaid diagram processing)
- AC-8.3 (standalone import without viewer/server)

**Estimated test count:** 6–8 tests

---

## Validation Checklist

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Every AC has at least one TC
- [x] TCs cover happy path, edge cases, and errors
- [x] Data contracts are fully typed
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Dependencies documented
- [x] Story breakdown covers all ACs (33 ACs mapped across Stories 0–6)
- [x] Stories sequence logically (manifest first, creation before extraction, library before CLI, rendering independent)
- [x] Verification round 1 complete (14 fixes applied)
- [x] Verification round 2 complete (5 supplementary fixes applied)
- [x] Self-review complete
