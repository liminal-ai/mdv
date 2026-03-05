import { describe, expect, it } from 'vitest';

import { firstMarkdownPathFromDropFiles, isMarkdownPath } from '../src/core/drop';

describe('drop helpers', () => {
  it('accepts markdown extensions', () => {
    expect(isMarkdownPath('/tmp/readme.md')).toBe(true);
    expect(isMarkdownPath('/tmp/notes.markdown')).toBe(true);
    expect(isMarkdownPath('/tmp/notes.txt')).toBe(false);
  });

  it('returns first markdown file from drop list', () => {
    const filePath = firstMarkdownPathFromDropFiles([
      { path: '/tmp/a.txt' },
      { path: '/tmp/b.md' },
      { path: '/tmp/c.markdown' }
    ]);

    expect(filePath).toBe('/tmp/b.md');
  });

  it('returns null for invalid drops', () => {
    expect(firstMarkdownPathFromDropFiles([{ path: '/tmp/a.txt' }])).toBeNull();
    expect(firstMarkdownPathFromDropFiles([])).toBeNull();
  });
});
