import { afterEach, describe, expect, it, vi } from 'vitest';

describe('SessionService fs mocks', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('node:fs/promises');
  });

  it('uses mocked node:fs/promises for atomic writes', async () => {
    const mkdir = vi.fn().mockResolvedValue(undefined);
    const readFile = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Missing session'), { code: 'ENOENT' }));
    const rename = vi.fn().mockResolvedValue(undefined);
    const stat = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Missing path'), { code: 'ENOENT' }));
    const writeFile = vi.fn().mockResolvedValue(undefined);

    vi.doMock('node:fs/promises', () => ({
      mkdir,
      readFile,
      rename,
      stat,
      writeFile,
    }));

    const { SessionService } = await import('../../../src/server/services/session.service.js');
    const service = new SessionService('/tmp/mdv-audit-session');

    await service.touchRecentFile('/tmp/example.md');

    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.stringContaining('/tmp/example.md'),
      'utf8',
    );
    expect(rename).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      '/tmp/mdv-audit-session/session.json',
    );
  });
});
