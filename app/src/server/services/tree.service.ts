import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { TreeNode } from '../schemas/index.js';

const MD_EXTENSIONS = new Set(['.md', '.markdown']);

function isMarkdownFile(name: string): boolean {
  if (name.startsWith('.')) return false;
  const ext = path.extname(name).toLowerCase();
  return MD_EXTENSIONS.has(ext);
}

function isHidden(name: string): boolean {
  return name.startsWith('.');
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function computeMdCount(node: TreeNode): number {
  if (node.type === 'file') return 1;
  const count = (node.children ?? []).reduce((sum, child) => sum + computeMdCount(child), 0);
  node.mdCount = count;
  return count;
}

async function scanDir(dirPath: string, visited: Set<string>): Promise<TreeNode[]> {
  let realDir: string;
  try {
    realDir = await realpath(dirPath);
  } catch {
    return [];
  }

  if (visited.has(realDir)) return [];
  visited.add(realDir);

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    if (isHidden(entry.name)) continue;

    const entryPath = path.join(dirPath, entry.name);

    let isDir: boolean;
    let isFile: boolean;

    if (entry.isSymbolicLink()) {
      try {
        const targetStat = await stat(entryPath);
        isDir = targetStat.isDirectory();
        isFile = targetStat.isFile();
      } catch {
        continue;
      }
    } else {
      isDir = entry.isDirectory();
      isFile = entry.isFile();
    }

    if (!isDir && !isFile) continue;

    if (isDir) {
      const children = await scanDir(entryPath, visited);
      if (children.length === 0) continue;

      const node: TreeNode = {
        name: entry.name,
        path: entryPath,
        type: 'directory',
        children,
      };
      computeMdCount(node);
      nodes.push(node);
    } else if (isFile && isMarkdownFile(entry.name)) {
      nodes.push({
        name: entry.name,
        path: entryPath,
        type: 'file',
      });
    }
  }

  return sortNodes(nodes);
}

export async function scanTree(rootPath: string): Promise<TreeNode[]> {
  const rootStat = await stat(rootPath);
  if (!rootStat.isDirectory()) {
    const err = new Error(`Not a directory: ${rootPath}`);
    (err as NodeJS.ErrnoException).code = 'ENOTDIR';
    throw err;
  }

  const visited = new Set<string>();
  return scanDir(rootPath, visited);
}
