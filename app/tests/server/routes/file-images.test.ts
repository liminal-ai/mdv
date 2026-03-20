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
    existsSync: vi.fn(),
  };
});

import { buildApp } from '../../../src/server/app.js';

const DEFAULT_DOCUMENT_PATH = '/Users/leemoore/code/project/docs/images.md';
const DEFAULT_MODIFIED_AT = '2026-03-19T00:00:00Z';

function makeFileStat(
  options: { size?: number; modifiedAt?: string | Date; isFile?: boolean } = {},
): Stats {
  return {
    size: options.size ?? 0,
    mtime: new Date(options.modifiedAt ?? DEFAULT_MODIFIED_AT),
    isFile: () => options.isFile ?? true,
  } as Stats;
}

interface RenderedFileContext {
  response: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>['inject']>>;
  body: {
    html: string;
    warnings: Array<{ type: string; source: string; message: string }>;
  };
  document: Document;
}

async function withRenderedFile(
  content: string,
  assertion: (context: RenderedFileContext) => Promise<void> | void,
  options: {
    documentPath?: string;
    existingPaths?: Iterable<string>;
  } = {},
) {
  const documentPath = options.documentPath ?? DEFAULT_DOCUMENT_PATH;
  const existingPaths = new Set(options.existingPaths ?? []);

  vi.mocked(fs.stat).mockResolvedValue(
    makeFileStat({ size: Buffer.byteLength(content, 'utf8'), modifiedAt: DEFAULT_MODIFIED_AT }),
  );
  vi.mocked(fs.realpath).mockResolvedValue(documentPath);
  vi.mocked(fs.readFile).mockResolvedValue(content);
  vi.mocked(nodeFs.existsSync).mockImplementation((candidate) =>
    existingPaths.has(String(candidate)),
  );

  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: `/api/file?path=${encodeURIComponent(documentPath)}`,
    });
    const body = response.json();
    const document = new JSDOM(`<main>${body.html}</main>`).window.document;

    await assertion({
      response,
      body,
      document,
    });
  } finally {
    await app.close();
  }
}

describe('file image handling route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodeFs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-3.1a: Relative image src rewritten to proxy URL', async () => {
    await withRenderedFile(
      '![Diagram](./images/diagram.png)',
      ({ response, body, document }) => {
        expect(response.statusCode).toBe(200);
        expect(document.querySelector('img')?.getAttribute('src')).toBe(
          '/api/image?path=%2FUsers%2Fleemoore%2Fcode%2Fproject%2Fdocs%2Fimages%2Fdiagram.png',
        );
        expect(body.warnings).toEqual([]);
      },
      {
        existingPaths: ['/Users/leemoore/code/project/docs/images/diagram.png'],
      },
    );
  });

  it('TC-3.1b: Absolute image src rewritten to proxy URL', async () => {
    await withRenderedFile(
      '![Absolute](/tmp/test/image.jpg)',
      ({ response, body, document }) => {
        expect(response.statusCode).toBe(200);
        expect(document.querySelector('img')?.getAttribute('src')).toBe(
          '/api/image?path=%2Ftmp%2Ftest%2Fimage.jpg',
        );
        expect(body.warnings).toEqual([]);
      },
      {
        existingPaths: ['/tmp/test/image.jpg'],
      },
    );
  });

  it('TC-3.2a: Missing image replaced with placeholder div', async () => {
    await withRenderedFile('![Missing](./missing.png)', ({ response, body, document }) => {
      expect(response.statusCode).toBe(200);
      expect(document.querySelector('img')).toBeNull();
      expect(document.querySelector('.image-placeholder')?.getAttribute('data-type')).toBe(
        'missing',
      );
      expect(document.querySelector('.image-placeholder')?.textContent).toContain('./missing.png');
      expect(body.warnings).toHaveLength(1);
    });
  });

  it('TC-3.2b: Unsupported format (.psd) shows placeholder and warning', async () => {
    await withRenderedFile('![PSD](./mockup.psd)', ({ body, document }) => {
      expect(document.querySelector('.image-placeholder')?.getAttribute('data-type')).toBe(
        'unsupported',
      );
      expect(document.querySelector('.image-placeholder')?.textContent).toContain('./mockup.psd');
      expect(body.warnings).toEqual([
        {
          type: 'unsupported-format',
          source: './mockup.psd',
          message: 'Unsupported image format: .psd',
        },
      ]);
    });
  });

  it('TC-3.2c: Missing image adds to warnings array', async () => {
    await withRenderedFile('![Missing](./missing.png)', ({ body }) => {
      expect(body.warnings).toEqual([
        {
          type: 'missing-image',
          source: './missing.png',
          message: 'Missing image: ./missing.png',
        },
      ]);
    });
  });

  it('TC-3.3a: Remote http image blocked with placeholder', async () => {
    await withRenderedFile('![Remote](http://example.com/image.png)', ({ body, document }) => {
      expect(document.querySelector('.image-placeholder')?.getAttribute('data-type')).toBe(
        'remote-blocked',
      );
      expect(document.querySelector('.image-placeholder')?.textContent).toContain(
        'http://example.com/image.png',
      );
      expect(body.warnings).toHaveLength(1);
    });
  });

  it('TC-3.3b: Remote https image adds to warnings array', async () => {
    await withRenderedFile('![Remote](https://example.com/image.png)', ({ body }) => {
      expect(body.warnings).toEqual([
        {
          type: 'remote-image-blocked',
          source: 'https://example.com/image.png',
          message: 'Remote image blocked: https://example.com/image.png',
        },
      ]);
    });
  });

  it('Non-TC: Multiple images (5) processed correctly with correct warning counts', async () => {
    await withRenderedFile(
      [
        '![Relative](./images/diagram.png)',
        '![Absolute](/tmp/test/absolute.jpg)',
        '![Missing](./missing.png)',
        '![Remote](http://example.com/blocked.png)',
        '![Unsupported](./mockup.psd)',
      ].join('\n\n'),
      ({ body, document }) => {
        expect(
          [...document.querySelectorAll('img')].map((image) => image.getAttribute('src')),
        ).toEqual([
          '/api/image?path=%2FUsers%2Fleemoore%2Fcode%2Fproject%2Fdocs%2Fimages%2Fdiagram.png',
          '/api/image?path=%2Ftmp%2Ftest%2Fabsolute.jpg',
        ]);
        expect(
          [...document.querySelectorAll('.image-placeholder')].map((placeholder) =>
            placeholder.getAttribute('data-type'),
          ),
        ).toEqual(['missing', 'remote-blocked', 'unsupported']);
        expect(body.warnings).toEqual([
          {
            type: 'missing-image',
            source: './missing.png',
            message: 'Missing image: ./missing.png',
          },
          {
            type: 'remote-image-blocked',
            source: 'http://example.com/blocked.png',
            message: 'Remote image blocked: http://example.com/blocked.png',
          },
          {
            type: 'unsupported-format',
            source: './mockup.psd',
            message: 'Unsupported image format: .psd',
          },
        ]);
      },
      {
        existingPaths: [
          '/Users/leemoore/code/project/docs/images/diagram.png',
          '/tmp/test/absolute.jpg',
        ],
      },
    );
  });
});
