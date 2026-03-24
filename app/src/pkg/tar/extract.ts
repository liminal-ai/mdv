import { createReadStream } from 'node:fs';
import { lstat, mkdir, readlink, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGunzip } from 'node:zlib';

import { extract } from 'tar-stream';

import { PackageError, PackageErrorCode } from '../errors.js';
import type { ExtractOptions } from '../types.js';

function validateEntryPath(outputDir: string, entryName: string): string {
  const normalizedOutputDir = path.resolve(outputDir);
  const normalizedEntryPath = path.resolve(outputDir, entryName);
  const pathSegments = entryName.split(/[\\/]+/).filter(Boolean);

  if (entryName.startsWith('/') || pathSegments.includes('..')) {
    throw new PackageError(
      PackageErrorCode.PATH_TRAVERSAL,
      `Unsafe package entry path: ${entryName}`,
      entryName,
    );
  }

  if (
    normalizedEntryPath !== normalizedOutputDir &&
    !normalizedEntryPath.startsWith(`${normalizedOutputDir}${path.sep}`)
  ) {
    throw new PackageError(
      PackageErrorCode.PATH_TRAVERSAL,
      `Package entry resolves outside output directory: ${entryName}`,
      entryName,
    );
  }

  return normalizedEntryPath;
}

async function verifyRealPath(
  dirPath: string,
  resolvedOutputDir: string,
  entryName: string,
): Promise<void> {
  let stats: Awaited<ReturnType<typeof lstat>>;

  try {
    stats = await lstat(dirPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }

    throw error;
  }

  let realDir: string;

  if (stats.isSymbolicLink()) {
    try {
      realDir = await realpath(dirPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }

      realDir = path.resolve(path.dirname(dirPath), await readlink(dirPath));
    }
  } else {
    realDir = await realpath(dirPath);
  }

  if (realDir !== resolvedOutputDir && !realDir.startsWith(`${resolvedOutputDir}${path.sep}`)) {
    throw new PackageError(
      PackageErrorCode.PATH_TRAVERSAL,
      `Package entry resolves outside output directory via symlink: ${entryName}`,
      entryName,
    );
  }
}

async function readEntryContent(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    stream.once('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stream.once('error', reject);
  });
}

function waitForExtraction(
  inputStream: NodeJS.ReadableStream,
  archiveStream: NodeJS.ReadableStream,
  extractStream: ReturnType<typeof extract>,
  packagePath: string,
  compressed: boolean,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      inputStream.removeListener('error', onInputError);
      archiveStream.removeListener('error', onArchiveError);
      extractStream.removeListener('error', onExtractError);
      extractStream.removeListener('finish', onFinish);
    };

    const settleReject = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    const onInputError = (_error: Error) => {
      settleReject(
        new PackageError(
          PackageErrorCode.READ_ERROR,
          `Failed to read package: ${packagePath}`,
          packagePath,
        ),
      );
    };

    const onArchiveError = (error: Error) => {
      if (!compressed || archiveStream === inputStream) {
        settleReject(error);
        return;
      }

      settleReject(
        new PackageError(
          PackageErrorCode.COMPRESSION_ERROR,
          `Compressed package is invalid or corrupted: ${packagePath}`,
          packagePath,
        ),
      );
    };

    const onExtractError = (error: Error) => {
      if (error instanceof PackageError) {
        settleReject(error);
        return;
      }

      settleReject(
        new PackageError(
          PackageErrorCode.INVALID_ARCHIVE,
          `Package archive is invalid: ${packagePath}`,
          packagePath,
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

    inputStream.once('error', onInputError);
    archiveStream.once('error', onArchiveError);
    extractStream.once('error', onExtractError);
    extractStream.once('finish', onFinish);
  });
}

async function extractEntry(
  outputDir: string,
  resolvedOutputDir: string,
  header: { name: string; type?: string | null },
  stream: NodeJS.ReadableStream,
): Promise<void> {
  const outputPath = validateEntryPath(outputDir, header.name);
  const entryType = header.type ?? 'file';

  if (entryType !== 'file' && entryType !== 'directory') {
    throw new PackageError(
      PackageErrorCode.INVALID_ARCHIVE,
      `Unsupported tar entry type: ${entryType} (${header.name})`,
      header.name,
    );
  }

  if (entryType === 'directory') {
    await mkdir(outputPath, { recursive: true });
    await verifyRealPath(outputPath, resolvedOutputDir, header.name);
    await readEntryContent(stream);
    return;
  }

  const content = await readEntryContent(stream);

  try {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await verifyRealPath(path.dirname(outputPath), resolvedOutputDir, header.name);
    await verifyRealPath(outputPath, resolvedOutputDir, header.name);
    await writeFile(outputPath, content);
  } catch (error) {
    if (error instanceof PackageError) throw error;
    throw new PackageError(
      PackageErrorCode.WRITE_ERROR,
      `Failed to write extracted file: ${header.name}`,
      header.name,
    );
  }
}

export async function extractPackage(options: ExtractOptions): Promise<void> {
  if (!options?.packagePath || !options.outputDir) {
    throw new TypeError('extractPackage requires packagePath and outputDir');
  }

  await mkdir(options.outputDir, { recursive: true });
  const resolvedOutputDir = await realpath(options.outputDir);

  const compressed = options.packagePath.endsWith('.mpkz');
  const inputStream = createReadStream(options.packagePath);
  const archiveStream = compressed ? inputStream.pipe(createGunzip()) : inputStream;
  const extractStream = extract();

  extractStream.on('entry', (header, stream, next) => {
    extractEntry(options.outputDir, resolvedOutputDir, header, stream).then(
      () => {
        next();
      },
      (error) => {
        stream.resume();
        extractStream.destroy(error as Error);
      },
    );
  });

  const extractionPromise = waitForExtraction(
    inputStream,
    archiveStream,
    extractStream,
    options.packagePath,
    compressed,
  );

  archiveStream.pipe(extractStream);
  await extractionPromise;
}

export default extractPackage;
