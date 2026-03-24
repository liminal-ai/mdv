import { parseManifest } from '../manifest/parser.js';
import type { FileEntry, InspectOptions, PackageInfo } from '../types.js';
import { MANIFEST_FILENAME } from '../types.js';
import { drainEntry, readEntryContent, scanPackage } from './shared.js';

export async function inspectPackage(options: InspectOptions): Promise<PackageInfo> {
  if (!options?.packagePath) {
    throw new TypeError('inspectPackage requires packagePath');
  }

  const files: FileEntry[] = [];
  let manifestContent = '';

  const format = await scanPackage(options.packagePath, async (header, stream) => {
    files.push({
      path: header.name,
      size: Number(header.size ?? 0),
    });

    if (header.name !== MANIFEST_FILENAME) {
      await drainEntry(stream);
      return;
    }

    manifestContent = (await readEntryContent(stream)).toString('utf8');
  });

  const parsed = parseManifest(manifestContent);

  files.sort((left, right) =>
    left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }),
  );

  return {
    metadata: parsed.metadata,
    navigation: parsed.navigation,
    files,
    format,
  };
}
