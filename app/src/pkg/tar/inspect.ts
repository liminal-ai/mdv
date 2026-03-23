import { NotImplementedError } from '../errors.js';
import type { InspectOptions, PackageInfo } from '../types.js';

export async function inspectPackage(_options: InspectOptions): Promise<PackageInfo> {
  throw new NotImplementedError('inspectPackage');
}
