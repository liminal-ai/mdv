import { drainEntry, scanPackage } from './shared.js';
import type { FileEntry, ListOptions } from '../types.js';

export async function listPackage(options: ListOptions): Promise<FileEntry[]> {
  if (!options?.packagePath) {
    throw new TypeError('listPackage requires packagePath');
  }

  const files: FileEntry[] = [];

  await scanPackage(options.packagePath, async (header, stream) => {
    if (header.type === undefined || header.type === null || header.type === 'file') {
      files.push({
        path: header.name,
        size: Number(header.size ?? 0),
      });
    }

    await drainEntry(stream);
  });

  files.sort((left, right) =>
    left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }),
  );

  return files;
}
