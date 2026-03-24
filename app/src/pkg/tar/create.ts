import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGzip } from 'node:zlib';

import { pack } from 'tar-stream';

import { scaffoldManifest } from '../manifest/scaffold.js';
import { PackageError, PackageErrorCode } from '../errors.js';
import { MANIFEST_FILENAME, type CreateOptions } from '../types.js';

function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

async function collectFilePaths(sourceDir: string): Promise<string[]> {
  const entries = await readdir(sourceDir, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => toPosixPath(path.relative(sourceDir, path.join(entry.parentPath, entry.name))))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}

async function writeEntry(
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

function waitForOutput(
  packStream: ReturnType<typeof pack>,
  archiveStream: NodeJS.ReadableStream,
  outputStream: NodeJS.WritableStream,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      for (const stream of new Set([packStream, archiveStream, outputStream])) {
        stream.removeListener('error', onError);
      }

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

    for (const stream of new Set([packStream, archiveStream, outputStream])) {
      stream.once('error', onError);
    }

    outputStream.once('finish', onFinish);
  });
}

export async function createPackage(options: CreateOptions): Promise<void> {
  if (!options?.sourceDir || !options.outputPath) {
    throw new TypeError('createPackage requires sourceDir and outputPath');
  }

  const sourceStats = await (async () => {
    try {
      return await stat(options.sourceDir);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        throw new PackageError(
          PackageErrorCode.SOURCE_DIR_NOT_FOUND,
          `Source directory does not exist: ${options.sourceDir}`,
          options.sourceDir,
        );
      }

      throw error;
    }
  })();

  if (!sourceStats.isDirectory()) {
    throw new PackageError(
      PackageErrorCode.SOURCE_DIR_NOT_FOUND,
      `Source path is not a directory: ${options.sourceDir}`,
      options.sourceDir,
    );
  }

  const sourceEntries = await readdir(options.sourceDir, { recursive: true });
  if (sourceEntries.length === 0) {
    throw new PackageError(
      PackageErrorCode.SOURCE_DIR_EMPTY,
      `Source directory is empty: ${options.sourceDir}`,
      options.sourceDir,
    );
  }

  const manifestPath = path.join(options.sourceDir, MANIFEST_FILENAME);

  try {
    await stat(manifestPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== 'ENOENT') {
      throw error;
    }

    const manifestContent = await scaffoldManifest(options.sourceDir);
    await writeFile(manifestPath, manifestContent, 'utf8');
  }

  const filePaths = await collectFilePaths(options.sourceDir);
  const packStream = pack();
  const archiveStream = options.compress ? packStream.pipe(createGzip()) : packStream;

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  const outputStream = createWriteStream(options.outputPath);
  const outputPromise = waitForOutput(packStream, archiveStream, outputStream);

  archiveStream.pipe(outputStream);

  for (const relativePath of filePaths) {
    const absolutePath = path.join(options.sourceDir, relativePath);
    const content = await readFile(absolutePath);
    await writeEntry(packStream, relativePath, content);
  }

  packStream.finalize();
  await outputPromise;
}

export default createPackage;
