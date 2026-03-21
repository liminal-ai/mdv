import { z } from 'zod/v4';

// --- Primitives ---
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

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  mdCount?: number;
}

// --- Domain Objects ---
export const WorkspaceSchema = z.object({
  path: AbsolutePathSchema,
  label: z.string(),
  addedAt: z.string().datetime(),
});

export const RecentFileSchema = z.object({
  path: AbsolutePathSchema,
  openedAt: z.string().datetime(),
});

export const SidebarStateSchema = z.object({
  workspacesCollapsed: z.boolean(),
});

export const SessionStateSchema = z.object({
  workspaces: z.array(WorkspaceSchema),
  lastRoot: AbsolutePathSchema.nullable(),
  recentFiles: z.array(RecentFileSchema),
  theme: ThemeIdSchema,
  sidebarState: SidebarStateSchema,
  defaultOpenMode: OpenModeSchema.default('render'),
  openTabs: z.array(AbsolutePathSchema).default([]),
  activeTab: AbsolutePathSchema.nullable().default(null),
});

// --- Tree ---
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

// --- File Read ---
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

export const FileChangeEventSchema = z.object({
  path: AbsolutePathSchema,
  event: FileChangeEventTypeSchema,
});

export const ClientWsMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('watch'), path: AbsolutePathSchema }),
  z.object({ type: z.literal('unwatch'), path: AbsolutePathSchema }),
]);

export const ServerWsMessageSchema = z.discriminatedUnion('type', [
  FileChangeEventSchema.extend({
    type: z.literal('file-change'),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
]);

// --- Request Bodies ---
export const FileTreeRequestSchema = z.object({ root: AbsolutePathSchema });
export const SetRootRequestSchema = z.object({ root: AbsolutePathSchema });
export const AddWorkspaceRequestSchema = z.object({ path: AbsolutePathSchema });
export const RemoveWorkspaceRequestSchema = z.object({ path: AbsolutePathSchema });
export const SetThemeRequestSchema = z.object({ theme: z.string() });
export const UpdateSidebarRequestSchema = z.object({ workspacesCollapsed: z.boolean() });
export const ClipboardRequestSchema = z.object({ text: z.string().max(100_000) });
export const TouchRecentFileRequestSchema = z.object({ path: AbsolutePathSchema });
export const RemoveRecentFileRequestSchema = z.object({ path: AbsolutePathSchema });
export const SetDefaultModeRequestSchema = z.object({
  mode: z.enum(['render']),
});
export const UpdateTabsRequestSchema = z.object({
  openTabs: z.array(AbsolutePathSchema),
  activeTab: AbsolutePathSchema.nullable(),
});

// --- Theme Info ---
export const ThemeInfoSchema = z.object({
  id: ThemeIdSchema,
  label: z.string(),
  variant: z.enum(['light', 'dark']),
});

// --- Bootstrap Response ---
export const AppBootstrapResponseSchema = z.object({
  session: SessionStateSchema,
  availableThemes: z.array(ThemeInfoSchema),
});

// --- Error Response ---
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

// --- Inferred Types ---
export type SessionState = z.infer<typeof SessionStateSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type RecentFile = z.infer<typeof RecentFileSchema>;
export type SidebarState = z.infer<typeof SidebarStateSchema>;
export type ThemeId = z.infer<typeof ThemeIdSchema>;
export type ThemeInfo = z.infer<typeof ThemeInfoSchema>;
export type FileTreeRequest = z.infer<typeof FileTreeRequestSchema>;
export type FileTreeResponse = z.infer<typeof FileTreeResponseSchema>;
export type OpenMode = z.infer<typeof OpenModeSchema>;
export type FileReadRequest = z.infer<typeof FileReadRequestSchema>;
export type RenderWarning = z.infer<typeof RenderWarningSchema>;
export type FileReadResponse = z.infer<typeof FileReadResponseSchema>;
export type FilePickerResponse = z.infer<typeof FilePickerResponseSchema>;
export type ImageRequest = z.infer<typeof ImageRequestSchema>;
export type OpenExternalRequest = z.infer<typeof OpenExternalRequestSchema>;
export type FileChangeEvent = z.infer<typeof FileChangeEventSchema>;
export type ClientWsMessage = z.infer<typeof ClientWsMessageSchema>;
export type ServerWsMessage = z.infer<typeof ServerWsMessageSchema>;
export type AppBootstrapResponse = z.infer<typeof AppBootstrapResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SetDefaultModeRequest = z.infer<typeof SetDefaultModeRequestSchema>;
export type UpdateTabsRequest = z.infer<typeof UpdateTabsRequestSchema>;
