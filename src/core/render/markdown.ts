import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { load } from 'cheerio';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';

import {
  DiagramAsset,
  MermaidRenderer,
  RenderRequest,
  RenderResult,
  RenderWarning
} from '../types';

interface DiagramSource {
  id: string;
  source: string;
}

const PAGE_BREAK_MARKER = '<!-- pagebreak -->';
const PAGE_BREAK_SENTINEL = '[[MDV_PAGE_BREAK]]';

function preprocessPageBreakMarkers(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => (line.trim() === PAGE_BREAK_MARKER ? PAGE_BREAK_SENTINEL : line))
    .join('\n');
}

function injectPageBreakDivs(html: string): string {
  const pageBreakDiv = '<div class="page-break" style="page-break-after: always;"></div>';
  return html
    .replaceAll(`<p>${PAGE_BREAK_SENTINEL}</p>`, pageBreakDiv)
    .replaceAll(PAGE_BREAK_SENTINEL, pageBreakDiv);
}

function createMarkdownParser(diagrams: DiagramSource[]): MarkdownIt {
  const highlight = (code: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre><code class="hljs language-${lang}">${hljs.highlight(code, { language: lang }).value}</code></pre>`;
    }
    return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
  };

  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight
  });

  const defaultFence = md.renderer.rules.fence?.bind(md.renderer.rules);

  md.renderer.rules.fence = (tokens: any[], idx: number, options: unknown, env: unknown, self: any) => {
    const token = tokens[idx] as { info?: string; content: string } | undefined;
    if (!token) {
      return '';
    }
    const rawInfo = token.info || '';
    const language = rawInfo.trim().split(/\s+/)[0]?.toLowerCase() ?? '';

    if (language === 'mermaid') {
      const id = `diagram-${diagrams.length + 1}`;
      diagrams.push({ id, source: token.content });
      return `<div class="mdv-mermaid-placeholder" data-diagram-id="${id}"></div>`;
    }

    if (defaultFence) {
      return defaultFence(tokens, idx, options as never, env as never, self);
    }

    return self.renderToken(tokens, idx, options);
  };

  return md;
}

function blockRemoteImages(html: string, warnings: RenderWarning[]): string {
  const $ = load(html);

  $('img').each((_, element) => {
    const src = ($(element).attr('src') || '').trim();
    if (!src) {
      return;
    }

    const isRemote = /^(https?:)?\/\//i.test(src);
    if (!isRemote) {
      return;
    }

    warnings.push({
      code: 'REMOTE_IMAGE_BLOCKED',
      message: `Blocked remote image: ${src}`,
      location: src
    });

    $(element).replaceWith(
      `<div class="mdv-warning">Remote image blocked in offline mode: <code>${escapeHtml(src)}</code></div>`
    );
  });

  return $('body').html() || $.root().html() || '';
}

function applyDiagramResults(
  html: string,
  diagrams: DiagramAsset[],
  warnings: RenderWarning[],
  mode: 'preview' | 'export'
): string {
  const $ = load(html);

  $('.mdv-mermaid-placeholder').each((_, node) => {
    const id = ($(node).attr('data-diagram-id') || '').trim();
    const diagram = diagrams.find((item) => item.id === id);
    if (!diagram) {
      $(node).replaceWith('<div class="mdv-warning">Missing Mermaid diagram metadata.</div>');
      return;
    }

    if (!diagram.svgContent) {
      warnings.push({
        code: 'MERMAID_RENDER_FAILED',
        message: `Mermaid render failed for ${diagram.id}`,
        location: diagram.id
      });
      $(node).replaceWith(
        `<div class="mdv-warning">Mermaid render failed for ${diagram.id}. Showing source block.</div><pre><code class="language-mermaid">${escapeHtml(diagram.source)}</code></pre>`
      );
      return;
    }

    if (mode === 'preview') {
      $(node).replaceWith(`<div class="mdv-mermaid-diagram">${diagram.svgContent}</div>`);
      return;
    }

    $(node).replaceWith(`<img src="./assets/${diagram.svgPath}" alt="Mermaid diagram ${diagram.id}">`);
  });

  return $('body').html() || $.root().html() || '';
}

function absolutizeLocalImagesForPreview(html: string, baseDir: string): string {
  const $ = load(html);

  $('img').each((_, element) => {
    const src = ($(element).attr('src') || '').trim();
    if (!src || /^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
      return;
    }

    const resolved = path.resolve(baseDir, src);
    $(element).attr('src', pathToFileURL(resolved).toString());
  });

  return $('body').html() || $.root().html() || '';
}

export async function renderMarkdown(
  request: RenderRequest,
  mermaidRenderer: MermaidRenderer
): Promise<RenderResult> {
  const warnings: RenderWarning[] = [];
  const diagrams: DiagramSource[] = [];
  const markdownWithPageBreaks = preprocessPageBreakMarkers(request.markdown);

  const parser = createMarkdownParser(diagrams);
  const initialHtml = parser.render(markdownWithPageBreaks);
  const htmlWithPageBreaks = injectPageBreakDivs(initialHtml);
  const sanitizedHtml = blockRemoteImages(htmlWithPageBreaks, warnings);

  const diagramAssets: DiagramAsset[] = [];
  for (let i = 0; i < diagrams.length; i += 1) {
    const item = diagrams[i];
    if (!item) {
      continue;
    }
    const svgPath = `diagram-${String(i + 1).padStart(3, '0')}.svg`;
    const result = await mermaidRenderer.renderDiagram(item.id, item.source);
    diagramAssets.push({
      id: item.id,
      source: item.source,
      svgPath,
      svgContent: result.ok ? result.svg : undefined
    });
  }

  const previewHtml = applyDiagramResults(sanitizedHtml, diagramAssets, warnings, 'preview');
  const previewWithLocalImages = absolutizeLocalImagesForPreview(previewHtml, request.baseDir);
  const exportHtml = applyDiagramResults(sanitizedHtml, diagramAssets, warnings, 'export');

  return {
    html: previewWithLocalImages,
    exportHtml,
    diagrams: diagramAssets,
    warnings,
    baseDir: request.baseDir,
    inputPath: request.inputPath
  };
}

export async function readMarkdownFile(inputPath: string): Promise<string> {
  return fs.readFile(inputPath, 'utf8');
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
