import { NotImplementedError } from '../errors.js';
import type { ExtractOptions } from '../types.js';

export async function extractPackage(_options: ExtractOptions): Promise<void> {
  throw new NotImplementedError('extractPackage');
}
