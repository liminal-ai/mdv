import type { ChildProcess } from 'node:child_process';
import { execFile } from 'node:child_process';
import type { Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: vi.fn(),
  };
});

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

import { buildApp } from '../../../src/server/app.js';
import { getOpenPathCommand } from '../../../src/server/utils/system-shell.js';

function makeFileStat(): Stats {
  return {
    isFile: () => true,
  } as Stats;
}

function mockExecSuccess(path: string) {
  const { command, args } = getOpenPathCommand(path);
  vi.mocked(execFile).mockImplementationOnce(((
    actualCommand: string,
    actualArgs: readonly string[],
    optionsOrCallback?:
      | { timeout?: number }
      | ((error: Error | null, stdout: string, stderr: string) => void),
    maybeCallback?: (error: Error | null, stdout: string, stderr: string) => void,
  ) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    expect(actualCommand).toBe(command);
    expect(actualArgs).toEqual(args);
    if (typeof optionsOrCallback === 'object') {
      expect(optionsOrCallback).toEqual(expect.objectContaining({ timeout: 15_000 }));
    }
    callback?.(null, '', '');
    return {} as ChildProcess;
  }) as unknown as typeof execFile);
}

describe('open external route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-5.3a: Opens the file with the system handler', async () => {
    const path = '/tmp/test/diagram.svg';
    vi.mocked(stat).mockResolvedValue(makeFileStat());
    mockExecSuccess(path);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/open-external',
      payload: { path },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it('Non-TC: Missing file returns 404', async () => {
    const path = '/tmp/test/missing.pdf';
    vi.mocked(stat).mockRejectedValue(Object.assign(new Error('Missing'), { code: 'ENOENT' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/open-external',
      payload: { path },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${path}`,
      },
    });
    expect(execFile).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: Invalid path returns 400', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/open-external',
      payload: { path: 'relative/file.pdf' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Path must be absolute',
      },
    });
    expect(stat).not.toHaveBeenCalled();
    expect(execFile).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: Shell metacharacters are passed as a literal argument', async () => {
    const path = '/tmp/test/$(touch pwned)-`echo no`.pdf';
    vi.mocked(stat).mockResolvedValue(makeFileStat());
    mockExecSuccess(path);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/open-external',
      payload: { path },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    const { command, args } = getOpenPathCommand(path);
    expect(execFile).toHaveBeenCalledWith(
      command,
      args,
      expect.objectContaining({ timeout: 15_000 }),
      expect.any(Function),
    );

    await app.close();
  });
});
