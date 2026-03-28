export { ErrorCode } from '../../shared/contracts/error-codes.js';

export function isPermissionError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return code === 'EACCES' || code === 'EPERM';
}

export function isNotFoundError(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT';
}

export function isInsufficientStorageError(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOSPC';
}

export interface ApiError {
  code: string;
  message: string;
  timeout?: boolean;
}

export class InvalidPathError extends Error {
  constructor(path: string) {
    super(`Path must be absolute: ${path}`);
    this.name = 'InvalidPathError';
  }
}

export class NotMarkdownError extends Error {
  constructor(path: string, ext: string) {
    super(`Not a markdown file (${ext}): ${path}`);
    this.name = 'NotMarkdownError';
  }
}

export class ConflictError extends Error {
  readonly expected: string;

  readonly actual: string;

  constructor(path: string, expected: string, actual: string) {
    super(
      `File has been modified externally. Expected mtime: ${expected}, actual: ${actual}. Path: ${path}`,
    );
    this.name = 'ConflictError';
    this.expected = expected;
    this.actual = actual;
  }
}

export class PathNotFoundError extends Error {
  constructor(path: string) {
    super(`Parent directory does not exist: ${path}`);
    this.name = 'PathNotFoundError';
  }
}

export class FileTooLargeError extends Error {
  readonly size: number;

  readonly limit: number;

  constructor(path: string, size: number, limit: number) {
    super(
      `File too large (${(size / 1024 / 1024).toFixed(1)}MB, limit ${(limit / 1024 / 1024).toFixed(0)}MB): ${path}`,
    );
    this.name = 'FileTooLargeError';
    this.size = size;
    this.limit = limit;
  }
}

export class NotFileError extends Error {
  constructor(path: string) {
    super(`Not a regular file: ${path}`);
    this.name = 'NotFileError';
  }
}

export class UnsupportedFormatError extends Error {
  constructor(path: string, ext: string) {
    super(`Unsupported image format (${ext}): ${path}`);
    this.name = 'UnsupportedFormatError';
  }
}

export class ExportInProgressError extends Error {
  constructor() {
    super('Another export is already in progress');
    this.name = 'ExportInProgressError';
  }
}

export class ExportWritePermissionError extends Error {
  readonly savePath: string;

  constructor(savePath: string) {
    super(`Could not write export to ${savePath}: permission denied.`);
    this.name = 'ExportWritePermissionError';
    this.savePath = savePath;
  }
}

export class ExportInsufficientStorageError extends Error {
  readonly savePath: string;

  constructor(savePath: string) {
    super(`Could not write export to ${savePath}: insufficient disk space.`);
    this.name = 'ExportInsufficientStorageError';
    this.savePath = savePath;
  }
}

export class ExportWriteError extends Error {
  readonly savePath: string;

  constructor(savePath: string, cause?: unknown) {
    const detail = cause instanceof Error ? cause.message : 'Unknown write failure';
    super(`Could not write export to ${savePath}: ${detail}`);
    this.name = 'ExportWriteError';
    this.savePath = savePath;
  }
}

export class ReadTimeoutError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`File read timed out after 10 seconds: ${path}`);
    this.name = 'ReadTimeoutError';
    this.path = path;
  }
}

export class ScanTimeoutError extends Error {
  readonly root: string;

  constructor(root: string) {
    super(`Tree scan timed out after 10 seconds for ${root}`);
    this.name = 'ScanTimeoutError';
    this.root = root;
  }
}

export class NotImplementedError extends Error {
  constructor(name: string) {
    super(`Not implemented: ${name}`);
    this.name = 'NotImplementedError';
  }
}

export class PackageNotFoundError extends Error {
  constructor(filePath: string) {
    super(`Package file not found: ${filePath}`);
    this.name = 'PackageNotFoundError';
  }
}

export class InvalidArchiveError extends Error {
  constructor(filePath: string, cause?: string) {
    super(`Invalid archive: ${filePath}${cause ? ` (${cause})` : ''}`);
    this.name = 'InvalidArchiveError';
  }
}

export class ExtractionError extends Error {
  constructor(filePath: string, cause?: string) {
    super(`Extraction failed: ${filePath}${cause ? ` (${cause})` : ''}`);
    this.name = 'ExtractionError';
  }
}

export class NoActivePackageError extends Error {
  constructor() {
    super('No package is currently open');
    this.name = 'NoActivePackageError';
  }
}

export class ManifestExistsError extends Error {
  constructor(path: string) {
    super(`Manifest already exists: ${path}`);
    this.name = 'ManifestExistsError';
  }
}

export class ManifestNotFoundError extends Error {
  constructor() {
    super('Active package has no manifest file');
    this.name = 'ManifestNotFoundError';
  }
}

export class ManifestParseError extends Error {
  constructor(cause?: string) {
    super(`Manifest could not be parsed${cause ? `: ${cause}` : ''}`);
    this.name = 'ManifestParseError';
  }
}

export function toApiError(
  code: string,
  message: string,
  extras: Partial<Pick<ApiError, 'timeout'>> = {},
): { error: ApiError } {
  return { error: { code, message, ...extras } };
}
