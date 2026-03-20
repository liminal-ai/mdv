import type { Stats } from 'node:fs';
import * as nodeFs from 'node:fs';
import * as fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    access: vi.fn(),
    stat: vi.fn(),
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    createReadStream: vi.fn(),
  };
});

import { buildApp } from '../../../src/server/app.js';

function makeFileStat(options: { isFile?: boolean } = {}): Stats {
  return {
    isFile: () => options.isFile ?? true,
  } as Stats;
}

function makeStream(content: string) {
  return Readable.from([content]) as unknown as nodeFs.ReadStream;
}

describe('image route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.access).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-3.1a: Proxy serves .png with Content-Type: image/png', async () => {
    const imagePath = '/tmp/test/diagram.png';
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(nodeFs.createReadStream).mockReturnValue(makeStream('png-bytes'));
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/image?path=${encodeURIComponent(imagePath)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['cache-control']).toBe('private, max-age=60');
    expect(response.body).toBe('png-bytes');

    await app.close();
  });

  it('TC-3.1b: Proxy serves absolute path image, returns 200', async () => {
    const imagePath = '/tmp/test/photo.jpg';
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(nodeFs.createReadStream).mockReturnValue(makeStream('jpeg-bytes'));
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/image?path=${encodeURIComponent(imagePath)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('jpeg-bytes');
    expect(nodeFs.createReadStream).toHaveBeenCalledWith(imagePath);

    await app.close();
  });

  it('Non-TC: Non-absolute path returns 400', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/image?path=${encodeURIComponent('relative/image.png')}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Path must be absolute',
      },
    });
    expect(nodeFs.createReadStream).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: Missing image (ENOENT) returns 404', async () => {
    const imagePath = '/tmp/test/missing.png';
    vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('Missing'), { code: 'ENOENT' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/image?path=${encodeURIComponent(imagePath)}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'FILE_NOT_FOUND',
        message: `Image not found: ${imagePath}`,
      },
    });
    expect(nodeFs.createReadStream).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: Permission denied (EACCES) returns 403', async () => {
    const imagePath = '/tmp/test/private.png';
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.access).mockRejectedValue(Object.assign(new Error('Denied'), { code: 'EACCES' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/image?path=${encodeURIComponent(imagePath)}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to read this image.',
      },
    });
    expect(nodeFs.createReadStream).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: SVG served with Content-Type: image/svg+xml', async () => {
    const imagePath = '/tmp/test/diagram.svg';
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(nodeFs.createReadStream).mockReturnValue(makeStream('<svg></svg>'));
    const app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/image?path=${encodeURIComponent(imagePath)}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/svg+xml');
    expect(response.body).toBe('<svg></svg>');

    await app.close();
  });
});
