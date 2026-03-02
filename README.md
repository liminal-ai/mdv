# MD Viewer

Fast, lightweight macOS Markdown viewer with local Mermaid rendering and export workflows.

## Features

- Open `.md` or `.markdown` files from app, drag/drop, or CLI.
- GFM-style markdown rendering with syntax highlighting.
- Mermaid diagrams rendered locally in an isolated hidden Chromium context.
- Export to PDF (US Letter default).
- Export to DOCX (`.docx`) with Mermaid diagrams embedded as PNG images.
- Export to `document.html` + `assets/` folder (Mermaid diagrams and local images).
- Offline runtime behavior: remote images are blocked and reported as warnings.
- Live reload when the currently opened markdown file changes on disk.
- Print-oriented layout heuristics for PDF/DOCX: 1-inch margins, keep-together blocks, and manual `<!-- pagebreak -->` markers.

## Requirements

- macOS
- Node LTS (recommended via `nvm` or `fnm`)

## Setup

```bash
npm ci
npm run build
```

## Run Desktop App

```bash
npm run dev
```

## CLI Usage

Build first, then run:

```bash
node dist/cli/mdv.js export --input ./fixtures/sample.md --format pdf --output ./out/sample.pdf
node dist/cli/mdv.js export --input ./fixtures/sample.md --format docx --output ./out/sample.docx
node dist/cli/mdv.js export --input ./fixtures/sample.md --format html --output ./out/sample-export
node dist/cli/mdv.js export --input ./fixtures/sample.md --format all --output ./out
```

If you want a local binary command, run:

```bash
npm link
mdv export --input ./fixtures/sample.md --format all --output ./out
```

Exit codes:

- `0` success
- `2` validation/input errors
- `3` render/export failures

## Package a macOS App

```bash
npm run make
```

The resulting app bundle/zip is generated under `out/`.

## Associate `.md` with MD Viewer

1. Build/package the app so a `.app` bundle exists.
2. Run:

```bash
npm run set-md-default
```

If your machine policy blocks this, set it manually in Finder:

- Right click a `.md` file.
- `Get Info` -> `Open with` -> choose `MD Viewer.app`.
- Click `Change All...`.

## Notes

- Remote assets are not fetched in V1 to keep exports deterministic and offline-safe.
- Explicit page breaks are supported with a line containing exactly: `<!-- pagebreak -->`.
