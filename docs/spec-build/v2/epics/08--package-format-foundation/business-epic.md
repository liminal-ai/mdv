# Epic 8: Package Format Foundation — Business Epic

<!-- Jira: Epic -->

---

## User Profile
<!-- Jira: Epic Description — User Profile section -->

**Primary User:** Technical user who works with structured markdown collections — specs, documentation, agent outputs
**Context:** Bundling, sharing, inspecting, and extracting markdown collections from the command line or programmatically, without a viewer or server
**Mental Model:** "I have a folder of markdown files with a manifest that defines the navigation. I collapse it into a single file I can share, and anyone can inspect or extract it."
**Key Constraint:** Must be independently usable — library + CLI only, no viewer or server dependencies

---

## Feature Overview
<!-- Jira: Epic Description — Feature Overview section -->

After this epic, the user can create `.mpk` (tar) and `.mpkz` (compressed tar) packages from directories of markdown files, where a manifest file at the package root defines metadata and a navigation tree. They can inspect packages to see metadata, navigation structure, and file listings without extracting. They can extract packages back to directories, preserving the original structure. They can read individual documents from packages by file path or navigation display name. All operations are available as both a CLI tool and a programmatic library API. The markdown rendering pipeline (markdown-to-HTML with syntax highlighting and Mermaid support) is also exposed as a standalone library for external use.

---

## Scope
<!-- Jira: Epic Description — Scope section -->

### In Scope

Package format specification, manifest convention, parsing, archive read/write, CLI tooling, and library API — everything needed to create, inspect, extract, and read markdown packages without the viewer:

- Package format: `.mpk` as tar, `.mpkz` as gzip-compressed tar. A manifest file at the root, markdown files, and supporting assets (images, etc.), preserving directory hierarchy.
- Manifest convention: a markdown file at the package root with optional YAML frontmatter (title, version, author, description, type, status) and a markdown body of nested lists with links defining the navigation tree.
- Manifest parser: produces a structured navigation tree from the manifest markdown — hierarchy from nesting, display names from link text, file paths from link targets, group labels from non-linked list items.
- Package creation from a directory, with auto-scaffolded manifest if none exists. Compression to `.mpkz`.
- Package extraction to a directory, preserving original structure.
- Package inspection: metadata, navigation tree, file listings — all without extracting.
- Single document reading by file path or navigation display name.
- CLI wrapping all library operations: `create`, `extract`, `info`, `ls`, `read`, `manifest`.
- Library API: programmatic access to all operations with typed inputs and outputs.
- Rendering library exposure: the existing markdown-to-HTML pipeline accessible as an importable library. Additive to the package core.

### Out of Scope

- Viewer integration — opening packages in the viewer UI (Epic 9)
- Package-mode sidebar navigation (Epic 9)
- Manifest editing within the viewer (Epic 9)
- Batch operations across multiple packages
- Package versioning or diffing
- Publishing packages to a registry
- LLM preamble / agent-optimized summaries (future)
- Streaming archive reads (optimization — extract-to-temp is sufficient for expected package sizes)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Archive library handles expected package sizes (dozens of files, a few MB) without performance issues | Unvalidated | Tech Lead | From Technical Architecture |
| A2 | Node built-in compression is sufficient for `.mpkz` | Unvalidated | Tech Lead | No external compression dependency needed |
| A3 | The manifest convention covers the navigation needs of the target use cases (specs, docs, agent outputs) | Unvalidated | Product | May need revision after real-world usage |
| A4 | A single canonical manifest file name is sufficient (no fallback chain) | Unvalidated | Tech Lead | Decision made in tech design |
| A5 | Supporting assets (images) referenced by relative paths from markdown files have those paths preserved in the archive structure | Unvalidated | Tech Lead | Standard archive behavior |

---

## Flows & Requirements
<!-- Jira: Epic Description — Requirements section -->

### 1. Manifest Structure and Parsing (AC-1.1 through AC-1.6)

The manifest is a markdown file at the package root with two parts: optional YAML frontmatter containing package metadata, and a markdown body of nested lists with links defining the navigation tree. The parser reads this file and produces a structured navigation tree. Linked items become navigable entries (display name from link text, file path from link target). Non-linked items become group labels. The parser extracts frontmatter fields that are present and leaves missing fields undefined. It handles edge cases: ordered and unordered lists, empty link targets, non-markdown file links, paragraph text between lists, and manifests with no body. It rejects structurally invalid content (no list items, malformed YAML) with clear error messages.

*(See Story 1 for detailed ACs and test conditions.)*

### 2. Package Creation (AC-2.1 through AC-2.5)

Package creation takes a source directory and produces a `.mpk` or `.mpkz` file. All files are bundled into the archive preserving the original directory hierarchy, including supporting assets like images. If the source directory has no manifest, the tool auto-scaffolds one with navigation entries for every markdown file found and writes it to disk. Compression produces a smaller `.mpkz` file that is a valid gzip archive. Errors are reported for nonexistent or empty source directories. Creating to an existing output path overwrites the previous file.

*(See Story 2 for detailed ACs and test conditions.)*

### 3. Package Extraction (AC-3.1 through AC-3.6)

Package extraction reads a `.mpk` or `.mpkz` file and writes its contents to a target directory, recreating the original directory structure. Compressed packages are decompressed automatically. Extracted files are byte-identical to the originals. Existing files at conflicting paths are overwritten. Nonexistent output directories are created including intermediate directories. Invalid or corrupted archives produce clear errors. Extraction validates every entry path for directory traversal attacks — entries with `..` segments or absolute paths are rejected.

*(See Story 3 for detailed ACs and test conditions.)*

### 4. Package Inspection (AC-4.1 through AC-4.4)

Three inspection operations examine packages without extracting: info shows metadata and navigation tree, ls lists all files with paths and sizes, and manifest outputs the raw manifest file content. Info displays frontmatter metadata when present and the navigation tree with hierarchy indicated by indentation. Ls produces a sorted file listing. Manifest outputs the exact file content including YAML delimiters. All operations report errors for invalid archives or missing manifests.

*(See Story 4 for detailed ACs and test conditions.)*

### 5. Single Document Reading (AC-5.1, AC-5.2)

The read operation retrieves a single document from a package by file path or by navigation display name. File path reads scan the archive for the matching entry and output its content. Display name reads resolve the name to a file path through the manifest's navigation tree, then read the file. If multiple navigation entries share the same display name, the operation fails with an error listing the matches. Missing file paths and unmatched display names produce clear errors.

*(See Story 4 for detailed ACs and test conditions.)*

### 6. CLI Interface (AC-6.1 through AC-6.4)

The CLI wraps all library operations as commands: `create`, `extract`, `info`, `ls`, `read`, `manifest`. Top-level help lists all commands with descriptions. Each command provides its own help with argument details. Successful operations exit with code 0; failures exit with non-zero. Error messages identify the problem, include the command name, and include the relevant file path.

*(See Story 5 for detailed ACs and test conditions.)*

### 7. Library API (AC-7.1 through AC-7.3)

Every CLI operation has a corresponding library function that can be imported and used programmatically. Library functions accept typed option objects and return typed results. Errors are thrown as typed error objects with error codes from a defined set and descriptive messages. CLI-library parity is validated — the same inputs produce identical outputs.

*(See Stories 1–5 for detailed ACs and test conditions. AC-7.2 and AC-7.3 are cross-cutting runtime properties verified across library functions in Stories 2–4.)*

### 8. Rendering Library Exposure (AC-8.1 through AC-8.3)

The existing markdown rendering pipeline — markdown-to-HTML with syntax highlighting and Mermaid diagram processing — is exposed as a standalone importable library. It converts markdown to HTML with syntax highlighting applied to fenced code blocks. Mermaid code blocks are processed into diagram markup with basic structural validation — empty or unrecognized blocks produce inline error indicators. The library is importable independently of the viewer and server — no HTTP listener, application framework, or browser required.

*(See Story 6 for detailed ACs and test conditions.)*

---

## Data Contracts
<!-- Jira: Epic Description — Data Contracts section -->

The package library's external contract is its programmatic API — there are no HTTP endpoints, WebSocket messages, or browser interactions.

**Inputs from consumers:**
- Source directory path for package creation
- Package file path for inspection, extraction, and reading operations
- Output directory path for extraction
- Markdown string content for rendering
- Configuration options for each operation (compression flag, read target selection, rendering options)

**Outputs to consumers:**
- Structured package information: metadata fields from manifest frontmatter, navigation tree with hierarchy and group labels, file listing with paths and sizes, package format identifier
- Document content: raw file content as UTF-8 text, resolved file path
- Manifest content: raw manifest text plus parsed metadata and navigation
- Rendered HTML from markdown input
- Typed errors with machine-readable error codes and descriptive messages

Internal type definitions (TypeScript interfaces, error class, option/result shapes) are defined in the story file's Technical Design sections.

---

## Non-Functional Requirements
<!-- Jira: Epic Description — NFR section -->

### Performance
- Package creation and extraction complete within 5 seconds for packages up to 50 files / 10 MB
- Manifest parsing completes within 100ms for manifests up to 500 navigation entries
- Single document read completes within 2 seconds for packages up to 50 files

### Correctness
- Round-trip fidelity: create then extract produces byte-identical files to the originals
- Manifest parsing is deterministic — same input always produces the same navigation tree

### Portability
- Package files created on one platform can be extracted on another (standard tar/gzip)
- No platform-specific path separators stored in archive entries

---

## Tech Design Questions
<!-- Jira: Epic Description — Tech Design Questions section -->

Questions for the Tech Lead to address during design:

1. **Manifest file name:** What canonical name for the manifest file? The underscore prefix signals metadata and sorts to the top of directory listings.
2. **Package library module boundary:** Should this be a separate workspace package, a directory within the existing project, or another arrangement? The library must be independently usable without the viewer.
3. **CLI framework choice:** Lightweight argument parser or hand-rolled parsing? The CLI has six commands with straightforward arguments.
4. **Manifest auto-scaffold ordering:** When auto-scaffolding a manifest, how should discovered markdown files be ordered as navigation entries?
5. **Rendering library Mermaid runtime:** Mermaid rendering in the viewer runs in the browser. How should Mermaid diagrams be handled in the server-side rendering context?
6. **Binary file handling in archives:** Should the library treat binary assets differently from text files in the API, or treat all entries as opaque byte streams?
7. **Package size limits:** Should the library enforce size limits on packages, or leave that to consumers?
8. **Read result content type for binary assets:** Should the read operation support binary content (returning a buffer) or remain text-only (string)?

---

## Dependencies
<!-- Jira: Epic Description — Dependencies section -->

Technical dependencies:
- Epics 1–6 complete (existing rendering pipeline for rendering library exposure)
- Epic 7 complete (E2E test infrastructure)
- Node.js runtime

Process dependencies:
- None

---

## Story Breakdown
<!-- Jira: Epic Description — Story Breakdown section -->

### Story 0: Foundation (Infrastructure)
Project structure for the package library: shared types, error class with error codes, test fixtures, and structural tests. No direct ACs — foundation scaffolding used by all subsequent stories.
*(See story file Story 0 for full details.)*

### Story 1: Manifest Parsing
The manifest parser: given a manifest markdown string, produces structured metadata and a navigation tree. Covers AC-1.1 through AC-1.6.
*(See story file Story 1 for full details and test conditions.)*

### Story 2: Package Creation
Library function to create `.mpk` and `.mpkz` packages from a source directory, with manifest auto-scaffolding when none exists. Covers AC-2.1 through AC-2.5, AC-7.2.
*(See story file Story 2 for full details and test conditions.)*

### Story 3: Package Extraction
Library function to extract packages to a target directory, with path traversal safety, directory creation, and overwrite behavior. Covers AC-3.1 through AC-3.6, AC-7.3.
*(See story file Story 3 for full details and test conditions.)*

### Story 4: Package Inspection and Reading
Library functions for inspecting package contents (info, ls, manifest) and reading individual documents by file path or display name. Covers AC-4.1 through AC-5.2, AC-7.2, AC-7.3.
*(See story file Story 4 for full details and test conditions.)*

### Story 5: CLI Interface (`mdvpkg`)
CLI wrapping all library operations: six commands with help, argument parsing, exit codes, and error formatting. Validates library-CLI parity. Covers AC-6.1 through AC-6.4, AC-7.1.
*(See story file Story 5 for full details and test conditions.)*

### Story 6: Rendering Library Exposure
The existing markdown rendering pipeline wrapped and exported as a standalone library — no viewer or server dependencies. Covers AC-8.1 through AC-8.3.
*(See story file Story 6 for full details and test conditions.)*

---

## Validation Checklist
<!-- Jira: Epic Description — Validation section -->

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Dependencies documented
- [x] Story breakdown covers all 33 ACs
- [x] Stories sequence logically (manifest first, creation before extraction, library before CLI, rendering independent)
- [x] Self-review complete
