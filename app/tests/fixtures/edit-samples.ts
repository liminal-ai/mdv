import type { TabState } from '../../src/client/state.js';
import type { FileSaveResponse } from '../../src/shared/types.js';

export const cleanTab: TabState = {
  id: 'tab-1',
  path: '/Users/leemoore/code/docs/readme.md',
  canonicalPath: '/Users/leemoore/code/docs/readme.md',
  filename: 'readme.md',
  html: '<h1>README</h1>',
  content: '# README',
  warnings: [],
  scrollPosition: 0,
  loading: false,
  modifiedAt: '2026-03-20T10:00:00Z',
  size: 10,
  status: 'ok',
  mode: 'render',
  editContent: null,
  editScrollPosition: 0,
  cursorPosition: null,
  dirty: false,
  editedSinceLastSave: false,
};

export const dirtyTab: TabState = {
  ...cleanTab,
  id: 'tab-2',
  path: '/Users/leemoore/code/docs/spec.md',
  canonicalPath: '/Users/leemoore/code/docs/spec.md',
  filename: 'spec.md',
  content: '# Spec\n\nOriginal content.',
  editContent: '# Spec\n\nModified content.',
  mode: 'edit',
  dirty: true,
  editedSinceLastSave: true,
  cursorPosition: { line: 3, column: 18 },
};

export const dirtyRenderTab: TabState = {
  ...dirtyTab,
  mode: 'render',
};

export const saveResponse: FileSaveResponse = {
  path: '/Users/leemoore/code/docs/spec.md',
  modifiedAt: '2026-03-20T10:05:00Z',
  size: 35,
};

export const threeTabs: TabState[] = [
  { ...cleanTab, id: 'tab-a', path: '/a.md', canonicalPath: '/a.md', filename: 'a.md' },
  { ...dirtyTab, id: 'tab-b', path: '/b.md', canonicalPath: '/b.md', filename: 'b.md' },
  { ...cleanTab, id: 'tab-c', path: '/c.md', canonicalPath: '/c.md', filename: 'c.md' },
];

export const twoDirtyTabs: TabState[] = [
  { ...dirtyTab, id: 'tab-x', path: '/x.md', canonicalPath: '/x.md', filename: 'x.md' },
  { ...dirtyTab, id: 'tab-y', path: '/y.md', canonicalPath: '/y.md', filename: 'y.md' },
];
