export const ErrorCode = {
  INVALID_PATH: 'INVALID_PATH',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  PATH_NOT_FOUND: 'PATH_NOT_FOUND',
  SCAN_ERROR: 'SCAN_ERROR',
  INVALID_THEME: 'INVALID_THEME',
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

export function toApiError(code: string, message: string): { error: ApiError } {
  return { error: { code, message } };
}
