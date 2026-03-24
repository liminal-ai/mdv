import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { pack } from 'tar-stream';
import { afterEach, describe, expect, it } from 'vitest';

import { PackageError, PackageErrorCode } from '../../src/pkg/errors.js';
import createPackage from '../../src/pkg/tar/create.js';
import extractPackage from '../../src/pkg/tar/extract.js';
import { MANIFEST_FILENAME } from '../../src/pkg/types.js';
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
  const packageDir = await createTempDir('mdv-extract-package-');
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

async function createTraversalTar(
  outputPath: string,
  entries: Array<{ name: string; content: string }>,
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

  for (const entry of entries) {
    await new Promise<void>((resolve, reject) => {
      const content = Buffer.from(entry.content, 'utf8');

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
  await outputPromise;
}

async function readWorkspaceFiles(rootDir: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const entries = await readdir(rootDir, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const relativePath = path.relative(rootDir, path.join(entry.parentPath, entry.name));
    files.set(relativePath, await readFile(path.join(rootDir, relativePath)));
  }

  return files;
}

describe('extractPackage', () => {
  it('TC-3.1a full extraction preserves structure', async () => {
    const packagePath = await createTestPackage({
      manifest: '- [Home](docs/home.md)\n- [Logo](assets/logo.txt)\n- [Api](reference/api.md)',
      files: {
        'docs/home.md': '# Home',
        'reference/api.md': '# API',
        'assets/logo.txt': 'logo placeholder',
      },
    });
    const outputDir = await createTempDir('mdv-extract-output-');

    await extractPackage({ packagePath, outputDir });

    expect(await readFile(path.join(outputDir, MANIFEST_FILENAME), 'utf8')).toContain(
      '[Home](docs/home.md)',
    );
    expect(await readFile(path.join(outputDir, 'docs/home.md'), 'utf8')).toBe('# Home');
    expect(await readFile(path.join(outputDir, 'reference/api.md'), 'utf8')).toBe('# API');
    expect(await readFile(path.join(outputDir, 'assets/logo.txt'), 'utf8')).toBe(
      'logo placeholder',
    );
  });

  it('TC-3.1b extracted files are byte-identical to originals', async () => {
    const sourceDir = await createWorkspace({
      manifest: '- [Guide](docs/guide.md)\n- [Asset](images/logo.bin)',
      files: {
        'docs/guide.md': '# Guide\n\nLine one\nLine two',
      },
      binaryFiles: {
        'images/logo.bin': Buffer.from([0, 1, 2, 3, 254, 255]),
      },
    });
    const packageDir = await createTempDir('mdv-byte-compare-');
    const packagePath = path.join(packageDir, 'byte-identical.mpk');
    const outputDir = await createTempDir('mdv-byte-output-');

    await createPackage({ sourceDir, outputPath: packagePath });
    await extractPackage({ packagePath, outputDir });

    const [originalFiles, extractedFiles] = await Promise.all([
      readWorkspaceFiles(sourceDir),
      readWorkspaceFiles(outputDir),
    ]);

    expect([...extractedFiles.keys()].sort()).toEqual([...originalFiles.keys()].sort());

    for (const [relativePath, originalContent] of originalFiles) {
      expect(extractedFiles.get(relativePath)).toEqual(originalContent);
    }
  });

  it('TC-3.2a compressed package extracts correctly', async () => {
    const sourceDir = await createWorkspace({
      manifest: '- [Guide](guide.md)\n- [Nested](docs/nested/topic.md)',
      files: {
        'guide.md': '# Guide',
        'docs/nested/topic.md': '# Topic',
      },
      binaryFiles: {
        'images/logo.bin': Buffer.from([10, 20, 30, 40]),
      },
    });
    const packageDir = await createTempDir('mdv-compressed-package-');
    const uncompressedPath = path.join(packageDir, 'archive.mpk');
    const compressedPath = path.join(packageDir, 'archive.mpkz');
    const uncompressedOutputDir = await createTempDir('mdv-compressed-out-a-');
    const compressedOutputDir = await createTempDir('mdv-compressed-out-b-');

    await createPackage({ sourceDir, outputPath: uncompressedPath });
    await createPackage({ sourceDir, outputPath: compressedPath, compress: true });
    await extractPackage({ packagePath: uncompressedPath, outputDir: uncompressedOutputDir });
    await extractPackage({ packagePath: compressedPath, outputDir: compressedOutputDir });

    expect(await readWorkspaceFiles(compressedOutputDir)).toEqual(
      await readWorkspaceFiles(uncompressedOutputDir),
    );
  });

  it('TC-3.3a extracting overwrites existing conflicting files', async () => {
    const packagePath = await createTestPackage({
      manifest: '- [Guide](docs/guide.md)',
      files: {
        'docs/guide.md': '# Package Version',
      },
    });
    const outputDir = await createTempDir('mdv-overwrite-output-');
    const conflictingPath = path.join(outputDir, 'docs/guide.md');

    await mkdir(path.dirname(conflictingPath), { recursive: true });
    await writeFile(conflictingPath, '# Existing Version', 'utf8');
    await extractPackage({ packagePath, outputDir });

    expect(await readFile(conflictingPath, 'utf8')).toBe('# Package Version');
  });

  it('TC-3.4a non-tar file throws INVALID_ARCHIVE', async () => {
    const packageDir = await createTempDir('mdv-invalid-archive-');
    const packagePath = path.join(packageDir, 'invalid.mpk');
    const outputDir = await createTempDir('mdv-invalid-output-');

    await writeFile(packagePath, 'not a tar archive', 'utf8');

    await expect(extractPackage({ packagePath, outputDir })).rejects.toMatchObject({
      code: PackageErrorCode.INVALID_ARCHIVE,
      path: packagePath,
    } satisfies Partial<PackageError>);
  });

  it('TC-3.4b corrupted gzip throws COMPRESSION_ERROR', async () => {
    const packageDir = await createTempDir('mdv-corrupt-gzip-');
    const packagePath = path.join(packageDir, 'invalid.mpkz');
    const outputDir = await createTempDir('mdv-corrupt-output-');

    await writeFile(packagePath, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));

    await expect(extractPackage({ packagePath, outputDir })).rejects.toMatchObject({
      code: PackageErrorCode.COMPRESSION_ERROR,
      path: packagePath,
    } satisfies Partial<PackageError>);
  });

  it('TC-3.5a nonexistent output directory created', async () => {
    const packagePath = await createTestPackage({
      manifest: '- [Guide](guide.md)',
      files: {
        'guide.md': '# Guide',
      },
    });
    const baseOutputDir = await createTempDir('mdv-nested-output-');
    const outputDir = path.join(baseOutputDir, 'deep', 'nested', 'target');

    await extractPackage({ packagePath, outputDir });

    expect(await readFile(path.join(outputDir, 'guide.md'), 'utf8')).toBe('# Guide');
  });

  it('TC-3.6a path traversal with .. blocked', async () => {
    const packageDir = await createTempDir('mdv-traversal-package-');
    const packagePath = path.join(packageDir, 'traversal.mpk');
    const outputDir = await createTempDir('mdv-traversal-output-');

    await createTraversalTar(packagePath, [{ name: '../../etc/malicious', content: 'owned' }]);

    await expect(extractPackage({ packagePath, outputDir })).rejects.toMatchObject({
      code: PackageErrorCode.PATH_TRAVERSAL,
      path: '../../etc/malicious',
    } satisfies Partial<PackageError>);
  });

  it('TC-3.6b absolute path blocked', async () => {
    const packageDir = await createTempDir('mdv-absolute-package-');
    const packagePath = path.join(packageDir, 'absolute.mpk');
    const outputDir = await createTempDir('mdv-absolute-output-');

    await createTraversalTar(packagePath, [{ name: '/etc/passwd', content: 'owned' }]);

    await expect(extractPackage({ packagePath, outputDir })).rejects.toMatchObject({
      code: PackageErrorCode.PATH_TRAVERSAL,
      path: '/etc/passwd',
    } satisfies Partial<PackageError>);
  });

  it('TC-7.3a error has code property from PackageErrorCode', async () => {
    const packageDir = await createTempDir('mdv-error-code-package-');
    const packagePath = path.join(packageDir, 'invalid.mpk');
    const outputDir = await createTempDir('mdv-error-code-output-');

    await writeFile(packagePath, 'still not a tar archive', 'utf8');

    try {
      await extractPackage({ packagePath, outputDir });
      throw new Error('Expected extractPackage to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PackageError);
      expect(Object.values(PackageErrorCode)).toContain((error as PackageError).code);
    }
  });

  it('rejects extraction through pre-existing symlink in output directory', async () => {
    const packagePath = await createTestPackage({
      manifest: '- [Guide](linked/guide.md)',
      files: { 'linked/guide.md': '# Guide' },
    });
    const outputDir = await createTempDir('mdv-symlink-output-');
    const escapeDir = await createTempDir('mdv-symlink-escape-');

    await symlink(escapeDir, path.join(outputDir, 'linked'));

    await expect(extractPackage({ packagePath, outputDir })).rejects.toMatchObject({
      code: PackageErrorCode.PATH_TRAVERSAL,
    } satisfies Partial<PackageError>);
  });

  it('nonexistent package file throws READ_ERROR', async () => {
    const outputDir = await createTempDir('mdv-missing-package-output-');

    await expect(
      extractPackage({
        packagePath: '/nonexistent/path/to/package.mpk',
        outputDir,
      }),
    ).rejects.toMatchObject({
      code: PackageErrorCode.READ_ERROR,
    } satisfies Partial<PackageError>);
  });

  it('handles unicode filenames', async () => {
    const packagePath = await createTestPackage({
      manifest: '- [Japanese](docs/日本語.md)',
      files: {
        'docs/日本語.md': '# こんにちは',
      },
    });
    const outputDir = await createTempDir('mdv-unicode-output-');

    await extractPackage({ packagePath, outputDir });

    expect(await readFile(path.join(outputDir, 'docs/日本語.md'), 'utf8')).toBe('# こんにちは');
  });

  it('handles very long file path', async () => {
    const longRelativePath = path.join(
      'docs',
      'a'.repeat(80),
      'b'.repeat(80),
      `${'c'.repeat(80)}.md`,
    );
    const packagePath = await createTestPackage({
      manifest: `- [Long Path](${longRelativePath.split(path.sep).join('/')})`,
      files: {
        [longRelativePath]: '# Long Path',
      },
    });
    const outputDir = await createTempDir('mdv-long-path-output-');

    await extractPackage({ packagePath, outputDir });

    expect(await readFile(path.join(outputDir, longRelativePath), 'utf8')).toBe('# Long Path');
  });
});
