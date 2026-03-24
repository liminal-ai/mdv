import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { pack } from 'tar-stream';
import { afterEach, describe, expect, it } from 'vitest';

import { PackageError, PackageErrorCode } from '../../src/pkg/errors.js';
import createPackage from '../../src/pkg/tar/create.js';
import { readDocument } from '../../src/pkg/tar/read.js';
import { AMBIGUOUS_NAMES_MANIFEST, NESTED_MANIFEST } from './fixtures/manifests.js';
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
  const packageDir = await createTempDir('mdv-read-package-');
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

async function createTarWithoutManifest(
  outputPath: string,
  files: Record<string, string>,
): Promise<void> {
  const packStream = pack();
  const outputStream = createWriteStream(outputPath);

  const outputPromise = new Promise<void>((resolve, reject) => {
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

  for (const [name, content] of Object.entries(files)) {
    await new Promise<void>((resolve, reject) => {
      const buffer = Buffer.from(content, 'utf8');

      packStream.entry({ name, size: buffer.length }, buffer, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  packStream.finalize();
  await outputPromise;
}

describe('readDocument', () => {
  it('reads document by file path', async () => {
    const packagePath = await createTestPackage({
      manifest: '- [OAuth2](auth/oauth2.md)\n- [API Keys](auth/api-keys.md)\n',
      files: {
        'auth/oauth2.md': '# OAuth2\n\nUse OAuth2 for delegated access.',
        'auth/api-keys.md': '# API Keys',
      },
    });

    const result = await readDocument({
      packagePath,
      target: { filePath: 'auth/oauth2.md' },
    });

    expect(result).toEqual({
      content: '# OAuth2\n\nUse OAuth2 for delegated access.',
      filePath: 'auth/oauth2.md',
    });
  });

  it('throws FILE_NOT_FOUND for missing file path', async () => {
    const packagePath = await createTestPackage({
      manifest: '- [OAuth2](auth/oauth2.md)\n',
      files: {
        'auth/oauth2.md': '# OAuth2',
      },
    });

    await expect(
      readDocument({
        packagePath,
        target: { filePath: 'nonexistent.md' },
      }),
    ).rejects.toMatchObject({
      code: PackageErrorCode.FILE_NOT_FOUND,
      path: 'nonexistent.md',
    } satisfies Partial<PackageError>);
  });

  it('throws INVALID_ARCHIVE for non-tar file', async () => {
    const packageDir = await createTempDir('mdv-read-invalid-');
    const packagePath = path.join(packageDir, 'invalid.mpk');

    await writeFile(packagePath, 'not a tar archive', 'utf8');

    await expect(
      readDocument({
        packagePath,
        target: { filePath: 'auth/oauth2.md' },
      }),
    ).rejects.toMatchObject({
      code: PackageErrorCode.INVALID_ARCHIVE,
      path: packagePath,
    } satisfies Partial<PackageError>);
  });

  it('reads document by display name via manifest', async () => {
    const packagePath = await createTestPackage({
      manifest: NESTED_MANIFEST,
      files: {
        'guides/start.md': '# Start Here\n\nBegin here.',
        'guides/advanced.md': '# Advanced',
        'reference/cli.md': '# CLI',
      },
    });

    const result = await readDocument({
      packagePath,
      target: { displayName: 'Start Here' },
    });

    expect(result).toEqual({
      content: '# Start Here\n\nBegin here.',
      filePath: 'guides/start.md',
    });
  });

  it('throws FILE_NOT_FOUND for unknown display name', async () => {
    const packagePath = await createTestPackage({
      manifest: NESTED_MANIFEST,
      files: {
        'guides/start.md': '# Start Here',
        'guides/advanced.md': '# Advanced',
        'reference/cli.md': '# CLI',
      },
    });

    await expect(
      readDocument({
        packagePath,
        target: { displayName: 'Nonexistent' },
      }),
    ).rejects.toMatchObject({
      code: PackageErrorCode.FILE_NOT_FOUND,
      path: 'Nonexistent',
    } satisfies Partial<PackageError>);
  });

  it('throws MANIFEST_NOT_FOUND for display name lookup when manifest is missing', async () => {
    const packageDir = await createTempDir('mdv-read-no-manifest-');
    const packagePath = path.join(packageDir, 'no-manifest.mpk');

    await createTarWithoutManifest(packagePath, {
      'guides/start.md': '# Start Here',
    });

    await expect(
      readDocument({
        packagePath,
        target: { displayName: 'Start Here' },
      }),
    ).rejects.toMatchObject({
      code: PackageErrorCode.MANIFEST_NOT_FOUND,
      message: 'No manifest found in package',
      path: packagePath,
    } satisfies Partial<PackageError>);
  });

  it('throws AMBIGUOUS_DISPLAY_NAME for duplicate display names', async () => {
    const packagePath = await createTestPackage({
      manifest: AMBIGUOUS_NAMES_MANIFEST,
      files: {
        'guides/overview.md': '# Guides Overview',
        'reference/overview.md': '# Reference Overview',
      },
    });

    await expect(
      readDocument({
        packagePath,
        target: { displayName: 'Overview' },
      }),
    ).rejects.toMatchObject({
      code: PackageErrorCode.AMBIGUOUS_DISPLAY_NAME,
      path: 'Overview',
    } satisfies Partial<PackageError>);

    await expect(
      readDocument({
        packagePath,
        target: { displayName: 'Overview' },
      }),
    ).rejects.toThrow(/guides\/overview\.md/);
    await expect(
      readDocument({
        packagePath,
        target: { displayName: 'Overview' },
      }),
    ).rejects.toThrow(/reference\/overview\.md/);
  });

  it('provides descriptive error message for FILE_NOT_FOUND', async () => {
    const packagePath = await createTestPackage({
      manifest: '- [OAuth2](auth/oauth2.md)\n',
      files: {
        'auth/oauth2.md': '# OAuth2',
      },
    });

    await expect(
      readDocument({
        packagePath,
        target: { filePath: 'missing/file.md' },
      }),
    ).rejects.toThrow(/missing\/file\.md/);
  });

  it('reads document from compressed .mpkz package', async () => {
    const packagePath = await createTestPackage(
      {
        manifest: '- [OAuth2](auth/oauth2.md)\n',
        files: {
          'auth/oauth2.md': '# OAuth2\n\nCompressed package content.',
        },
      },
      { compress: true },
    );

    const result = await readDocument({
      packagePath,
      target: { filePath: 'auth/oauth2.md' },
    });

    expect(result.content).toBe('# OAuth2\n\nCompressed package content.');
    expect(result.filePath).toBe('auth/oauth2.md');
  });
});
