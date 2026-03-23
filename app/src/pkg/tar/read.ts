import { NotImplementedError } from '../errors.js';
import type { ReadOptions, ReadResult } from '../types.js';

export async function readDocument(_options: ReadOptions): Promise<ReadResult> {
  throw new NotImplementedError('readDocument');
}
