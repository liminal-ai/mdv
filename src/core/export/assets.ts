import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'cheerio';
import { Resvg } from '@resvg/resvg-js';

import { DiagramAsset, RenderWarning } from '../types';
import { escapeHtml } from '../render/markdown';

function safeAssetName(originalName: string, index: number): string {
  const cleaned = originalName.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const suffix = path.extname(cleaned) || '.bin';
  const stem = path.basename(cleaned, suffix) || 'image';
  return `image-${String(index + 1).padStart(3, '0')}-${stem}${suffix}`;
}

function detectMimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
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
    case '.bmp':
      return 'image/bmp';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function svgToPng(svgContent: string): Buffer {
  const rendered = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: 1400
    }
  }).render();
  return Buffer.from(rendered.asPng());
}

function toDataUri(mime: string, payload: Buffer): string {
  return `data:${mime};base64,${payload.toString('base64')}`;
}

function buildDiagramLookup(diagrams: DiagramAsset[]): Map<string, DiagramAsset> {
  const diagramByPath = new Map<string, DiagramAsset>();
  for (const diagram of diagrams) {
    diagramByPath.set(diagram.svgPath, diagram);
  }
  return diagramByPath;
}

function resolveImagePath(baseDir: string, src: string): string {
  if (src.startsWith('file://')) {
    return fileURLToPath(src);
  }
  return path.resolve(baseDir, src);
}

export async function writeDiagramSvgAssets(
  assetsDir: string,
  diagrams: Array<{ svgPath: string; svgContent?: string }>
): Promise<void> {
  await fs.mkdir(assetsDir, { recursive: true });

  for (const diagram of diagrams) {
    if (!diagram.svgContent) {
      continue;
    }
    await fs.writeFile(path.join(assetsDir, diagram.svgPath), diagram.svgContent, 'utf8');
  }
}

export async function copyLocalImagesToAssets(
  htmlBody: string,
  baseDir: string,
  assetsDir: string,
  warnings: RenderWarning[]
): Promise<string> {
  const $ = load(htmlBody);
  let copiedImageCount = 0;

  const imageNodes = $('img').toArray();
  for (const node of imageNodes) {
    const src = ($(node).attr('src') || '').trim();
    if (!src || /^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
      continue;
    }
    if (src.startsWith('./assets/') || src.startsWith('assets/')) {
      continue;
    }

    const resolved = resolveImagePath(baseDir, src);
    try {
      await fs.access(resolved);
      const assetName = safeAssetName(path.basename(src), copiedImageCount);
      await fs.copyFile(resolved, path.join(assetsDir, assetName));
      $(node).attr('src', `./assets/${assetName}`);
      copiedImageCount += 1;
    } catch {
      warnings.push({
        code: 'MISSING_LOCAL_IMAGE',
        message: `Missing local image: ${src}`,
        location: src
      });
      $(node).replaceWith(
        `<div class="mdv-missing-image">Missing local image in export: <code>${escapeHtml(src)}</code></div>`
      );
    }
  }

  return $('body').html() || $.root().html() || '';
}

export async function inlineImagesForDocx(
  htmlBody: string,
  baseDir: string,
  diagrams: DiagramAsset[],
  warnings: RenderWarning[]
): Promise<string> {
  const $ = load(htmlBody);
  const diagramByPath = buildDiagramLookup(diagrams);

  const imageNodes = $('img').toArray();
  for (const node of imageNodes) {
    const src = ($(node).attr('src') || '').trim();
    if (!src || /^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
      continue;
    }

    if (src.startsWith('./assets/') || src.startsWith('assets/')) {
      const fileName = src.split('/').pop();
      if (!fileName) {
        continue;
      }

      const diagram = diagramByPath.get(fileName);
      if (!diagram || !diagram.svgContent) {
        warnings.push({
          code: 'DOCX_IMAGE_CONVERSION_FAILED',
          message: `Unable to resolve Mermaid asset for DOCX: ${src}`,
          location: src
        });
        continue;
      }

      try {
        const pngBuffer = svgToPng(diagram.svgContent);
        $(node).attr('src', toDataUri('image/png', pngBuffer));
      } catch (error) {
        warnings.push({
          code: 'DOCX_IMAGE_CONVERSION_FAILED',
          message: `Failed to convert Mermaid SVG to PNG: ${String(error)}`,
          location: src
        });
        $(node).attr('src', toDataUri('image/svg+xml', Buffer.from(diagram.svgContent, 'utf8')));
      }
      continue;
    }

    const resolved = resolveImagePath(baseDir, src);
    let payload: Buffer;
    try {
      payload = await fs.readFile(resolved);
    } catch {
      warnings.push({
        code: 'MISSING_LOCAL_IMAGE',
        message: `Missing or unreadable local image: ${src}`,
        location: src
      });
      $(node).replaceWith(
        `<div class="mdv-missing-image">Missing local image in DOCX export: <code>${escapeHtml(src)}</code></div>`
      );
      continue;
    }

    const mime = detectMimeFromPath(resolved);
    if (mime !== 'image/svg+xml') {
      $(node).attr('src', toDataUri(mime, payload));
      continue;
    }

    const svgText = payload.toString('utf8');
    try {
      const pngBuffer = svgToPng(svgText);
      $(node).attr('src', toDataUri('image/png', pngBuffer));
    } catch (error) {
      warnings.push({
        code: 'DOCX_IMAGE_CONVERSION_FAILED',
        message: `Failed to convert SVG image for DOCX: ${String(error)}`,
        location: src
      });
      $(node).attr('src', toDataUri('image/svg+xml', payload));
    }
  }

  return $('body').html() || $.root().html() || '';
}

export async function inlineImagesForPdf(
  htmlBody: string,
  baseDir: string,
  diagrams: DiagramAsset[],
  warnings: RenderWarning[]
): Promise<string> {
  const $ = load(htmlBody);
  const diagramByPath = buildDiagramLookup(diagrams);

  const imageNodes = $('img').toArray();
  for (const node of imageNodes) {
    const src = ($(node).attr('src') || '').trim();
    if (!src || /^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
      continue;
    }

    if (src.startsWith('./assets/') || src.startsWith('assets/')) {
      const fileName = src.split('/').pop();
      if (!fileName) {
        continue;
      }

      const diagram = diagramByPath.get(fileName);
      if (!diagram || !diagram.svgContent) {
        warnings.push({
          code: 'MERMAID_RENDER_FAILED',
          message: `Unable to resolve Mermaid asset for PDF: ${src}`,
          location: src
        });
        continue;
      }

      $(node).attr('src', toDataUri('image/svg+xml', Buffer.from(diagram.svgContent, 'utf8')));
      continue;
    }

    const resolved = resolveImagePath(baseDir, src);
    let payload: Buffer;
    try {
      payload = await fs.readFile(resolved);
    } catch {
      warnings.push({
        code: 'MISSING_LOCAL_IMAGE',
        message: `Missing or unreadable local image: ${src}`,
        location: src
      });
      $(node).replaceWith(
        `<div class="mdv-missing-image">Missing local image in PDF export: <code>${escapeHtml(src)}</code></div>`
      );
      continue;
    }

    const mime = detectMimeFromPath(resolved);
    $(node).attr('src', toDataUri(mime, payload));
  }

  return $('body').html() || $.root().html() || '';
}
