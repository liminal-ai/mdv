import { z } from 'zod/v4';

// --- Primitives ---
export const AbsolutePathSchema = z.string().refine((p) => p.startsWith('/'), {
  message: 'Path must be absolute',
});

export const ThemeIdSchema = z.string();

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
export type AppBootstrapResponse = z.infer<typeof AppBootstrapResponseSchema>;
