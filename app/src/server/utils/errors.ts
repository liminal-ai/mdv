export const ErrorCode = {
  INVALID_PATH: 'INVALID_PATH',
  INVALID_ROOT: 'INVALID_ROOT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  PATH_NOT_FOUND: 'PATH_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  NOT_MARKDOWN: 'NOT_MARKDOWN',
  READ_ERROR: 'READ_ERROR',
  SCAN_ERROR: 'SCAN_ERROR',
  INVALID_THEME: 'INVALID_THEME',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export function isPermissionError(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'EACCES';
}

export function isNotFoundError(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT';
}

export interface ApiError {
  code: string;
  message: string;
}

export class NotMarkdownError extends Error {
  constructor(path: string, ext: string) {
    super(`Not a markdown file (${ext}): ${path}`);
    this.name = 'NotMarkdownError';
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

export function toApiError(code: string, message: string): { error: ApiError } {
  return { error: { code, message } };
}
