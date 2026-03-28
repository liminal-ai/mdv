import { parseManifest } from '../manifest/parser.js';
import { PackageError, PackageErrorCode } from '../errors.js';
import type { ManifestOptions, ManifestResult } from '../types.js';
import { MANIFEST_FILENAME } from '../types.js';
import { drainEntry, readEntryContent, scanPackage } from './shared.js';

export async function getManifest(options: ManifestOptions): Promise<ManifestResult> {
  if (!options?.packagePath) {
    throw new TypeError('getManifest requires packagePath');
  }

  let content: string | undefined;

  await scanPackage(options.packagePath, async (header, stream) => {
    if (header.name !== MANIFEST_FILENAME) {
      await drainEntry(stream);
      return;
    }

    content = (await readEntryContent(stream)).toString('utf8');
  });

  if (content === undefined) {
    throw new PackageError(
      PackageErrorCode.MANIFEST_NOT_FOUND,
      `Manifest not found in package: ${options.packagePath}`,
      options.packagePath,
    );
  }

  const parsed = parseManifest(content);

  return {
    content,
    metadata: parsed.metadata,
    navigation: parsed.navigation,
  };
}
