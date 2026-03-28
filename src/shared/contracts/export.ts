import { z } from 'zod/v4';
import { AbsolutePathSchema, ThemeIdSchema } from './core.js';

export const ExportFormatSchema = z.enum(['pdf', 'docx', 'html']);

export const ExportRequestSchema = z.object({
  path: AbsolutePathSchema,
  format: ExportFormatSchema,
  savePath: AbsolutePathSchema,
  theme: ThemeIdSchema,
});

export const ExportWarningSchema = z.object({
  type: z.enum([
    'missing-image',
    'remote-image-blocked',
    'unsupported-format',
    'mermaid-error',
    'format-degradation',
  ]),
  source: z.string(),
  line: z.number().optional(),
  message: z.string(),
});

export const ExportResponseSchema = z.object({
  status: z.literal('success'),
  outputPath: AbsolutePathSchema,
  warnings: z.array(ExportWarningSchema),
});

export const SaveDialogRequestSchema = z.object({
  defaultPath: AbsolutePathSchema,
  defaultFilename: z.string(),
  prompt: z.string().optional(),
});

export const SaveDialogResponseSchema = z
  .object({
    path: AbsolutePathSchema,
  })
  .nullable();

export const RevealRequestSchema = z.object({
  path: AbsolutePathSchema,
});

export const SetLastExportDirSchema = z.object({
  path: AbsolutePathSchema,
});

export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type ExportWarning = z.infer<typeof ExportWarningSchema>;
export type ExportResponse = z.infer<typeof ExportResponseSchema>;
export type SaveDialogRequest = z.infer<typeof SaveDialogRequestSchema>;
export type SaveDialogResponse = z.infer<typeof SaveDialogResponseSchema>;
export type RevealRequest = z.infer<typeof RevealRequestSchema>;
export type SetLastExportDir = z.infer<typeof SetLastExportDirSchema>;
