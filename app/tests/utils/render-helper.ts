import type { Stats } from 'node:fs';
import * as nodeFs from 'node:fs';
import * as fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import { buildApp } from '../../src/server/app.js';

const DEFAULT_DOCUMENT_PATH = '/Users/leemoore/code/project/docs/rendered.md';
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

export interface RenderTestContext {
  response: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>['inject']>>;
  body: {
    path: string;
    canonicalPath: string;
    filename: string;
    content: string;
    html: string;
    warnings: Array<{ type: string; source: string; message: string }>;
    modifiedAt: string;
    size: number;
  };
  document: Document;
}

export async function withRenderedFile(
  content: string,
  assertion: (context: RenderTestContext) => Promise<void> | void,
  options: {
    documentPath?: string;
    canonicalPath?: string;
    existingPaths?: Iterable<string>;
  } = {},
): Promise<void> {
  const documentPath = options.documentPath ?? DEFAULT_DOCUMENT_PATH;
  const existingPaths = new Set(options.existingPaths ?? []);

  vi.mocked(fs.stat).mockResolvedValue(
    makeFileStat({ size: Buffer.byteLength(content, 'utf8'), modifiedAt: DEFAULT_MODIFIED_AT }),
  );
  vi.mocked(fs.realpath).mockResolvedValue(options.canonicalPath ?? documentPath);
  vi.mocked(fs.readFile).mockResolvedValue(content);
  vi.mocked(nodeFs.statSync).mockImplementation((candidate) => {
    if (!existingPaths.has(String(candidate))) {
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }

    return makeFileStat();
  });

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
