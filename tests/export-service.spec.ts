import { describe, expect, it } from 'vitest';

import { shouldReuseRenderForExport } from '../src/main/exportService';

describe('exportService helpers', () => {
  it('reuses the cached render when no markdown override is provided', () => {
    expect(shouldReuseRenderForExport('# rendered', undefined)).toBe(true);
  });

  it('reuses the cached render when the override matches the current markdown', () => {
    expect(shouldReuseRenderForExport('# rendered', '# rendered')).toBe(true);
  });

  it('forces a fresh render when the export markdown differs', () => {
    expect(shouldReuseRenderForExport('# rendered', '# changed')).toBe(false);
  });
});
