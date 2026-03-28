import { ApiError } from '../api.js';

export function getClientErrorMessage(error: unknown): {
  code: string;
  message: string;
  timeout?: boolean;
} {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.timeout ? { timeout: true } : {}),
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'Something went wrong.',
  };
}

export function isClientFileNotFoundError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'FILE_NOT_FOUND' || error.status === 404;
  }

  return (
    (error as { code?: string } | undefined)?.code === 'FILE_NOT_FOUND' ||
    (error as { status?: number } | undefined)?.status === 404
  );
}
