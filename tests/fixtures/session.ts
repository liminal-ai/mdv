import type { SessionState } from '../../src/shared/types.js';

export const emptySession: SessionState = {
  workspaces: [],
  lastRoot: null,
  lastExportDir: null,
  recentFiles: [],
  theme: 'light-default',
  sidebarState: { workspacesCollapsed: false },
  defaultOpenMode: 'render',
  openTabs: [],
  activeTab: null,
  activePackage: null,
};

export const populatedSession: SessionState = {
  workspaces: [
    { path: '/Users/leemoore', label: 'leemoore', addedAt: '2026-03-01T00:00:00Z' },
    { path: '/Users/leemoore/code/liminal', label: 'liminal', addedAt: '2026-03-02T00:00:00Z' },
    { path: '/Users/leemoore/code', label: 'code', addedAt: '2026-03-03T00:00:00Z' },
  ],
  lastRoot: '/Users/leemoore/code',
  lastExportDir: null,
  recentFiles: [{ path: '/Users/leemoore/code/README.md', openedAt: '2026-03-19T00:00:00Z' }],
  theme: 'dark-default',
  sidebarState: { workspacesCollapsed: false },
  defaultOpenMode: 'render',
  openTabs: [
    { path: '/Users/leemoore/code/README.md', mode: 'render' },
    { path: '/Users/leemoore/code/liminal/ARCHITECTURE.md', mode: 'render' },
  ],
  activeTab: '/Users/leemoore/code/README.md',
  activePackage: null,
};

export const corruptedSessionJson = '{ "workspaces": [, invalid }';

export const sessionWithDeletedRoot: SessionState = {
  ...populatedSession,
  lastRoot: '/nonexistent/path',
};
