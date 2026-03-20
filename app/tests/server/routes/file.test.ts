import type { ChildProcess } from 'node:child_process';
import { execFile } from 'node:child_process';
import type { Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: vi.fn(),
    realpath: vi.fn(),
    readFile: vi.fn(),
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
import {
  basicFileResponse,
  largeFileResponse,
  symlinkFileResponse,
} from '../../fixtures/file-responses.js';
import { emptyMarkdown } from '../../fixtures/markdown-samples.js';

const FILE_PICKER_COMMAND =
  'POSIX path of (choose file of type {"md", "markdown"} with prompt "Open Markdown File")';
const FILE_PICKER_TIMEOUT_MS = 60_000;

function makeFileStat(
  options: { size?: number; modifiedAt?: string | Date; isFile?: boolean } = {},
): Stats {
  return {
    size: options.size ?? basicFileResponse.size,
    mtime: new Date(options.modifiedAt ?? basicFileResponse.modifiedAt),
    isFile: () => options.isFile ?? true,
  } as Stats;
}

function mockExecResult(result: { stdout?: string; error?: Error & { code?: number } }) {
  vi.mocked(execFile).mockImplementationOnce(((
    file: string,
    args: readonly string[],
    optionsOrCallback?:
      | { timeout: number }
      | ((error: Error | null, stdout: string, stderr: string) => void),
    callback?: (error: Error | null, stdout: string, stderr: string) => void,
  ) => {
    expect(file).toBe('osascript');
    expect(args).toEqual(['-e', FILE_PICKER_COMMAND]);
    expect(optionsOrCallback).toEqual({ timeout: FILE_PICKER_TIMEOUT_MS });
    callback?.(result.error ?? null, result.stdout ?? '', '');
    return {} as ChildProcess;
  }) as unknown as typeof execFile);
}

describe('file routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-1.1a: File open returns content and metadata', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.realpath).mockResolvedValue(basicFileResponse.canonicalPath);
    vi.mocked(fs.readFile).mockResolvedValue(basicFileResponse.content);
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(basicFileResponse.path)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...basicFileResponse,
      modifiedAt: new Date(basicFileResponse.modifiedAt).toISOString(),
    });

    await app.close();
  });

  it('TC-1.3b: Canonical path resolves symlinks', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.realpath).mockResolvedValue(symlinkFileResponse.canonicalPath);
    vi.mocked(fs.readFile).mockResolvedValue(symlinkFileResponse.content);
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(symlinkFileResponse.path)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().path).toBe(symlinkFileResponse.path);
    expect(response.json().canonicalPath).toBe(symlinkFileResponse.canonicalPath);
    expect(response.json().canonicalPath).not.toBe(response.json().path);

    await app.close();
  });

  it('TC-1.4a: File outside root opens normally', async () => {
    const outsidePath = '/Users/leemoore/code/project-b/notes.md';
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat({ size: 24 }));
    vi.mocked(fs.realpath).mockResolvedValue(outsidePath);
    vi.mocked(fs.readFile).mockResolvedValue('# Outside Root\n\nOpened.');
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(outsidePath)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      path: outsidePath,
      canonicalPath: outsidePath,
      filename: 'notes.md',
      content: '# Outside Root\n\nOpened.',
      html: '<h1 id="outside-root" tabindex="-1">Outside Root</h1>\n<p>Opened.</p>\n',
      warnings: [],
      size: 24,
    });

    await app.close();
  });

  it('TC-1.5a: File picker returns selected path', async () => {
    mockExecResult({ stdout: '/Users/leemoore/code/project/docs/selected.md\n' });
    const app = await buildApp();

    const response = await app.inject({ method: 'POST', url: '/api/file/pick' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ path: '/Users/leemoore/code/project/docs/selected.md' });

    await app.close();
  });

  it('TC-1.5b: Selecting a file from picker opens it', async () => {
    const pickedPath = '/Users/leemoore/code/project/docs/from-picker.md';
    mockExecResult({ stdout: `${pickedPath}\n` });
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat({ size: 19 }));
    vi.mocked(fs.realpath).mockResolvedValue(pickedPath);
    vi.mocked(fs.readFile).mockResolvedValue('# Picked\n\nOpened.');
    const app = await buildApp();

    const pickResponse = await app.inject({ method: 'POST', url: '/api/file/pick' });
    const openResponse = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(pickedPath)}`,
    });

    expect(pickResponse.statusCode).toBe(200);
    expect(pickResponse.json()).toEqual({ path: pickedPath });
    expect(openResponse.statusCode).toBe(200);
    expect(openResponse.json()).toMatchObject({
      path: pickedPath,
      canonicalPath: pickedPath,
      filename: 'from-picker.md',
      content: '# Picked\n\nOpened.',
      html: '<h1 id="picked" tabindex="-1">Picked</h1>\n<p>Opened.</p>\n',
      warnings: [],
    });

    await app.close();
  });

  it('TC-1.5c: Cancelling the picker returns null', async () => {
    mockExecResult({ error: Object.assign(new Error('User canceled'), { code: 1 }) });
    const app = await buildApp();

    const response = await app.inject({ method: 'POST', url: '/api/file/pick' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();

    await app.close();
  });

  it('Non-TC: File picker failure returns 500', async () => {
    mockExecResult({ error: Object.assign(new Error('osascript not found'), { code: 127 }) });
    const app = await buildApp();

    const response = await app.inject({ method: 'POST', url: '/api/file/pick' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'READ_ERROR',
        message: 'Failed to open the file picker.',
      },
    });

    await app.close();
  });

  it('TC-9.1a: Permission denied returns 403', async () => {
    vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('Denied'), { code: 'EACCES' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(basicFileResponse.path)}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to read this file.',
      },
    });

    await app.close();
  });

  it('TC-9.1b: File disappeared returns 404', async () => {
    vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('Missing'), { code: 'ENOENT' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(basicFileResponse.path)}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'The requested file no longer exists.',
      },
    });

    await app.close();
  });

  it('TC-9.3b: returns 504 with READ_TIMEOUT when file read hangs', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.realpath).mockResolvedValue(basicFileResponse.canonicalPath);
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController();
      queueMicrotask(() => controller.abort());
      return controller.signal;
    });
    vi.mocked(fs.readFile).mockImplementation(((_path, options) => {
      return new Promise((_resolve, reject) => {
        if (typeof options !== 'object' || options === null || !('signal' in options)) {
          reject(new Error('Expected readFile to receive an abort signal.'));
          return;
        }

        options.signal.addEventListener(
          'abort',
          () => {
            reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
          },
          { once: true },
        );
      });
    }) as never);
    const app = await buildApp();

    try {
      const responsePromise = app.inject({
        method: 'GET',
        url: `/api/file?path=${encodeURIComponent(basicFileResponse.path)}`,
      });

      const response = await responsePromise;

      expect(response.statusCode).toBe(504);
      expect(response.json()).toEqual({
        error: {
          code: 'READ_TIMEOUT',
          message: `File read timed out after 10 seconds: ${basicFileResponse.path}`,
        },
      });
    } finally {
      await app.close();
    }
  });

  it('Non-TC: Non-absolute path rejected', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent('relative/path.md')}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Path must be absolute',
      },
    });
    expect(fs.stat).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: Non-markdown extension rejected', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent('/Users/leemoore/code/project/image.png')}`,
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('NOT_MARKDOWN');
    expect(fs.stat).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: File over 5MB rejected', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat({ size: 5 * 1024 * 1024 + 1 }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(basicFileResponse.path)}`,
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('FILE_TOO_LARGE');
    expect(fs.realpath).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: File 1-5MB returns with size for client warning', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat({ size: largeFileResponse.size }));
    vi.mocked(fs.realpath).mockResolvedValue(largeFileResponse.canonicalPath);
    vi.mocked(fs.readFile).mockResolvedValue(largeFileResponse.content);
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(largeFileResponse.path)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().size).toBe(largeFileResponse.size);

    await app.close();
  });

  it('Non-TC: Empty file opens without error', async () => {
    const emptyPath = '/Users/leemoore/code/project/docs/empty.md';
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat({ size: 0 }));
    vi.mocked(fs.realpath).mockResolvedValue(emptyPath);
    vi.mocked(fs.readFile).mockResolvedValue(emptyMarkdown);
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(emptyPath)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      path: emptyPath,
      canonicalPath: emptyPath,
      filename: 'empty.md',
      content: '',
      html: '',
      warnings: [],
      size: 0,
    });

    await app.close();
  });

  it('Non-TC: GET /api/file with missing query param returns 400', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/file',
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

  it('Non-TC: Non-file paths rejected', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat({ isFile: false }));
    const app = await buildApp();
    const directoryLikeMarkdownPath = '/Users/leemoore/code/project/docs-folder.md';

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(directoryLikeMarkdownPath)}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_PATH');
    expect(fs.realpath).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: Read failures return 500', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.realpath).mockResolvedValue(basicFileResponse.canonicalPath);
    vi.mocked(fs.readFile).mockRejectedValue(
      Object.assign(new Error('Disk I/O failed'), { code: 'EIO' }),
    );
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(basicFileResponse.path)}`,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'READ_ERROR',
        message: 'Failed to read the requested file.',
      },
    });

    await app.close();
  });
});
