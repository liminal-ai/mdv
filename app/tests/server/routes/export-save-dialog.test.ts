import { exec } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../src/server/app.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    exec: vi.fn(),
  };
});

const execMock = vi.mocked(exec);

function mockExecResult(
  error: (Error & { code?: number }) | null,
  stdout = '/Users/test/exports/selected-file.pdf\n',
) {
  execMock.mockImplementation(((command, options, callback) => {
    const done = typeof options === 'function' ? options : callback;
    done?.(error, stdout, '');
    return {} as never;
  }) as typeof exec);
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
    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('default name "architecture.pdf"'),
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

    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('default location POSIX file "/Users/test/docs"'),
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

    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('default location POSIX file "/Users/test/exports"'),
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

    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('default name "readme.docx"'),
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

    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('default name "notes.html"'),
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
    expect(execMock.mock.calls[0]?.[0]).not.toContain('overwrite');

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
