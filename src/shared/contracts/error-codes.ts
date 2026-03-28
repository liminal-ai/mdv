import { z } from 'zod/v4';

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

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    timeout: z.boolean().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
