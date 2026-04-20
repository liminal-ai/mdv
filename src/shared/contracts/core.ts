import { z } from 'zod/v4';

const WINDOWS_DRIVE_ABSOLUTE_PATH = /^[a-zA-Z]:\//;

export function isAbsolutePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return normalized.startsWith('/') || WINDOWS_DRIVE_ABSOLUTE_PATH.test(normalized);
}

export const AbsolutePathSchema = z.string().refine(isAbsolutePath, {
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
