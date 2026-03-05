import fs from 'node:fs/promises';
import path from 'node:path';

import { isMarkdownPath } from '../core/drop';
import { FolderNode } from '../core/types';

function sortNodes(nodes: FolderNode[]): FolderNode[] {
  return nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'dir' ? -1 : 1;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: 'accent', numeric: true });
  });
}

async function scanDirectory(currentPath: string, visited: Set<string>): Promise<FolderNode[]> {
  let realPath: string;
  try {
    realPath = await fs.realpath(currentPath);
  } catch {
    realPath = currentPath;
  }

  if (visited.has(realPath)) {
    return [];
  }

  visited.add(realPath);

  let entries: Array<import('node:fs').Dirent>;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FolderNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      const children = await scanDirectory(fullPath, visited);
      if (children.length > 0) {
        nodes.push({
          type: 'dir',
          name: entry.name,
          path: fullPath,
          children
        });
      }
      continue;
    }

    if (entry.isSymbolicLink()) {
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          const children = await scanDirectory(fullPath, visited);
          if (children.length > 0) {
            nodes.push({
              type: 'dir',
              name: entry.name,
              path: fullPath,
              children
            });
          }
          continue;
        }

        if (stats.isFile() && isMarkdownPath(entry.name)) {
          nodes.push({
            type: 'file',
            name: entry.name,
            path: fullPath
          });
        }
      } catch {
        // Ignore broken symlinks.
      }
      continue;
    }

    if (entry.isFile() && isMarkdownPath(entry.name)) {
      nodes.push({
        type: 'file',
        name: entry.name,
        path: fullPath
      });
    }
  }

  return sortNodes(nodes);
}

export async function listMarkdownTree(rootPath: string): Promise<FolderNode[]> {
  const normalized = path.resolve(rootPath);
  return scanDirectory(normalized, new Set<string>());
}

export async function listMarkdownChildren(rootPath: string): Promise<FolderNode[]> {
  const normalized = path.resolve(rootPath);

  let entries: Array<import('node:fs').Dirent>;
  try {
    entries = await fs.readdir(normalized, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FolderNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(normalized, entry.name);

    if (entry.isDirectory()) {
      nodes.push({
        type: 'dir',
        name: entry.name,
        path: fullPath
      });
      continue;
    }

    if (entry.isSymbolicLink()) {
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          nodes.push({
            type: 'dir',
            name: entry.name,
            path: fullPath
          });
          continue;
        }

        if (stats.isFile() && isMarkdownPath(entry.name)) {
          nodes.push({
            type: 'file',
            name: entry.name,
            path: fullPath
          });
        }
      } catch {
        // Ignore broken symlinks.
      }
      continue;
    }

    if (entry.isFile() && isMarkdownPath(entry.name)) {
      nodes.push({
        type: 'file',
        name: entry.name,
        path: fullPath
      });
    }
  }

  return sortNodes(nodes);
}
