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
  withDegradedContentMarkdown,
  withImagesMarkdown,
  withMermaidMarkdown,
} from '../../fixtures/export-samples.js';

const actualFsPromises =
  await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const actualNodeFs = await vi.importActual<typeof import('node:fs')>('node:fs');

const DEFAULT_MODIFIED_AT = '2026-03-21T00:00:00Z';
const HTML_SAVE_PATH = exportSavePath.replace(/\.pdf$/, '.html');
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
  format: 'html',
  overrides: Partial<Record<'path' | 'savePath' | 'theme', string>> = {},
) {
  return {
    path: mockState.documentPath,
    format,
    savePath: HTML_SAVE_PATH,
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
  format: 'html',
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

describe('export html routes', () => {
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
    'TC-5.1a: Self-contained HTML renders',
    async () => {
      configureSourceFile(plainTextMarkdown);

      const { response, body } = await runExport('html');
      const html = getWrittenHtml();

      expect(response.statusCode).toBe(200);
      expect(body).toMatchObject({ status: 'success', warnings: [] });
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<style>');
      expect(html).toContain('Architecture Overview');
      expect(html).toContain('This document describes the system architecture.');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.1b: CSS inlined',
    async () => {
      configureSourceFile(plainTextMarkdown);

      const { response, body } = await runExport('html');
      const html = getWrittenHtml();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(html).toContain('<style>');
      expect(html).not.toContain('<link rel="stylesheet"');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.1c: Images as base64',
    async () => {
      configureSourceFile(withImagesMarkdown, {
        existingImages: [
          '/Users/test/docs/images/system-diagram.png',
          '/Users/test/assets/sequence-flow.jpg',
        ],
        imageBuffers: {
          '/Users/test/docs/images/system-diagram.png': TINY_PNG_BUFFER,
          '/Users/test/assets/sequence-flow.jpg': TINY_PNG_BUFFER,
        },
      });

      const { response, body } = await runExport('html');
      const html = getWrittenHtml();
      const document = getHtmlDocument(html);
      const imageSources = [...document.querySelectorAll('img')].map((image) =>
        image.getAttribute('src'),
      );

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(imageSources).toHaveLength(2);
      expect(imageSources.every((src) => src?.startsWith('data:image/'))).toBe(true);
      expect(html).not.toContain('/api/image');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.2a: Visual parity theme applied',
    async () => {
      configureSourceFile(plainTextMarkdown);

      const { response, body } = await runExport('html', { theme: 'dark-default' });
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark-default');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.2b: Mermaid SVGs inline',
    async () => {
      configureSourceFile(withMermaidMarkdown);

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('.mermaid-diagram')).not.toBeNull();
      expect(document.querySelector('svg')).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.2c: Syntax highlighting present',
    async () => {
      configureSourceFile(withCodeBlocksMarkdown);

      const { response, body } = await runExport('html');
      const html = getWrittenHtml();
      const document = getHtmlDocument(html);

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('pre.shiki')).not.toBeNull();
      expect(html).toContain('style="color:');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.3a: External links preserved',
    async () => {
      configureSourceFile('[Link](https://example.com)');

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.3b: Relative md links preserved',
    async () => {
      configureSourceFile('[Design](./design.md)');

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('a')?.getAttribute('href')).toBe('./design.md');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.3c: Anchor links work',
    async () => {
      configureSourceFile(['## My Heading', '', '[Go](#my-heading)'].join('\n'));

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      expect(document.querySelector('a')?.getAttribute('href')).toBe('#my-heading');
      expect(document.querySelector('[id="my-heading"]')).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.4a: Missing images as placeholders',
    async () => {
      configureSourceFile(withDegradedContentMarkdown);

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'missing-image' })]),
      );
      expect(document.querySelector('.image-placeholder')).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-5.4b: Failed Mermaid fallback',
    async () => {
      configureSourceFile(withDegradedContentMarkdown);

      const { response, body } = await runExport('html');
      const document = getHtmlDocument(getWrittenHtml());

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'mermaid-error' })]),
      );
      expect(document.querySelector('.mermaid-error')).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );
});
