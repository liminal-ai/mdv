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
    writeFile: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
  };
});

import { buildApp } from '../../../src/server/app.js';

const DOCUMENT_PATH = '/Users/test/docs/story.md';
const DOCUMENT_DIR = '/Users/test/docs';
const MODIFIED_AT = '2026-03-20T10:00:00.000Z';
const NEW_MODIFIED_AT = '2026-03-20T10:05:00.000Z';

function makeStat(
  options: {
    modifiedAt?: string | Date;
    size?: number;
    isFile?: boolean;
    isDirectory?: boolean;
  } = {},
): Stats {
  return {
    size: options.size ?? 0,
    mtime: new Date(options.modifiedAt ?? MODIFIED_AT),
    isFile: () => options.isFile ?? true,
    isDirectory: () => options.isDirectory ?? false,
  } as Stats;
}

function buildPayload(
  overrides: Partial<{ path: string; content: string; expectedModifiedAt: string | null }> = {},
) {
  return {
    path: DOCUMENT_PATH,
    content: '# Story\n\nUpdated.',
    expectedModifiedAt: MODIFIED_AT,
    ...overrides,
  };
}

describe('file save routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockImplementation((async (candidate: fs.PathLike) => {
      const path = String(candidate);
      if (path === DOCUMENT_DIR) {
        return makeStat({ isFile: false, isDirectory: true });
      }
      if (path === DOCUMENT_PATH) {
        return makeStat({
          size: Buffer.byteLength('# Story\n\nUpdated.', 'utf8'),
          modifiedAt: MODIFIED_AT,
        });
      }
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }) as typeof fs.stat);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-3.1a: Save writes content to disk', async () => {
    let fileStatCalls = 0;
    vi.mocked(fs.stat).mockImplementation((async (candidate: fs.PathLike) => {
      const path = String(candidate);
      if (path === DOCUMENT_DIR) {
        return makeStat({ isFile: false, isDirectory: true });
      }
      if (path === DOCUMENT_PATH) {
        fileStatCalls += 1;
        return makeStat({
          size: Buffer.byteLength('# Story\n\nUpdated.', 'utf8'),
          modifiedAt: fileStatCalls === 1 ? MODIFIED_AT : NEW_MODIFIED_AT,
        });
      }
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }) as typeof fs.stat);
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload(),
    });

    expect(response.statusCode).toBe(200);
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      expect.stringMatching(/\/Users\/test\/docs\/\.story\.md\.\d+\.tmp$/),
      '# Story\n\nUpdated.',
      'utf-8',
    );
    expect(vi.mocked(fs.rename)).toHaveBeenCalledWith(
      expect.stringMatching(/\/Users\/test\/docs\/\.story\.md\.\d+\.tmp$/),
      DOCUMENT_PATH,
    );
    expect(response.json()).toEqual({
      path: DOCUMENT_PATH,
      modifiedAt: new Date(NEW_MODIFIED_AT).toISOString(),
      size: Buffer.byteLength('# Story\n\nUpdated.', 'utf8'),
    });

    await app.close();
  });

  it('TC-3.1c: Save when not dirty still succeeds', async () => {
    let fileStatCalls = 0;
    vi.mocked(fs.stat).mockImplementation((async (candidate: fs.PathLike) => {
      const path = String(candidate);
      if (path === DOCUMENT_DIR) {
        return makeStat({ isFile: false, isDirectory: true });
      }
      if (path === DOCUMENT_PATH) {
        fileStatCalls += 1;
        return makeStat({
          size: 8,
          modifiedAt: fileStatCalls === 1 ? MODIFIED_AT : NEW_MODIFIED_AT,
        });
      }
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }) as typeof fs.stat);
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload({ content: '# Story\n' }),
    });

    expect(response.statusCode).toBe(200);
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('TC-3.1e: Stale write returns 409 CONFLICT', async () => {
    vi.mocked(fs.stat)
      .mockResolvedValueOnce(makeStat({ isFile: false, isDirectory: true }))
      .mockResolvedValueOnce(makeStat({ modifiedAt: NEW_MODIFIED_AT }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload(),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'CONFLICT',
        message: `File changed on disk since last load: ${DOCUMENT_PATH}`,
      },
    });
    expect(vi.mocked(fs.writeFile)).not.toHaveBeenCalled();

    await app.close();
  });

  it('TC-3.3a: Permission denied returns 403', async () => {
    vi.mocked(fs.stat).mockImplementation((async (candidate: fs.PathLike) => {
      if (String(candidate) === DOCUMENT_DIR) {
        return makeStat({ isFile: false, isDirectory: true });
      }
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }) as typeof fs.stat);
    vi.mocked(fs.writeFile).mockRejectedValueOnce(
      Object.assign(new Error('Denied'), { code: 'EACCES' }),
    );
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload({ expectedModifiedAt: null }),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Denied',
      },
    });

    await app.close();
  });

  it('TC-3.3b: Disk full returns 507', async () => {
    vi.mocked(fs.stat).mockImplementation((async (candidate: fs.PathLike) => {
      if (String(candidate) === DOCUMENT_DIR) {
        return makeStat({ isFile: false, isDirectory: true });
      }
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }) as typeof fs.stat);
    vi.mocked(fs.writeFile).mockRejectedValueOnce(
      Object.assign(new Error('Disk full'), { code: 'ENOSPC' }),
    );
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload({ expectedModifiedAt: null }),
    });

    expect(response.statusCode).toBe(507);
    expect(response.json()).toEqual({
      error: {
        code: 'INSUFFICIENT_STORAGE',
        message: 'Disk full',
      },
    });

    await app.close();
  });

  it('TC-3.3c: Parent directory missing returns 404', async () => {
    vi.mocked(fs.stat).mockRejectedValueOnce(
      Object.assign(new Error('Missing'), { code: 'ENOENT' }),
    );
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload({ expectedModifiedAt: null }),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'PATH_NOT_FOUND',
        message: `Parent directory does not exist: ${DOCUMENT_DIR}`,
      },
    });

    await app.close();
  });

  it('Non-TC: Invalid path returns 400', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload({ path: 'relative.md', expectedModifiedAt: null }),
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

  it('Non-TC: Non-markdown extension returns 415', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload({
        path: '/Users/test/docs/story.txt',
        expectedModifiedAt: null,
      }),
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toEqual({
      error: {
        code: 'NOT_MARKDOWN',
        message: 'Not a markdown file (.txt): /Users/test/docs/story.txt',
      },
    });

    await app.close();
  });

  it('Non-TC: Atomic write cleanup removes temp file on failure', async () => {
    vi.mocked(fs.stat).mockImplementation((async (candidate: fs.PathLike) => {
      if (String(candidate) === DOCUMENT_DIR) {
        return makeStat({ isFile: false, isDirectory: true });
      }
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }) as typeof fs.stat);
    vi.mocked(fs.rename).mockRejectedValueOnce(new Error('rename failed'));
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload({ expectedModifiedAt: null }),
    });

    expect(response.statusCode).toBe(500);
    const tempPath = String(vi.mocked(fs.writeFile).mock.calls[0]?.[0] ?? '');
    expect(tempPath).toMatch(/\/Users\/test\/docs\/\.story\.md\.\d+\.tmp$/);
    expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith(tempPath);

    await app.close();
  });

  it('Non-TC: Save As to a new file succeeds without expectedModifiedAt', async () => {
    const newPath = '/Users/test/docs/new-story.md';
    vi.mocked(fs.stat).mockImplementation((async (candidate: fs.PathLike) => {
      const path = String(candidate);
      if (path === DOCUMENT_DIR) {
        return makeStat({ isFile: false, isDirectory: true });
      }
      if (path === newPath) {
        return makeStat({
          size: Buffer.byteLength('# New Story\n', 'utf8'),
          modifiedAt: NEW_MODIFIED_AT,
        });
      }
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }) as typeof fs.stat);
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload({
        path: newPath,
        content: '# New Story\n',
        expectedModifiedAt: null,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      expect.stringMatching(/\/Users\/test\/docs\/\.new-story\.md\.\d+\.tmp$/),
      '# New Story\n',
      'utf-8',
    );
    expect(response.json().path).toBe(newPath);

    await app.close();
  });

  it('Non-TC: Save overwrites an existing file', async () => {
    vi.mocked(fs.stat).mockImplementation((async (candidate: fs.PathLike) => {
      const path = String(candidate);
      if (path === DOCUMENT_DIR) {
        return makeStat({ isFile: false, isDirectory: true });
      }
      if (path === DOCUMENT_PATH) {
        return makeStat({ size: 22, modifiedAt: NEW_MODIFIED_AT });
      }
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }) as typeof fs.stat);
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload({
        content: '# Story\n\nOverwrite me.',
        expectedModifiedAt: null,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(vi.mocked(fs.rename)).toHaveBeenCalledWith(
      expect.stringMatching(/\/Users\/test\/docs\/\.story\.md\.\d+\.tmp$/),
      DOCUMENT_PATH,
    );

    await app.close();
  });

  it('Non-TC: Concurrent save mtime check prevents an overwrite after external modification', async () => {
    vi.mocked(fs.stat)
      .mockResolvedValueOnce(makeStat({ isFile: false, isDirectory: true }))
      .mockResolvedValueOnce(makeStat({ modifiedAt: '2026-03-20T10:00:01Z' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/api/file',
      payload: buildPayload(),
    });

    expect(response.statusCode).toBe(409);
    expect(vi.mocked(fs.rename)).not.toHaveBeenCalled();

    await app.close();
  });
});
