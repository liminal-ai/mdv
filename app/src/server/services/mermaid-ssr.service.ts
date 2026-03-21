import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import type { ExportWarning } from '../schemas/index.js';

const MERMAID_PLACEHOLDER_RE =
  /<div class="mermaid-placeholder">[\s\S]*?<code class="language-mermaid">([\s\S]*?)<\/code>[\s\S]*?<\/div>/g;

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decodeHtml(value: string): string {
  return value.replaceAll(
    /&amp;|&lt;|&gt;|&quot;|&#39;/g,
    (entity) => HTML_ENTITIES[entity] ?? entity,
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

function renderErrorFallback(source: string, message: string): string {
  return (
    '<div class="mermaid-error">' +
    `<div class="mermaid-error__banner">⚠ Mermaid error: ${escapeHtml(message)}</div>` +
    `<pre class="mermaid-error__source"><code>${escapeHtml(source)}</code></pre>` +
    '</div>'
  );
}

const MERMAID_SCRIPT_PATH = fileURLToPath(
  new URL('../../../node_modules/mermaid/dist/mermaid.min.js', import.meta.url),
);

export class MermaidSsrService {
  async renderAll(
    html: string,
    mermaidTheme: string,
  ): Promise<{ html: string; warnings: ExportWarning[] }> {
    const matches = Array.from(html.matchAll(MERMAID_PLACEHOLDER_RE));
    if (matches.length === 0) {
      return { html, warnings: [] };
    }

    const browser = await puppeteer.launch({ headless: true });
    const warnings: ExportWarning[] = [];

    try {
      const page = await browser.newPage();
      await page.setContent('<!doctype html><html><body></body></html>');
      await page.addScriptTag({ path: MERMAID_SCRIPT_PATH });
      await page.evaluate((theme) => {
        const mermaid = (globalThis as typeof globalThis & { mermaid?: unknown }).mermaid as {
          initialize(config: Record<string, unknown>): void;
        };
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme,
          suppressErrors: true,
          logLevel: 'fatal',
        });
      }, mermaidTheme);

      let cursor = 0;
      let nextHtml = '';
      let renderIndex = 0;

      for (const match of matches) {
        const placeholder = match[0];
        const encodedSource = match[1] ?? '';
        const source = decodeHtml(encodedSource).trim();
        const start = match.index ?? 0;

        nextHtml += html.slice(cursor, start);

        if (!source) {
          const message = 'Diagram definition is empty';
          warnings.push({
            type: 'mermaid-error',
            source,
            message,
          });
          nextHtml += renderErrorFallback(source, message);
          cursor = start + placeholder.length;
          continue;
        }

        try {
          const svg = await page.evaluate(
            async ({ id, diagramSource }) => {
              const mermaid = (globalThis as typeof globalThis & { mermaid?: unknown }).mermaid as {
                render(renderId: string, sourceText: string): Promise<{ svg: string }>;
              };
              const result = await mermaid.render(id, diagramSource);
              return result.svg;
            },
            { id: `export-mermaid-${renderIndex++}`, diagramSource: source },
          );

          nextHtml += `<div class="mermaid-diagram">${svg}</div>`;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push({
            type: 'mermaid-error',
            source,
            message,
          });
          nextHtml += renderErrorFallback(source, message);
        }

        cursor = start + placeholder.length;
      }

      nextHtml += html.slice(cursor);
      return { html: nextHtml, warnings };
    } finally {
      await browser.close();
    }
  }
}
