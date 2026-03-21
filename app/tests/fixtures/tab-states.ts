import type { TabState } from '../../src/client/state.js';

export const singleTab: TabState = {
  id: 'tab-1',
  path: '/Users/leemoore/code/docs/readme.md',
  canonicalPath: '/Users/leemoore/code/docs/readme.md',
  filename: 'readme.md',
  html: '<h1>README</h1>',
  content: '# README',
  warnings: [],
  renderGeneration: 0,
  scrollPosition: 0,
  loading: false,
  modifiedAt: '2026-03-19T00:00:00Z',
  size: 10,
  status: 'ok',
};

export const multipleTabs: TabState[] = [
  {
    ...singleTab,
    id: 'tab-1',
    path: '/a/readme.md',
    canonicalPath: '/a/readme.md',
    filename: 'readme.md',
  },
  {
    ...singleTab,
    id: 'tab-2',
    path: '/a/design.md',
    canonicalPath: '/a/design.md',
    filename: 'design.md',
  },
  {
    ...singleTab,
    id: 'tab-3',
    path: '/a/notes.md',
    canonicalPath: '/a/notes.md',
    filename: 'notes.md',
  },
];

export const manyTabs: TabState[] = Array.from({ length: 15 }, (_, i) => ({
  ...singleTab,
  id: `tab-${i}`,
  path: `/docs/doc-${i}.md`,
  canonicalPath: `/docs/doc-${i}.md`,
  filename: `doc-${i}.md`,
}));

export const deletedTab: TabState = {
  ...singleTab,
  id: 'tab-deleted',
  path: '/Users/leemoore/code/docs/deleted.md',
  canonicalPath: '/Users/leemoore/code/docs/deleted.md',
  filename: 'deleted.md',
  status: 'deleted',
};
