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
  generateLargeMarkdown,
  plainTextMarkdown,
  withCodeBlocksMarkdown,
  withDegradedContentMarkdown,
  withDetailsMarkdown,
  withFullyDegradedMarkdown,
  withInlineHtmlMarkdown,
  withTaskListMarkdown,
} from '../../fixtures/export-samples.js';

const actualFsPromises =
  await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const actualNodeFs = await vi.importActual<typeof import('node:fs')>('node:fs');

const DEFAULT_MODIFIED_AT = '2026-03-21T00:00:00Z';
const HTML_SAVE_PATH = exportSavePath.replace(/\.pdf$/, '.html');
const PDF_SAVE_PATH = exportSavePath;
const DOCX_SAVE_PATH = exportSavePath.replace(/\.pdf$/, '.docx');
const TEST_TIMEOUT_MS = 120_000;

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

function getDefaultSavePath(format: 'pdf' | 'docx' | 'html'): string {
  switch (format) {
    case 'pdf':
      return PDF_SAVE_PATH;
    case 'docx':
      return DOCX_SAVE_PATH;
    case 'html':
    default:
      return HTML_SAVE_PATH;
  }
}

function buildRequest(
  format: 'pdf' | 'docx' | 'html',
  overrides: Partial<Record<'path' | 'savePath' | 'theme', string>> = {},
) {
  return {
    path: mockState.documentPath,
    format,
    savePath: getDefaultSavePath(format),
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

function getHtmlDocument(html: string): Document {
  return new JSDOM(html).window.document;
}

async function runExport(
  format: 'pdf' | 'docx' | 'html',
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

describe('export fidelity routes', () => {
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
    'TC-6.1a: Consistent degraded content',
    async () => {
      configureSourceFile(withDegradedContentMarkdown);

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'missing-image' }),
          expect.objectContaining({ type: 'remote-image-blocked' }),
          expect.objectContaining({ type: 'mermaid-error' }),
        ]),
      );
      expect(document.querySelectorAll('.image-placeholder').length).toBeGreaterThanOrEqual(2);
      expect(document.querySelector('.mermaid-error')).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.1b: Blocked remote images in export',
    async () => {
      configureSourceFile('# Remote Image\n\n![Remote](https://example.com/image.png)');

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'remote-image-blocked' })]),
      );
      expect(
        document.querySelector('.image-placeholder[data-type="remote-blocked"]'),
      ).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.1c: Task list checkboxes exported',
    async () => {
      configureSourceFile(withTaskListMarkdown);

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());
      const checkboxes = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
      expect(checkboxes.some((checkbox) => checkbox.checked)).toBe(true);
      expect(checkboxes.some((checkbox) => !checkbox.checked)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.2a: PDF uses light scheme regardless of viewer theme',
    async () => {
      configureSourceFile(withCodeBlocksMarkdown);

      const { response, body } = await runExport('pdf', { theme: 'dark-default' });

      expect(response.statusCode).toBe(200);
      expect(body.status).toBe('success');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.2b: DOCX uses light scheme regardless of viewer theme',
    async () => {
      configureSourceFile(plainTextMarkdown);

      const { response, body } = await runExport('docx', { theme: 'dark-default' });

      expect(response.statusCode).toBe(200);
      expect(body.status).toBe('success');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.2c: HTML preserves active viewer theme',
    async () => {
      configureSourceFile(plainTextMarkdown);

      const { response, body } = await runExport('html', { theme: 'dark-cool' });
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.status).toBe('success');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark-cool');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.2d: PDF/DOCX consistent across viewer themes',
    async () => {
      configureSourceFile(plainTextMarkdown);

      const lightPdf = await runExport('pdf', { savePath: '/Users/test/exports/light-theme.pdf' });
      const darkPdf = await runExport('pdf', {
        savePath: '/Users/test/exports/dark-theme.pdf',
        theme: 'dark-default',
      });

      expect(lightPdf.response.statusCode).toBe(200);
      expect(lightPdf.body.status).toBe('success');
      expect(darkPdf.response.statusCode).toBe(200);
      expect(darkPdf.body.status).toBe('success');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.3a: details/summary expanded in PDF/DOCX',
    async () => {
      configureSourceFile(withDetailsMarkdown);

      const htmlExport = await runExport('html');
      const htmlDocument = getHtmlDocument(getWrittenHtml());
      const details = htmlDocument.querySelector('details');

      const pdfExport = await runExport('pdf', { savePath: '/Users/test/exports/details.pdf' });
      const docxExport = await runExport('docx', { savePath: '/Users/test/exports/details.docx' });

      expect(htmlExport.response.statusCode).toBe(200);
      expect(details).not.toBeNull();
      expect(details?.hasAttribute('open')).toBe(false);
      expect(htmlDocument.querySelector('summary')?.textContent).toBe('Click to expand');
      expect(htmlDocument.body.textContent).toContain(
        'This is the hidden content that should be visible in static exports.',
      );

      expect(pdfExport.response.statusCode).toBe(200);
      expect(pdfExport.body.status).toBe('success');
      expect(pdfExport.body.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'format-degradation' })]),
      );

      expect(docxExport.response.statusCode).toBe(200);
      expect(docxExport.body.status).toBe('success');
      expect(docxExport.body.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'format-degradation' })]),
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.3b: kbd rendered as code-like',
    async () => {
      configureSourceFile(withInlineHtmlMarkdown);

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());
      const kbdElements = [...document.querySelectorAll('kbd')];

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(kbdElements).toHaveLength(2);
      expect(kbdElements.map((element) => element.textContent)).toEqual(['Ctrl', 'C']);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.3c: details preserved in HTML',
    async () => {
      configureSourceFile(
        '# Preserved Details\n\n<details><summary>Expand</summary>Inner content</details>',
      );

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());
      const details = document.querySelector('details');

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(details).not.toBeNull();
      expect(details?.hasAttribute('open')).toBe(false);
      expect(document.querySelector('summary')?.textContent).toBe('Expand');
      expect(document.body.textContent).toContain('Inner content');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.3d: Inline HTML elements exported',
    async () => {
      configureSourceFile(withInlineHtmlMarkdown);

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('sub')?.textContent).toBe('2');
      expect(document.querySelector('sup')?.textContent).toBe('2');
      expect(document.querySelector('br')).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-6.4a: No hidden content surfaced',
    async () => {
      configureSourceFile(plainTextMarkdown);

      const { response, body } = await runExport('html');
      const html = getWrittenHtml();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(html).not.toContain('# Architecture Overview');
      expect(html).not.toContain('```');
      expect(html).not.toContain('![');
      expect(html).not.toContain('mdv:warning-panel-toggle');
      expect(html).not.toContain('export-result__warnings');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-7.2a: Large document exports',
    async () => {
      configureSourceFile(generateLargeMarkdown());

      const { response, body } = await runExport('pdf');

      expect(response.statusCode).toBe(200);
      expect(body.status).toBe('success');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-7.2b: Fully degraded document exports',
    async () => {
      configureSourceFile(withFullyDegradedMarkdown);

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.status).toBe('success');
      expect(body.warnings.length).toBeGreaterThanOrEqual(4);
      expect(body.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'missing-image' }),
          expect.objectContaining({ type: 'mermaid-error' }),
        ]),
      );
      expect(document.querySelector('.image-placeholder')).not.toBeNull();
      expect(document.querySelector('.mermaid-error')).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );
});
