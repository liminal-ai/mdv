import { NotImplementedError } from '../errors.js';
import type { FileEntry, ListOptions } from '../types.js';

export async function listPackage(_options: ListOptions): Promise<FileEntry[]> {
  throw new NotImplementedError('listPackage');
}
