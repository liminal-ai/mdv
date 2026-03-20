import { chmod, mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/server/app.js';
import { createTempDir, removeTempDir } from '../../utils/tmp.js';

describe('tree routes', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => removeTempDir(dir)));
  });

  async function createRoot() {
    const baseDir = await createTempDir();
    tempDirs.push(baseDir);
    const root = path.join(baseDir, 'project');
    await mkdir(root, { recursive: true });
    return root;
  }

  async function getTree(root: string) {
    const sessionDir = path.join(path.dirname(root), 'session');
    const app = await buildApp({ sessionDir });
    const response = await app.inject({
      method: 'GET',
      url: `/api/tree?root=${encodeURIComponent(root)}`,
    });
    await app.close();
    return response;
  }

  it('TC-5.1a: Only markdown files displayed', async () => {
    const root = await createRoot();
    await writeFile(path.join(root, 'README.md'), '# README');
    await writeFile(path.join(root, 'notes.md'), '# Notes');
    await writeFile(path.join(root, 'script.sh'), '#!/bin/bash');
    await writeFile(path.join(root, 'image.png'), 'binary');

    const response = await getTree(root);

    expect(response.statusCode).toBe(200);
    const names = response.json().tree.map((n: { name: string }) => n.name);
    expect(names).toContain('README.md');
    expect(names).toContain('notes.md');
    expect(names).not.toContain('script.sh');
    expect(names).not.toContain('image.png');
  });

  it('TC-5.1b: Empty directory hidden', async () => {
    const root = await createRoot();
    await mkdir(path.join(root, 'empty-dir'), { recursive: true });
    await writeFile(path.join(root, 'readme.md'), '# Hi');

    const response = await getTree(root);

    const names = response.json().tree.map((n: { name: string }) => n.name);
    expect(names).not.toContain('empty-dir');
    expect(names).toContain('readme.md');
  });

  it('TC-5.1c: Nested directory with markdown shown', async () => {
    const root = await createRoot();
    await mkdir(path.join(root, 'dir-a', 'dir-b'), { recursive: true });
    await writeFile(path.join(root, 'dir-a', 'dir-b', 'doc.md'), '# Doc');

    const response = await getTree(root);

    const tree = response.json().tree;
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('dir-a');
    expect(tree[0].children[0].name).toBe('dir-b');
    expect(tree[0].children[0].children[0].name).toBe('doc.md');
  });

  it('TC-5.1d: Mixed directory shows only markdown files', async () => {
    const root = await createRoot();
    const dir = path.join(root, 'mixed');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'doc1.md'), '# 1');
    await writeFile(path.join(dir, 'doc2.md'), '# 2');
    await writeFile(path.join(dir, 'doc3.md'), '# 3');
    for (let i = 0; i < 10; i++) {
      await writeFile(path.join(dir, `module${i}.ts`), `export const x = ${i};`);
    }

    const response = await getTree(root);

    const mixedDir = response.json().tree.find((n: { name: string }) => n.name === 'mixed');
    expect(mixedDir).toBeDefined();
    expect(mixedDir.children).toHaveLength(3);
    expect(mixedDir.children.every((c: { name: string }) => c.name.endsWith('.md'))).toBe(true);
  });

  it('TC-5.1e: Case-insensitive extension matching', async () => {
    const root = await createRoot();
    await writeFile(path.join(root, 'NOTES.MD'), '# Notes');
    await writeFile(path.join(root, 'changelog.Markdown'), '# Changelog');
    await writeFile(path.join(root, 'readme.md'), '# Readme');

    const response = await getTree(root);

    const names = response.json().tree.map((n: { name: string }) => n.name);
    expect(names).toHaveLength(3);
    expect(names).toContain('NOTES.MD');
    expect(names).toContain('changelog.Markdown');
    expect(names).toContain('readme.md');
  });

  it('TC-5.1f: Hidden files excluded', async () => {
    const root = await createRoot();
    await writeFile(path.join(root, '.hidden.md'), '# Hidden');
    await writeFile(path.join(root, 'visible.md'), '# Visible');

    const response = await getTree(root);

    const names = response.json().tree.map((n: { name: string }) => n.name);
    expect(names).toContain('visible.md');
    expect(names).not.toContain('.hidden.md');
  });

  it('TC-5.1g: MDX files excluded', async () => {
    const root = await createRoot();
    await writeFile(path.join(root, 'component.mdx'), '<Component />');
    await writeFile(path.join(root, 'readme.md'), '# Readme');

    const response = await getTree(root);

    const names = response.json().tree.map((n: { name: string }) => n.name);
    expect(names).toContain('readme.md');
    expect(names).not.toContain('component.mdx');
  });

  it('TC-5.1h: Symlinked markdown files included with symlink path', async () => {
    const root = await createRoot();
    const docsDir = path.join(root, 'docs');
    await mkdir(docsDir, { recursive: true });

    const outsideDir = path.join(path.dirname(root), 'outside');
    await mkdir(outsideDir, { recursive: true });
    await writeFile(path.join(outsideDir, 'real.md'), '# Real');

    await symlink(path.join(outsideDir, 'real.md'), path.join(docsDir, 'link.md'));

    const response = await getTree(root);

    const tree = response.json().tree;
    const docsNode = tree.find((n: { name: string }) => n.name === 'docs');
    expect(docsNode).toBeDefined();
    const linkNode = docsNode.children.find((n: { name: string }) => n.name === 'link.md');
    expect(linkNode).toBeDefined();
    expect(linkNode.path).toBe(path.join(docsDir, 'link.md'));
    expect(linkNode.path).not.toContain('outside');
  });

  it('TC-5.4a: Sort order — directories first, alphabetical case-insensitive', async () => {
    const root = await createRoot();
    await mkdir(path.join(root, 'Docs'), { recursive: true });
    await writeFile(path.join(root, 'Docs', 'a.md'), '# A');
    await mkdir(path.join(root, 'api'), { recursive: true });
    await writeFile(path.join(root, 'api', 'b.md'), '# B');
    await writeFile(path.join(root, 'README.md'), '# README');
    await writeFile(path.join(root, 'changelog.md'), '# Changelog');

    const response = await getTree(root);

    const names = response.json().tree.map((n: { name: string }) => n.name);
    expect(names).toEqual(['api', 'Docs', 'changelog.md', 'README.md']);
  });

  it('TC-5.5a: mdCount computed per directory', async () => {
    const root = await createRoot();
    const docsDir = path.join(root, 'docs');
    const guidesDir = path.join(docsDir, 'guides');
    await mkdir(guidesDir, { recursive: true });
    await writeFile(path.join(docsDir, 'getting-started.md'), '# GS');
    await writeFile(path.join(docsDir, 'api-reference.md'), '# API');
    await writeFile(path.join(guidesDir, 'setup.md'), '# Setup');

    const response = await getTree(root);

    const docsNode = response.json().tree.find((n: { name: string }) => n.name === 'docs');
    expect(docsNode.mdCount).toBe(3);
    const guidesNode = docsNode.children.find((n: { name: string }) => n.name === 'guides');
    expect(guidesNode.mdCount).toBe(1);
  });

  it('TC-9.2a: Medium directory scans within 2 seconds', async () => {
    const root = await createRoot();
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 50; i++) {
      const dir = path.join(root, `dir-${i}`);
      promises.push(
        mkdir(dir, { recursive: true }).then(async () => {
          const filePromises: Promise<void>[] = [];
          for (let j = 0; j < 10; j++) {
            filePromises.push(writeFile(path.join(dir, `doc-${j}.md`), `# Doc ${j}`));
          }
          await Promise.all(filePromises);
        }),
      );
    }
    await Promise.all(promises);

    const start = Date.now();
    const response = await getTree(root);
    const elapsed = Date.now() - start;

    expect(response.statusCode).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });

  it('TC-10.1a: Permission denied on root returns 403', async () => {
    const root = await createRoot();
    await chmod(root, 0o000);

    try {
      const response = await getTree(root);

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: {
          code: 'PERMISSION_DENIED',
          message: `Cannot read directory: ${root}`,
        },
      });
    } finally {
      await chmod(root, 0o700);
    }
  });

  it('TC-10.2a: Root directory not found returns 404', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'GET',
      url: `/api/tree?root=${encodeURIComponent('/nonexistent/path/abc')}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PATH_NOT_FOUND');
    await app.close();
  });

  it('TC-10.3a: Symlink loop detected and skipped', async () => {
    const root = await createRoot();
    await writeFile(path.join(root, 'readme.md'), '# Root');
    const loopDir = path.join(root, 'loop-target');
    await mkdir(loopDir, { recursive: true });
    await writeFile(path.join(loopDir, 'doc.md'), '# Doc');
    await symlink(root, path.join(loopDir, 'self-link'));

    const response = await getTree(root);

    expect(response.statusCode).toBe(200);
    const names = response.json().tree.map((n: { name: string }) => n.name);
    expect(names).toContain('loop-target');
    expect(names).toContain('readme.md');
  });

  it('TC-10.3b: Special files (sockets) are ignored', async () => {
    const root = await createRoot();
    await writeFile(path.join(root, 'readme.md'), '# Root');
    // We can't easily create sockets in a test, but we verify non-regular files are skipped
    // by creating a broken symlink (points to nonexistent target)
    try {
      await symlink('/nonexistent/target', path.join(root, 'broken-link.md'));
    } catch {
      // Symlink creation might fail on some systems
    }

    const response = await getTree(root);

    expect(response.statusCode).toBe(200);
    const names = response.json().tree.map((n: { name: string }) => n.name);
    expect(names).toContain('readme.md');
    expect(names).not.toContain('broken-link.md');
  });

  it('Non-absolute root rejected with 400 INVALID_PATH', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'GET',
      url: `/api/tree?root=${encodeURIComponent('relative/path')}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Root path must be absolute.',
      },
    });
    await app.close();
  });

  it('Empty root returns empty tree', async () => {
    const root = await createRoot();
    // Root exists but has no markdown files
    await writeFile(path.join(root, 'script.sh'), '#!/bin/bash');

    const response = await getTree(root);

    expect(response.statusCode).toBe(200);
    expect(response.json().tree).toEqual([]);
  });

  it('Hidden directories are excluded', async () => {
    const root = await createRoot();
    const hiddenDir = path.join(root, '.hidden-dir');
    await mkdir(hiddenDir, { recursive: true });
    await writeFile(path.join(hiddenDir, 'secret.md'), '# Secret');
    await writeFile(path.join(root, 'visible.md'), '# Visible');

    const response = await getTree(root);

    const names = response.json().tree.map((n: { name: string }) => n.name);
    expect(names).toContain('visible.md');
    expect(names).not.toContain('.hidden-dir');
  });
});
