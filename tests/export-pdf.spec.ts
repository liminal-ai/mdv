import { describe, expect, it } from 'vitest';

import { inlineImagesForPdf } from '../src/core/export/assets';

describe('inlineImagesForPdf', () => {
  it('embeds local svg and mermaid diagram sources as export-safe data uris', async () => {
    const html = `
      <section class="mdv-block mdv-block-image"><figure class="mdv-figure"><img src="./fixtures/local.svg" alt="local"></figure></section>
      <section class="mdv-block mdv-block-mermaid"><figure class="mdv-figure"><img src="./assets/diagram-001.svg" alt="Mermaid diagram diagram-1"></figure></section>
    `;

    const output = await inlineImagesForPdf(
      html,
      '/Users/leemoore/code/md-viewer',
      [
        {
          id: 'diagram-1',
          source: 'graph TD; A --> B;',
          svgPath: 'diagram-001.svg',
          svgContent:
            '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect x="2" y="2" width="116" height="76" fill="#ecfeff" stroke="#0f766e"/><text x="60" y="45" text-anchor="middle">D1</text></svg>'
        }
      ],
      []
    );

    expect(output).toContain('data:image/svg+xml;base64,');
    expect(output).not.toContain('./fixtures/local.svg');
    expect(output).not.toContain('./assets/diagram-001.svg');
  });
});
