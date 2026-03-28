import type { TreeNode } from '../../src/shared/types.js';

export function generateTreeNodes(fileCount: number, maxDepth: number): TreeNode[] {
  const rootChildren: TreeNode[] = [];
  const directoryLookup = new Map<string, TreeNode>();

  const ensureDirectory = (segments: string[]): TreeNode[] => {
    let children = rootChildren;
    let currentPath = '';

    for (const segment of segments) {
      currentPath = `${currentPath}/${segment}`;
      const existing = directoryLookup.get(currentPath);

      if (existing) {
        children = existing.children ?? [];
        continue;
      }

      const directory: TreeNode = {
        name: segment,
        path: currentPath,
        type: 'directory',
        children: [],
        mdCount: 0,
      };

      children.push(directory);
      directoryLookup.set(currentPath, directory);
      children = directory.children ?? [];
    }

    return children;
  };

  for (let index = 0; index < fileCount; index += 1) {
    const depth = (index % maxDepth) + 1;
    const segments = Array.from({ length: depth }, (_, level) => `section-${(index + level) % 24}`);
    const children = ensureDirectory(segments);
    const filePath = `/${segments.join('/')}/document-${index + 1}.md`;

    children.push({
      name: `document-${index + 1}.md`,
      path: filePath,
      type: 'file',
    });

    for (let level = 1; level <= segments.length; level += 1) {
      const directory = directoryLookup.get(`/${segments.slice(0, level).join('/')}`);
      if (directory) {
        directory.mdCount = (directory.mdCount ?? 0) + 1;
      }
    }
  }

  return rootChildren;
}

export const TREE_1500_FILES = generateTreeNodes(1500, 10);

export const TREE_WITH_SYMLINK_LOOP: TreeNode[] = [
  {
    name: 'docs',
    path: '/docs',
    type: 'directory',
    mdCount: 2,
    children: [
      {
        name: 'guide.md',
        path: '/docs/guide.md',
        type: 'file',
      },
      {
        name: 'loop',
        path: '/docs/loop',
        type: 'directory',
        mdCount: 1,
        children: [
          {
            name: 'loop-target.md',
            path: '/docs/loop/loop-target.md',
            type: 'file',
          },
        ],
      },
    ],
  },
];

export const TREE_WITH_BROKEN_SYMLINKS: TreeNode[] = [
  {
    name: 'docs',
    path: '/docs',
    type: 'directory',
    mdCount: 1,
    children: [
      {
        name: 'readme.md',
        path: '/docs/readme.md',
        type: 'file',
      },
    ],
  },
];

export const TREE_WITH_PERMISSION_ERRORS: TreeNode[] = [
  {
    name: 'docs',
    path: '/docs',
    type: 'directory',
    mdCount: 2,
    children: [
      {
        name: 'public.md',
        path: '/docs/public.md',
        type: 'file',
      },
      {
        name: 'restricted.md',
        path: '/docs/restricted.md',
        type: 'file',
      },
    ],
  },
];
