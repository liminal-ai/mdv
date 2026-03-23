import { NotImplementedError } from '../errors.js';
import type { ParsedManifest } from '../types.js';

export function parseManifest(_content: string): ParsedManifest {
  throw new NotImplementedError('parseManifest');
}
