import { NotImplementedError } from '../errors.js';
import type { CreateOptions } from '../types.js';

export async function createPackage(_options: CreateOptions): Promise<void> {
  throw new NotImplementedError('createPackage');
}
