function pageSizeCss(pageSize: 'Letter' | 'A4'): string {
  return pageSize === 'A4' ? 'A4' : 'Letter';
}

export function documentCss(pageSize: 'Letter' | 'A4' = 'Letter'): string {
  return `
:root {
  color-scheme: light;
  --mdv-doc-fg: #172033;
  --mdv-doc-muted: #556070;
  --mdv-doc-bg: #ffffff;
  --mdv-doc-surface: #f5f7fb;
  --mdv-doc-surface-strong: #eef2f8;
  --mdv-doc-border: #d7deea;
  --mdv-doc-border-strong: #c2ccda;
  --mdv-doc-code-bg: #111827;
  --mdv-doc-code-fg: #f9fafb;
  --mdv-doc-accent: #1f5fbf;
  --mdv-doc-warn-bg: #fff5d4;
  --mdv-doc-warn-border: #dfb24f;
  --mdv-doc-danger-bg: #fee2e2;
  --mdv-doc-danger-border: #fca5a5;
}
body.mdv-export-shell {
  margin: 0;
  color: var(--mdv-doc-fg);
  background: var(--mdv-doc-bg);
}
.mdv-document,
.mdv-document * {
  box-sizing: border-box;
}
.mdv-document {
  color: var(--mdv-doc-fg);
  font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.mdv-document-screen {
  max-width: 1080px;
  margin: 0 auto;
  padding: 18px 22px 28px;
}
.mdv-document-export {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px;
}
.mdv-document .mdv-block {
  margin: 0 0 1rem;
}
.mdv-document .mdv-block:last-child {
  margin-bottom: 0;
}
.mdv-document .mdv-block-heading {
  margin-top: 1.45rem;
  margin-bottom: 0.75rem;
}
.mdv-document .mdv-block-heading:first-child {
  margin-top: 0;
}
.mdv-document .mdv-heading {
  margin: 0;
  line-height: 1.15;
  letter-spacing: -0.015em;
}
.mdv-document .mdv-heading-h1 {
  font-size: 2.15rem;
}
.mdv-document .mdv-heading-h2 {
  font-size: 1.55rem;
}
.mdv-document .mdv-heading-h3 {
  font-size: 1.2rem;
}
.mdv-document .mdv-paragraph {
  margin: 0;
}
.mdv-document .mdv-link {
  color: var(--mdv-doc-accent);
}
.mdv-document .mdv-list {
  margin: 0;
  padding-left: 1.45rem;
}
.mdv-document .mdv-list-item + .mdv-list-item {
  margin-top: 0.32rem;
}
.mdv-document .mdv-blockquote {
  margin: 0;
  padding: 0.85rem 1rem;
  border-left: 4px solid var(--mdv-doc-border-strong);
  background: linear-gradient(180deg, #fafbfd, #f5f7fb);
  color: var(--mdv-doc-muted);
  border-radius: 0 12px 12px 0;
}
.mdv-document .mdv-code-block {
  margin: 0;
  overflow-x: auto;
  background: var(--mdv-doc-code-bg);
  color: var(--mdv-doc-code-fg);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.mdv-document .mdv-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.92em;
}
.mdv-document :not(pre) > code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.92em;
  background: var(--mdv-doc-surface);
  border-radius: 7px;
  padding: 0.12rem 0.35rem;
}
.mdv-document .mdv-figure {
  margin: 0;
  display: grid;
  gap: 0.55rem;
}
.mdv-document .mdv-figure-frame {
  border: 1px solid var(--mdv-doc-border);
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff, #fbfcfe);
  padding: 12px;
  overflow: auto;
}
.mdv-document .mdv-figure-image,
.mdv-document .mdv-content-image {
  display: block;
  max-width: 100%;
  height: auto;
}
.mdv-document .mdv-mermaid-frame svg {
  display: block;
  max-width: 100%;
  height: auto;
}
.mdv-document .mdv-table-shell {
  overflow-x: auto;
  border: 1px solid var(--mdv-doc-border);
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff, #fbfcfe);
}
.mdv-document .mdv-table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.mdv-document .mdv-table-head {
  background: var(--mdv-doc-surface-strong);
}
.mdv-document .mdv-table-row:nth-child(even) {
  background: rgba(238, 242, 248, 0.4);
}
.mdv-document .mdv-table-cell {
  min-width: 7rem;
  max-width: 22rem;
  padding: 0.7rem 0.85rem;
  border-right: 1px solid var(--mdv-doc-border);
  border-bottom: 1px solid var(--mdv-doc-border);
  vertical-align: top;
  overflow-wrap: anywhere;
  white-space: normal;
}
.mdv-document .mdv-table-row:last-child .mdv-table-cell {
  border-bottom: 0;
}
.mdv-document .mdv-table-cell:last-child {
  border-right: 0;
}
.mdv-document .mdv-table-heading-cell {
  font-weight: 700;
}
.mdv-document .mdv-align-left {
  text-align: left;
}
.mdv-document .mdv-align-center {
  text-align: center;
}
.mdv-document .mdv-align-right {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.mdv-document .mdv-align-default {
  text-align: left;
}
.mdv-document .mdv-warning {
  border: 1px solid var(--mdv-doc-warn-border);
  background: var(--mdv-doc-warn-bg);
  border-radius: 12px;
  padding: 10px 12px;
}
.mdv-document .mdv-missing-image {
  border: 1px solid var(--mdv-doc-danger-border);
  background: var(--mdv-doc-danger-bg);
  border-radius: 12px;
  padding: 10px 12px;
}
.mdv-document .mdv-block-page-break {
  margin: 1.35rem 0;
}
.mdv-document .mdv-page-break-line {
  border-top: 2px dashed var(--mdv-doc-border-strong);
}
.mdv-document .mdv-keep-with-next {
  break-after: avoid-page;
  page-break-after: avoid;
}
.mdv-document .mdv-keep-together {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.mdv-document .mdv-allow-split {
  break-inside: auto;
  page-break-inside: auto;
}
@media print {
  @page {
    size: ${pageSizeCss(pageSize)};
    margin: 1in;
  }

  body.mdv-export-shell {
    background: #fff;
  }

  .mdv-document-print {
    max-width: none;
    margin: 0;
    padding: 0;
  }

  .mdv-document .mdv-table-shell {
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .mdv-document .mdv-table {
    width: 100%;
    min-width: 100%;
    table-layout: fixed;
  }

  .mdv-document .mdv-table-head {
    display: table-header-group;
  }

  .mdv-document .mdv-table-row {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  .mdv-document .mdv-table-cell {
    max-width: none;
  }

  .mdv-document .mdv-code-block {
    overflow: visible;
    white-space: pre-wrap;
  }

  .mdv-document .mdv-block-page-break {
    break-after: page;
    page-break-after: always;
    margin: 0;
  }

  .mdv-document .mdv-page-break-line {
    display: none;
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
  <body class="mdv-export-shell">
    <main class="mdv-document mdv-document-export mdv-document-print">
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
