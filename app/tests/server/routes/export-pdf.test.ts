import type { Stats } from 'node:fs';
import * as nodeFs from 'node:fs';
import * as fs from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  documentPath: '',
  canonicalPath: '',
  documentContent: '',
  existingPaths: new Set<string>(),
  imageBuffers: new Map<string, Buffer>(),
}));

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

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    statSync: vi.fn(),
  };
});

import { buildApp } from '../../../src/server/app.js';
import {
  exportSamplePath,
  exportSavePath,
  plainTextMarkdown,
  withCodeBlocksMarkdown,
  withImagesMarkdown,
  withMermaidMarkdown,
} from '../../fixtures/export-samples.js';

const actualFsPromises =
  await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const actualNodeFs = await vi.importActual<typeof import('node:fs')>('node:fs');

const DEFAULT_MODIFIED_AT = '2026-03-21T00:00:00Z';
const HTML_SAVE_PATH = '/Users/test/exports/architecture.html';
const PDF_SAVE_PATH = exportSavePath;
const TEST_TIMEOUT_MS = 120_000;
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2pXl0AAAAASUVORK5CYII=',
  'base64',
);

function makeFileStat(
  options: { size?: number; modifiedAt?: string | Date; isFile?: boolean } = {},
): Stats {
  return {
    size: options.size ?? 100,
    mtime: new Date(options.modifiedAt ?? DEFAULT_MODIFIED_AT),
    isFile: () => options.isFile ?? true,
  } as Stats;
}

function resetMockState() {
  mockState.documentPath = exportSamplePath;
  mockState.canonicalPath = exportSamplePath;
  mockState.documentContent = plainTextMarkdown;
  mockState.existingPaths = new Set();
  mockState.imageBuffers = new Map();
}

function configureSourceFile(
  content: string,
  options: {
    path?: string;
    canonicalPath?: string;
    existingImages?: string[];
    imageBuffers?: Record<string, Buffer>;
  } = {},
) {
  mockState.documentPath = options.path ?? exportSamplePath;
  mockState.canonicalPath = options.canonicalPath ?? mockState.documentPath;
  mockState.documentContent = content;
  mockState.existingPaths = new Set(options.existingImages ?? []);
  mockState.imageBuffers = new Map(Object.entries(options.imageBuffers ?? {}));
}

function buildRequest(
  format: 'pdf' | 'html',
  overrides: Partial<Record<'path' | 'savePath' | 'theme', string>> = {},
) {
  return {
    path: mockState.documentPath,
    format,
    savePath: format === 'pdf' ? PDF_SAVE_PATH : HTML_SAVE_PATH,
    theme: 'light-default',
    ...overrides,
  };
}

function getExportWriteCall(savePath: string) {
  return vi
    .mocked(fs.writeFile)
    .mock.calls.find(([target]) => String(target) === `${savePath}.tmp`);
}

function getWrittenHtml(savePath = HTML_SAVE_PATH): string {
  const writeCall = getExportWriteCall(savePath);
  expect(writeCall).toBeDefined();
  expect(typeof writeCall?.[1]).toBe('string');
  return writeCall?.[1] as string;
}

function getWrittenPdf(savePath = PDF_SAVE_PATH): Buffer {
  const writeCall = getExportWriteCall(savePath);
  expect(writeCall).toBeDefined();
  expect(Buffer.isBuffer(writeCall?.[1])).toBe(true);
  return writeCall?.[1] as Buffer;
}

function getHtmlDocument(html: string): Document {
  return new JSDOM(html).window.document;
}

function getPdfContents(buffer: Buffer): string {
  return buffer.toString('latin1');
}

async function runExport(
  format: 'pdf' | 'html',
  options: Partial<Record<'path' | 'savePath' | 'theme', string>> = {},
) {
  const payload = buildRequest(format, options);
  const response = await app.inject({
    method: 'POST',
    url: '/api/export',
    payload,
  });

  return {
    response,
    body: response.json(),
    savePath: payload.savePath,
  };
}

let app: FastifyInstance;

describe('export pdf routes', () => {
  beforeAll(async () => {
    app = await buildApp();
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();

    vi.mocked(fs.stat).mockImplementation((async (candidate) => {
      if (String(candidate) === mockState.documentPath) {
        return makeFileStat({
          size: Buffer.byteLength(mockState.documentContent, 'utf8'),
          modifiedAt: DEFAULT_MODIFIED_AT,
        });
      }

      return actualFsPromises.stat(candidate as Parameters<typeof actualFsPromises.stat>[0]);
    }) as typeof fs.stat);

    vi.mocked(fs.realpath).mockImplementation((async (candidate) => {
      if (String(candidate) === mockState.documentPath) {
        return mockState.canonicalPath;
      }

      return actualFsPromises.realpath(
        candidate as Parameters<typeof actualFsPromises.realpath>[0],
      );
    }) as typeof fs.realpath);

    vi.mocked(fs.readFile).mockImplementation((async (...args) => {
      const [candidate, options] = args;
      const filePath = String(candidate);

      if (filePath === mockState.documentPath) {
        if (typeof options === 'string' || (typeof options === 'object' && options?.encoding)) {
          return mockState.documentContent;
        }

        return Buffer.from(mockState.documentContent, 'utf8');
      }

      const imageBuffer = mockState.imageBuffers.get(filePath);
      if (imageBuffer) {
        return imageBuffer;
      }

      return actualFsPromises.readFile(
        candidate as Parameters<typeof actualFsPromises.readFile>[0],
        options as Parameters<typeof actualFsPromises.readFile>[1],
      );
    }) as typeof fs.readFile);

    vi.mocked(fs.writeFile).mockImplementation((async (...args) => {
      const [candidate, data, options] = args;
      if (String(candidate).startsWith('/Users/test/exports/')) {
        return undefined;
      }

      return actualFsPromises.writeFile(
        candidate as Parameters<typeof actualFsPromises.writeFile>[0],
        data as Parameters<typeof actualFsPromises.writeFile>[1],
        options as Parameters<typeof actualFsPromises.writeFile>[2],
      );
    }) as typeof fs.writeFile);

    vi.mocked(fs.rename).mockImplementation((async (...args) => {
      const [oldPath, newPath] = args;
      if (
        String(oldPath).startsWith('/Users/test/exports/') ||
        String(newPath).startsWith('/Users/test/exports/')
      ) {
        return undefined;
      }

      return actualFsPromises.rename(
        oldPath as Parameters<typeof actualFsPromises.rename>[0],
        newPath as Parameters<typeof actualFsPromises.rename>[1],
      );
    }) as typeof fs.rename);

    vi.mocked(fs.unlink).mockImplementation((async (candidate) => {
      if (String(candidate).startsWith('/Users/test/exports/')) {
        return undefined;
      }

      return actualFsPromises.unlink(candidate as Parameters<typeof actualFsPromises.unlink>[0]);
    }) as typeof fs.unlink);

    vi.mocked(nodeFs.statSync).mockImplementation((candidate, options) => {
      if (mockState.existingPaths.has(String(candidate))) {
        return makeFileStat({ size: 100 });
      }

      return actualNodeFs.statSync(candidate, options);
    });
  });

  it(
    'TC-3.1a: PDF has margins',
    async () => {
      configureSourceFile(plainTextMarkdown);

      const { response, body } = await runExport('pdf');
      const pdfBuffer = getWrittenPdf();

      expect(response.statusCode).toBe(200);
      expect(body).toMatchObject({ status: 'success', warnings: [] });
      expect(pdfBuffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(pdfBuffer.length).toBeGreaterThan(2_000);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.1b: Body text is legible',
    async () => {
      configureSourceFile(fullTextMarkdown);

      const { response, body } = await runExport('pdf');
      const pdfBuffer = getWrittenPdf();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(pdfBuffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(pdfBuffer.length).toBeGreaterThan(4_000);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.1c: Default page size is Letter',
    async () => {
      configureSourceFile(plainTextMarkdown);

      const { response } = await runExport('pdf');
      const pdfContents = getPdfContents(getWrittenPdf());

      expect(response.statusCode).toBe(200);
      expect(pdfContents).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.2a: Heading stays with paragraph',
    async () => {
      configureSourceFile('# Export Heading\n\nThis paragraph should follow the heading.');

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('h1')?.getAttribute('data-mdv-layout')).toBe('keep-with-next');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.2b: Table rows not split',
    async () => {
      configureSourceFile(
        [
          '# Export Matrix',
          '',
          '| Format | Supported | Notes |',
          '|--------|-----------|-------|',
          '| PDF | Yes | Best fidelity |',
          '| DOCX | Yes | Editable output |',
        ].join('\n'),
      );

      const { response } = await runExport('html');
      const html = getWrittenHtml();
      const document = getHtmlDocument(html);

      expect(response.statusCode).toBe(200);
      expect(document.querySelector('table')).not.toBeNull();
      expect(html).toContain('@media print');
      expect(html).toContain('[data-mdv-layout="keep-together"]');
      expect(html).toContain('break-inside: avoid;');
      expect(html).toContain('page-break-inside: avoid;');
      expect(html).toContain('thead { display: table-header-group; }');
      expect(html).toContain('tr { break-inside: avoid;');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.2c: Short code blocks kept together',
    async () => {
      configureSourceFile(withCodeBlocksMarkdown);

      const { response } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(document.querySelector('pre')?.getAttribute('data-mdv-layout')).toBe('keep-together');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.2d: Images not split',
    async () => {
      const localImagePath = '/Users/test/docs/images/system-diagram.png';
      configureSourceFile(withImagesMarkdown, {
        existingImages: [localImagePath, '/Users/test/assets/sequence-flow.jpg'],
        imageBuffers: {
          [localImagePath]: TINY_PNG_BUFFER,
          '/Users/test/assets/sequence-flow.jpg': TINY_PNG_BUFFER,
        },
      });

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('img')?.getAttribute('data-mdv-layout')).toBe('keep-together');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.3a: Mermaid diagram in PDF',
    async () => {
      configureSourceFile(withMermaidMarkdown);

      const { response, body } = await runExport('html');
      const html = getWrittenHtml();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(html).toContain('class="mermaid-diagram"');
      expect(html).toContain('<svg');
      expect(html).not.toContain('<div class="mermaid-placeholder">');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.3b: Failed Mermaid in PDF',
    async () => {
      configureSourceFile(
        ['# Broken Diagram', '', '```mermaid', 'graph TD', '  Broken[broken', '```'].join('\n'),
      );

      const { response, body } = await runExport('html');
      const html = getWrittenHtml();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'mermaid-error' })]),
      );
      expect(html).toContain('class="mermaid-error"');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.4a: Highlighted code in PDF',
    async () => {
      configureSourceFile(withCodeBlocksMarkdown);

      const { response, body } = await runExport('html');
      const html = getWrittenHtml();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(html).toContain('class="shiki');
      expect(html).toContain('style="color:');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.5a: Local image embedded',
    async () => {
      const localImagePath = '/Users/test/docs/images/system-diagram.png';
      configureSourceFile('# Embedded Image\n\n![System Diagram](./images/system-diagram.png)', {
        existingImages: [localImagePath],
        imageBuffers: {
          [localImagePath]: TINY_PNG_BUFFER,
        },
      });

      const { response, body } = await runExport('pdf');
      const pdfBuffer = getWrittenPdf();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(pdfBuffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
      expect(pdfBuffer.length).toBeGreaterThan(2_000);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.5b: Missing image placeholder',
    async () => {
      configureSourceFile('# Missing Image\n\n![Missing](./missing-diagram.png)');

      const { response, body } = await runExport('pdf');
      const pdfBuffer = getWrittenPdf();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'missing-image' })]),
      );
      expect(pdfBuffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.6a: External links preserved',
    async () => {
      configureSourceFile('[External Link](https://example.com/docs)');

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('a')?.getAttribute('href')).toBe('https://example.com/docs');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.6b: Blockquotes styled',
    async () => {
      configureSourceFile('> Exported blockquote');

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('blockquote')?.textContent).toContain('Exported blockquote');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.6c: Horizontal rules present',
    async () => {
      configureSourceFile('Before\n\n---\n\nAfter');

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('hr')).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-3.6d: Relative md links as text',
    async () => {
      configureSourceFile('[Other Doc](./other.md)');

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());
      const link = document.querySelector('a');

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(link?.textContent).toBe('Other Doc');
      expect(link?.getAttribute('href')).toBe('./other.md');
    },
    TEST_TIMEOUT_MS,
  );
});

const fullTextMarkdown = `
# Architecture Overview

This document describes the export pipeline in a readable paragraph.

## Rendering

PDF output should preserve margins, spacing, and readable body text.

Another paragraph ensures the document has enough content for a real PDF render.
`;
