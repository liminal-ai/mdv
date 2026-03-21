import type { Dirent } from 'node:fs';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readdir: vi.fn(actual.readdir),
    realpath: vi.fn(actual.realpath),
    stat: vi.fn(actual.stat),
    readFile: vi.fn(actual.readFile),
  };
});

import { buildApp } from '../../../src/server/app.js';
import { scanTree } from '../../../src/server/services/tree.service.js';
import { ScanTimeoutError } from '../../../src/server/utils/errors.js';
import { createTempDir, removeTempDir } from '../../utils/tmp.js';

const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');

function countMarkdownFiles(nodes: Array<{ type: string; children?: unknown[] }>): number {
  return nodes.reduce((sum, node) => {
    if (node.type === 'file') {
      return sum + 1;
    }

    return (
      sum +
      countMarkdownFiles((node.children ?? []) as Array<{ type: string; children?: unknown[] }>)
    );
  }, 0);
}

describe('tree hardening routes', () => {
  const tempDirs: string[] = [];
  const cleanupTasks: Array<() => Promise<void>> = [];

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.mocked(fs.readdir).mockImplementation(actualFs.readdir as typeof fs.readdir);
    vi.mocked(fs.realpath).mockImplementation(actualFs.realpath as typeof fs.realpath);
    vi.mocked(fs.stat).mockImplementation(actualFs.stat as typeof fs.stat);
    vi.mocked(fs.readFile).mockImplementation(actualFs.readFile as typeof fs.readFile);
  });

  afterEach(async () => {
    for (const cleanup of cleanupTasks.splice(0)) {
      await cleanup();
    }
    await Promise.all(tempDirs.splice(0).map((dir) => removeTempDir(dir)));
    vi.useRealTimers();
  });

  async function createRoot() {
    const baseDir = await createTempDir();
    tempDirs.push(baseDir);
    const root = path.join(baseDir, 'project');
    await actualFs.mkdir(root, { recursive: true });
    return root;
  }

  async function getAppForRoot(root: string) {
    const sessionDir = path.join(path.dirname(root), 'session');
    return buildApp({ sessionDir });
  }

  it('TC-2.1a: tree scan completes for 1500 files', async () => {
    const root = await createRoot();

    const writes: Array<Promise<void>> = [];
    for (let dirIndex = 0; dirIndex < 200; dirIndex += 1) {
      const dir = path.join(root, `dir-${dirIndex}`);
      writes.push(
        actualFs.mkdir(dir, { recursive: true }).then(async () => {
          const fileCount = dirIndex < 100 ? 8 : 7;
          await Promise.all(
            Array.from({ length: fileCount }, (_, fileIndex) =>
              actualFs.writeFile(
                path.join(dir, `doc-${fileIndex}.md`),
                `# ${dirIndex}-${fileIndex}`,
              ),
            ),
          );
        }),
      );
    }
    await Promise.all(writes);

    const app = await getAppForRoot(root);
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tree?root=${encodeURIComponent(root)}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tree).toHaveLength(200);
      expect(countMarkdownFiles(response.json().tree)).toBe(1500);
    } finally {
      await app.close();
    }
  });

  it('TC-5.2a: symlink loop detected and skipped', async () => {
    const root = await createRoot();
    const loopTarget = path.join(root, 'loop-target');
    await actualFs.mkdir(loopTarget, { recursive: true });
    await actualFs.writeFile(path.join(loopTarget, 'doc.md'), '# loop');
    await actualFs.writeFile(path.join(root, 'readme.md'), '# root');
    await actualFs.symlink(root, path.join(loopTarget, 'self-link'));

    const app = await getAppForRoot(root);
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tree?root=${encodeURIComponent(root)}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tree.map((node: { name: string }) => node.name)).toContain(
        'loop-target',
      );
      expect(countMarkdownFiles(response.json().tree)).toBe(2);
    } finally {
      await app.close();
    }
  });

  it('TC-5.2b: broken symlink excluded', async () => {
    const root = await createRoot();
    await actualFs.writeFile(path.join(root, 'readme.md'), '# root');
    await actualFs.symlink('/nonexistent/target.md', path.join(root, 'broken.md'));

    const app = await getAppForRoot(root);
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tree?root=${encodeURIComponent(root)}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tree.map((node: { name: string }) => node.name)).toEqual([
        'readme.md',
      ]);
    } finally {
      await app.close();
    }
  });

  it('TC-5.2c: symlink outside root uses symlink path', async () => {
    const root = await createRoot();
    const docsDir = path.join(root, 'docs');
    const outsideDir = path.join(path.dirname(root), 'outside');
    await actualFs.mkdir(docsDir, { recursive: true });
    await actualFs.mkdir(outsideDir, { recursive: true });
    await actualFs.writeFile(path.join(outsideDir, 'real.md'), '# real');
    await actualFs.symlink(path.join(outsideDir, 'real.md'), path.join(docsDir, 'link.md'));

    const app = await getAppForRoot(root);
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tree?root=${encodeURIComponent(root)}`,
      });

      const docsNode = response.json().tree.find((node: { name: string }) => node.name === 'docs');
      expect(response.statusCode).toBe(200);
      expect(docsNode.children[0].path).toBe(path.join(docsDir, 'link.md'));
      expect(docsNode.children[0].path).not.toContain('outside');
    } finally {
      await app.close();
    }
  });

  it('TC-5.1a: unreadable .md file appears in tree', async () => {
    const root = await createRoot();
    const unreadablePath = path.join(root, 'private.md');
    await actualFs.writeFile(unreadablePath, '# secret');
    await actualFs.chmod(unreadablePath, 0o000);
    cleanupTasks.push(async () => {
      await actualFs.chmod(unreadablePath, 0o600);
    });

    const app = await getAppForRoot(root);
    try {
      const treeResponse = await app.inject({
        method: 'GET',
        url: `/api/tree?root=${encodeURIComponent(root)}`,
      });
      const fileResponse = await app.inject({
        method: 'GET',
        url: `/api/file?path=${encodeURIComponent(unreadablePath)}`,
      });

      expect(treeResponse.statusCode).toBe(200);
      expect(treeResponse.json().tree.map((node: { name: string }) => node.name)).toContain(
        'private.md',
      );
      expect(fileResponse.statusCode).toBe(403);
      expect(fileResponse.json().error.code).toBe('PERMISSION_DENIED');
    } finally {
      await app.close();
    }
  });

  it('TC-5.1b: unreadable directory skipped silently', async () => {
    const root = await createRoot();
    const blockedDir = path.join(root, 'blocked');
    await actualFs.mkdir(blockedDir, { recursive: true });
    await actualFs.writeFile(path.join(blockedDir, 'hidden.md'), '# hidden');
    await actualFs.writeFile(path.join(root, 'visible.md'), '# visible');
    await actualFs.chmod(blockedDir, 0o000);
    cleanupTasks.push(async () => {
      await actualFs.chmod(blockedDir, 0o700);
    });

    const app = await getAppForRoot(root);
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tree?root=${encodeURIComponent(root)}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tree.map((node: { name: string }) => node.name)).toEqual([
        'visible.md',
      ]);
    } finally {
      await app.close();
    }
  });

  it('TC-5.3a: tree scan timeout returns 500 SCAN_ERROR with timeout flag', async () => {
    const root = await createRoot();
    vi.mocked(fs.readdir).mockImplementation(async (dirPath, options) => {
      if (
        dirPath === root &&
        options &&
        typeof options === 'object' &&
        'withFileTypes' in options
      ) {
        return new Promise<Dirent<string>[]>((_resolve) => {});
      }

      return actualFs.readdir(dirPath, options as Parameters<typeof actualFs.readdir>[1]);
    });

    await expect(scanTree(root, { timeoutMs: 5 })).rejects.toEqual(new ScanTimeoutError(root));
  });

  it('TC-5.3b: slow file read shows timeout error', async () => {
    const root = await createRoot();
    const slowFilePath = path.join(root, 'slow.md');
    await actualFs.writeFile(slowFilePath, '# slow');

    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController();
      queueMicrotask(() => controller.abort());
      return controller.signal;
    });
    vi.mocked(fs.readFile).mockImplementation(((_path, options) => {
      return new Promise((_resolve, reject) => {
        if (typeof options !== 'object' || options === null || !('signal' in options)) {
          reject(new Error('Expected readFile to receive an abort signal.'));
          return;
        }

        options.signal.addEventListener(
          'abort',
          () => {
            reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
          },
          { once: true },
        );
      });
    }) as typeof fs.readFile);

    const app = await getAppForRoot(root);
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/file?path=${encodeURIComponent(slowFilePath)}`,
      });

      expect(response.statusCode).toBe(504);
      expect(response.json()).toEqual({
        error: {
          code: 'READ_TIMEOUT',
          message: `File read timed out after 10 seconds: ${slowFilePath}`,
        },
      });
    } finally {
      await app.close();
    }
  });

  it('TC-5.3c: filesystem disconnect produces error', async () => {
    const root = await createRoot();
    vi.mocked(fs.readdir).mockRejectedValueOnce(
      Object.assign(new Error('Network mount disconnected'), { code: 'ENETUNREACH' }),
    );

    const app = await getAppForRoot(root);
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tree?root=${encodeURIComponent(root)}`,
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: {
          code: 'SCAN_ERROR',
          message: `Failed to scan directory: ${root}`,
        },
      });
    } finally {
      await app.close();
    }
  });

  it('TC-5.4a: deep nesting (50+ levels) handled', async () => {
    const root = await createRoot();
    let current = root;
    for (let index = 0; index < 60; index += 1) {
      current = path.join(current, `level-${index}`);
      await actualFs.mkdir(current, { recursive: true });
    }
    await actualFs.writeFile(path.join(current, 'deep.md'), '# deep');

    const app = await getAppForRoot(root);
    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tree?root=${encodeURIComponent(root)}`,
      });

      let cursor = response.json().tree[0];
      for (let index = 0; index < 59; index += 1) {
        expect(cursor.type).toBe('directory');
        cursor = cursor.children[0];
      }

      expect(cursor.children[0].name).toBe('deep.md');
    } finally {
      await app.close();
    }
  });

  it('TC-13.1b: tree timeout shows retry prompt', async () => {
    const root = await createRoot();
    vi.resetModules();
    const { ScanTimeoutError: RouteScanTimeoutError } =
      await import('../../../src/server/utils/errors.js');
    vi.doMock('../../../src/server/services/tree.service.js', () => ({
      scanTree: vi.fn().mockRejectedValue(new RouteScanTimeoutError(root)),
    }));

    const Fastify = (await import('fastify')).default;
    const { serializerCompiler, validatorCompiler } = await import('fastify-type-provider-zod');
    const { treeRoutes } = await import('../../../src/server/routes/tree.js');
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(treeRoutes);

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tree?root=${encodeURIComponent(root)}`,
      });

      expect(response.statusCode).toBe(500);
      expect(response.json().error.code).toBe('SCAN_ERROR');
      expect(response.json().error.timeout).toBe(true);
    } finally {
      await app.close();
      vi.doUnmock('../../../src/server/services/tree.service.js');
      vi.resetModules();
    }
  });
});
