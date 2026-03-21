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
import {
  htmlTableWithBlockContent,
  tableWithEscapedPipes,
  tableWithFormattingMarkdown,
  tableWithListAttemptMarkdown,
  wideTableMarkdownEpic3,
} from '../../fixtures/markdown-samples.js';

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

interface RenderTestContext {
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

async function withRenderedFile(
  content: string,
  assertion: (context: RenderTestContext) => Promise<void> | void,
  options: {
    documentPath?: string;
    canonicalPath?: string;
    existingPaths?: Iterable<string>;
  } = {},
) {
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

describe('table rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodeFs.statSync).mockImplementation(() => {
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-4.1a: Inline formatting in cells', async () => {
    await withRenderedFile(tableWithFormattingMarkdown, ({ document }) => {
      const strikethroughCell = document.querySelector('td s') ?? document.querySelector('td del');

      expect(document.querySelector('td strong')?.textContent).toBe('Bold');
      expect(document.querySelector('td em')?.textContent).toBe('italic');
      expect(strikethroughCell?.textContent).toBe('struck');
      expect(document.querySelector('td code')?.textContent).toBe('code');
    });
  });

  it('TC-4.1b: Links in cells', async () => {
    await withRenderedFile(tableWithFormattingMarkdown, ({ document }) => {
      const link = document.querySelector('td a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('https://example.com');
    });
  });

  it('TC-4.1c: Code spans in cells', async () => {
    await withRenderedFile(tableWithFormattingMarkdown, ({ document }) => {
      const code = document.querySelector('td code');
      expect(code?.textContent).toBe('code');
      expect(code?.closest('pre.shiki')).toBeNull();
      expect(document.querySelector('td pre.shiki')).toBeNull();
    });
  });

  it('TC-4.2a: Mixed content widths', async () => {
    await withRenderedFile(tableWithFormattingMarkdown, ({ document }) => {
      const headers = [...document.querySelectorAll('thead th')];
      const cells = [...document.querySelectorAll('tbody td')];

      expect(headers).toHaveLength(3);
      expect(cells).toHaveLength(6);
      expect(headers.every((cell) => (cell.textContent ?? '').trim().length > 0)).toBe(true);
      expect(cells.every((cell) => (cell.textContent ?? '').trim().length > 0)).toBe(true);
    });
  });

  it('TC-4.2b: Many columns with complex content', async () => {
    await withRenderedFile(wideTableMarkdownEpic3, ({ document }) => {
      const headers = [...document.querySelectorAll('thead th')];
      const firstRowCells = [...document.querySelectorAll('tbody tr:first-child td')];

      expect(headers).toHaveLength(15);
      expect(firstRowCells).toHaveLength(15);
      expect(headers.every((cell) => (cell.textContent ?? '').trim().length > 0)).toBe(true);
      expect(firstRowCells.every((cell) => (cell.textContent ?? '').trim().length > 0)).toBe(true);
    });
  });

  it('TC-4.3a: List syntax in table cell', async () => {
    await withRenderedFile(tableWithListAttemptMarkdown, ({ document }) => {
      const listCell = document.querySelector('tbody tr td:last-child');
      expect(listCell?.textContent?.trim()).toBe('- item 1 - item 2');
      expect(listCell?.querySelector('ul')).toBeNull();
      expect(listCell?.querySelector('li')).toBeNull();
    });
  });

  it('TC-4.3b: HTML table with block content', async () => {
    await withRenderedFile(htmlTableWithBlockContent, ({ document }) => {
      expect(document.querySelector('table')).not.toBeNull();
      expect(document.querySelector('td ul')).not.toBeNull();
      expect(document.querySelectorAll('td li')).toHaveLength(2);
      expect(document.querySelector('td ul')?.textContent).toContain('First item');
      expect(document.querySelector('td ul')?.textContent).toContain('Second item');
    });
  });

  it('TC-4.3c: Pipe characters in cell content', async () => {
    await withRenderedFile(tableWithEscapedPipes, ({ document }) => {
      const headers = [...document.querySelectorAll('thead th')];
      const rows = [...document.querySelectorAll('tbody tr')];
      const cells = [...document.querySelectorAll('tbody td')];
      const firstRowCells = [...document.querySelectorAll('tbody tr:first-child td')];
      const secondRowCells = [...document.querySelectorAll('tbody tr:nth-child(2) td')];

      expect(headers).toHaveLength(2);
      expect(rows).toHaveLength(2);
      expect(cells).toHaveLength(4);
      expect(firstRowCells).toHaveLength(2);
      expect(secondRowCells).toHaveLength(2);
      expect(firstRowCells[0]?.textContent?.trim()).toBe('a | b');
      expect(firstRowCells[1]?.textContent?.trim()).toBe('union');
      expect(secondRowCells[0]?.textContent?.trim()).toBe('x | y');
      expect(secondRowCells[1]?.textContent?.trim()).toBe('code with pipe');
    });
  });

  it('Non-TC: Table with highlighted code spans', async () => {
    const markdown = `
| Snippet | Value |
|---------|-------|
| \`const x = 1\` | plain inline code |
`;

    await withRenderedFile(markdown, ({ document }) => {
      const code = document.querySelector('td code');
      expect(code?.textContent).toBe('const x = 1');
      expect(document.querySelectorAll('td code')).toHaveLength(1);
      expect(code?.closest('pre.shiki')).toBeNull();
      expect(document.querySelector('td pre.shiki')).toBeNull();
    });
  });

  it('Non-TC: Wide table with highlighted code', async () => {
    const markdown = `
| Col1 | Col2 | Col3 | Col4 | Col5 | Col6 | Col7 | Col8 | Col9 | Col10 | Col11 | Col12 | Col13 | Col14 | Col15 | Col16 |
|------|------|------|------|------|------|------|------|------|-------|-------|-------|-------|-------|-------|-------|
| \`a\` | data-2 | \`c\` | data-4 | \`e\` | data-6 | \`g\` | data-8 | \`i\` | data-10 | \`k\` | data-12 | \`m\` | data-14 | \`o\` | data-16 |
`;

    await withRenderedFile(markdown, ({ document }) => {
      const headers = [...document.querySelectorAll('thead th')];
      const firstRowCells = [...document.querySelectorAll('tbody tr:first-child td')];
      const codeSpans = [...document.querySelectorAll('tbody td code')];

      expect(headers.length).toBeGreaterThanOrEqual(15);
      expect(firstRowCells.length).toBeGreaterThanOrEqual(15);
      expect(codeSpans.length).toBeGreaterThan(0);
      expect(codeSpans.every((code) => code.closest('pre.shiki') === null)).toBe(true);
    });
  });
});
