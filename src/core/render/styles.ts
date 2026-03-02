function pageSizeCss(pageSize: 'Letter' | 'A4'): string {
  return pageSize === 'A4' ? 'A4' : 'Letter';
}

export function documentCss(pageSize: 'Letter' | 'A4' = 'Letter'): string {
  return `
:root {
  color-scheme: light;
  --fg: #111827;
  --muted: #4b5563;
  --bg: #ffffff;
  --surface: #f3f4f6;
  --border: #d1d5db;
  --code-bg: #111827;
  --code-fg: #f9fafb;
  --warn-bg: #fef3c7;
  --warn-border: #f59e0b;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--fg);
  background: var(--bg);
}
main {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px;
}
h1, h2, h3, h4, h5, h6 { line-height: 1.2; margin-top: 1.4em; }
a { color: #1d4ed8; }
pre {
  background: var(--code-bg);
  color: var(--code-fg);
  border-radius: 10px;
  padding: 12px;
  overflow-x: auto;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.92em;
}
pre code { background: transparent; }
:not(pre) > code {
  background: var(--surface);
  padding: 2px 6px;
  border-radius: 6px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}
th, td {
  border: 1px solid var(--border);
  padding: 8px;
  vertical-align: top;
}
img { max-width: 100%; }
blockquote {
  border-left: 4px solid var(--border);
  margin: 1em 0;
  padding: 0.2em 1em;
  color: var(--muted);
}
.mdv-warning {
  border: 1px solid var(--warn-border);
  background: var(--warn-bg);
  border-radius: 8px;
  padding: 10px;
  margin: 10px 0;
}
.mdv-mermaid-diagram {
  overflow-x: auto;
  padding: 8px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin: 8px 0;
}
.mdv-missing-image {
  border: 1px dashed #ef4444;
  color: #7f1d1d;
  background: #fee2e2;
  border-radius: 8px;
  padding: 10px;
  margin: 8px 0;
}
.page-break {
  margin: 1.2em 0;
  border: 0;
  border-top: 2px dashed var(--border);
}
@media print {
  @page {
    size: ${pageSizeCss(pageSize)};
    margin: 1in;
  }

  body { background: #fff; }
  main { max-width: 100%; padding: 0; margin: 0; }
  h1, h2, h3 {
    break-after: avoid-page;
    page-break-after: avoid;
  }
  thead { display: table-header-group; }
  .mdv-print-keep-together {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
  .mdv-print-keep-with-next {
    break-after: avoid-page;
    page-break-after: avoid;
  }
  .mdv-print-text {
    orphans: 3;
    widows: 3;
  }
  pre {
    overflow: visible;
    white-space: pre-wrap;
  }
  .page-break {
    margin: 0;
    border: 0;
    break-after: page;
    page-break-after: always;
  }
}
`;
}

export function wrapDocumentHtml(
  title: string,
  body: string,
  baseHref?: string,
  pageSize: 'Letter' | 'A4' = 'Letter'
): string {
  const safeTitle = escapeHtml(title);
  const base = baseHref ? `<base href="${escapeHtml(baseHref)}">` : '';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file: data:; style-src 'unsafe-inline'; font-src data:;">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${base}
    <title>${safeTitle}</title>
    <style>${documentCss(pageSize)}</style>
  </head>
  <body>
    <main>
      ${body}
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
