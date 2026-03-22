import { readdir, realpath, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import type { TreeNode } from '../schemas/index.js';
import { ScanTimeoutError } from '../utils/errors.js';

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

async function scanDir(
  dirPath: string,
  visited: Set<string>,
  options: {
    entries?: Dirent[];
    signal?: AbortSignal;
    throwOnReadError?: boolean;
    depth?: number;
    maxDepth?: number;
    rootPath?: string;
  } = {},
): Promise<TreeNode[]> {
  const {
    entries: providedEntries,
    signal,
    throwOnReadError,
    depth = 0,
    maxDepth = 100,
    rootPath = dirPath,
  } = options;

  if (depth > maxDepth) {
    return [];
  }

  let realDir: string;
  try {
    throwIfAborted(signal, rootPath);
    realDir = await realpath(dirPath);
  } catch (error) {
    if (error instanceof ScanTimeoutError) {
      throw error;
    }
    if (throwOnReadError) {
      throw error;
    }
    return [];
  }

  if (visited.has(realDir)) return [];
  visited.add(realDir);

  let entries;
  try {
    entries = providedEntries ?? (await readDirWithTimeout(dirPath, signal, rootPath));
  } catch (error) {
    if (error instanceof ScanTimeoutError) {
      throw error;
    }
    if (throwOnReadError) {
      throw error;
    }
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
        throwIfAborted(signal, rootPath);
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
      const children = await scanDir(entryPath, visited, {
        signal,
        depth: depth + 1,
        maxDepth,
        rootPath,
      });
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

function throwIfAborted(signal: AbortSignal | undefined, rootPath: string): void {
  if (signal?.aborted) {
    throw new ScanTimeoutError(rootPath);
  }
}

async function readDirWithTimeout(
  dirPath: string,
  signal: AbortSignal | undefined,
  rootPath: string,
): Promise<Dirent[]> {
  throwIfAborted(signal, rootPath);

  if (!signal) {
    return readdir(dirPath, { withFileTypes: true });
  }

  return new Promise<Dirent[]>((resolve, reject) => {
    const onAbort = () => {
      reject(new ScanTimeoutError(rootPath));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    void readdir(dirPath, { withFileTypes: true }).then(
      (entries) => {
        signal.removeEventListener('abort', onAbort);
        resolve(entries);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export async function scanTree(
  rootPath: string,
  options: {
    timeoutMs?: number;
    maxDepth?: number;
  } = {},
): Promise<TreeNode[]> {
  const { timeoutMs = 10_000, maxDepth = 100 } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    throwIfAborted(controller.signal, rootPath);
    const rootStat = await stat(rootPath);
    if (!rootStat.isDirectory()) {
      const err = new Error(`Not a directory: ${rootPath}`);
      (err as NodeJS.ErrnoException).code = 'ENOTDIR';
      throw err;
    }

    const rootEntries = await readDirWithTimeout(rootPath, controller.signal, rootPath);
    const visited = new Set<string>();
    return scanDir(rootPath, visited, {
      entries: rootEntries,
      signal: controller.signal,
      throwOnReadError: true,
      depth: 0,
      maxDepth,
      rootPath,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
