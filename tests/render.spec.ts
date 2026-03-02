import { describe, expect, it } from 'vitest';

import { renderMarkdown } from '../src/core/render/markdown';
import { MermaidRenderer } from '../src/core/types';

class FakeMermaidRenderer implements MermaidRenderer {
  async renderDiagram(id: string): Promise<{ ok: boolean; svg?: string; error?: string }> {
    return {
      ok: true,
      svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg"><text x="10" y="20">diagram</text></svg>`
    };
  }

  async dispose(): Promise<void> {
    return Promise.resolve();
  }
}

describe('renderMarkdown', () => {
  it('renders mermaid placeholders to inline SVG and blocks remote images', async () => {
    const markdown = `# Title

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

<!-- pagebreak -->

![remote](https://example.com/image.png)
`;

    const result = await renderMarkdown(
      {
        inputPath: '/tmp/test.md',
        markdown,
        baseDir: '/tmp',
        offline: true
      },
      new FakeMermaidRenderer()
    );

    expect(result.html).toContain('<svg');
    expect(result.html).toContain('mdv-warning');
    expect(result.warnings.some((warning) => warning.code === 'REMOTE_IMAGE_BLOCKED')).toBe(true);
    expect(result.exportHtml).toContain('./assets/diagram-001.svg');
    expect(result.exportHtml).toContain('class="page-break"');
  });
});
