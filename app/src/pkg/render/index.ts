import { NotImplementedError } from '../errors.js';
import type { RenderOptions, RenderResult } from '../types.js';

export async function renderMarkdown(
  _markdown: string,
  _options?: RenderOptions,
): Promise<RenderResult> {
  throw new NotImplementedError('renderMarkdown');
}
