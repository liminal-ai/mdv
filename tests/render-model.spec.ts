import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderMarkdown } from '../src/core/render/markdown';
import { MermaidRenderer } from '../src/core/types';

class FakeMermaidRenderer implements MermaidRenderer {
  async renderDiagram(id: string): Promise<{ ok: boolean; svg?: string; error?: string }> {
    return {
      ok: true,
      svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect x="2" y="2" width="116" height="76" fill="#ecfeff" stroke="#0f766e"/><text x="60" y="45" text-anchor="middle">diagram</text></svg>`
    };
  }

  async dispose(): Promise<void> {
    return Promise.resolve();
  }
}

describe('normalized markdown document model', () => {
  it('captures table metadata for wide tables', async () => {
    const baseDir = '/Users/leemoore/code/md-viewer/fixtures';
    const markdown = await fs.readFile(path.join(baseDir, 'wide-table-sample.md'), 'utf8');
    const result = await renderMarkdown(
      {
        inputPath: path.join(baseDir, 'wide-table-sample.md'),
        markdown,
        baseDir,
        offline: true
      },
      new FakeMermaidRenderer()
    );

    const tableBlock = result.document.blocks.find((block) => block.kind === 'table');
    expect(tableBlock).toBeTruthy();
    expect(tableBlock?.table?.alignments).toEqual(['default', 'default', 'right', 'right', 'right', 'right', 'default']);
    expect(tableBlock?.exportHtml).toContain('mdv-table-shell');
    expect(tableBlock?.exportHtml).toContain('mdv-align-right');
  });

  it('normalizes local images and mermaid diagrams as figure blocks', async () => {
    const baseDir = '/Users/leemoore/code/md-viewer/fixtures';
    const markdown = await fs.readFile(path.join(baseDir, 'image-heavy-sample.md'), 'utf8');
    const result = await renderMarkdown(
      {
        inputPath: path.join(baseDir, 'image-heavy-sample.md'),
        markdown,
        baseDir,
        offline: true
      },
      new FakeMermaidRenderer()
    );

    expect(result.document.blocks.filter((block) => block.kind === 'image')).toHaveLength(2);
    expect(result.document.blocks.filter((block) => block.kind === 'mermaid')).toHaveLength(1);
    expect(result.document.assets.map((asset) => asset.kind)).toEqual([
      'local-image',
      'local-image',
      'mermaid-diagram'
    ]);
    expect(result.previewBlocks.every((block) => block.html.includes('data-block-id'))).toBe(true);
  });
});
