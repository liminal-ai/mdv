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
import {
  binaryMarkdown,
  blockquoteMarkdown,
  codeBlockMarkdown,
  emptyMarkdown,
  headingsMarkdown,
  horizontalRuleMarkdown,
  imageMarkdown,
  inlineFormattingMarkdown,
  linksMarkdown,
  listsMarkdown,
  longLineMarkdown,
  malformedMarkdown,
  mermaidMarkdown,
  rawHtmlMarkdown,
  scriptTagMarkdown,
  tableMarkdown,
  taskListMarkdown,
  wideTableMarkdown,
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

describe('file render route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodeFs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-2.1a: renders heading levels with scoped anchor ids', async () => {
    await withRenderedFile(headingsMarkdown, ({ response, document }) => {
      expect(response.statusCode).toBe(200);
      expect(document.querySelector('h1')?.id).toBe('heading-1');
      expect(document.querySelector('h2')?.id).toBe('heading-2');
      expect(document.querySelector('h3')?.id).toBe('heading-3');
      expect(document.querySelector('h4')?.id).toBe('heading-4');
      expect(document.querySelector('h5')?.id).toBe('heading-5');
      expect(document.querySelector('h6')?.id).toBe('heading-6');
    });
  });

  it('TC-2.2a: renders inline formatting elements', async () => {
    await withRenderedFile(inlineFormattingMarkdown, ({ body, document }) => {
      expect(document.querySelector('strong')?.textContent).toBe('bold');
      expect(document.querySelector('em')?.textContent).toBe('italic');
      expect(document.querySelector('s')?.textContent).toBe('strikethrough');
      expect(document.querySelector('code')?.textContent).toBe('inline code');
      expect(body.warnings).toEqual([]);
    });
  });

  it('TC-2.2b: renders horizontal rules', async () => {
    await withRenderedFile(horizontalRuleMarkdown, ({ document }) => {
      expect(document.querySelectorAll('hr')).toHaveLength(3);
    });
  });

  it('TC-2.3a: renders ordered and unordered lists', async () => {
    await withRenderedFile(listsMarkdown, ({ document }) => {
      expect(document.querySelectorAll('ul > li')).not.toHaveLength(0);
      expect(document.querySelectorAll('ol > li')).toHaveLength(3);
    });
  });

  it('TC-2.3b: renders nested lists', async () => {
    await withRenderedFile(listsMarkdown, ({ document }) => {
      expect(document.querySelector('ul ul li')?.textContent).toContain('nested 2a');
      expect(document.querySelector('ul ul ul li')?.textContent).toContain('deep nested');
    });
  });

  it('TC-2.4a: renders table structure with header and body rows', async () => {
    await withRenderedFile(tableMarkdown, ({ document }) => {
      expect(document.querySelector('table')).not.toBeNull();
      expect(document.querySelectorAll('thead th')).toHaveLength(3);
      expect(document.querySelectorAll('tbody td')).toHaveLength(6);
    });
  });

  it('TC-2.4b: preserves markdown table alignment markup', async () => {
    await withRenderedFile(tableMarkdown, ({ document }) => {
      const headerCells = [...document.querySelectorAll('thead th')];
      expect(headerCells.map((cell) => cell.getAttribute('style'))).toEqual([
        'text-align:left',
        'text-align:center',
        'text-align:right',
      ]);
    });
  });

  it('TC-2.4c: renders wide tables without truncating the column set', async () => {
    await withRenderedFile(wideTableMarkdown, ({ document }) => {
      expect(document.querySelectorAll('thead th')).toHaveLength(12);
      expect(document.querySelectorAll('tbody td')).toHaveLength(12);
    });
  });

  it('TC-2.5a: renders fenced code blocks inside pre and code tags', async () => {
    await withRenderedFile(codeBlockMarkdown, ({ document }) => {
      const codeBlocks = document.querySelectorAll('pre > code');
      expect(codeBlocks.length).toBeGreaterThanOrEqual(2);
      expect(codeBlocks[0]?.textContent).toContain('const x: number = 42;');
    });
  });

  it('TC-2.5b: preserves the fenced code language hint', async () => {
    await withRenderedFile(codeBlockMarkdown, ({ document }) => {
      expect(document.querySelector('pre > code.language-typescript')?.textContent).toContain(
        'const x: number = 42;',
      );
    });
  });

  it('TC-2.5c: renders indented code blocks with the same structure', async () => {
    await withRenderedFile(codeBlockMarkdown, ({ document }) => {
      const codeBlocks = [...document.querySelectorAll('pre > code')];
      expect(
        codeBlocks.some((codeBlock) => codeBlock.textContent?.includes('indented code block')),
      ).toBe(true);
    });
  });

  it('TC-2.6a: renders blockquotes', async () => {
    await withRenderedFile(blockquoteMarkdown, ({ document }) => {
      expect(document.querySelector('blockquote')?.textContent).toContain('Single blockquote');
    });
  });

  it('TC-2.6b: renders nested blockquotes', async () => {
    await withRenderedFile(blockquoteMarkdown, ({ document }) => {
      expect(document.querySelector('blockquote blockquote')?.textContent).toContain(
        'Nested blockquote',
      );
    });
  });

  it('TC-2.7a: renders external links as anchor tags', async () => {
    await withRenderedFile(linksMarkdown, ({ document }) => {
      expect(
        [...document.querySelectorAll('a')]
          .find((link) => link.textContent === 'External')
          ?.getAttribute('href'),
      ).toBe('https://example.com');
    });
  });

  it('TC-2.7b: renders anchor links targeting heading ids', async () => {
    await withRenderedFile(linksMarkdown, ({ document }) => {
      expect(
        [...document.querySelectorAll('a')]
          .find((link) => link.textContent === 'Anchor')
          ?.getAttribute('href'),
      ).toBe('#section-heading');
    });
  });

  it('TC-2.7c: renders links as identifiable anchors with href values', async () => {
    await withRenderedFile(linksMarkdown, ({ document }) => {
      expect(document.querySelectorAll('a')).toHaveLength(5);
      expect([...document.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
        'https://example.com',
        '#section-heading',
        './other.md',
        './other.md#heading',
        './diagram.svg',
      ]);
    });
  });

  it('TC-2.8a: renders task lists with disabled checkboxes', async () => {
    await withRenderedFile(taskListMarkdown, ({ document }) => {
      const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')];
      expect(checkboxes).toHaveLength(3);
      expect(checkboxes.every((checkbox) => checkbox.hasAttribute('disabled'))).toBe(true);
      expect(checkboxes[1]?.hasAttribute('checked')).toBe(true);
    });
  });

  it('TC-2.9a: preserves supported raw html elements', async () => {
    await withRenderedFile(rawHtmlMarkdown, ({ document }) => {
      expect(document.querySelector('details')).not.toBeNull();
      expect(document.querySelector('summary')?.textContent).toBe('Click me');
      expect(document.querySelector('kbd')?.textContent).toBe('Ctrl+C');
      expect(document.querySelector('sup')?.textContent).toBe('superscript');
      expect(document.querySelector('sub')?.textContent).toBe('subscript');
      expect(document.querySelector('br')).not.toBeNull();
    });
  });

  it('TC-2.9b: strips script tags during sanitization', async () => {
    await withRenderedFile(scriptTagMarkdown, ({ body, document }) => {
      expect(document.querySelector('script')).toBeNull();
      expect(body.html).not.toContain('alert(');
      expect(document.body.textContent).toContain('Normal content after script.');
    });
  });

  it('TC-2.10a: returns an empty html payload for empty files', async () => {
    await withRenderedFile(emptyMarkdown, ({ response, body }) => {
      expect(response.statusCode).toBe(200);
      expect(body.html).toBe('');
      expect(body.warnings).toEqual([]);
    });
  });

  it('TC-2.11a: wraps mermaid blocks in a placeholder container', async () => {
    await withRenderedFile(mermaidMarkdown, ({ document }) => {
      expect(document.querySelector('.mermaid-placeholder')).not.toBeNull();
      expect(document.querySelector('.mermaid-placeholder__label')?.textContent).toContain(
        'Mermaid diagram',
      );
      expect(document.querySelector('code.language-mermaid')?.textContent).toContain('graph TD');
    });
  });

  it('TC-9.2a: handles malformed markdown without crashing', async () => {
    await withRenderedFile(malformedMarkdown, ({ response, body }) => {
      expect(response.statusCode).toBe(200);
      expect(body.html).not.toBe('');
      expect(body.html).toContain('<p>');
    });
  });

  it('TC-9.2b: renders extremely long lines without a server error', async () => {
    await withRenderedFile(longLineMarkdown, ({ response, body }) => {
      expect(response.statusCode).toBe(200);
      expect(body.html.startsWith('<p>')).toBe(true);
      expect(body.html).toContain('x'.repeat(256));
    });
  });

  it('TC-9.2c: falls back gracefully for binary-like markdown content', async () => {
    await withRenderedFile(binaryMarkdown, ({ response, body, document }) => {
      expect(response.statusCode).toBe(200);
      expect(body.html).not.toBe('');
      expect(document.querySelector('h1')?.textContent).toBe('Binary Fixture');
    });
  });

  it('Non-TC: resets heading slugs between documents on the same route instance', async () => {
    const markdown = '# Heading';
    vi.mocked(fs.stat).mockResolvedValue(
      makeFileStat({ size: Buffer.byteLength(markdown, 'utf8'), modifiedAt: DEFAULT_MODIFIED_AT }),
    );
    vi.mocked(fs.realpath).mockImplementation(async (requestedPath) => requestedPath);
    vi.mocked(fs.readFile).mockResolvedValue(markdown);
    vi.mocked(nodeFs.existsSync).mockReturnValue(false);

    const app = await buildApp();

    try {
      const first = await app.inject({
        method: 'GET',
        url: `/api/file?path=${encodeURIComponent('/Users/leemoore/code/project/docs/one.md')}`,
      });
      const second = await app.inject({
        method: 'GET',
        url: `/api/file?path=${encodeURIComponent('/Users/leemoore/code/project/docs/two.md')}`,
      });

      expect(first.json().html).toContain('id="heading"');
      expect(second.json().html).toContain('id="heading"');
      expect(second.json().html).not.toContain('id="heading-1"');
    } finally {
      await app.close();
    }
  });

  it('Non-TC: escapes html entities inside code blocks', async () => {
    await withRenderedFile('```html\n<div>safe</div>\n```', ({ body, document }) => {
      expect(document.querySelector('pre > code')?.innerHTML).toContain(
        '&lt;div&gt;safe&lt;/div&gt;',
      );
      expect(body.html).not.toContain('<div>safe</div>');
    });
  });

  it('Non-TC: rewrites existing local images and reports placeholder warnings for blocked sources', async () => {
    await withRenderedFile(
      imageMarkdown,
      ({ body, document }) => {
        const imageSources = [...document.querySelectorAll('img')].map((image) =>
          image.getAttribute('src'),
        );
        expect(imageSources).toEqual([
          '/api/image?path=%2FUsers%2Fleemoore%2Fcode%2Fproject%2Fdocs%2Fimages%2Fdiagram.png',
          '/api/image?path=%2Ftmp%2Ftest%2Fimage.jpg',
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
            source: 'https://example.com/image.png',
            message: 'Remote image blocked: https://example.com/image.png',
          },
          {
            type: 'unsupported-format',
            source: './file.psd',
            message: 'Unsupported image format: .psd',
          },
        ]);
      },
      {
        existingPaths: [
          '/Users/leemoore/code/project/docs/images/diagram.png',
          '/tmp/test/image.jpg',
        ],
      },
    );
  });

  it('Non-TC: processes raw html img tags that use single-quoted src attributes', async () => {
    await withRenderedFile(
      "<img src='./raw.png' alt='Raw'>\n<img src='https://example.com/raw.png' alt='Remote raw'>",
      ({ body, document }) => {
        expect(document.querySelector('img')?.getAttribute('src')).toBe(
          '/api/image?path=%2FUsers%2Fleemoore%2Fcode%2Fproject%2Fdocs%2Fraw.png',
        );
        expect(document.querySelector('.image-placeholder')?.getAttribute('data-type')).toBe(
          'remote-blocked',
        );
        expect(body.warnings).toEqual([
          {
            type: 'remote-image-blocked',
            source: 'https://example.com/raw.png',
            message: 'Remote image blocked: https://example.com/raw.png',
          },
        ]);
      },
      {
        existingPaths: ['/Users/leemoore/code/project/docs/raw.png'],
      },
    );
  });

  it('Non-TC: processes raw html img tags when src uses whitespace around the equals sign', async () => {
    await withRenderedFile(
      '<img src = "./raw-space.png" alt="Raw spaced">\n' +
        '<img src = "https://example.com/raw-space.png" alt="Remote raw spaced">',
      ({ body, document }) => {
        expect(document.querySelector('img')?.getAttribute('src')).toBe(
          '/api/image?path=%2FUsers%2Fleemoore%2Fcode%2Fproject%2Fdocs%2Fraw-space.png',
        );
        expect(document.querySelector('.image-placeholder')?.getAttribute('data-type')).toBe(
          'remote-blocked',
        );
        expect(body.warnings).toEqual([
          {
            type: 'remote-image-blocked',
            source: 'https://example.com/raw-space.png',
            message: 'Remote image blocked: https://example.com/raw-space.png',
          },
        ]);
      },
      {
        existingPaths: ['/Users/leemoore/code/project/docs/raw-space.png'],
      },
    );
  });

  it('Non-TC: rewrites image references with query strings using the underlying file path', async () => {
    await withRenderedFile(
      '![Diagram](./diagram.png?v=1#section)',
      ({ body, document }) => {
        expect(document.querySelector('img')?.getAttribute('src')).toBe(
          '/api/image?path=%2FUsers%2Fleemoore%2Fcode%2Fproject%2Fdocs%2Fdiagram.png',
        );
        expect(body.warnings).toEqual([]);
      },
      {
        existingPaths: ['/Users/leemoore/code/project/docs/diagram.png'],
      },
    );
  });
});
