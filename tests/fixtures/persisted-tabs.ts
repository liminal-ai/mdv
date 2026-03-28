import type { PersistedTab } from '../../src/shared/types.js';

export const PERSISTED_TABS_CLEAN: PersistedTab[] = [
  { path: '/docs/readme.md', mode: 'render' },
  { path: '/docs/spec.md', mode: 'edit' },
  { path: '/docs/design.md', mode: 'render', scrollPosition: 450 },
];

export const PERSISTED_TABS_WITH_MISSING: PersistedTab[] = [
  { path: '/docs/readme.md', mode: 'render' },
  { path: '/docs/deleted.md', mode: 'render' },
  { path: '/docs/spec.md', mode: 'edit' },
];

export const LEGACY_TABS_STRINGS: string[] = [
  '/docs/readme.md',
  '/docs/spec.md',
  '/docs/design.md',
];
