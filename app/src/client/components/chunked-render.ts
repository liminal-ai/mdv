const BLOCK_BOUNDARY_PATTERN =
  /<\/(?:div|p|h[1-6]|pre|table|blockquote|ul|ol|li|section|article)\s*>/gi;
const SMALL_DOCUMENT_BLOCK_THRESHOLD = 200;

export interface ChunkedRenderOptions {
  container: HTMLElement;
  html: string;
  chunkSize?: number;
  onProgress?: (inserted: number, total: number) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

export function splitHtmlChunks(html: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const blockBoundary = new RegExp(BLOCK_BOUNDARY_PATTERN.source, BLOCK_BOUNDARY_PATTERN.flags);
  let start = 0;

  while (start < html.length) {
    let end = start + chunkSize;

    if (end >= html.length) {
      chunks.push(html.slice(start));
      break;
    }

    blockBoundary.lastIndex = end;
    const match = blockBoundary.exec(html);
    end = match ? match.index + match[0].length : end;
    chunks.push(html.slice(start, end));
    start = end;
  }

  return chunks;
}

function countBlockElements(html: string): number {
  return html.match(BLOCK_BOUNDARY_PATTERN)?.length ?? 0;
}

export function renderChunked(options: ChunkedRenderOptions): void {
  const { container, html, chunkSize = 50_000, onProgress, onComplete, signal } = options;
  const blockCount = countBlockElements(html);

  container.innerHTML = '';

  if (blockCount < SMALL_DOCUMENT_BLOCK_THRESHOLD) {
    container.innerHTML = html;
    onComplete?.();
    return;
  }

  const chunks = splitHtmlChunks(html, chunkSize);
  const total = chunks.length;
  let inserted = 0;

  const insertBatch = () => {
    if (signal?.aborted) {
      return;
    }

    const chunk = chunks.shift();
    if (!chunk) {
      onComplete?.();
      return;
    }

    const template = document.createElement('template');
    template.innerHTML = chunk;
    container.appendChild(template.content);

    inserted += 1;
    onProgress?.(inserted, total);

    requestAnimationFrame(insertBatch);
  };

  requestAnimationFrame(insertBatch);
}
