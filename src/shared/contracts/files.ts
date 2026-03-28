import { z } from 'zod/v4';
import { AbsolutePathSchema, RenderWarningTypeSchema } from './core.js';

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  mdCount?: number;
}

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: AbsolutePathSchema,
    type: z.enum(['file', 'directory']),
    children: z.array(TreeNodeSchema).optional(),
    mdCount: z.number().int().nonnegative().optional(),
  }),
);

export const FileTreeResponseSchema = z.object({
  root: AbsolutePathSchema,
  tree: z.array(TreeNodeSchema),
});

export const FileTreeRequestSchema = z.object({ root: AbsolutePathSchema });
export const FileReadRequestSchema = z.object({
  path: AbsolutePathSchema,
});

export const RenderWarningSchema = z.object({
  type: RenderWarningTypeSchema,
  source: z.string(),
  line: z.number().optional(),
  message: z.string(),
});

export const FileReadResponseSchema = z.object({
  path: AbsolutePathSchema,
  canonicalPath: AbsolutePathSchema,
  filename: z.string(),
  content: z.string(),
  html: z.string(),
  warnings: z.array(RenderWarningSchema),
  modifiedAt: z.string().datetime(),
  size: z.number().int().nonnegative(),
});

export const FileSaveRequestSchema = z.object({
  path: AbsolutePathSchema,
  content: z.string(),
  expectedModifiedAt: z.string().datetime().nullable().optional(),
});

export const FileSaveResponseSchema = z.object({
  path: AbsolutePathSchema,
  modifiedAt: z.string().datetime(),
  size: z.number().int().nonnegative(),
});

export const RenderFromContentRequestSchema = z.object({
  content: z.string(),
  documentPath: AbsolutePathSchema,
});

export const RenderFromContentResponseSchema = z.object({
  html: z.string(),
  warnings: z.array(RenderWarningSchema),
});

export const FilePickerResponseSchema = z
  .object({
    path: AbsolutePathSchema,
  })
  .nullable();

export const ImageRequestSchema = z.object({
  path: AbsolutePathSchema,
});

export const OpenExternalRequestSchema = z.object({
  path: AbsolutePathSchema,
});

export const ClipboardRequestSchema = z.object({ text: z.string().max(100_000) });

export type FileTreeRequest = z.infer<typeof FileTreeRequestSchema>;
export type FileTreeResponse = z.infer<typeof FileTreeResponseSchema>;
export type FileReadRequest = z.infer<typeof FileReadRequestSchema>;
export type RenderWarning = z.infer<typeof RenderWarningSchema>;
export type FileReadResponse = z.infer<typeof FileReadResponseSchema>;
export type FileSaveRequest = z.infer<typeof FileSaveRequestSchema>;
export type FileSaveResponse = z.infer<typeof FileSaveResponseSchema>;
export type RenderFromContentRequest = z.infer<typeof RenderFromContentRequestSchema>;
export type RenderFromContentResponse = z.infer<typeof RenderFromContentResponseSchema>;
export type FilePickerResponse = z.infer<typeof FilePickerResponseSchema>;
export type ImageRequest = z.infer<typeof ImageRequestSchema>;
export type OpenExternalRequest = z.infer<typeof OpenExternalRequestSchema>;
