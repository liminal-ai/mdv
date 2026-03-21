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

const execFileMock = vi.mocked(execFile);

function mockExecResult(
  error: (Error & { code?: number | string }) | null,
  stdout = '/Users/test/docs/saved.md\n',
): void {
  execFileMock.mockImplementation(((_file, _args, options, callback) => {
    const done = typeof options === 'function' ? options : callback;
    done?.(error, stdout, '');
    return {} as never;
  }) as typeof execFile);
}

describe('save dialog routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('TC-3.2a: Save As dialog opens with defaults', async () => {
    mockExecResult(null);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'story.md',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ path: '/Users/test/docs/saved.md' });
    expect(execFileMock).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('default name "story.md"')],
      expect.objectContaining({ timeout: 60000 }),
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('default location POSIX file "/Users/test/docs"')],
      expect.any(Object),
      expect.any(Function),
    );

    await app.close();
  });

  it('TC-3.2c: Cancel returns null', async () => {
    mockExecResult(Object.assign(new Error('User cancelled'), { code: 1 }), '');
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'story.md',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();

    await app.close();
  });

  it('Non-TC: Custom prompt is passed through to osascript', async () => {
    mockExecResult(null);
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'story.md',
        prompt: 'Save Copy',
      },
    });

    expect(execFileMock).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('with prompt "Save Copy"')],
      expect.any(Object),
      expect.any(Function),
    );

    await app.close();
  });

  it('Non-TC: Dialog timeout returns 500', async () => {
    mockExecResult(Object.assign(new Error('Timed out'), { code: 'ETIMEDOUT' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'story.md',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'WRITE_ERROR',
        message: 'Failed to open save dialog.',
      },
    });

    await app.close();
  });
});
