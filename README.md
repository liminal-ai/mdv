# mdv

A markdown viewer and editor. Runs as a web app (Fastify + vanilla JS) or as a desktop app (Electron shell around the same server).

## Quick Start

```bash
npm install
npm run build
npm start          # web app at http://localhost:3000
```

## Electron

```bash
npm run build:electron
npm run install-app   # builds, packages, and installs to ~/Applications
```

## Development

```bash
npm run dev            # start server with --watch
npm run verify         # build + typecheck + lint + test
npm run test:e2e       # end-to-end (Playwright)
```

## CLI

`mdvpkg` — package, inspect, and extract `.mpk`/`.mpkz` markdown packages.

```bash
npx mdvpkg create ./docs -o docs.mpk
npx mdvpkg info docs.mpk
npx mdvpkg ls docs.mpk
```
