import { z } from 'zod/v4';
import { AbsolutePathSchema, OpenModeSchema, ThemeIdSchema } from './core.js';
import { ActivePackageSchema } from './packages.js';

export const WorkspaceSchema = z.object({
  path: AbsolutePathSchema,
  label: z.string(),
  addedAt: z.string().datetime(),
});

export const RecentFileSchema = z.object({
  path: AbsolutePathSchema,
  openedAt: z.string().datetime(),
});

export const PersistedTabSchema = z.object({
  path: AbsolutePathSchema,
  mode: OpenModeSchema,
  scrollPosition: z.number().nonnegative().optional(),
});

export const LegacyOrPersistedTab = z.union([
  AbsolutePathSchema.transform(
    (path): z.infer<typeof PersistedTabSchema> => ({
      path,
      mode: 'render',
    }),
  ),
  PersistedTabSchema,
]);

export const SidebarStateSchema = z.object({
  workspacesCollapsed: z.boolean(),
});

export const SessionStateSchema = z.object({
  workspaces: z.array(WorkspaceSchema),
  lastRoot: AbsolutePathSchema.nullable(),
  lastExportDir: AbsolutePathSchema.nullable().default(null),
  recentFiles: z.array(RecentFileSchema),
  theme: ThemeIdSchema,
  sidebarState: SidebarStateSchema,
  defaultOpenMode: OpenModeSchema.default('render'),
  openTabs: z.array(LegacyOrPersistedTab).default([]),
  activeTab: AbsolutePathSchema.nullable().default(null),
  activePackage: ActivePackageSchema,
});

export const SetRootRequestSchema = z.object({ root: AbsolutePathSchema });
export const AddWorkspaceRequestSchema = z.object({ path: AbsolutePathSchema });
export const RemoveWorkspaceRequestSchema = z.object({ path: AbsolutePathSchema });
export const SetThemeRequestSchema = z.object({ theme: z.string() });
export const UpdateSidebarRequestSchema = z.object({ workspacesCollapsed: z.boolean() });
export const TouchRecentFileRequestSchema = z.object({ path: AbsolutePathSchema });
export const RemoveRecentFileRequestSchema = z.object({ path: AbsolutePathSchema });
export const SetDefaultModeRequestSchema = z.object({
  mode: z.enum(['render', 'edit']),
});
export const UpdateTabsRequestSchema = z.object({
  openTabs: z.array(PersistedTabSchema),
  activeTab: AbsolutePathSchema.nullable(),
});

export const ThemeInfoSchema = z.object({
  id: ThemeIdSchema,
  label: z.string(),
  variant: z.enum(['light', 'dark']),
});

export const AppBootstrapResponseSchema = z.object({
  session: SessionStateSchema,
  availableThemes: z.array(ThemeInfoSchema),
});

export type SessionState = z.infer<typeof SessionStateSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type RecentFile = z.infer<typeof RecentFileSchema>;
export type PersistedTab = z.infer<typeof PersistedTabSchema>;
export type SidebarState = z.infer<typeof SidebarStateSchema>;
export type ThemeInfo = z.infer<typeof ThemeInfoSchema>;
export type AppBootstrapResponse = z.infer<typeof AppBootstrapResponseSchema>;
export type SetDefaultModeRequest = z.infer<typeof SetDefaultModeRequestSchema>;
export type UpdateTabsRequest = z.infer<typeof UpdateTabsRequestSchema>;
