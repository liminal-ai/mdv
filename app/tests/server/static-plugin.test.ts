import { describe, expect, it } from 'vitest';
import { resolveClientRoot } from '../../src/server/plugins/static.js';

describe('static plugin client root resolution', () => {
  it('prefers unpacked client assets for packaged Electron apps', () => {
    const baseDir = '/Applications/mdv.app/Contents/Resources/app.asar/dist/server/plugins';
    const exists = (target: string) =>
      target === '/Applications/mdv.app/Contents/Resources/app.asar.unpacked/dist/client/index.html';

    expect(resolveClientRoot(baseDir, exists)).toBe(
      '/Applications/mdv.app/Contents/Resources/app.asar.unpacked/dist/client',
    );
  });

  it('uses the standard dist/client directory during normal runs', () => {
    const baseDir = '/Users/me/code/md-viewer/app/dist/server/plugins';
    const exists = (target: string) =>
      target === '/Users/me/code/md-viewer/app/dist/client/index.html';

    expect(resolveClientRoot(baseDir, exists)).toBe('/Users/me/code/md-viewer/app/dist/client');
  });

  it('throws a clear error when the renderer build is missing', () => {
    expect(() => resolveClientRoot('/tmp/mdv/dist/server/plugins', () => false)).toThrow(
      /Client build not found.*npm run build/s,
    );
  });
});
