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
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export/reveal',
      payload: {
        path: '/Users/test/exports/architecture.pdf',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(vi.mocked(execFile)).toHaveBeenCalledWith('open', [
      '-R',
      '/Users/test/exports/architecture.pdf',
    ]);

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
});
