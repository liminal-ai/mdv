# Future Capability: Markdown Package Format

## Status

Early idea capture. Not scoped for any current epic. Revisit once the core viewer is solid.

## Core Idea

There should be a simple packaging convention for structured collections of markdown files that a viewer like this one can open and navigate directly — without a build step, static site generator, or hosted platform.

A markdown package is just a directory of markdown files with a manifest file at the root that defines the navigation structure. The viewer detects the manifest and switches from filesystem-scan mode to manifest-driven navigation.

## Two Shapes

### 1. Directory on disk

A folder containing markdown files and a manifest. The viewer opens the folder, finds the manifest, and presents the navigation tree defined in it instead of scanning the filesystem.

This is the primary shape. It's what you author and work with locally.

### 2. Single file for transfer

The same directory, tar'd into a single file. A tar contains everything needed to rebuild the full directory structure inline — file contents, directory hierarchy, filenames, metadata. It's completely self-contained. Unpack it and you have the exact directory back.

The viewer can open the tar directly — read its contents, find the manifest, present the same navigation. No extraction step required from the user's perspective.

Optionally gzip'd for size, but that's secondary to the core value: one self-contained file that is the entire package.

## Manifest Convention

The manifest is a plain markdown file at the package root. Candidate names (pick one or support a few with priority):

- `_nav.md`
- `_toc.md`
- `index.md`

The manifest uses standard markdown to define the navigation tree:

```markdown
# My Architecture Docs

- [Overview](./overview.md)
- [System Design](./architecture/system-design.md)
- Components
  - [Auth Service](./architecture/auth.md)
  - [API Gateway](./architecture/gateway.md)
- [ADRs](./adrs/index.md)
  - [ADR-001: Use Fastify](./adrs/001-fastify.md)
  - [ADR-002: Vanilla JS](./adrs/002-vanilla-js.md)
- [Glossary](./glossary.md)
```

Rules:

- Nested lists = hierarchy in the navigation tree
- Link text = display name (does not need to match the filename)
- Link target = relative path to the actual .md file
- List items without links are grouping labels (non-navigable nodes)
- The manifest itself is just valid markdown — readable and useful even without the viewer

## Optional Metadata

The manifest can include YAML frontmatter for package-level metadata:

```yaml
---
title: Architecture Documentation
version: 1.2.0
author: Platform Team
description: Internal architecture docs for the payments platform
---
```

This is optional. A manifest without frontmatter still works — it just won't have package-level metadata.

## How The Viewer Would Use This

When opening a folder or compressed file:

1. Check for a manifest file at the root (`_nav.md`, `_toc.md`, `index.md` — in priority order)
2. If found: switch to package mode
   - Parse the manifest to build the sidebar navigation tree
   - Display names come from link text, not filenames
   - Navigation structure comes from the manifest's list hierarchy
   - Clicking a node opens the linked .md file in the content pane
3. If not found: use current filesystem-scan behavior as-is

For consolidated files (.tar, optionally .tar.gz):
- Read the tar contents directly (or extract to a temp location)
- Then follow the same manifest detection logic

## Why This Is Interesting

- **No build step**: unlike mdBook, GitBook, MkDocs, Docusaurus — you don't compile anything. You just open the folder.
- **The manifest is just markdown**: human-readable, editable, viewable anywhere. Not YAML config or JSON.
- **Node names are decoupled from filenames**: display names can be descriptive without worrying about filesystem-safe naming.
- **Transfer is trivial**: tar the folder into a single file, send it, open it. No hosting, no deployment. The file is mostly text with binary sections only for embedded resources.
- **Good fit for this app's identity**: a local-first markdown workspace that can also open structured markdown packages fits naturally.

## Use Cases

- Internal documentation packages (architecture docs, runbooks, onboarding guides)
- Spec packages (PRDs, tech designs, epic breakdowns — structured and navigable)
- Knowledge sharing between teams without requiring a wiki or hosted site
- Open source project documentation distributed as a browsable package
- Personal knowledge bases with authored navigation

## Relationship To Existing Tools

| Tool | Approach | Difference |
|------|----------|------------|
| mdBook | SUMMARY.md manifest, compiles to HTML | Requires build step, produces a website |
| GitBook | SUMMARY.md manifest, hosted platform | Requires platform, not local-first |
| MkDocs | mkdocs.yml config, compiles to HTML | YAML config, requires build step |
| Docusaurus | sidebars.js config, React site | Heavy framework, requires build |
| Obsidian | Graph-linked vault | No authored nav tree, different UX model |
| **This** | Markdown manifest, opened directly by viewer | No build, no hosting, manifest is just markdown |

## LLM Agent Accessibility

The package format should be designed for efficient consumption by LLM agents, not just human viewers.

### Problem

An LLM agent encountering a markdown package (directory or tar) shouldn't need to slurp the entire thing to understand what's in it, find what it needs, or extract specific content. Packages can contain dozens or hundreds of files. Agents need a fast path.

### Two complementary mechanisms

#### 1. LLM preamble / front-loaded summary

The manifest file (or the tar itself) should have a machine-readable summary section near the top — an LLM-oriented preamble that an agent can extract by reading just the first portion of the file.

This preamble would contain:

- Package title, description, scope
- Complete navigation structure with brief descriptions of each document
- Key terms, concepts, or entities covered
- Relationships between documents (what depends on what, reading order if any)
- Enough context for an agent to decide which specific files to read without scanning everything

This is similar in spirit to `llms.txt` (the convention some websites are adopting to provide LLM-friendly site summaries), but built into the package format itself.

The preamble could live in:

- A dedicated section in the manifest's frontmatter (YAML block with structured summaries)
- A separate `_llm.md` or `_summary.md` file that's conventionally the first entry in the tar
- A structured comment block at the top of the manifest

The key constraint: it must be front-loaded. An agent reading the first N bytes of the file (or the first file in the tar) gets the full map without reading further.

#### 2. CLI tooling for agent navigation

A small CLI (or library) that lets agents interact with packages efficiently:

```bash
# List package metadata and navigation tree
mdvpkg info package.tar

# List all documents with paths and descriptions
mdvpkg ls package.tar

# Extract a specific document by nav path or file path
mdvpkg read package.tar "Components/Auth Service"
mdvpkg read package.tar ./architecture/auth.md

# Extract just the LLM preamble / summary
mdvpkg summary package.tar

# Extract manifest only
mdvpkg manifest package.tar
```

This gives agents (or scripts, or other tools) a way to navigate the package without unpacking the whole thing or parsing tar headers manually. The CLI operates on both directory-mode packages and tar-mode packages with the same interface.

### Design principle

The package format should be **legible at three levels**:

1. **Human reading the directory**: just open the manifest, follow links, read markdown files
2. **Viewer application**: detect manifest, build nav tree, render content
3. **LLM agent**: read the preamble for the full map, use CLI to extract specific documents as needed

All three levels work from the same underlying structure. No separate "agent version" of the package — just a front-loaded summary convention and efficient access tooling.

## Open Questions

- Best manifest filename convention? `_nav.md` feels explicit. `index.md` is common but might collide with actual content files.
- Should the viewer support multiple manifest files (e.g., different views of the same content)?
- How should missing links be handled (manifest references a file that doesn't exist)?
- Should packages support assets (images, diagrams) with the same relative-path convention?
- How should the viewer indicate it's in package mode vs filesystem-scan mode?
- Should there be a way to "eject" from package mode and browse the raw filesystem?
- What's the best structure for the LLM preamble? Frontmatter YAML, separate file, or structured markdown section?
- Should the preamble be auto-generated from the manifest + document frontmatter, or hand-authored?
- How much context is enough in the preamble for an agent to navigate without reading full documents?
- Should the CLI tooling be part of the viewer distribution or a standalone package?
