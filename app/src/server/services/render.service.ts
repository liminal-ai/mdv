import { existsSync } from 'node:fs';
import path from 'node:path';
import DOMPurify from 'isomorphic-dompurify';
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItTaskLists from 'markdown-it-task-lists';
import type { RenderWarning } from '../schemas/index.js';

const IMG_TAG_RE = /<img\s+([^>]*?)src\s*=\s*(["'])(.*?)\2([^>]*?)>/gi;
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

function createRenderer(slugger: GithubSlugger): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  });

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
    (_match, pre: string, _quote: string, src: string, post: string) => {
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

      if (!existsSync(normalizedPath)) {
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

export class RenderService {
  private readonly slugger: GithubSlugger;
  private readonly markdownIt: MarkdownIt;

  constructor() {
    this.slugger = new GithubSlugger();
    this.markdownIt = createRenderer(this.slugger);
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
}
