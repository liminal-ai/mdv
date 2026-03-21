import type { Stats } from 'node:fs';
import * as nodeFs from 'node:fs';
import * as fs from 'node:fs/promises';
import puppeteer from 'puppeteer';
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

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    statSync: vi.fn(),
  };
});

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}));

const htmlToDocxMock = vi.hoisted(() => vi.fn(async () => Buffer.from('PK mock-docx export')));

vi.mock('@turbodocx/html-to-docx', () => ({
  default: htmlToDocxMock,
}));

import { buildApp } from '../../../src/server/app.js';
import {
  exportSamplePath,
  fullDocumentMarkdown,
  plainTextMarkdown,
  withDegradedContentMarkdown,
  withMermaidMarkdown,
} from '../../fixtures/export-samples.js';

const HTML_SAVE_PATH = '/Users/test/exports/architecture.html';
const PDF_SAVE_PATH = '/Users/test/exports/architecture.pdf';
const DOCX_SAVE_PATH = '/Users/test/exports/architecture.docx';
const DEFAULT_MODIFIED_AT = '2026-03-21T00:00:00Z';

const pageEvaluateMock = vi.fn();
const pageMock = {
  setContent: vi.fn(async () => undefined),
  addScriptTag: vi.fn(async () => undefined),
  evaluate: pageEvaluateMock,
  emulateMediaType: vi.fn(async () => undefined),
  pdf: vi.fn(async () => Buffer.from('%PDF-1.4 mocked export')),
  close: vi.fn(async () => undefined),
};
const browserMock = {
  newPage: vi.fn(async () => pageMock),
  close: vi.fn(async () => undefined),
};

function makeFileStat(
  options: { size?: number; modifiedAt?: string | Date; isFile?: boolean } = {},
): Stats {
  return {
    size: options.size ?? 0,
    mtime: new Date(options.modifiedAt ?? DEFAULT_MODIFIED_AT),
    isFile: () => options.isFile ?? true,
  } as Stats;
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
  const documentPath = options.path ?? exportSamplePath;
  const existingImages = new Set(options.existingImages ?? []);
  const imageBuffers = options.imageBuffers ?? {};

  vi.mocked(fs.stat).mockResolvedValue(
    makeFileStat({ size: Buffer.byteLength(content, 'utf8'), modifiedAt: DEFAULT_MODIFIED_AT }),
  );
  vi.mocked(fs.realpath).mockResolvedValue(options.canonicalPath ?? documentPath);
  vi.mocked(fs.readFile).mockImplementation((async (candidate) => {
    const filePath = String(candidate);
    if (filePath === documentPath) {
      return content;
    }

    return imageBuffers[filePath] ?? Buffer.from('image-bytes');
  }) as typeof fs.readFile);
  vi.mocked(nodeFs.statSync).mockImplementation((candidate) => {
    if (existingImages.has(String(candidate))) {
      return makeFileStat();
    }

    throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
  });
}

function buildDefaultRequest(
  overrides: Partial<Record<'path' | 'format' | 'savePath' | 'theme', string>> = {},
) {
  return {
    path: exportSamplePath,
    format: 'html',
    savePath: HTML_SAVE_PATH,
    theme: 'light-default',
    ...overrides,
  };
}

describe('export routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    pageEvaluateMock.mockImplementation(async (_fn, arg) => {
      if (typeof arg === 'string') {
        return undefined;
      }

      const diagramSource = (arg as { diagramSource?: string } | undefined)?.diagramSource ?? '';
      if (diagramSource.includes('Broken')) {
        throw new Error('Failed to render mermaid diagram');
      }

      return `<svg data-source="${diagramSource}"></svg>`;
    });
    vi.mocked(puppeteer.launch).mockResolvedValue(browserMock as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-1.1a: Export endpoint exists and accepts ExportRequest', async () => {
    configureSourceFile(plainTextMarkdown);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'success',
      outputPath: HTML_SAVE_PATH,
      warnings: [],
    });

    await app.close();
  });

  it('TC-1.1d: Export disabled when no document (404 for missing file)', async () => {
    vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('Missing'), { code: 'ENOENT' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'FILE_NOT_FOUND',
        message: `Source file not found: ${exportSamplePath}`,
      },
    });

    await app.close();
  });

  it('TC-1.1f: Export works for file opened outside root', async () => {
    configureSourceFile(plainTextMarkdown, { path: '/private/tmp/outside-root.md' });
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({
        path: '/private/tmp/outside-root.md',
        savePath: '/Users/test/exports/outside-root.html',
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().outputPath).toBe('/Users/test/exports/outside-root.html');

    await app.close();
  });

  it('TC-2.1a: Export returns ExportResponse on success', async () => {
    configureSourceFile(fullDocumentMarkdown, {
      existingImages: ['/Users/test/docs/images/system-diagram.png'],
      imageBuffers: {
        '/Users/test/docs/images/system-diagram.png': Buffer.from('png-bytes'),
      },
    });
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('success');
    expect(response.json().warnings).toEqual([]);

    await app.close();
  });

  it('TC-2.3c: Degraded export still produces file with warnings', async () => {
    configureSourceFile(withDegradedContentMarkdown);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'missing-image' }),
        expect.objectContaining({ type: 'remote-image-blocked' }),
        expect.objectContaining({ type: 'mermaid-error' }),
      ]),
    );
    expect(fs.writeFile).toHaveBeenCalled();

    await app.close();
  });

  it('TC-2.4a: Write permission denied returns 403', async () => {
    configureSourceFile(plainTextMarkdown);
    vi.mocked(fs.writeFile).mockRejectedValue(
      Object.assign(new Error('Denied'), { code: 'EACCES' }),
    );
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: {
        code: 'PERMISSION_DENIED',
        message: `Could not write export to ${HTML_SAVE_PATH}: permission denied.`,
      },
    });

    await app.close();
  });

  it('Non-TC: EPERM write failures also return 403', async () => {
    configureSourceFile(plainTextMarkdown);
    vi.mocked(fs.writeFile).mockRejectedValue(
      Object.assign(new Error('Operation not permitted'), { code: 'EPERM' }),
    );
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: {
        code: 'PERMISSION_DENIED',
        message: `Could not write export to ${HTML_SAVE_PATH}: permission denied.`,
      },
    });

    await app.close();
  });

  it('TC-2.4b: Export engine failure returns 500', async () => {
    configureSourceFile(withMermaidMarkdown);
    vi.mocked(puppeteer.launch).mockRejectedValue(new Error('Puppeteer failed'));
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('EXPORT_ERROR');
    expect(response.json().error.message).toContain(`Export failed for ${HTML_SAVE_PATH}:`);

    await app.close();
  });

  it('TC-2.4c: Disk full returns 507', async () => {
    configureSourceFile(plainTextMarkdown);
    vi.mocked(fs.writeFile).mockRejectedValue(Object.assign(new Error('Full'), { code: 'ENOSPC' }));
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(507);
    expect(response.json()).toEqual({
      error: {
        code: 'INSUFFICIENT_STORAGE',
        message: `Could not write export to ${HTML_SAVE_PATH}: insufficient disk space.`,
      },
    });

    await app.close();
  });

  it('TC-7.1a: App recovers from export failure', async () => {
    configureSourceFile(plainTextMarkdown);
    vi.mocked(fs.writeFile)
      .mockRejectedValueOnce(new Error('First export failed'))
      .mockResolvedValue(undefined);
    const app = await buildApp();

    const failedResponse = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });
    const recoveredResponse = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(failedResponse.statusCode).toBe(500);
    expect(recoveredResponse.statusCode).toBe(200);

    await app.close();
  });

  it('TC-7.1b: No partial files remain on failure', async () => {
    configureSourceFile(plainTextMarkdown);
    vi.mocked(fs.rename).mockRejectedValue(new Error('rename failed'));
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(500);
    expect(fs.unlink).toHaveBeenCalledWith(`${HTML_SAVE_PATH}.tmp`);

    await app.close();
  });

  it('TC-7.1c: Concurrent export prevention returns 409', async () => {
    configureSourceFile(plainTextMarkdown);
    const started = createDeferred<void>();
    const release = createDeferred<void>();
    vi.mocked(fs.writeFile).mockImplementation((async () => {
      started.resolve();
      await release.promise;
    }) as typeof fs.writeFile);
    const app = await buildApp();

    const firstRequest = app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    await started.promise;

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    release.resolve();
    const firstResponse = await firstRequest;

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json().error.code).toBe('EXPORT_IN_PROGRESS');
    expect(firstResponse.statusCode).toBe(200);

    await app.close();
  });

  it('TC-7.2c: Empty document export succeeds', async () => {
    configureSourceFile('');
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().warnings).toEqual([]);

    await app.close();
  });

  it('TC-7.2d: Source file changes during export uses content at read time', async () => {
    configureSourceFile('# Before export');
    const started = createDeferred<void>();
    const release = createDeferred<void>();
    let writtenHtml = '';
    vi.mocked(fs.writeFile).mockImplementation((async (target, data) => {
      started.resolve();
      if (String(target).endsWith('.tmp') && typeof data === 'string') {
        writtenHtml = data;
      }
      await release.promise;
    }) as typeof fs.writeFile);
    const app = await buildApp();

    const requestPromise = app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    await started.promise;
    vi.mocked(fs.readFile).mockResolvedValue('# After export');
    release.resolve();

    const response = await requestPromise;

    expect(response.statusCode).toBe(200);
    expect(writtenHtml).toContain('Before export');
    expect(writtenHtml).not.toContain('After export');

    await app.close();
  });

  it('Non-TC: Invalid path returns 400', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({ path: 'relative.md' }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_PATH');

    await app.close();
  });

  it('Non-TC: Invalid format returns 400', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: {
        path: exportSamplePath,
        format: 'zip',
        savePath: HTML_SAVE_PATH,
        theme: 'light-default',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_FORMAT');

    await app.close();
  });

  it('Non-TC: Successful PDF export writes file atomically', async () => {
    configureSourceFile(plainTextMarkdown);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({ format: 'pdf', savePath: PDF_SAVE_PATH }),
    });

    expect(response.statusCode).toBe(200);
    expect(fs.writeFile).toHaveBeenCalledWith(
      `${PDF_SAVE_PATH}.tmp`,
      Buffer.from('%PDF-1.4 mocked export'),
    );
    expect(fs.rename).toHaveBeenCalledWith(`${PDF_SAVE_PATH}.tmp`, PDF_SAVE_PATH);

    await app.close();
  });

  it('Non-TC: PDF export reuses a single browser for Mermaid SSR and PDF generation', async () => {
    configureSourceFile(withMermaidMarkdown);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({ format: 'pdf', savePath: PDF_SAVE_PATH }),
    });

    expect(response.statusCode).toBe(200);
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('Non-TC: Relative markdown links are flattened for PDF exports', async () => {
    configureSourceFile('[Other Doc](./other.md)');
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({ format: 'pdf', savePath: PDF_SAVE_PATH }),
    });

    expect(response.statusCode).toBe(200);
    expect(pageMock.setContent).toHaveBeenCalledWith(
      expect.not.stringContaining('href="./other.md"'),
      expect.objectContaining({ waitUntil: 'networkidle0' }),
    );
    expect(pageMock.setContent).toHaveBeenCalledWith(
      expect.stringContaining('Other Doc'),
      expect.objectContaining({ waitUntil: 'networkidle0' }),
    );

    await app.close();
  });

  it('Non-TC: Relative markdown links are flattened for uppercase Markdown extensions', async () => {
    configureSourceFile('[Other Doc](./README.MD)');
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({ format: 'pdf', savePath: PDF_SAVE_PATH }),
    });

    expect(response.statusCode).toBe(200);
    expect(pageMock.setContent).toHaveBeenCalledWith(
      expect.not.stringContaining('href="./README.MD"'),
      expect.objectContaining({ waitUntil: 'networkidle0' }),
    );
    expect(pageMock.setContent).toHaveBeenCalledWith(
      expect.stringContaining('Other Doc'),
      expect.objectContaining({ waitUntil: 'networkidle0' }),
    );

    await app.close();
  });

  it('Non-TC: Static exports emphasize summary elements inside details', async () => {
    configureSourceFile(
      '# Details\n\n<details><summary>Expand me</summary><p>Hidden content</p></details>',
    );
    const app = await buildApp();

    const pdfResponse = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({ format: 'pdf', savePath: PDF_SAVE_PATH }),
    });
    const docxResponse = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({ format: 'docx', savePath: DOCX_SAVE_PATH }),
    });

    expect(pdfResponse.statusCode).toBe(200);
    expect(pageMock.setContent).toHaveBeenCalledWith(
      expect.stringContaining('data-mdv-static-summary="true"'),
      expect.objectContaining({ waitUntil: 'networkidle0' }),
    );
    expect(docxResponse.statusCode).toBe(200);
    expect(htmlToDocxMock).toHaveBeenCalledWith(
      expect.stringContaining('data-mdv-static-summary="true"'),
      null,
      expect.any(Object),
    );

    await app.close();
  });

  it('Non-TC: Successful HTML export writes file atomically', async () => {
    configureSourceFile(plainTextMarkdown);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(200);
    expect(fs.writeFile).toHaveBeenCalledWith(
      `${HTML_SAVE_PATH}.tmp`,
      expect.stringContaining('<!doctype html>'),
      'utf8',
    );
    expect(fs.rename).toHaveBeenCalledWith(`${HTML_SAVE_PATH}.tmp`, HTML_SAVE_PATH);

    await app.close();
  });

  it('Non-TC: Successful DOCX export writes file atomically', async () => {
    configureSourceFile(plainTextMarkdown);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({ format: 'docx', savePath: DOCX_SAVE_PATH }),
    });

    expect(response.statusCode).toBe(200);
    const writeCall = vi
      .mocked(fs.writeFile)
      .mock.calls.find(([target]) => String(target) === `${DOCX_SAVE_PATH}.tmp`);

    expect(writeCall).toBeDefined();
    expect(Buffer.isBuffer(writeCall?.[1])).toBe(true);
    expect((writeCall?.[1] as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
    expect(fs.rename).toHaveBeenCalledWith(`${DOCX_SAVE_PATH}.tmp`, DOCX_SAVE_PATH);

    await app.close();
  });

  it('Non-TC: Relative markdown links are flattened for DOCX exports', async () => {
    configureSourceFile('[Other Doc](./other.md)');
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest({ format: 'docx', savePath: DOCX_SAVE_PATH }),
    });

    expect(response.statusCode).toBe(200);
    expect(htmlToDocxMock).toHaveBeenCalledWith(
      expect.not.stringContaining('href="./other.md"'),
      null,
      expect.any(Object),
    );
    expect(htmlToDocxMock).toHaveBeenCalledWith(
      expect.stringContaining('Other Doc'),
      null,
      expect.any(Object),
    );

    await app.close();
  });

  it('Non-TC: Warning sources are truncated to 200 characters', async () => {
    const longBrokenDiagram = ['```mermaid', `graph TD\n${'A-->B\n'.repeat(80)}Broken[broken`, '```'].join(
      '\n',
    );
    configureSourceFile(`# Mermaid\n\n${longBrokenDiagram}`);
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/export',
      payload: buildDefaultRequest(),
    });

    expect(response.statusCode).toBe(200);
    const warning = response
      .json()
      .warnings.find((item: { type: string }) => item.type === 'mermaid-error');
    expect(warning.source.length).toBeLessThanOrEqual(200);

    await app.close();
  });
});
