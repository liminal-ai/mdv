import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STYLESHEET_NAMES = ['themes.css', 'base.css', 'markdown-body.css', 'mermaid.css'] as const;

const PRINT_CSS = `
@media print {
  html,
  body {
    background: white !important;
  }

  .markdown-body {
    max-width: none;
    padding: 0;
  }

  [data-mdv-layout="keep-with-next"] {
    break-after: avoid-page;
    page-break-after: avoid;
  }

  [data-mdv-layout="keep-together"] {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  [data-mdv-layout="allow-split"] {
    break-inside: auto;
    page-break-inside: auto;
  }

  .image-placeholder { break-inside: avoid; }
  .mermaid-diagram { break-inside: avoid; }
  .mermaid-error { break-inside: avoid; }
}
`;

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function readStylesheet(name: (typeof STYLESHEET_NAMES)[number]): string | null {
  const stylesheetPath = fileURLToPath(new URL(`../../client/styles/${name}`, import.meta.url));
  if (!existsSync(stylesheetPath)) {
    return null;
  }

  return readFileSync(stylesheetPath, 'utf8');
}

export class HtmlExportService {
  assemble(contentHtml: string, themeId: string): string {
    const styles = STYLESHEET_NAMES.map(readStylesheet)
      .filter((stylesheet): stylesheet is string => Boolean(stylesheet))
      .map((stylesheet) => `<style>\n${stylesheet}\n</style>`)
      .join('\n');

    return [
      '<!doctype html>',
      `<html lang="en" data-theme="${escapeAttribute(themeId)}">`,
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>Exported Markdown</title>',
      styles,
      `<style>\n${PRINT_CSS}\n</style>`,
      '</head>',
      '<body>',
      `<div class="markdown-body">${contentHtml}</div>`,
      '</body>',
      '</html>',
    ].join('\n');
  }
}
