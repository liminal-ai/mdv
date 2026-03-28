import { z } from 'zod/v4';

export const MenuStateSchema = z.object({
  hasDocument: z.boolean(),
  hasDirtyTab: z.boolean(),
  activeTabDirty: z.boolean(),
  activeTheme: z.string(),
  activeMode: z.enum(['render', 'edit']),
  defaultMode: z.enum(['render', 'edit']),
});

export type MenuState = z.infer<typeof MenuStateSchema>;
