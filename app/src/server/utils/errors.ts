export const ErrorCode = {
  INVALID_PATH: 'INVALID_PATH',
  INVALID_ROOT: 'INVALID_ROOT',
  INVALID_FORMAT: 'INVALID_FORMAT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  PATH_NOT_FOUND: 'PATH_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  NOT_MARKDOWN: 'NOT_MARKDOWN',
  READ_TIMEOUT: 'READ_TIMEOUT',
  READ_ERROR: 'READ_ERROR',
  WRITE_ERROR: 'WRITE_ERROR',
  SCAN_ERROR: 'SCAN_ERROR',
  CONFLICT: 'CONFLICT',
  EXPORT_ERROR: 'EXPORT_ERROR',
  EXPORT_IN_PROGRESS: 'EXPORT_IN_PROGRESS',
  INSUFFICIENT_STORAGE: 'INSUFFICIENT_STORAGE',
  INVALID_THEME: 'INVALID_THEME',
  INVALID_MODE: 'INVALID_MODE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

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
    super(`File changed on disk since last load: ${path}`);
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

export function toApiError(code: string, message: string): { error: ApiError } {
  return { error: { code, message } };
}
