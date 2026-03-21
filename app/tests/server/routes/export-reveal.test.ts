import { execFile } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

import { buildApp } from '../../../src/server/app.js';

describe('export reveal routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('TC-2.2b: Reveal calls open -R with the path', async () => {
    vi.mocked(execFile).mockImplementation(((_file, _args, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      done?.(null, '', '');
      return {} as never;
    }) as typeof execFile);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export/reveal',
      payload: {
        path: '/Users/test/exports/architecture.pdf',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'open',
      ['-R', '/Users/test/exports/architecture.pdf'],
      expect.objectContaining({ timeout: 15_000 }),
      expect.any(Function),
    );

    await app.close();
  });

  it('Non-TC: Reveal with invalid path returns appropriate error', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export/reveal',
      payload: {
        path: 'relative/output.pdf',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Path must be absolute',
      },
    });

    await app.close();
  });

  it('Non-TC: Reveal returns 500 when Finder reveal fails', async () => {
    vi.mocked(execFile).mockImplementation(((_file, _args, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      done?.(new Error('open failed'), '', 'open failed');
      return {} as never;
    }) as typeof execFile);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export/reveal',
      payload: {
        path: '/Users/test/exports/architecture.pdf',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Could not reveal exported file in Finder: open failed',
      },
    });

    await app.close();
  });
});
