import { describe, expect, it } from 'vitest';

import { preparePrintHtml } from '../src/core/export/layout';

describe('preparePrintHtml', () => {
  it('adds balanced print classes and preserves page-break blocks', () => {
    const html = `
      <h2>Heading</h2>
      <p>Paragraph</p>
      <pre><code>const x = 1;</code></pre>
      <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>
      <p><!-- pagebreak --></p>
    `;

    const output = preparePrintHtml(html);

    expect(output).toContain('mdv-print-keep-with-next');
    expect(output).toContain('mdv-print-keep-together');
    expect(output).toContain('mdv-print-text');
    expect(output).toContain('class="page-break"');
    expect(output).toContain('page-break-after: always;');
  });
});
