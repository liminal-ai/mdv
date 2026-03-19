import type { TreeNode } from '../../src/shared/types.js';

export const simpleTree: TreeNode[] = [
  {
    name: 'docs',
    path: '/root/docs',
    type: 'directory',
    mdCount: 3,
    children: [
      { name: 'getting-started.md', path: '/root/docs/getting-started.md', type: 'file' },
      { name: 'api-reference.md', path: '/root/docs/api-reference.md', type: 'file' },
      {
        name: 'guides',
        path: '/root/docs/guides',
        type: 'directory',
        mdCount: 1,
        children: [{ name: 'setup.md', path: '/root/docs/guides/setup.md', type: 'file' }],
      },
    ],
  },
  { name: 'README.md', path: '/root/README.md', type: 'file' },
];

export const emptyTree: TreeNode[] = [];

export const largeTree: TreeNode[] = generateLargeTree(200);

function generateLargeTree(dirCount: number): TreeNode[] {
  return Array.from({ length: dirCount }, (_, i) => ({
    name: `dir-${i}`,
    path: `/root/dir-${i}`,
    type: 'directory' as const,
    mdCount: 2,
    children: [
      { name: `doc-${i}-a.md`, path: `/root/dir-${i}/doc-${i}-a.md`, type: 'file' as const },
      { name: `doc-${i}-b.md`, path: `/root/dir-${i}/doc-${i}-b.md`, type: 'file' as const },
    ],
  }));
}
