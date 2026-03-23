import { NotImplementedError } from '../errors.js';
import type { ManifestOptions, ManifestResult } from '../types.js';

export async function getManifest(_options: ManifestOptions): Promise<ManifestResult> {
  throw new NotImplementedError('getManifest');
}
