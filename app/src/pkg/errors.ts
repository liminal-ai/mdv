export const PackageErrorCode = {
  INVALID_ARCHIVE: 'INVALID_ARCHIVE',
  MANIFEST_NOT_FOUND: 'MANIFEST_NOT_FOUND',
  MANIFEST_PARSE_ERROR: 'MANIFEST_PARSE_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  AMBIGUOUS_DISPLAY_NAME: 'AMBIGUOUS_DISPLAY_NAME',
  PATH_TRAVERSAL: 'PATH_TRAVERSAL',
  SOURCE_DIR_NOT_FOUND: 'SOURCE_DIR_NOT_FOUND',
  SOURCE_DIR_EMPTY: 'SOURCE_DIR_EMPTY',
  COMPRESSION_ERROR: 'COMPRESSION_ERROR',
  READ_ERROR: 'READ_ERROR',
  WRITE_ERROR: 'WRITE_ERROR',
} as const;

export type PackageErrorCode = (typeof PackageErrorCode)[keyof typeof PackageErrorCode];

export class PackageError extends Error {
  readonly code: PackageErrorCode;
  readonly path?: string;

  constructor(code: PackageErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'PackageError';
    this.code = code;
    this.path = path;
  }
}

export class NotImplementedError extends Error {
  constructor(name: string) {
    super(`Not implemented: ${name}`);
    this.name = 'NotImplementedError';
  }
}
