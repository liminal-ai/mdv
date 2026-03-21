import { execFile } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../src/server/app.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

const execFileMock = vi.mocked(execFile);

function mockExecResult(
  error: (Error & { code?: number }) | null,
  stdout = '/Users/test/exports/selected-file.pdf\n',
): void {
  execFileMock.mockImplementation(((_file, _args, options, callback) => {
    const done = typeof options === 'function' ? options : callback;
    done?.(error, stdout, '');
    return {} as never;
  }) as typeof execFile);
}

describe('export save dialog routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('TC-1.2a: Default filename uses the provided PDF name', async () => {
    mockExecResult(null);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'architecture.pdf',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(execFileMock).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('default name "architecture.pdf"')],
      expect.objectContaining({ timeout: 60000 }),
      expect.any(Function),
    );

    await app.close();
  });

  it('TC-1.2b: Default directory can use the source file directory', async () => {
    mockExecResult(null);
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/export/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'architecture.pdf',
      },
    });

    expect(execFileMock).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('default location POSIX file "/Users/test/docs"')],
      expect.any(Object),
      expect.any(Function),
    );

    await app.close();
  });

  it('TC-1.2c: Default directory can use the last-used export directory', async () => {
    mockExecResult(null);
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/export/save-dialog',
      payload: {
        defaultPath: '/Users/test/exports',
        defaultFilename: 'architecture.pdf',
      },
    });

    expect(execFileMock).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('default location POSIX file "/Users/test/exports"')],
      expect.any(Object),
      expect.any(Function),
    );

    await app.close();
  });

  it('TC-1.2d: DOCX filename extension is passed through', async () => {
    mockExecResult(null, '/Users/test/exports/readme.docx\n');
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/export/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'readme.docx',
      },
    });

    expect(execFileMock).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('default name "readme.docx"')],
      expect.any(Object),
      expect.any(Function),
    );

    await app.close();
  });

  it('TC-1.2e: HTML filename extension is passed through', async () => {
    mockExecResult(null, '/Users/test/exports/notes.html\n');
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/export/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'notes.html',
      },
    });

    expect(execFileMock).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('default name "notes.html"')],
      expect.any(Object),
      expect.any(Function),
    );

    await app.close();
  });

  it('TC-1.2f: Overwrite behavior is delegated to the OS dialog', async () => {
    mockExecResult(null, '/Users/test/exports/architecture.pdf\n');
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export/save-dialog',
      payload: {
        defaultPath: '/Users/test/exports',
        defaultFilename: 'architecture.pdf',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ path: '/Users/test/exports/architecture.pdf' });
    const scriptArg = (execFileMock.mock.calls[0]?.[1] as string[])?.[1] ?? '';
    expect(scriptArg).not.toContain('overwrite');

    await app.close();
  });

  it('TC-1.3a: Cancel returns null', async () => {
    mockExecResult(Object.assign(new Error('User cancelled'), { code: 1 }), '');
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'architecture.pdf',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();

    await app.close();
  });

  it('Non-TC: osascript errors return 500', async () => {
    mockExecResult(new Error('osascript failed'));
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export/save-dialog',
      payload: {
        defaultPath: '/Users/test/docs',
        defaultFilename: 'architecture.pdf',
      },
    });

    expect(response.statusCode).toBe(500);

    await app.close();
  });
});
