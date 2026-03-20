# MD Viewer Prototype (`first-pass-poc`)

This folder contains the current Electron-based first-pass prototype for MD Viewer.

It remains a fully runnable app and is being kept intact as:

- the working desktop prototype in active use
- a reference implementation for product behavior
- a source of reusable render/export/domain logic

The longer-term browser-first implementation is expected to live elsewhere in this repo. This folder should be treated as the current prototype root.

## Requirements

- macOS
- Node LTS (recommended via `nvm` or `fnm`)

## Setup

```bash
npm ci
npm run build
```

### Icon Assets

Generate source icon (uses imagegen skill if `OPENAI_API_KEY` is set, otherwise local fallback):

```bash
npm run icon:generate
```

Build `.icns` and favicons:

```bash
npm run icon:build
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

## Associate `.md` With MD Viewer

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
