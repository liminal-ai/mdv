import { describe, expect, it } from 'vitest';

import { preparePrintHtml } from '../src/core/export/layout';

describe('preparePrintHtml', () => {
  it('normalizes print-oriented table classes and preserves page-break blocks', () => {
    const html = `
      <h2>Heading</h2>
      <p>Paragraph</p>
      <pre><code>const x = 1;</code></pre>
      <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>
      <p><!-- pagebreak --></p>
    `;

    const output = preparePrintHtml(html);

    expect(output).toContain('mdv-table');
    expect(output).toContain('mdv-table-head');
    expect(output).toContain('mdv-table-row');
    expect(output).toContain('mdv-table-cell');
    expect(output).toContain('mdv-block-page-break');
    expect(output).toContain('mdv-page-break-line');
  });
});
