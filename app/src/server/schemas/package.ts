import { z } from 'zod/v4';
import { AbsolutePathSchema } from './index.js';

const DeferredAbsolutePathSchema: z.ZodType<string> = z.lazy(() => AbsolutePathSchema);

export const PackageOpenRequestSchema = z.object({
  filePath: DeferredAbsolutePathSchema,
});

export const ManifestMetadataSchema = z.object({
  title: z.string().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
});

export const NavigationNodeSchema: z.ZodType = z.lazy(() =>
  z.object({
    displayName: z.string(),
    filePath: z.string().optional(),
    children: z.array(NavigationNodeSchema),
    isGroup: z.boolean(),
  }),
);

export const PackageInfoSchema = z.object({
  sourcePath: DeferredAbsolutePathSchema,
  extractedRoot: DeferredAbsolutePathSchema,
  format: z.enum(['mpk', 'mpkz']),
  manifestStatus: z.enum(['present', 'missing', 'unreadable']),
  manifestError: z.string().optional(),
});

export const PackageOpenResponseSchema = z.object({
  metadata: ManifestMetadataSchema,
  navigation: z.array(NavigationNodeSchema),
  packageInfo: PackageInfoSchema,
});

export const PackageManifestResponseSchema = z.object({
  metadata: ManifestMetadataSchema,
  navigation: z.array(NavigationNodeSchema),
  raw: z.string(),
});

export const PackageCreateRequestSchema = z.object({
  rootDir: DeferredAbsolutePathSchema,
  overwrite: z.boolean().optional(),
});

export const PackageCreateResponseSchema = z.object({
  metadata: ManifestMetadataSchema,
  navigation: z.array(NavigationNodeSchema),
  manifestPath: DeferredAbsolutePathSchema,
});

export const PackageExportRequestSchema = z.object({
  outputPath: DeferredAbsolutePathSchema,
  compress: z.boolean().optional(),
  sourceDir: DeferredAbsolutePathSchema.optional(),
});

export const PackageExportResponseSchema = z.object({
  outputPath: DeferredAbsolutePathSchema,
  format: z.enum(['mpk', 'mpkz']),
  fileCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
});

export const ActivePackageSchema = z
  .object({
    sourcePath: DeferredAbsolutePathSchema,
    extractedRoot: DeferredAbsolutePathSchema,
    format: z.enum(['mpk', 'mpkz']),
    mode: z.enum(['extracted', 'directory']),
    stale: z.boolean(),
    manifestStatus: z.enum(['present', 'missing', 'unreadable']),
  })
  .nullable()
  .default(null);

export const PackageErrorCode = {
  INVALID_FILE_PATH: 'INVALID_FILE_PATH',
  INVALID_ARCHIVE: 'INVALID_ARCHIVE',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  EXTRACTION_ERROR: 'EXTRACTION_ERROR',
  NO_ACTIVE_PACKAGE: 'NO_ACTIVE_PACKAGE',
  MANIFEST_NOT_FOUND: 'MANIFEST_NOT_FOUND',
  MANIFEST_PARSE_ERROR: 'MANIFEST_PARSE_ERROR',
  INVALID_DIR_PATH: 'INVALID_DIR_PATH',
  DIR_NOT_FOUND: 'DIR_NOT_FOUND',
  MANIFEST_EXISTS: 'MANIFEST_EXISTS',
  INVALID_OUTPUT_PATH: 'INVALID_OUTPUT_PATH',
  NO_SOURCE: 'NO_SOURCE',
  EXPORT_ERROR: 'EXPORT_ERROR',
} as const;

export type PackageErrorCode = (typeof PackageErrorCode)[keyof typeof PackageErrorCode];
export type PackageOpenRequest = z.infer<typeof PackageOpenRequestSchema>;
export type ManifestMetadata = z.infer<typeof ManifestMetadataSchema>;
export type NavigationNode = z.infer<typeof NavigationNodeSchema>;
export type PackageInfo = z.infer<typeof PackageInfoSchema>;
export type PackageOpenResponse = z.infer<typeof PackageOpenResponseSchema>;
export type PackageManifestResponse = z.infer<typeof PackageManifestResponseSchema>;
export type PackageCreateRequest = z.infer<typeof PackageCreateRequestSchema>;
export type PackageCreateResponse = z.infer<typeof PackageCreateResponseSchema>;
export type PackageExportRequest = z.infer<typeof PackageExportRequestSchema>;
export type PackageExportResponse = z.infer<typeof PackageExportResponseSchema>;
export type ActivePackage = z.infer<typeof ActivePackageSchema>;
