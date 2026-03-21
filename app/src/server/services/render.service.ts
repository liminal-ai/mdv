import { statSync } from 'node:fs';
import path from 'node:path';
import DOMPurify from 'isomorphic-dompurify';
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';
import { fromHighlighter } from '@shikijs/markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItTaskLists from 'markdown-it-task-lists';
import { createHighlighter } from 'shiki';
import type { RenderWarning } from '../schemas/index.js';

const IMG_TAG_RE = /<img\s+([^>]*?)src\s*=\s*(?:(["'])(.*?)\2|([^>\s]+))([^>]*?)>/gi;
const MERMAID_RE = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi;

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.bmp',
  '.ico',
]);

export interface RenderResult {
  html: string;
  warnings: RenderWarning[];
}

type ImagePlaceholderType = 'missing' | 'remote-blocked' | 'unsupported';

const SHIKI_THEMES = {
  light: 'github-light',
  dark: 'github-dark',
} as const;

function isDarkTheme(themeId: string): boolean {
  return themeId.startsWith('dark');
}

function getShikiTheme(themeId: string): (typeof SHIKI_THEMES)[keyof typeof SHIKI_THEMES] {
  return isDarkTheme(themeId) ? SHIKI_THEMES.dark : SHIKI_THEMES.light;
}

const shikiHighlighterPromise = createHighlighter({
  themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
  langs: [
    'javascript',
    'typescript',
    'python',
    'go',
    'rust',
    'java',
    'c',
    'cpp',
    'sql',
    'yaml',
    'json',
    'bash',
    'html',
    'css',
    'markdown',
    'toml',
    'dockerfile',
  ],
  langAlias: {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    sh: 'bash',
    yml: 'yaml',
  },
});

async function createRenderer(
  slugger: GithubSlugger,
  options: { themeId?: string } = {},
): Promise<MarkdownIt> {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  });

  const originalFence = md.renderer.rules.fence;
  const originalHighlight = md.options.highlight;
  const highlighter = await shikiHighlighterPromise;
  const shikiPlugin = options.themeId
    ? fromHighlighter(highlighter, {
        theme: getShikiTheme(options.themeId),
        fallbackLanguage: undefined,
      })
    : fromHighlighter(highlighter, {
        themes: SHIKI_THEMES,
        defaultColor: false,
        fallbackLanguage: undefined,
      });

  md.use(shikiPlugin);

  const shikiHighlight = md.options.highlight;
  md.options.highlight = (code, lang, attrs) => {
    const normalizedLang = lang.trim().toLowerCase();

    if (!normalizedLang || normalizedLang === 'mermaid') {
      return '';
    }

    return shikiHighlight ? shikiHighlight(code, normalizedLang, attrs) : '';
  };

  const shikiFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    try {
      return shikiFence
        ? shikiFence(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    } catch {
      const previousHighlight = md.options.highlight;
      md.options.highlight = originalHighlight;

      try {
        return originalFence
          ? originalFence(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options);
      } finally {
        md.options.highlight = previousHighlight;
      }
    }
  };

  md.use(markdownItTaskLists, {
    enabled: false,
    label: true,
  });

  md.use(markdownItAnchor, {
    slugify: (value: string) => slugger.slug(value),
  });

  return md;
}

function processMermaidBlocks(html: string): string {
  return html.replace(MERMAID_RE, (_match, content: string) => {
    return (
      '<div class="mermaid-placeholder">' +
      '<div class="mermaid-placeholder__label">Mermaid diagram (rendering available in a future update)</div>' +
      `<pre><code class="language-mermaid">${content}</code></pre>` +
      '</div>'
    );
  });
}

function processImages(html: string, documentDir: string): RenderResult {
  const warnings: RenderWarning[] = [];

  const processedHtml = html.replace(
    IMG_TAG_RE,
    (
      _match,
      pre: string,
      _quote: string | undefined,
      quotedSrc: string | undefined,
      unquotedSrc: string | undefined,
      post: string,
    ) => {
      const src = quotedSrc ?? unquotedSrc ?? '';

      if (src.startsWith('http://') || src.startsWith('https://')) {
        warnings.push({
          type: 'remote-image-blocked',
          source: src,
          message: `Remote image blocked: ${src}`,
        });
        return renderImagePlaceholder('remote-blocked', src);
      }

      const resolvedPath = path.isAbsolute(src) ? src : path.resolve(documentDir, src);
      const normalizedPath = stripQueryAndHash(resolvedPath);
      const extension = path.extname(normalizedPath).toLowerCase();

      if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
        warnings.push({
          type: 'unsupported-format',
          source: src,
          message: `Unsupported image format: ${extension || '(none)'}`,
        });
        return renderImagePlaceholder('unsupported', src);
      }

      let isFile = false;
      try {
        isFile = statSync(normalizedPath).isFile();
      } catch {
        // ENOENT or other error — treat as missing
      }

      if (!isFile) {
        warnings.push({
          type: 'missing-image',
          source: src,
          message: `Missing image: ${src}`,
        });
        return renderImagePlaceholder('missing', src);
      }

      const proxyUrl = `/api/image?path=${encodeURIComponent(normalizedPath)}`;
      return `<img ${pre}src="${proxyUrl}"${post}>`;
    },
  );

  return {
    html: processedHtml,
    warnings,
  };
}

function renderImagePlaceholder(type: ImagePlaceholderType, source: string): string {
  const labels: Record<ImagePlaceholderType, string> = {
    missing: 'Missing image',
    'remote-blocked': 'Remote image blocked',
    unsupported: 'Unsupported format',
  };

  return (
    `<div class="image-placeholder" data-type="${type}">` +
    `<span class="image-placeholder__text">${labels[type]}: ${escapeHtml(source)}</span>` +
    '</div>'
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripQueryAndHash(value: string): string {
  return value.replace(/[?#].*$/, '');
}

function setHtmlAttribute(attrs: string | undefined, name: string, value: string): string {
  const source = attrs ?? '';
  const attributePattern = new RegExp(`${name}\\s*=\\s*(".*?"|'.*?'|[^\\s>]+)`, 'i');

  if (attributePattern.test(source)) {
    return source.replace(attributePattern, `${name}="${value}"`);
  }

  return `${source} ${name}="${value}"`;
}

function countLinesFromHtml(content: string): number {
  const text = content.replace(/<[^>]+>/g, '').trim();
  if (!text) {
    return 0;
  }

  return text.split('\n').length;
}

function addLayoutHints(html: string): string {
  let hintedHtml = html.replace(
    /<(h[1-6])([^>]*)>/gi,
    (_match, tagName: string, attrs: string | undefined) =>
      `<${tagName}${setHtmlAttribute(attrs, 'data-mdv-layout', 'keep-with-next')}>`,
  );

  hintedHtml = hintedHtml.replace(
    /<pre([^>]*)>([\s\S]*?)<\/pre>/gi,
    (_match, attrs: string | undefined, content: string) => {
      const layout = countLinesFromHtml(content) < 15 ? 'keep-together' : 'allow-split';
      return `<pre${setHtmlAttribute(attrs, 'data-mdv-layout', layout)}>${content}</pre>`;
    },
  );

  hintedHtml = hintedHtml.replace(
    /<img([^>]*)>/gi,
    (_match, attrs: string | undefined) =>
      `<img${setHtmlAttribute(attrs, 'data-mdv-layout', 'keep-together')}>`,
  );

  return hintedHtml;
}

export class RenderService {
  private readonly slugger: GithubSlugger;
  private readonly markdownIt: MarkdownIt;
  private readonly exportMarkdownItByTheme = new Map<string, Promise<MarkdownIt>>();

  private constructor(slugger: GithubSlugger, markdownIt: MarkdownIt) {
    this.slugger = slugger;
    this.markdownIt = markdownIt;
  }

  static async create(): Promise<RenderService> {
    const slugger = new GithubSlugger();
    const markdownIt = await createRenderer(slugger);
    return new RenderService(slugger, markdownIt);
  }

  render(content: string, documentPath: string): RenderResult {
    this.slugger.reset();

    let html = this.markdownIt.render(content);
    html = processMermaidBlocks(html);

    const imageResult = processImages(html, path.dirname(documentPath));
    html = DOMPurify.sanitize(imageResult.html);

    return {
      html,
      warnings: imageResult.warnings,
    };
  }

  async renderForExport(
    content: string,
    documentPath: string,
    themeId: string,
  ): Promise<RenderResult> {
    this.slugger.reset();

    let markdownItPromise = this.exportMarkdownItByTheme.get(themeId);
    if (!markdownItPromise) {
      markdownItPromise = createRenderer(this.slugger, { themeId });
      this.exportMarkdownItByTheme.set(themeId, markdownItPromise);
    }

    const exportMarkdownIt = await markdownItPromise;

    let html = exportMarkdownIt.render(content);
    html = processMermaidBlocks(html);

    const imageResult = processImages(html, path.dirname(documentPath));
    html = addLayoutHints(imageResult.html);
    html = DOMPurify.sanitize(html);

    return {
      html,
      warnings: imageResult.warnings,
    };
  }
}
