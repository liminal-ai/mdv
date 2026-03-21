export function createPlaceholderHtml(source: string): string {
  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (
    '<div class="mermaid-placeholder">' +
    '<div class="mermaid-placeholder__label">Mermaid diagram (rendering available in a future update)</div>' +
    `<pre><code class="language-mermaid">${escaped}</code></pre>` +
    '</div>'
  );
}

export function createMarkdownBodyWithPlaceholders(sources: string[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'markdown-body';
  container.innerHTML = sources
    .map(createPlaceholderHtml)
    .join('\n<p>Paragraph between diagrams.</p>\n');
  document.body.appendChild(container);
  return container;
}

export function setTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
}

export function cleanupDom(): void {
  document.body.innerHTML = '';
  delete document.documentElement.dataset.theme;
}
