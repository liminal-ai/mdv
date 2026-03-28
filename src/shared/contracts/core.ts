import { z } from 'zod/v4';

export const AbsolutePathSchema = z.string().refine((p) => p.startsWith('/'), {
  message: 'Path must be absolute',
});

export const ThemeIdSchema = z.string();
export const OpenModeSchema = z.enum(['render', 'edit']);
export const FileChangeEventTypeSchema = z.enum(['modified', 'deleted', 'created']);
export const RenderWarningTypeSchema = z.enum([
  'missing-image',
  'remote-image-blocked',
  'unsupported-format',
  'mermaid-error',
]);

export type ThemeId = z.infer<typeof ThemeIdSchema>;
export type OpenMode = z.infer<typeof OpenModeSchema>;
