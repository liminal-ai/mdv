import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createGzip } from 'node:zlib';
import { pack } from 'tar-stream';
import { createPackage, extractPackage, MANIFEST_FILENAME } from '../../../src/pkg/index.js';

interface WorkspaceDefinition {
  files: Record<string, string>;
  manifest?: string;
}

const FIXTURE_DIR = path.resolve('tests/fixtures/packages');

const SAMPLE_MANIFEST = `---
title: Sample Package
version: "1.0"
author: Test Author
---

- [Getting Started](getting-started.md)
- [API Reference](api-reference.md)
- [FAQ](faq.md)
`;

const NESTED_MANIFEST = `---
title: Nested Package
---

- [Overview](overview.md)
- Guides
  - [Quick Start](guides/quick-start.md)
  - [Advanced Usage](guides/advanced.md)
- Reference
  - API
    - [Endpoints](reference/api/endpoints.md)
    - [Authentication](reference/api/auth.md)
`;

const MALFORMED_MANIFEST = `---
title: Bad Package
version: [this is invalid YAML
---

- [Page](page.md)
`;

function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

async function withTempDir<T>(prefix: string, run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));

  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeWorkspace(dir: string, definition: WorkspaceDefinition): Promise<void> {
  if (definition.manifest !== undefined) {
    await writeFile(path.join(dir, MANIFEST_FILENAME), definition.manifest, 'utf8');
  }

  for (const [relativePath, content] of Object.entries(definition.files)) {
    const absolutePath = path.join(dir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }
}

async function collectFiles(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(toPosixPath(path.relative(rootDir, absolutePath)));
    }
  }

  return files.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}

async function writePackEntry(
  packStream: ReturnType<typeof pack>,
  relativePath: string,
  content: Buffer,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    packStream.entry({ name: relativePath, size: content.length }, content, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function packDirectory(
  sourceDir: string,
  outputPath: string,
  compress = false,
): Promise<void> {
  const packStream = pack();
  const archiveStream = compress ? packStream.pipe(createGzip()) : packStream;
  const outputStream = createWriteStream(outputPath);

  const finished = new Promise<void>((resolve, reject) => {
    archiveStream.once('error', reject);
    outputStream.once('error', reject);
    outputStream.once('finish', resolve);
  });

  archiveStream.pipe(outputStream);

  for (const relativePath of await collectFiles(sourceDir)) {
    const absolutePath = path.join(sourceDir, relativePath);
    const content = await readFile(absolutePath);
    await writePackEntry(packStream, relativePath, content);
  }

  packStream.finalize();
  await finished;
}

async function generatePackage(
  outputName: string,
  definition: WorkspaceDefinition,
  options: { compress?: boolean } = {},
): Promise<void> {
  await withTempDir('mdv-pkg-generate-', async (workspaceDir) => {
    await writeWorkspace(workspaceDir, definition);
    await createPackage({
      sourceDir: workspaceDir,
      outputPath: path.join(FIXTURE_DIR, outputName),
      compress: options.compress,
    });
  });
}

async function generateMutatedPackage(
  outputName: string,
  definition: WorkspaceDefinition,
  mutate: (extractedDir: string) => Promise<void>,
  options: { compress?: boolean } = {},
): Promise<void> {
  await withTempDir('mdv-pkg-generate-', async (workspaceDir) => {
    const basePackagePath = path.join(workspaceDir, 'base.mpk');
    const extractedDir = path.join(workspaceDir, 'extracted');

    await writeWorkspace(workspaceDir, definition);
    await createPackage({
      sourceDir: workspaceDir,
      outputPath: basePackagePath,
    });
    await mkdir(extractedDir, { recursive: true });
    await extractPackage({
      packagePath: basePackagePath,
      outputDir: extractedDir,
    });

    await mutate(extractedDir);
    await packDirectory(extractedDir, path.join(FIXTURE_DIR, outputName), options.compress);
  });
}

async function removeIfExists(targetPath: string): Promise<void> {
  try {
    await unlink(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

async function main(): Promise<void> {
  await mkdir(FIXTURE_DIR, { recursive: true });

  const sampleDefinition: WorkspaceDefinition = {
    manifest: SAMPLE_MANIFEST,
    files: {
      'getting-started.md': '# Getting Started\n\nWelcome to the sample package.\n',
      'api-reference.md': '# API Reference\n\n## Endpoints\n\n- `GET /health`\n',
      'faq.md': '# FAQ\n\nAnswers live here.\n',
    },
  };

  await generatePackage('sample.mpk', sampleDefinition);
  await generatePackage('sample.mpkz', sampleDefinition, { compress: true });

  await generatePackage('nested.mpk', {
    manifest: NESTED_MANIFEST,
    files: {
      'overview.md': '# Overview\n\nNested package overview.\n',
      'guides/quick-start.md': '# Quick Start\n\nStep one.\n',
      'guides/advanced.md': '# Advanced Usage\n\nAdvanced material.\n',
      'reference/api/endpoints.md': '# Endpoints\n\nList of endpoints.\n',
      'reference/api/auth.md': '# Authentication\n\nAuth details.\n',
    },
  });

  await generateMutatedPackage('no-manifest.mpk', sampleDefinition, async (extractedDir) => {
    await removeIfExists(path.join(extractedDir, MANIFEST_FILENAME));
  });

  await generateMutatedPackage('bad-manifest.mpk', sampleDefinition, async (extractedDir) => {
    await writeFile(path.join(extractedDir, MANIFEST_FILENAME), MALFORMED_MANIFEST, 'utf8');
  });

  await generatePackage('partial-meta.mpk', {
    manifest: `---
title: Partial Metadata
---

- [Only Page](only-page.md)
`,
    files: {
      'only-page.md': '# Only Page\n\nThis package only has a title.\n',
    },
  });

  await generatePackage('no-meta.mpk', {
    manifest: `- [Intro](intro.md)
- [Details](details.md)
`,
    files: {
      'intro.md': '# Intro\n\nNo frontmatter here.\n',
      'details.md': '# Details\n\nStill valid navigation.\n',
    },
  });

  await generatePackage('missing-file.mpk', {
    manifest: `---
title: Missing File Package
---

- [Existing](existing.md)
- [Missing](missing.md)
`,
    files: {
      'existing.md': '# Existing\n\nThis file exists.\n',
    },
  });

  await generatePackage('mermaid.mpk', {
    manifest: `---
title: Mermaid Package
---

- [Diagram](diagram.md)
`,
    files: {
      'diagram.md': `# Diagram

\`\`\`mermaid
graph TD
  A[Start] --> B[Finish]
\`\`\`

\`\`\`ts
export const answer = 42;
\`\`\`
`,
    },
  });

  await writeFile(path.join(FIXTURE_DIR, 'corrupt.bin'), randomBytes(256));
}

await main();
