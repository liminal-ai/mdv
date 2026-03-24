import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';

import { extract } from 'tar-stream';

import { PackageError, PackageErrorCode } from '../errors.js';

export interface TarEntryHeader {
  name: string;
  size?: number | null;
  type?: string | null;
}

export function detectPackageFormat(packagePath: string): 'mpk' | 'mpkz' {
  return packagePath.endsWith('.mpkz') ? 'mpkz' : 'mpk';
}

export async function readEntryContent(stream: NodeJS.ReadableStream): Promise<Buffer> {
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

export async function drainEntry(stream: NodeJS.ReadableStream): Promise<void> {
  return await new Promise<void>((resolve, reject) => {
    stream.once('end', resolve);
    stream.once('error', reject);
    stream.resume();
  });
}

function waitForScan(
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

export async function scanPackage(
  packagePath: string,
  onEntry: (header: TarEntryHeader, stream: NodeJS.ReadableStream) => Promise<void>,
): Promise<'mpk' | 'mpkz'> {
  if (!packagePath) {
    throw new TypeError('packagePath is required');
  }

  const format = detectPackageFormat(packagePath);
  const compressed = format === 'mpkz';
  const inputStream = createReadStream(packagePath);
  const archiveStream = compressed ? inputStream.pipe(createGunzip()) : inputStream;
  const extractStream = extract();

  extractStream.on('entry', (header, stream, next) => {
    onEntry(header, stream).then(
      () => {
        next();
      },
      (error) => {
        stream.resume();
        extractStream.destroy(error as Error);
      },
    );
  });

  const scanPromise = waitForScan(
    inputStream,
    archiveStream,
    extractStream,
    packagePath,
    compressed,
  );

  archiveStream.pipe(extractStream);
  await scanPromise;

  return format;
}
