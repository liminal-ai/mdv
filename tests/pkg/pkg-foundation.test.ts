import { describe, expect, it } from 'vitest';

describe('Package Foundation', () => {
  it('types module is importable and exports expected types', async () => {
    const types = await import('../../src/pkg/types.js');
    expect(types.MANIFEST_FILENAME).toBeDefined();
    expect(types.MERMAID_DIAGRAM_TYPES).toBeInstanceOf(Set);
  });

  it('PackageError can be instantiated with code, message, and path', async () => {
    const { PackageError, PackageErrorCode } = await import('../../src/pkg/errors.js');
    const err = new PackageError(PackageErrorCode.FILE_NOT_FOUND, 'test message', '/some/path');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PackageError);
    expect(err.code).toBe('FILE_NOT_FOUND');
    expect(err.message).toBe('test message');
    expect(err.path).toBe('/some/path');
    expect(err.name).toBe('PackageError');
  });

  it('PackageErrorCode has all 11 expected values', async () => {
    const { PackageErrorCode } = await import('../../src/pkg/errors.js');
    const expectedCodes = [
      'INVALID_ARCHIVE',
      'MANIFEST_NOT_FOUND',
      'MANIFEST_PARSE_ERROR',
      'FILE_NOT_FOUND',
      'AMBIGUOUS_DISPLAY_NAME',
      'PATH_TRAVERSAL',
      'SOURCE_DIR_NOT_FOUND',
      'SOURCE_DIR_EMPTY',
      'COMPRESSION_ERROR',
      'READ_ERROR',
      'WRITE_ERROR',
    ];
    const actualCodes = Object.values(PackageErrorCode);
    expect(actualCodes).toHaveLength(11);
    for (const code of expectedCodes) {
      expect(actualCodes).toContain(code);
    }
  });

  it('MANIFEST_FILENAME equals _nav.md', async () => {
    const { MANIFEST_FILENAME } = await import('../../src/pkg/types.js');
    expect(MANIFEST_FILENAME).toBe('_nav.md');
  });
});
