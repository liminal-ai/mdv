import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { listMarkdownTree } from '../src/main/folders';

function flattenTree(nodes: Array<{ type: string; path: string; children?: any[] }>): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(node.path);
    if (node.children) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

describe('listMarkdownTree', () => {
  it('returns recursive folders and markdown files only', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-folders-'));
    const docsDir = path.join(root, 'docs');
    const nestedDir = path.join(docsDir, 'nested');
    await fs.mkdir(nestedDir, { recursive: true });

    await Promise.all([
      fs.writeFile(path.join(root, 'README.md'), '# top', 'utf8'),
      fs.writeFile(path.join(root, 'notes.txt'), 'skip', 'utf8'),
      fs.writeFile(path.join(docsDir, 'guide.markdown'), '# guide', 'utf8'),
      fs.writeFile(path.join(docsDir, 'image.png'), 'not-real', 'utf8'),
      fs.writeFile(path.join(nestedDir, 'deep.md'), '# deep', 'utf8')
    ]);

    const nodes = await listMarkdownTree(root);
    const flattened = flattenTree(nodes);

    expect(flattened.some((item) => item.endsWith('README.md'))).toBe(true);
    expect(flattened.some((item) => item.endsWith('guide.markdown'))).toBe(true);
    expect(flattened.some((item) => item.endsWith('deep.md'))).toBe(true);
    expect(flattened.some((item) => item.endsWith('notes.txt'))).toBe(false);
    expect(flattened.some((item) => item.endsWith('image.png'))).toBe(false);

    const firstNames = nodes.map((node) => `${node.type}:${path.basename(node.path)}`);
    expect(firstNames[0]?.startsWith('dir:')).toBe(true);
  });

  it('handles symlink loops safely', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-loop-'));
    const a = path.join(root, 'a');
    const b = path.join(a, 'b');
    await fs.mkdir(b, { recursive: true });
    await fs.writeFile(path.join(a, 'doc.md'), '# doc', 'utf8');

    try {
      await fs.symlink(a, path.join(b, 'back-to-a'));
    } catch {
      // Symlink creation may be disallowed in some environments.
    }

    const nodes = await listMarkdownTree(root);
    const flattened = flattenTree(nodes);
    expect(flattened.filter((item) => item.endsWith('doc.md')).length).toBe(1);
  });
});
