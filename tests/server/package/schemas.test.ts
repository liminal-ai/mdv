import { describe, expect, it } from 'vitest';
import {
  PackageCreateRequestSchema,
  PackageExportRequestSchema,
  PackageOpenRequestSchema,
} from '../../../src/shared/contracts/packages.js';

describe('package schemas', () => {
  it('PackageOpenRequestSchema accepts valid absolute path', () => {
    const result = PackageOpenRequestSchema.safeParse({
      filePath: '/tmp/sample.mpk',
    });

    expect(result.success).toBe(true);
  });

  it('PackageOpenRequestSchema accepts valid Windows absolute path', () => {
    const result = PackageOpenRequestSchema.safeParse({
      filePath: 'C:\\tmp\\sample.mpk',
    });

    expect(result.success).toBe(true);
  });

  it('PackageOpenRequestSchema rejects relative path', () => {
    const result = PackageOpenRequestSchema.safeParse({
      filePath: 'fixtures/sample.mpk',
    });

    expect(result.success).toBe(false);
  });

  it('PackageCreateRequestSchema accepts valid data', () => {
    const result = PackageCreateRequestSchema.safeParse({
      rootDir: '/tmp/package-root',
      overwrite: true,
    });

    expect(result.success).toBe(true);
  });

  it('PackageExportRequestSchema accepts valid data with optional fields', () => {
    const result = PackageExportRequestSchema.safeParse({
      outputPath: '/tmp/output/sample.mpkz',
      compress: true,
      sourceDir: '/tmp/package-root',
    });

    expect(result.success).toBe(true);
  });
});
