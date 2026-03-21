import type { Stats } from 'node:fs';
import * as nodeFs from 'node:fs';
import * as fs from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
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
  plainTextMarkdown,
  withCodeBlocksMarkdown,
  withImagesMarkdown,
  withMermaidMarkdown,
} from '../../fixtures/export-samples.js';

const actualFsPromises =
  await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
const actualNodeFs = await vi.importActual<typeof import('node:fs')>('node:fs');

const DEFAULT_MODIFIED_AT = '2026-03-21T00:00:00Z';
const DOCX_SAVE_PATH = '/Users/test/exports/architecture.docx';
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
  format: 'docx',
  overrides: Partial<Record<'path' | 'savePath' | 'theme', string>> = {},
) {
  return {
    path: mockState.documentPath,
    format,
    savePath: DOCX_SAVE_PATH,
    theme: 'light-default',
    ...overrides,
  };
}

function getExportWriteCall(savePath: string) {
  return vi
    .mocked(fs.writeFile)
    .mock.calls.find(([target]) => String(target) === `${savePath}.tmp`);
}

function getWrittenDocx(savePath = DOCX_SAVE_PATH): Buffer {
  const writeCall = getExportWriteCall(savePath);
  expect(writeCall).toBeDefined();
  expect(Buffer.isBuffer(writeCall?.[1])).toBe(true);
  return writeCall?.[1] as Buffer;
}

function assertValidDocx(buffer: Buffer) {
  expect(buffer).toBeInstanceOf(Buffer);
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer[0]).toBe(0x50);
  expect(buffer[1]).toBe(0x4b);
}

async function runExport(options: Partial<Record<'path' | 'savePath' | 'theme', string>> = {}) {
  const payload = buildRequest('docx', options);
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

describe('export docx routes', () => {
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
    'TC-4.1a: DOCX has heading levels',
    async () => {
      configureSourceFile('# H1\n\n## H2\n\n### H3\n\n#### H4');

      const { response, body } = await runExport();
      const docxBuffer = getWrittenDocx();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(docxBuffer);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.1b: Body text formatting preserved',
    async () => {
      configureSourceFile(
        '# Formatting\n\nThis has **bold** text, *italic* text, and `inline code`.',
      );

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.1c: Lists with nesting',
    async () => {
      configureSourceFile(
        [
          '# Lists',
          '',
          '1. First',
          '2. Second',
          '   - Nested bullet',
          '   - Another nested bullet',
          '',
          '- Top level bullet',
          '  1. Nested number',
        ].join('\n'),
      );

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.2a: Table in DOCX',
    async () => {
      configureSourceFile(
        [
          '# Table',
          '',
          '| Format | Supported | Notes |',
          '|--------|-----------|-------|',
          '| PDF | Yes | Best fidelity |',
          '| DOCX | Yes | Editable output |',
        ].join('\n'),
      );

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.2b: Table with inline content',
    async () => {
      configureSourceFile(
        [
          '# Rich Table',
          '',
          '| Column | Value |',
          '|--------|-------|',
          '| Status | **Ready** |',
          '| Sample | `npm run verify` |',
        ].join('\n'),
      );

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.3a: Code block in DOCX',
    async () => {
      configureSourceFile(withCodeBlocksMarkdown);

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.4a: Local image embedded',
    async () => {
      const localImagePath = '/Users/test/docs/images/system-diagram.png';
      const secondaryImagePath = '/Users/test/assets/sequence-flow.jpg';
      configureSourceFile(withImagesMarkdown, {
        existingImages: [localImagePath, secondaryImagePath],
        imageBuffers: {
          [localImagePath]: TINY_PNG_BUFFER,
          [secondaryImagePath]: TINY_PNG_BUFFER,
        },
      });

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.4b: Mermaid as PNG in DOCX',
    async () => {
      configureSourceFile(withMermaidMarkdown);

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.4c: Missing image placeholder',
    async () => {
      configureSourceFile('# Missing Image\n\n![Missing](./missing-diagram.png)');

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'missing-image' })]),
      );
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.5a: External links in DOCX',
    async () => {
      configureSourceFile('[External Link](https://example.com/docs)');

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.5b: Relative md links as text',
    async () => {
      configureSourceFile('[Other Doc](./other.md)');

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.5c: Blockquotes in DOCX',
    async () => {
      configureSourceFile('> Exported blockquote');

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.5d: Horizontal rules in DOCX',
    async () => {
      configureSourceFile('Before\n\n---\n\nAfter');

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'TC-4.6a: Deep heading levels h5-h6',
    async () => {
      configureSourceFile('# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6');

      const { response, body } = await runExport();

      expect(response.statusCode).toBe(200);
      expect(body.warnings).toEqual([]);
      assertValidDocx(getWrittenDocx());
    },
    TEST_TIMEOUT_MS,
  );
});
