import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface FixtureWorkspace {
  /** Absolute path to the temp fixture directory */
  rootPath: string;
  /** Absolute path to the temp session directory */
  sessionDir: string;
  /** Known file paths within the fixture */
  files: {
    kitchenSink: string;
    invalidMermaid: string;
    simple: string;
    nested: string;
    image: string;
    nonMarkdown: string[];
  };
  /** Path for export output */
  exportDir: string;
}

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2V5uQAAAAASUVORK5CYII=',
  'base64',
);

const KITCHEN_SINK_CONTENT = `# Kitchen Sink

Welcome to the E2E fixture workspace.

## Code Sample

### Third Level

\`\`\`javascript
export function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Table Example

| Name | Value |
| --- | --- |
| Alpha | 1 |
| Beta | 2 |

## Links

- [MD Viewer](https://example.com/md-viewer)
- [Nested Doc](./subdir/nested.md)

## Mermaid Diagram

\`\`\`mermaid
graph TD
  Start[Start] --> Review[Review]
  Review --> Done[Done]
\`\`\`

## Image

![Fixture image](./assets/test-image.png)
`;

const INVALID_MERMAID_CONTENT = `# Broken Mermaid

\`\`\`mermaid
graph TD
  Broken[Missing arrow
\`\`\`
`;

const SIMPLE_CONTENT = `# Simple Document

This file is used for edit mode tests.
`;

const NESTED_CONTENT = `# Nested Document

This file lives in a subdirectory.
`;

/**
 * Creates a temporary fixture workspace with known markdown content.
 *
 * Covers: AC-1.3 (fixture workspace), TC-1.3c (deterministic content)
 * Used by: global-setup.ts
 *
 * Content is hardcoded — no random or time-dependent data.
 */
export async function createFixtureWorkspace(): Promise<FixtureWorkspace> {
  const rootPath = await mkdtemp(join(tmpdir(), 'md-viewer-e2e-fixtures-'));
  const sessionDir = await mkdtemp(join(tmpdir(), 'md-viewer-e2e-session-'));
  const exportDir = await mkdtemp(join(tmpdir(), 'md-viewer-e2e-export-'));

  await mkdir(join(rootPath, 'subdir'), { recursive: true });
  await mkdir(join(rootPath, 'assets'), { recursive: true });

  const kitchenSink = join(rootPath, 'kitchen-sink.md');
  const invalidMermaid = join(rootPath, 'invalid-mermaid.md');
  const simple = join(rootPath, 'simple.md');
  const nested = join(rootPath, 'subdir', 'nested.md');
  const image = join(rootPath, 'assets', 'test-image.png');
  const notesTxt = join(rootPath, 'notes.txt');
  const dataJson = join(rootPath, 'data.json');

  await Promise.all([
    writeFile(kitchenSink, KITCHEN_SINK_CONTENT, 'utf8'),
    writeFile(invalidMermaid, INVALID_MERMAID_CONTENT, 'utf8'),
    writeFile(simple, SIMPLE_CONTENT, 'utf8'),
    writeFile(nested, NESTED_CONTENT, 'utf8'),
    writeFile(image, TINY_PNG),
    writeFile(
      notesTxt,
      'This is a plain text file and should not appear in the markdown tree.\n',
      'utf8',
    ),
    writeFile(dataJson, '{\n  "name": "md-viewer",\n  "kind": "fixture"\n}\n', 'utf8'),
  ]);

  return {
    rootPath,
    sessionDir,
    files: {
      kitchenSink,
      invalidMermaid,
      simple,
      nested,
      image,
      nonMarkdown: [notesTxt, dataJson],
    },
    exportDir,
  };
}

/**
 * Removes all temporary directories created by createFixtureWorkspace().
 *
 * Covers: AC-1.3b (cleanup)
 * Used by: global-teardown.ts
 */
export async function cleanupFixtures(workspace: FixtureWorkspace): Promise<void> {
  await Promise.all([
    rm(workspace.rootPath, { recursive: true, force: true }),
    rm(workspace.sessionDir, { recursive: true, force: true }),
    rm(workspace.exportDir, { recursive: true, force: true }),
  ]);
}
