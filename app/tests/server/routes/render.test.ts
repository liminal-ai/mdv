import type { Stats } from 'node:fs';
import * as nodeFs from 'node:fs';
import * as fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
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

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    statSync: vi.fn(),
  };
});

import { buildApp } from '../../../src/server/app.js';

const DOCUMENT_PATH = '/Users/test/docs/rendered.md';

function makeStat(): Stats {
  return {
    size: 0,
    mtime: new Date('2026-03-20T10:00:00Z'),
    isFile: () => true,
  } as Stats;
}

describe('render routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodeFs.statSync).mockImplementation(() => {
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-1.1e: Render from content returns HTML', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/render',
      payload: {
        content: '# Rendered\n\nBody copy.',
        documentPath: DOCUMENT_PATH,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      html: '<h1 id="rendered" tabindex="-1">Rendered</h1>\n<p>Body copy.</p>\n',
      warnings: [],
    });
    expect(vi.mocked(fs.readFile)).not.toHaveBeenCalled();

    await app.close();
  });

  it('Non-TC: documentPath is used for relative image resolution', async () => {
    vi.mocked(nodeFs.statSync).mockImplementation((candidate) => {
      if (String(candidate) === '/Users/test/docs/images/diagram.png') {
        return makeStat();
      }
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    });
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/render',
      payload: {
        content: '![Diagram](./images/diagram.png)',
        documentPath: DOCUMENT_PATH,
      },
    });

    const body = response.json();
    const document = new JSDOM(`<main>${body.html}</main>`).window.document;

    expect(response.statusCode).toBe(200);
    expect(document.querySelector('img')?.getAttribute('src')).toBe(
      '/api/image?path=%2FUsers%2Ftest%2Fdocs%2Fimages%2Fdiagram.png',
    );
    expect(body.warnings).toEqual([]);

    await app.close();
  });

  it('Non-TC: Missing image warnings are returned', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/render',
      payload: {
        content: '![Missing](./missing.png)',
        documentPath: DOCUMENT_PATH,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().warnings).toEqual([
      {
        type: 'missing-image',
        source: './missing.png',
        message: 'Missing image: ./missing.png',
      },
    ]);

    await app.close();
  });

  it('Non-TC: Mermaid placeholders are preserved in rendered content', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/render',
      payload: {
        content: '```mermaid\ngraph TD\n  A-->B\n```',
        documentPath: DOCUMENT_PATH,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().html).toContain('mermaid-placeholder');

    await app.close();
  });
});
