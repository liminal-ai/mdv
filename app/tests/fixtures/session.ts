import type { SessionState } from '../../src/shared/types.js';

export const emptySession: SessionState = {
  workspaces: [],
  lastRoot: null,
  recentFiles: [],
  theme: 'light-default',
  sidebarState: { workspacesCollapsed: false },
};

export const populatedSession: SessionState = {
  workspaces: [
    { path: '/Users/leemoore', label: 'leemoore', addedAt: '2026-03-01T00:00:00Z' },
    { path: '/Users/leemoore/code/liminal', label: 'liminal', addedAt: '2026-03-02T00:00:00Z' },
    { path: '/Users/leemoore/code', label: 'code', addedAt: '2026-03-03T00:00:00Z' },
  ],
  lastRoot: '/Users/leemoore/code',
  recentFiles: [{ path: '/Users/leemoore/code/README.md', openedAt: '2026-03-19T00:00:00Z' }],
  theme: 'dark-default',
  sidebarState: { workspacesCollapsed: false },
};

export const corruptedSessionJson = '{ "workspaces": [, invalid }';

export const sessionWithDeletedRoot: SessionState = {
  ...populatedSession,
  lastRoot: '/nonexistent/path',
};
