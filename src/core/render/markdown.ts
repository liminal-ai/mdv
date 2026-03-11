import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { load } from 'cheerio';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';

import type {
  DiagramAsset,
  LayoutHint,
  MarkdownBlockKind,
  MermaidRenderer,
  NormalizedBlock,
  NormalizedDocument,
  RenderRequest,
  RenderResult,
  RenderWarning,
  RenderedBlock,
  ResolvedAsset,
  TableAlignment,
  TableCellModel,
  TableModel,
  TableRowModel
} from '../types';

interface DiagramSource {
  id: string;
  source: string;
}

interface ParsedMarkdownDocument {
  html: string;
  diagrams: DiagramSource[];
}

interface NormalizeContext {
  baseDir: string;
  diagramsById: Map<string, DiagramAsset>;
  warnings: RenderWarning[];
  assets: ResolvedAsset[];
  blockSignatureCounts: Map<string, number>;
  assetCounter: number;
}

const PAGE_BREAK_MARKER = '<!-- pagebreak -->';
const PAGE_BREAK_SENTINEL = '[[MDV_PAGE_BREAK]]';
const mermaidSvgCache = new Map<string, string | null>();

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

export function parseMarkdownDocument(markdown: string): ParsedMarkdownDocument {
  const diagrams: DiagramSource[] = [];
  const parser = createMarkdownParser(diagrams);
  const initialHtml = parser.render(preprocessPageBreakMarkers(markdown));
  return {
    html: injectPageBreakDivs(initialHtml),
    diagrams
  };
}

function isRemoteSource(src: string): boolean {
  return /^(https?:)?\/\//i.test(src);
}

function isDataSource(src: string): boolean {
  return src.startsWith('data:');
}

function resolvePreviewPath(baseDir: string, src: string): string {
  return pathToFileURL(path.resolve(baseDir, src)).toString();
}

function detectMime(src: string): string {
  const ext = path.extname(src).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function htmlFromRoot($: ReturnType<typeof load>): string {
  return $('body').html() || $.root().html() || '';
}

function blockRemoteImages(html: string, warnings: RenderWarning[]): string {
  const $ = load(html);

  $('img').each((_, element) => {
    const src = ($(element).attr('src') || '').trim();
    if (!src || !isRemoteSource(src)) {
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

  return htmlFromRoot($);
}

async function replaceMissingLocalImages(html: string, baseDir: string, warnings: RenderWarning[]): Promise<string> {
  const $ = load(html);
  const imageNodes = $('img').toArray();

  for (const node of imageNodes) {
    const src = ($(node).attr('src') || '').trim();
    if (!src || isRemoteSource(src) || isDataSource(src) || src.startsWith('./assets/') || src.startsWith('assets/')) {
      continue;
    }

    const resolved = path.resolve(baseDir, src);
    try {
      await fs.access(resolved);
    } catch {
      warnings.push({
        code: 'MISSING_LOCAL_IMAGE',
        message: `Missing local image: ${src}`,
        location: src
      });
      $(node).replaceWith(
        `<div class="mdv-missing-image">Missing local image: <code>${escapeHtml(src)}</code></div>`
      );
    }
  }

  return htmlFromRoot($);
}

async function renderMermaidDiagrams(
  diagrams: DiagramSource[],
  mermaidRenderer: MermaidRenderer
): Promise<DiagramAsset[]> {
  const diagramAssets: DiagramAsset[] = [];

  for (let i = 0; i < diagrams.length; i += 1) {
    const diagram = diagrams[i];
    if (!diagram) {
      continue;
    }

    const svgPath = `diagram-${String(i + 1).padStart(3, '0')}.svg`;
    let svgContent = mermaidSvgCache.get(diagram.source);
    if (svgContent === undefined) {
      const result = await mermaidRenderer.renderDiagram(diagram.id, diagram.source);
      svgContent = result.ok ? result.svg ?? null : null;
      mermaidSvgCache.set(diagram.source, svgContent);
    }

    diagramAssets.push({
      id: diagram.id,
      source: diagram.source,
      svgPath,
      svgContent: svgContent ?? undefined
    });
  }

  return diagramAssets;
}

function serializeNode($: ReturnType<typeof load>, node: any): string {
  return $.html(node) || '';
}

function extractInnerHtml($: ReturnType<typeof load>, html: string): string {
  const root = load(`<div id="mdv-fragment-root">${html}</div>`);
  return root('#mdv-fragment-root').html() || '';
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function createStableBlockId(
  kind: MarkdownBlockKind,
  signature: string,
  counts: Map<string, number>
): string {
  const currentCount = (counts.get(signature) ?? 0) + 1;
  counts.set(signature, currentCount);
  return `block-${kind}-${hashString(signature)}-${currentCount}`;
}

function hintClassName(hint: LayoutHint): string {
  switch (hint) {
    case 'keep-with-next':
      return 'mdv-keep-with-next';
    case 'keep-together':
      return 'mdv-keep-together';
    case 'allow-split':
      return 'mdv-allow-split';
    case 'figure':
      return 'mdv-figure-block';
    case 'table-header-repeat':
      return 'mdv-table-header-repeat';
  }
}

function renderBlockWrapper(
  id: string,
  kind: MarkdownBlockKind,
  layoutHints: LayoutHint[],
  innerHtml: string,
  extraClasses: string[] = []
): string {
  const classes = ['mdv-block', `mdv-block-${kind}`, ...layoutHints.map(hintClassName), ...extraClasses].join(' ');
  return `<section class="${classes}" data-block-id="${escapeHtml(id)}" data-block-kind="${escapeHtml(kind)}">${innerHtml}</section>`;
}

function decorateFragmentHtml(html: string): string {
  const $ = load(`<div id="mdv-fragment-root">${html}</div>`);

  $('#mdv-fragment-root h1, #mdv-fragment-root h2, #mdv-fragment-root h3, #mdv-fragment-root h4, #mdv-fragment-root h5, #mdv-fragment-root h6').each(
    (_, node) => {
      const tagName = node.tagName.toLowerCase();
      $(node).addClass(`mdv-heading mdv-heading-${tagName}`);
    }
  );
  $('#mdv-fragment-root p').addClass('mdv-paragraph');
  $('#mdv-fragment-root ul, #mdv-fragment-root ol').addClass('mdv-list');
  $('#mdv-fragment-root li').addClass('mdv-list-item');
  $('#mdv-fragment-root blockquote').addClass('mdv-blockquote');
  $('#mdv-fragment-root pre').addClass('mdv-code-block');
  $('#mdv-fragment-root pre code').addClass('mdv-code');
  $('#mdv-fragment-root a').addClass('mdv-link');
  $('#mdv-fragment-root img').addClass('mdv-content-image');

  return $('#mdv-fragment-root').html() || '';
}

function absolutizeLocalImagesForPreview(html: string, baseDir: string): string {
  const $ = load(`<div id="mdv-fragment-root">${html}</div>`);

  $('#mdv-fragment-root img').each((_, element) => {
    const src = ($(element).attr('src') || '').trim();
    if (!src || isRemoteSource(src) || isDataSource(src) || src.startsWith('./assets/') || src.startsWith('assets/')) {
      return;
    }

    $(element).attr('src', resolvePreviewPath(baseDir, src));
  });

  return $('#mdv-fragment-root').html() || '';
}

function detectAlignment(cell: any): TableAlignment {
  const style = String(cell.attr('style') || '').toLowerCase();
  const alignAttr = String(cell.attr('align') || '').toLowerCase();
  const raw = style.includes('text-align:')
    ? style.split('text-align:')[1]?.split(';')[0]?.trim() ?? ''
    : alignAttr.trim();

  if (raw === 'left' || raw === 'center' || raw === 'right') {
    return raw;
  }

  return 'default';
}

function buildTableRowModel(
  $: ReturnType<typeof load>,
  row: any,
  defaultHeader: boolean,
  alignments: TableAlignment[]
): TableRowModel {
  const cells: TableCellModel[] = [];

  $(row)
    .children('th, td')
    .each((columnIndex, cell) => {
      const isHeader = cell.tagName.toLowerCase() === 'th' || defaultHeader;
      const alignment = detectAlignment($(cell));
      if (!alignments[columnIndex]) {
        alignments[columnIndex] = alignment;
      }

      $(cell).addClass('mdv-table-cell');
      $(cell).addClass(isHeader ? 'mdv-table-heading-cell' : 'mdv-table-data-cell');
      $(cell).addClass(`mdv-align-${alignment}`);
      $(cell).attr('data-align', alignment);

      cells.push({
        html: $(cell).html() || '',
        text: $(cell).text().trim(),
        align: alignment,
        isHeader,
        columnIndex
      });
    });

  $(row).addClass('mdv-table-row');
  return { cells };
}

function normalizeTableNode($: ReturnType<typeof load>, tableNode: any): { html: string; model: TableModel } {
  const table = $(tableNode).clone();
  const alignments: TableAlignment[] = [];
  const headerRows: TableRowModel[] = [];
  const bodyRows: TableRowModel[] = [];

  table.addClass('mdv-table');
  table.find('caption').addClass('mdv-table-caption');

  const theadRows = table.find('thead tr').toArray();
  for (const row of theadRows) {
    headerRows.push(buildTableRowModel($, row, true, alignments));
  }

  const tbodyRows = table.find('tbody tr').toArray();
  for (const row of tbodyRows) {
    bodyRows.push(buildTableRowModel($, row, false, alignments));
  }

  if (theadRows.length === 0) {
    const fallbackRows = table.find('tr').toArray();
    for (let index = 0; index < fallbackRows.length; index += 1) {
      const row = fallbackRows[index];
      const modelRow = buildTableRowModel($, row, index === 0, alignments);
      if (index === 0) {
        headerRows.push(modelRow);
      } else {
        bodyRows.push(modelRow);
      }
    }
  }

  table.find('thead').addClass('mdv-table-head');
  table.find('tbody').addClass('mdv-table-body');
  table.find('tfoot').addClass('mdv-table-foot');

  return {
    html: `<div class="mdv-table-shell">${$.html(table)}</div>`,
    model: {
      alignments,
      headerRows,
      bodyRows
    }
  };
}

function buildWarningBlock(
  ctx: NormalizeContext,
  textContent: string,
  innerHtml: string,
  layoutHints: LayoutHint[] = ['keep-together']
): NormalizedBlock {
  const decorated = decorateFragmentHtml(innerHtml);
  const signature = `warning:${textContent}:${decorated}`;
  const id = createStableBlockId('warning', signature, ctx.blockSignatureCounts);

  return {
    id,
    kind: 'warning',
    textContent,
    layoutHints,
    previewHtml: renderBlockWrapper(id, 'warning', layoutHints, decorated),
    exportHtml: renderBlockWrapper(id, 'warning', layoutHints, decorated),
    signature
  };
}

function buildAssetId(ctx: NormalizeContext, kind: ResolvedAsset['kind'], seed: string): string {
  ctx.assetCounter += 1;
  return `${kind}-${ctx.assetCounter}-${hashString(seed)}`;
}

function buildResolvedImageBlock(
  $: ReturnType<typeof load>,
  node: any,
  ctx: NormalizeContext
): NormalizedBlock {
  const img = $(node).find('img').first();
  const src = (img.attr('src') || '').trim();
  const alt = (img.attr('alt') || '').trim();
  const asset: ResolvedAsset = {
    id: buildAssetId(ctx, 'local-image', src),
    kind: 'local-image',
    originalSrc: src,
    previewSrc: src ? resolvePreviewPath(ctx.baseDir, src) : undefined,
    exportSrc: src,
    alt,
    mime: detectMime(src)
  };
  ctx.assets.push(asset);

  const figurePreview = `
    <figure class="mdv-figure">
      <div class="mdv-figure-frame">
        <img class="mdv-figure-image" src="${escapeHtml(asset.previewSrc || src)}" alt="${escapeHtml(alt)}">
      </div>
    </figure>`;
  const figureExport = `
    <figure class="mdv-figure">
      <div class="mdv-figure-frame">
        <img class="mdv-figure-image" src="${escapeHtml(asset.exportSrc)}" alt="${escapeHtml(alt)}" data-mdv-asset-id="${escapeHtml(asset.id)}">
      </div>
    </figure>`;

  const signature = `image:${src}:${alt}`;
  const id = createStableBlockId('image', signature, ctx.blockSignatureCounts);
  const layoutHints: LayoutHint[] = ['keep-together', 'figure'];

  return {
    id,
    kind: 'image',
    textContent: alt,
    layoutHints,
    previewHtml: renderBlockWrapper(id, 'image', layoutHints, figurePreview),
    exportHtml: renderBlockWrapper(id, 'image', layoutHints, figureExport),
    signature,
    asset
  };
}

function buildMermaidBlock(
  $: ReturnType<typeof load>,
  node: any,
  ctx: NormalizeContext
): NormalizedBlock {
  const diagramId = ($(node).attr('data-diagram-id') || '').trim();
  const diagram = ctx.diagramsById.get(diagramId);
  if (!diagram || !diagram.svgContent) {
    const diagramSource = diagram?.source || diagramId;
    if (diagram) {
      ctx.warnings.push({
        code: 'MERMAID_RENDER_FAILED',
        message: `Mermaid render failed for ${diagram.id}`,
        location: diagram.id
      });
    }
    return buildWarningBlock(
      ctx,
      diagramSource,
      `<div class="mdv-warning">Mermaid render failed. Showing source block.</div><pre><code class="language-mermaid">${escapeHtml(diagramSource)}</code></pre>`
    );
  }

  const asset: ResolvedAsset = {
    id: buildAssetId(ctx, 'mermaid-diagram', diagram.id),
    kind: 'mermaid-diagram',
    originalSrc: diagram.id,
    exportSrc: `./assets/${diagram.svgPath}`,
    alt: `Mermaid diagram ${diagram.id}`,
    mime: 'image/svg+xml',
    svgContent: diagram.svgContent
  };
  ctx.assets.push(asset);

  const previewFigure = `
    <figure class="mdv-figure mdv-figure-mermaid">
      <div class="mdv-figure-frame mdv-mermaid-frame">${diagram.svgContent}</div>
    </figure>`;
  const exportFigure = `
    <figure class="mdv-figure mdv-figure-mermaid">
      <div class="mdv-figure-frame">
        <img class="mdv-figure-image mdv-mermaid-image" src="${escapeHtml(asset.exportSrc)}" alt="${escapeHtml(asset.alt)}" data-mdv-asset-id="${escapeHtml(asset.id)}">
      </div>
    </figure>`;

  const signature = `mermaid:${diagram.source}`;
  const id = createStableBlockId('mermaid', signature, ctx.blockSignatureCounts);
  const layoutHints: LayoutHint[] = ['keep-together', 'figure'];

  return {
    id,
    kind: 'mermaid',
    textContent: diagram.source,
    layoutHints,
    previewHtml: renderBlockWrapper(id, 'mermaid', layoutHints, previewFigure),
    exportHtml: renderBlockWrapper(id, 'mermaid', layoutHints, exportFigure),
    signature,
    asset
  };
}

function normalizeRootNode($: ReturnType<typeof load>, node: any, ctx: NormalizeContext): NormalizedBlock | null {
  if (node.type === 'text' && !String(node.data || '').trim()) {
    return null;
  }
  if (node.type !== 'tag') {
    return null;
  }

  const tagName = node.tagName.toLowerCase();
  const rawHtml = serializeNode($, node);
  const textContent = $(node).text().trim();

  if ($(node).hasClass('page-break')) {
    const signature = `page-break:${rawHtml}`;
    const id = createStableBlockId('page-break', signature, ctx.blockSignatureCounts);
    const layoutHints: LayoutHint[] = ['allow-split'];
    const content = '<div class="mdv-page-break-line" aria-hidden="true"></div>';
    return {
      id,
      kind: 'page-break',
      textContent: '',
      layoutHints,
      previewHtml: renderBlockWrapper(id, 'page-break', layoutHints, content),
      exportHtml: renderBlockWrapper(id, 'page-break', layoutHints, content),
      signature
    };
  }

  if ($(node).hasClass('mdv-warning') || $(node).hasClass('mdv-missing-image')) {
    return buildWarningBlock(ctx, textContent, rawHtml);
  }

  if (tagName === 'p') {
    const meaningfulChildren = $(node)
      .contents()
      .toArray()
      .filter((child) => !(child.type === 'text' && !String(child.data || '').trim()));

    if (meaningfulChildren.length === 0 && !textContent) {
      return null;
    }

    if (
      meaningfulChildren.length === 1 &&
      meaningfulChildren[0]?.type === 'tag' &&
      meaningfulChildren[0].tagName.toLowerCase() === 'img'
    ) {
      return buildResolvedImageBlock($, node, ctx);
    }
  }

  if (tagName === 'div' && $(node).hasClass('mdv-mermaid-placeholder')) {
    return buildMermaidBlock($, node, ctx);
  }

  let kind: MarkdownBlockKind = 'paragraph';
  let layoutHints: LayoutHint[] = ['allow-split'];
  let innerHtml = decorateFragmentHtml(rawHtml);
  let table: TableModel | undefined;

  if (/^h[1-6]$/.test(tagName)) {
    kind = 'heading';
    const level = Number(tagName.slice(1));
    layoutHints = level <= 3 ? ['keep-with-next'] : ['allow-split'];
  } else if (tagName === 'ul' || tagName === 'ol') {
    kind = 'list';
  } else if (tagName === 'table') {
    kind = 'table';
    layoutHints = ['allow-split', 'table-header-repeat'];
    const normalizedTable = normalizeTableNode($, node);
    innerHtml = normalizedTable.html;
    table = normalizedTable.model;
  } else if (tagName === 'pre') {
    kind = 'code';
    layoutHints = ['keep-together'];
  } else if (tagName === 'blockquote') {
    kind = 'blockquote';
    layoutHints = ['keep-together'];
  } else if (tagName === 'p') {
    kind = 'paragraph';
  }

  const previewInnerHtml = absolutizeLocalImagesForPreview(innerHtml, ctx.baseDir);
  const signatureSource = `${kind}:${textContent}:${extractInnerHtml($, innerHtml)}`;
  const signature = `${signatureSource}:${table ? JSON.stringify(table.alignments) : ''}`;
  const id = createStableBlockId(kind, signature, ctx.blockSignatureCounts);

  return {
    id,
    kind,
    textContent,
    layoutHints,
    previewHtml: renderBlockWrapper(id, kind, layoutHints, previewInnerHtml),
    exportHtml: renderBlockWrapper(id, kind, layoutHints, innerHtml),
    signature,
    table
  };
}

export async function normalizeMarkdownDocument(
  parsed: ParsedMarkdownDocument,
  request: RenderRequest,
  mermaidRenderer: MermaidRenderer,
  warnings: RenderWarning[]
): Promise<{ document: NormalizedDocument; diagrams: DiagramAsset[] }> {
  const diagramAssets = await renderMermaidDiagrams(parsed.diagrams, mermaidRenderer);
  const diagramsById = new Map(diagramAssets.map((diagram) => [diagram.id, diagram]));

  const blockedRemote = blockRemoteImages(parsed.html, warnings);
  const htmlWithExistingImages = await replaceMissingLocalImages(blockedRemote, request.baseDir, warnings);
  const $ = load(htmlWithExistingImages);
  const rootNodes = ($('body').children().length > 0 ? $('body').children() : $.root().children()).toArray();

  const ctx: NormalizeContext = {
    baseDir: request.baseDir,
    diagramsById,
    warnings,
    assets: [],
    blockSignatureCounts: new Map<string, number>(),
    assetCounter: 0
  };

  const blocks: NormalizedBlock[] = [];
  for (const node of rootNodes) {
    const block = normalizeRootNode($, node, ctx);
    if (block) {
      blocks.push(block);
    }
  }

  return {
    document: {
      blocks,
      assets: ctx.assets
    },
    diagrams: diagramAssets
  };
}

function toRenderedBlocks(blocks: NormalizedBlock[], surface: 'preview' | 'export'): RenderedBlock[] {
  return blocks.map((block) => ({
    id: block.id,
    kind: block.kind,
    html: surface === 'preview' ? block.previewHtml : block.exportHtml,
    layoutHints: block.layoutHints,
    signature: block.signature
  }));
}

export async function renderMarkdown(
  request: RenderRequest,
  mermaidRenderer: MermaidRenderer
): Promise<RenderResult> {
  const warnings: RenderWarning[] = [];
  const parsed = parseMarkdownDocument(request.markdown);
  const { document, diagrams } = await normalizeMarkdownDocument(parsed, request, mermaidRenderer, warnings);
  const previewBlocks = toRenderedBlocks(document.blocks, 'preview');
  const exportBlocks = toRenderedBlocks(document.blocks, 'export');

  return {
    html: previewBlocks.map((block) => block.html).join('\n'),
    exportHtml: exportBlocks.map((block) => block.html).join('\n'),
    previewBlocks,
    exportBlocks,
    document,
    diagrams,
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
