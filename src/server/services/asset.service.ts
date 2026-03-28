import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExportWarning } from '../../shared/contracts/index.js';

const IMG_TAG_RE = /<img\s+([^>]*?)src\s*=\s*(?:(["'])(.*?)\2|([^>\s]+))([^>]*?)>/gi;

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderImagePlaceholder(source: string): string {
  return (
    '<div class="image-placeholder" data-type="missing">' +
    `<span class="image-placeholder__text">Missing image: ${escapeHtml(source)}</span>` +
    '</div>'
  );
}

function getImagePath(src: string): string | null {
  const [pathname, query = ''] = src.split('?');
  if (pathname !== '/api/image') {
    return null;
  }

  const params = new URLSearchParams(query);
  return params.get('path');
}

function toDataUri(imagePath: string, content: Buffer): string {
  const mimeType = MIME_TYPES[path.extname(imagePath).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mimeType};base64,${content.toString('base64')}`;
}

export class AssetService {
  async resolveImages(
    html: string,
    _documentPath: string,
  ): Promise<{ html: string; warnings: ExportWarning[] }> {
    const matches = Array.from(html.matchAll(IMG_TAG_RE)).filter((match) => {
      const src = match[3] ?? match[4] ?? '';
      return Boolean(getImagePath(src));
    });

    if (matches.length === 0) {
      return { html, warnings: [] };
    }

    const replacements = await Promise.all(
      matches.map(async (match) => {
        const [fullMatch] = match;
        const imageSrc = match[3] ?? match[4] ?? '';
        const imagePath = getImagePath(imageSrc);

        if (!imagePath) {
          return {
            index: match.index ?? 0,
            fullMatch,
            replacement: fullMatch,
            warning: null,
          };
        }

        try {
          const content = await readFile(imagePath);
          const replacement = fullMatch.replace(imageSrc, toDataUri(imagePath, content));
          return {
            index: match.index ?? 0,
            fullMatch,
            replacement,
            warning: null,
          };
        } catch (error) {
          if ((error as NodeJS.ErrnoException | undefined)?.code !== 'ENOENT') {
            throw error;
          }

          return {
            index: match.index ?? 0,
            fullMatch,
            replacement: renderImagePlaceholder(imagePath),
            warning: {
              type: 'missing-image' as const,
              source: imagePath,
              message: `Missing image: ${imagePath}`,
            },
          };
        }
      }),
    );

    let cursor = 0;
    let nextHtml = '';

    for (const replacement of replacements.sort((left, right) => left.index - right.index)) {
      nextHtml += html.slice(cursor, replacement.index);
      nextHtml += replacement.replacement;
      cursor = replacement.index + replacement.fullMatch.length;
    }

    nextHtml += html.slice(cursor);

    const warnings: ExportWarning[] = [];
    for (const replacement of replacements) {
      if (replacement.warning) {
        warnings.push(replacement.warning);
      }
    }

    return {
      html: nextHtml,
      warnings,
    };
  }
}
