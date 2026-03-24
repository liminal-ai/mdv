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
  outputPath: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const suppressUnhandledOutputError = () => {};

    const cleanup = () => {
      for (const stream of new Set([packStream, archiveStream])) {
        stream.removeListener('error', onError);
      }

      outputStream.removeListener('error', onOutputError);
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

    const onOutputError = (_error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(
        new PackageError(
          PackageErrorCode.WRITE_ERROR,
          `Failed to write package: ${outputPath}`,
          outputPath,
        ),
      );
    };

    const onFinish = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve();
    };

    for (const stream of new Set([packStream, archiveStream])) {
      stream.once('error', onError);
    }

    outputStream.on('error', suppressUnhandledOutputError);
    outputStream.once('error', onOutputError);
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

  const sourceEntries = await readdir(options.sourceDir, { recursive: true, withFileTypes: true });
  if (!sourceEntries.some((entry) => entry.isFile())) {
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

  try {
    const outputStats = await stat(options.outputPath);

    if (outputStats.isDirectory()) {
      throw new PackageError(
        PackageErrorCode.WRITE_ERROR,
        `Failed to write package: ${options.outputPath}`,
        options.outputPath,
      );
    }
  } catch (error) {
    if (error instanceof PackageError) {
      throw error;
    }

    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const outputStream = createWriteStream(options.outputPath);
  const outputPromise = waitForOutput(packStream, archiveStream, outputStream, options.outputPath);
  let outputError: Error | undefined;

  void outputPromise.catch((error) => {
    outputError = error as Error;
  });

  archiveStream.pipe(outputStream);

  try {
    for (const relativePath of filePaths) {
      if (outputError) {
        throw outputError;
      }

      const absolutePath = path.join(options.sourceDir, relativePath);
      const content = await readFile(absolutePath);

      if (outputError) {
        throw outputError;
      }

      try {
        await writeEntry(packStream, relativePath, content);
      } catch (error) {
        throw outputError ?? error;
      }
    }

    if (outputError) {
      throw outputError;
    }

    packStream.finalize();
    await outputPromise;
  } catch (error) {
    if (!packStream.destroyed) {
      packStream.destroy();
    }

    if ('destroy' in archiveStream && typeof archiveStream.destroy === 'function') {
      archiveStream.destroy();
    }

    if ('destroy' in outputStream && typeof outputStream.destroy === 'function') {
      outputStream.destroy();
    }

    await outputPromise.catch(() => undefined);
    throw outputError ?? error;
  }
}

export default createPackage;
