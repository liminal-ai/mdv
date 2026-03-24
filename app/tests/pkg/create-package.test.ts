import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGunzip } from 'node:zlib';

import { extract } from 'tar-stream';
import { afterEach, describe, expect, it } from 'vitest';

import scaffoldManifest from '../../src/pkg/manifest/scaffold.js';
import { PackageError, PackageErrorCode } from '../../src/pkg/errors.js';
import createPackage from '../../src/pkg/tar/create.js';
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

async function createOutputPath(filename: string): Promise<string> {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'mdv-pkg-output-'));
  cleanupTasks.push(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });
  return path.join(outputDir, filename);
}

async function createWorkspace(
  config: Parameters<typeof createFixtureWorkspace>[0],
): Promise<Awaited<ReturnType<typeof createFixtureWorkspace>>['dir']> {
  const workspace = await createFixtureWorkspace(config);
  cleanupTasks.push(workspace.cleanup);
  return workspace.dir;
}

async function readPackageEntries(
  packagePath: string,
  options: { gzip?: boolean } = {},
): Promise<Map<string, Buffer>> {
  const entries = new Map<string, Buffer>();
  const extractor = extract();
  const inputStream = createReadStream(packagePath);
  const archiveStream = options.gzip ? inputStream.pipe(createGunzip()) : inputStream;

  return await new Promise<Map<string, Buffer>>((resolve, reject) => {
    const onError = (error: Error) => {
      reject(error);
    };

    extractor.on('entry', (header, stream, next) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        entries.set(header.name, Buffer.concat(chunks));
        next();
      });

      stream.on('error', reject);
    });

    extractor.once('finish', () => {
      resolve(entries);
    });

    inputStream.once('error', onError);
    archiveStream.once('error', onError);
    extractor.once('error', onError);

    archiveStream.pipe(extractor);
  });
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

describe('createPackage', () => {
  it('TC-2.1a creates package with all source files', async () => {
    const sourceDir = await createWorkspace({
      manifest: '- [Overview](overview.md)\n- [Setup](setup.md)\n- [Api](api.md)',
      files: {
        'overview.md': '# Overview',
        'setup.md': '# Setup',
        'api.md': '# API',
      },
    });
    const outputPath = await createOutputPath('package.mpk');

    await createPackage({ sourceDir, outputPath });

    const entries = await readPackageEntries(outputPath);

    expect([...entries.keys()].sort()).toEqual([
      MANIFEST_FILENAME,
      'api.md',
      'overview.md',
      'setup.md',
    ]);
  });

  it('TC-2.1b includes supporting assets at original paths', async () => {
    const sourceDir = await createWorkspace({
      manifest: '- [Guide](docs/guide.md)',
      files: {
        'docs/guide.md': '# Guide',
      },
      binaryFiles: {
        'images/logo.png': Buffer.from([0, 1, 2, 3, 4]),
      },
    });
    const outputPath = await createOutputPath('assets.mpk');

    await createPackage({ sourceDir, outputPath });

    const entries = await readPackageEntries(outputPath);

    expect(entries.has('images/logo.png')).toBe(true);
    expect(entries.get('images/logo.png')).toEqual(Buffer.from([0, 1, 2, 3, 4]));
  });

  it('TC-2.1c preserves directory hierarchy in tar entries', async () => {
    const sourceDir = await createWorkspace({
      manifest:
        '- [Auth](docs/api/auth.md)\n- [Payments](docs/api/payments.md)\n- [Root](index.md)',
      files: {
        'docs/api/auth.md': '# Auth',
        'docs/api/payments.md': '# Payments',
        'index.md': '# Home',
      },
    });
    const outputPath = await createOutputPath('hierarchy.mpk');

    await createPackage({ sourceDir, outputPath });

    const entries = await readPackageEntries(outputPath);

    expect([...entries.keys()].sort()).toEqual([
      MANIFEST_FILENAME,
      'docs/api/auth.md',
      'docs/api/payments.md',
      'index.md',
    ]);
  });

  it('TC-2.2a scaffolds manifest to disk and includes in package', async () => {
    const sourceDir = await createWorkspace({
      files: {
        'guide.md': '# Guide',
        'reference/api.md': '# API',
      },
    });
    const outputPath = await createOutputPath('scaffolded.mpk');

    await createPackage({ sourceDir, outputPath });

    const manifestOnDisk = await readFile(path.join(sourceDir, MANIFEST_FILENAME), 'utf8');
    const entries = await readPackageEntries(outputPath);

    expect(manifestOnDisk).toContain('[Guide](guide.md)');
    expect(entries.has(MANIFEST_FILENAME)).toBe(true);
  });

  it('TC-2.2b scaffolded manifest contains entries for all markdown files', async () => {
    const sourceDir = await createWorkspace({
      files: {
        'alpha.md': '# Alpha',
        'guides/getting-started.md': '# Start',
        'reference/api_overview.md': '# API',
      },
    });
    const outputPath = await createOutputPath('manifest-links.mpk');

    await createPackage({ sourceDir, outputPath });

    const manifestOnDisk = await readFile(path.join(sourceDir, MANIFEST_FILENAME), 'utf8');
    const directScaffold = await scaffoldManifest(sourceDir);

    expect(manifestOnDisk).toBe(directScaffold);
    expect(manifestOnDisk).toContain('- [Alpha](alpha.md)');
    expect(manifestOnDisk).toContain('- [Getting Started](guides/getting-started.md)');
    expect(manifestOnDisk).toContain('- [Api Overview](reference/api_overview.md)');
  });

  it('TC-2.2c does not overwrite existing manifest', async () => {
    const customManifest = '# Custom Manifest\n\n- [Manual](manual.md)';
    const sourceDir = await createWorkspace({
      manifest: customManifest,
      files: {
        'manual.md': '# Manual',
      },
    });
    const outputPath = await createOutputPath('existing-manifest.mpk');

    await createPackage({ sourceDir, outputPath });

    const entries = await readPackageEntries(outputPath);

    expect(entries.get(MANIFEST_FILENAME)?.toString('utf8')).toBe(customManifest);
    expect(await readFile(path.join(sourceDir, MANIFEST_FILENAME), 'utf8')).toBe(customManifest);
  });

  it('TC-2.2d preserves case-insensitive alphabetical ordering in scaffolded package entries', async () => {
    const sourceDir = await createWorkspace({
      files: {
        'Zebra.md': '# Zebra',
        'alpha.md': '# Alpha',
        'Beta.md': '# Beta',
      },
    });
    const outputPath = await createOutputPath('ordered-scaffold.mpk');
    const manifestContent = await scaffoldManifest(sourceDir);

    await writeFile(path.join(sourceDir, MANIFEST_FILENAME), manifestContent, 'utf8');
    await createPackage({ sourceDir, outputPath });

    const entryPaths = [...(await readPackageEntries(outputPath)).keys()];

    expect(entryPaths).toEqual([MANIFEST_FILENAME, 'alpha.md', 'Beta.md', 'Zebra.md']);
    expect(entryPaths).toEqual(
      [...entryPaths].sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: 'base' }),
      ),
    );
  });

  it('TC-2.3a creates compressed package smaller than uncompressed', async () => {
    const repeatedContent = `${'# Repeated\n\n'}${'lorem ipsum dolor sit amet\n'.repeat(300)}`;
    const sourceDir = await createWorkspace({
      files: {
        'guide.md': repeatedContent,
        'reference/details.md': repeatedContent,
      },
    });
    const uncompressedPath = await createOutputPath('package.mpk');
    const compressedPath = await createOutputPath('package.mpkz');

    await createPackage({ sourceDir, outputPath: uncompressedPath });
    await createPackage({ sourceDir, outputPath: compressedPath, compress: true });

    const [uncompressedStats, compressedStats] = await Promise.all([
      stat(uncompressedPath),
      stat(compressedPath),
    ]);

    expect(compressedStats.size).toBeLessThan(uncompressedStats.size);
  });

  it('TC-2.3b compressed package is valid gzip containing valid tar', async () => {
    const sourceDir = await createWorkspace({
      files: {
        'guide.md': '# Guide',
        'nested/topic.md': '# Topic',
      },
    });
    const outputPath = await createOutputPath('package.mpkz');

    await createPackage({ sourceDir, outputPath, compress: true });

    const entries = await readPackageEntries(outputPath, { gzip: true });

    expect(entries.has('guide.md')).toBe(true);
    expect(entries.has('nested/topic.md')).toBe(true);
    expect(entries.has(MANIFEST_FILENAME)).toBe(true);
  });

  it('TC-2.4a throws SOURCE_DIR_NOT_FOUND for nonexistent directory', async () => {
    const missingSourceDir = path.join(tmpdir(), `missing-${Date.now()}-${Math.random()}`);
    const outputPath = await createOutputPath('missing-source.mpk');

    await expectPackageError(createPackage({ sourceDir: missingSourceDir, outputPath }), {
      code: PackageErrorCode.SOURCE_DIR_NOT_FOUND,
      message: `Source directory does not exist: ${missingSourceDir}`,
      path: missingSourceDir,
    });
  });

  it('TC-2.4c throws SOURCE_DIR_NOT_FOUND when source path is a file', async () => {
    const sourceRoot = await mkdtemp(path.join(tmpdir(), 'mdv-file-source-'));
    cleanupTasks.push(async () => {
      await rm(sourceRoot, { recursive: true, force: true });
    });
    const sourcePath = path.join(sourceRoot, 'source.md');
    const outputPath = await createOutputPath('file-source.mpk');

    await writeFile(sourcePath, '# Not a directory', 'utf8');

    await expectPackageError(createPackage({ sourceDir: sourcePath, outputPath }), {
      code: PackageErrorCode.SOURCE_DIR_NOT_FOUND,
      message: `Source path is not a directory: ${sourcePath}`,
      path: sourcePath,
    });
  });

  it('TC-2.4b throws SOURCE_DIR_EMPTY for empty directory', async () => {
    const sourceDir = await mkdtemp(path.join(tmpdir(), 'mdv-empty-source-'));
    cleanupTasks.push(async () => {
      await rm(sourceDir, { recursive: true, force: true });
    });
    const outputPath = await createOutputPath('empty-source.mpk');

    await expectPackageError(createPackage({ sourceDir, outputPath }), {
      code: PackageErrorCode.SOURCE_DIR_EMPTY,
      message: `Source directory is empty: ${sourceDir}`,
      path: sourceDir,
    });
  });

  it('TC-2.5a overwrites existing output file', async () => {
    const sourceDir = await createWorkspace({
      files: {
        'guide.md': '# Guide',
      },
    });
    const outputPath = await createOutputPath('overwrite.mpk');
    await writeFile(outputPath, 'placeholder', 'utf8');

    await createPackage({ sourceDir, outputPath });

    expect(await readFile(outputPath, 'utf8')).not.toBe('placeholder');
    const entries = await readPackageEntries(outputPath);
    expect(entries.has(MANIFEST_FILENAME)).toBe(true);
  });

  it('TC-7.2a throws error when required option field is missing', async () => {
    await expect(createPackage({} as never)).rejects.toThrow(
      'createPackage requires sourceDir and outputPath',
    );
  });

  it('handles symlinks gracefully', async () => {
    const sourceDir = await createWorkspace({
      files: {
        'guide.md': '# Guide',
      },
    });
    await symlink(path.join(sourceDir, 'guide.md'), path.join(sourceDir, 'guide-link.md'));
    const outputPath = await createOutputPath('symlink.mpk');

    await expect(createPackage({ sourceDir, outputPath })).resolves.toBeUndefined();

    const entries = await readPackageEntries(outputPath);
    expect(entries.has('guide.md')).toBe(true);
    expect(entries.has('guide-link.md')).toBe(false);
  });

  it('handles source directory with no markdown files', async () => {
    const sourceDir = await createWorkspace({
      files: {
        'notes.txt': 'plain text only',
      },
    });
    const outputPath = await createOutputPath('no-markdown.mpk');

    await createPackage({ sourceDir, outputPath });

    const manifestOnDisk = await readFile(path.join(sourceDir, MANIFEST_FILENAME), 'utf8');
    const scaffoldedManifest = await scaffoldManifest(sourceDir);
    const entries = await readPackageEntries(outputPath);

    expect(scaffoldedManifest).toBe('');
    expect(manifestOnDisk).toBe('');
    expect(entries.has(MANIFEST_FILENAME)).toBe(true);
    expect(entries.has('notes.txt')).toBe(true);
  });
});
