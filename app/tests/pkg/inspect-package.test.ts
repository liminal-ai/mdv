import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { pack } from 'tar-stream';
import { afterEach, describe, expect, it } from 'vitest';

import { PackageError, PackageErrorCode } from '../../src/pkg/errors.js';
import createPackage from '../../src/pkg/tar/create.js';
import { getManifest } from '../../src/pkg/tar/manifest.js';
import { inspectPackage } from '../../src/pkg/tar/inspect.js';
import { listPackage } from '../../src/pkg/tar/list.js';
import {
  FLAT_MANIFEST,
  FULL_MANIFEST,
  NESTED_MANIFEST,
  NO_FRONTMATTER_MANIFEST,
} from './fixtures/manifests.js';
import { createFixtureWorkspace } from './fixtures/workspaces.js';

const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(
    cleanupTasks.splice(0).map(async (cleanup) => {
      await cleanup();
    }),
  );
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  cleanupTasks.push(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

async function createWorkspace(
  config: Parameters<typeof createFixtureWorkspace>[0],
): Promise<Awaited<ReturnType<typeof createFixtureWorkspace>>['dir']> {
  const workspace = await createFixtureWorkspace(config);
  cleanupTasks.push(workspace.cleanup);
  return workspace.dir;
}

async function createTestPackage(
  config: Parameters<typeof createFixtureWorkspace>[0],
  options: { compress?: boolean; filename?: string } = {},
): Promise<string> {
  const sourceDir = await createWorkspace(config);
  const packageDir = await createTempDir('mdv-inspect-package-');
  const packagePath = path.join(
    packageDir,
    options.filename ?? `fixture.${options.compress ? 'mpkz' : 'mpk'}`,
  );

  await createPackage({
    sourceDir,
    outputPath: packagePath,
    compress: options.compress,
  });

  return packagePath;
}

async function createTarArchive(
  outputPath: string,
  entries: Array<{ name: string; content: string }>,
): Promise<void> {
  const packStream = pack();
  const outputStream = createWriteStream(outputPath);

  const done = new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      packStream.removeListener('error', onError);
      outputStream.removeListener('error', onError);
      outputStream.removeListener('finish', onFinish);
    };

    const onError = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    const onFinish = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve();
    };

    packStream.once('error', onError);
    outputStream.once('error', onError);
    outputStream.once('finish', onFinish);

    packStream.pipe(outputStream);
  });

  for (const entry of entries) {
    const content = Buffer.from(entry.content, 'utf8');
    await new Promise<void>((resolve, reject) => {
      packStream.entry({ name: entry.name, size: content.length }, content, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  packStream.finalize();
  await done;
}

async function createTarWithoutManifest(
  outputPath: string,
  files: Record<string, string>,
): Promise<void> {
  await createTarArchive(
    outputPath,
    Object.entries(files).map(([name, content]) => ({ name, content })),
  );
}

async function expectPackageError(
  promise: Promise<unknown>,
  expected: Partial<PackageError>,
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected operation to throw PackageError');
  } catch (error) {
    expect(error).toBeInstanceOf(PackageError);
    expect(error).toMatchObject(expected);
  }
}

describe('inspectPackage', () => {
  it('returns metadata fields from manifest frontmatter', async () => {
    const packagePath = await createTestPackage({
      manifest: FULL_MANIFEST,
      files: {
        'overview.md': '# Overview',
        'auth/intro.md': '# Intro',
        'auth/login.md': '# Login',
        'endpoints/users.md': '# Users',
        'endpoints/sessions.md': '# Sessions',
      },
    });

    const result = await inspectPackage({ packagePath });

    expect(result.metadata).toEqual({
      title: 'API Reference',
      version: '1.2.3',
      author: 'Docs Team',
      description: 'Comprehensive API package manifest',
      type: 'reference',
      status: 'published',
    });
  });

  it('returns empty metadata when manifest has no frontmatter', async () => {
    const packagePath = await createTestPackage({
      manifest: NO_FRONTMATTER_MANIFEST,
      files: {
        'overview.md': '# Overview',
        'setup.md': '# Setup',
        'usage.md': '# Usage',
      },
    });

    const result = await inspectPackage({ packagePath });

    expect(result.metadata).toEqual({});
    expect(result.navigation).toHaveLength(3);
  });

  it('throws INVALID_ARCHIVE for non-tar file', async () => {
    const packageDir = await createTempDir('mdv-inspect-invalid-');
    const packagePath = path.join(packageDir, 'invalid.mpk');

    await writeFile(packagePath, 'not a tar archive', 'utf8');

    await expect(inspectPackage({ packagePath })).rejects.toMatchObject({
      code: PackageErrorCode.INVALID_ARCHIVE,
      path: packagePath,
    } satisfies Partial<PackageError>);
  });

  it('throws MANIFEST_NOT_FOUND for package without manifest', async () => {
    const packageDir = await createTempDir('mdv-inspect-missing-manifest-');
    const packagePath = path.join(packageDir, 'no-manifest.mpk');

    await createTarWithoutManifest(packagePath, {
      'guide.md': '# Guide',
      'reference/api.md': '# API',
    });

    await expectPackageError(inspectPackage({ packagePath }), {
      code: PackageErrorCode.MANIFEST_NOT_FOUND,
      message: `Manifest not found in package: ${packagePath}`,
      path: packagePath,
    });
  });

  it('returns hierarchical navigation with groups', async () => {
    const packagePath = await createTestPackage({
      manifest: NESTED_MANIFEST,
      files: {
        'guides/start.md': '# Start Here',
        'guides/advanced.md': '# Advanced',
        'reference/cli.md': '# CLI',
      },
    });

    const result = await inspectPackage({ packagePath });

    expect(result.navigation).toHaveLength(2);
    expect(result.navigation[0]).toMatchObject({
      displayName: 'Guides',
      isGroup: true,
    });
    expect(result.navigation[0]?.children.map((node) => node.displayName)).toEqual([
      'Start Here',
      'Advanced',
    ]);
    expect(result.navigation[1]).toMatchObject({
      displayName: 'Reference',
      isGroup: true,
    });
    expect(result.navigation[1]?.children[0]).toMatchObject({
      displayName: 'CLI',
      filePath: 'reference/cli.md',
      isGroup: false,
    });
  });

  it('returns flat navigation list', async () => {
    const packagePath = await createTestPackage({
      manifest: FLAT_MANIFEST,
      files: {
        'one.md': '# One',
        'two.md': '# Two',
        'three.md': '# Three',
      },
    });

    const result = await inspectPackage({ packagePath });

    expect(result.navigation).toEqual([
      { displayName: 'One', filePath: 'one.md', children: [], isGroup: false },
      { displayName: 'Two', filePath: 'two.md', children: [], isGroup: false },
      { displayName: 'Three', filePath: 'three.md', children: [], isGroup: false },
    ]);
  });

  it('returns PackageInfo with expected shape', async () => {
    const packagePath = await createTestPackage({
      manifest: FULL_MANIFEST,
      files: {
        'overview.md': '# Overview',
        'auth/intro.md': '# Intro',
        'auth/login.md': '# Login',
        'endpoints/users.md': '# Users',
        'endpoints/sessions.md': '# Sessions',
      },
    });

    const result = await inspectPackage({ packagePath });

    expect(result).toMatchObject({
      metadata: expect.any(Object),
      navigation: expect.any(Array),
      files: expect.any(Array),
      format: 'mpk',
    });
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('inspects compressed .mpkz package', async () => {
    const packagePath = await createTestPackage(
      {
        manifest: FULL_MANIFEST,
        files: {
          'overview.md': '# Overview',
          'auth/intro.md': '# Intro',
          'auth/login.md': '# Login',
          'endpoints/users.md': '# Users',
          'endpoints/sessions.md': '# Sessions',
        },
      },
      { compress: true },
    );

    const result = await inspectPackage({ packagePath });

    expect(result.format).toBe('mpkz');
    expect(result.metadata.title).toBe('API Reference');
    expect(result.files.map((file) => file.path)).toEqual(
      [...result.files.map((file) => file.path)].sort(),
    );
  });
});

describe('listPackage', () => {
  it('returns all files with paths and sizes', async () => {
    const packagePath = await createTestPackage({
      manifest:
        '- [Intro](intro.md)\n- [Guide](docs/guide.md)\n- [API](reference/api.md)\n- [Logo](assets/logo.txt)\n',
      files: {
        'intro.md': '# Intro',
        'docs/guide.md': '# Guide',
        'reference/api.md': '# API',
        'assets/logo.txt': 'logo',
      },
    });

    const result = await listPackage({ packagePath });

    expect(result).toHaveLength(5);
    for (const entry of result) {
      expect(typeof entry.path).toBe('string');
      expect(typeof entry.size).toBe('number');
      expect(entry.size).toBeGreaterThan(0);
    }
  });

  it('returns files sorted ascending by path', async () => {
    const packageDir = await createTempDir('mdv-list-sorted-');
    const packagePath = path.join(packageDir, 'unsorted.mpk');

    await createTarArchive(packagePath, [
      { name: 'z-last.md', content: '# Z' },
      { name: '_nav.md', content: '- [Alpha](a/first.md)\n- [Omega](z-last.md)\n' },
      { name: 'a/second.md', content: '# Second' },
      { name: 'a/first.md', content: '# First' },
    ]);

    const result = await listPackage({ packagePath });

    expect(result.map((entry) => entry.path)).toEqual([
      '_nav.md',
      'a/first.md',
      'a/second.md',
      'z-last.md',
    ]);
  });
});

describe('getManifest', () => {
  it('returns raw manifest content including frontmatter', async () => {
    const packagePath = await createTestPackage({
      manifest: FULL_MANIFEST,
      files: {
        'overview.md': '# Overview',
        'auth/intro.md': '# Intro',
        'auth/login.md': '# Login',
        'endpoints/users.md': '# Users',
        'endpoints/sessions.md': '# Sessions',
      },
    });

    const result = await getManifest({ packagePath });

    expect(result.content).toBe(FULL_MANIFEST);
    expect(result.metadata.title).toBe('API Reference');
    expect(result.navigation).toHaveLength(3);
  });

  it('throws MANIFEST_NOT_FOUND for package without manifest', async () => {
    const packageDir = await createTempDir('mdv-manifest-missing-');
    const packagePath = path.join(packageDir, 'no-manifest.mpk');

    await createTarWithoutManifest(packagePath, {
      'guide.md': '# Guide',
      'reference/api.md': '# API',
    });

    await expect(getManifest({ packagePath })).rejects.toMatchObject({
      code: PackageErrorCode.MANIFEST_NOT_FOUND,
      path: packagePath,
    } satisfies Partial<PackageError>);
  });

  it('throws INVALID_ARCHIVE for non-tar file', async () => {
    const packageDir = await createTempDir('mdv-manifest-invalid-');
    const packagePath = path.join(packageDir, 'invalid.mpk');

    await writeFile(packagePath, 'not a tar archive', 'utf8');

    await expect(getManifest({ packagePath })).rejects.toMatchObject({
      code: PackageErrorCode.INVALID_ARCHIVE,
      path: packagePath,
    } satisfies Partial<PackageError>);
  });
});
