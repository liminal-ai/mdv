// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mermaid from 'mermaid';
import {
  renderMermaidBlocks,
  reRenderMermaidDiagrams,
} from '../../../src/client/utils/mermaid-renderer.js';
import {
  classMermaid,
  clickDirectiveMermaid,
  emptyMermaid,
  erMermaid,
  flowchartMermaid,
  ganttMermaid,
  mindmapMermaid,
  pieMermaid,
  sequenceMermaid,
  stateMermaid,
} from '../../fixtures/mermaid-samples.js';
import {
  cleanupDom,
  createMarkdownBodyWithPlaceholders,
  createPlaceholderHtml,
  setTheme,
} from '../../utils/mermaid-dom.js';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

function wrapInContentArea(markdownBody: HTMLElement): HTMLElement {
  const host = document.createElement('div');
  host.className = 'content-area__body';
  host.append(markdownBody);
  document.body.append(host);
  return markdownBody;
}

describe('renderMermaidBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTheme('light-default');
    vi.mocked(mermaid.render).mockResolvedValue({
      svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
    });
  });

  afterEach(() => {
    cleanupDom();
  });

  it('TC-1.1a: flowchart renders', async () => {
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    await renderMermaidBlocks(container);

    expect(container.querySelector('.mermaid-placeholder')).toBeNull();
    expect(container.querySelector('.mermaid-diagram')).not.toBeNull();
    expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull();
  });

  it('TC-1.1b: sequence diagram renders', async () => {
    const container = createMarkdownBodyWithPlaceholders([sequenceMermaid]);

    await renderMermaidBlocks(container);

    expect(container.querySelector('.mermaid-placeholder')).toBeNull();
    expect(container.querySelector('.mermaid-diagram')).not.toBeNull();
    expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull();
  });

  it.each([
    ['class', classMermaid],
    ['state', stateMermaid],
    ['gantt', ganttMermaid],
    ['ER', erMermaid],
    ['pie', pieMermaid],
    ['mindmap', mindmapMermaid],
  ])('TC-1.1c-h: %s diagram renders', async (_label, source) => {
    const container = createMarkdownBodyWithPlaceholders([source]);

    await renderMermaidBlocks(container);

    expect(container.querySelector('.mermaid-diagram')).not.toBeNull();
  });

  it('TC-1.2a: SVG has max-width 100% and height auto, no fixed width/height', async () => {
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);
    vi.mocked(mermaid.render).mockResolvedValueOnce({
      svg: '<svg viewBox="0 0 2000 200" width="2000" height="200"><rect width="2000" height="200"/></svg>',
    });

    await renderMermaidBlocks(container);

    const svgElement = container.querySelector<SVGElement>('.mermaid-diagram svg');
    expect(svgElement).not.toBeNull();
    expect(svgElement?.style.maxWidth).toBe('100%');
    expect(svgElement?.style.height).toBe('auto');
    expect(svgElement?.hasAttribute('width')).toBe(false);
    expect(svgElement?.hasAttribute('height')).toBe(false);
  });

  it('TC-1.2b: small diagram not upscaled', async () => {
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);
    vi.mocked(mermaid.render).mockResolvedValueOnce({
      svg: '<svg viewBox="0 0 40 40"><rect width="40" height="40"/></svg>',
    });

    await renderMermaidBlocks(container);

    const svgElement = container.querySelector<SVGElement>('.mermaid-diagram svg');
    expect(svgElement?.style.minWidth).toBe('');
    expect(svgElement?.style.width).toBe('');
  });

  it('TC-1.2c: tall diagram not truncated', async () => {
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);
    vi.mocked(mermaid.render).mockResolvedValueOnce({
      svg: '<svg viewBox="0 0 100 2000"><rect width="100" height="2000"/></svg>',
    });

    await renderMermaidBlocks(container);

    const diagram = container.querySelector<HTMLElement>('.mermaid-diagram');
    expect(diagram?.style.overflow).toBe('');
    expect(diagram?.style.maxHeight).toBe('');
  });

  it("TC-1.3a: light theme passes 'default' to mermaid.initialize", async () => {
    setTheme('light-default');
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    await renderMermaidBlocks(container);

    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'default' }));
  });

  it("TC-1.3b: dark theme passes 'dark'", async () => {
    setTheme('dark-default');
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    await renderMermaidBlocks(container);

    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
  });

  it('TC-1.3c: theme switch re-renders', async () => {
    const markdownBody = wrapInContentArea(createMarkdownBodyWithPlaceholders([flowchartMermaid]));

    await renderMermaidBlocks(markdownBody);
    setTheme('dark-default');

    await reRenderMermaidDiagrams();

    expect(mermaid.initialize).toHaveBeenCalledTimes(2);
    expect(mermaid.render).toHaveBeenCalledTimes(2);
    expect(mermaid.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' }));
  });

  it('TC-1.4a: 5 placeholders all render', async () => {
    const container = createMarkdownBodyWithPlaceholders([
      flowchartMermaid,
      sequenceMermaid,
      classMermaid,
      stateMermaid,
      pieMermaid,
    ]);

    await renderMermaidBlocks(container);

    expect(container.querySelectorAll('.mermaid-placeholder')).toHaveLength(0);
    expect(container.querySelectorAll('.mermaid-diagram')).toHaveLength(5);
  });

  it('TC-1.4b: mixed content unchanged', async () => {
    const container = document.createElement('div');
    container.className = 'markdown-body';
    container.innerHTML = [
      '<h2>Overview</h2>',
      createPlaceholderHtml(flowchartMermaid),
      '<p>Paragraph before.</p>',
      createPlaceholderHtml(sequenceMermaid),
      '<p>Paragraph after.</p>',
    ].join('');
    document.body.append(container);

    await renderMermaidBlocks(container);

    expect(container.querySelector('h2')?.textContent).toBe('Overview');
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(container.textContent).toContain('Paragraph before.');
    expect(container.textContent).toContain('Paragraph after.');
  });

  it('TC-1.5a: placeholder replaced', async () => {
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    await renderMermaidBlocks(container);

    expect(container.querySelectorAll('.mermaid-placeholder')).toHaveLength(0);
    expect(container.querySelectorAll('.mermaid-diagram')).toHaveLength(1);
  });

  it('TC-1.6a: securityLevel strict', async () => {
    const container = createMarkdownBodyWithPlaceholders([clickDirectiveMermaid]);

    await renderMermaidBlocks(container);

    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: 'strict' }),
    );
  });

  it('TC-1.6b: no interactive elements', async () => {
    const container = createMarkdownBodyWithPlaceholders([clickDirectiveMermaid]);

    await renderMermaidBlocks(container);

    const diagram = container.querySelector('.mermaid-diagram');
    expect(diagram?.querySelector('[onclick]')).toBeNull();
    expect(diagram?.querySelector('[onmouseover]')).toBeNull();
    expect(diagram?.querySelector('a')).toBeNull();
  });

  it('Non-TC: data-mermaid-source preserved', async () => {
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    await renderMermaidBlocks(container);

    expect(container.querySelector<HTMLElement>('.mermaid-diagram')?.dataset.mermaidSource).toBe(
      flowchartMermaid,
    );
  });

  it('Non-TC: no warnings for successful renders', async () => {
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    const result = await renderMermaidBlocks(container);

    expect(result.warnings).toEqual([]);
  });

  it('Non-TC: empty source uses the tech design error message', async () => {
    const container = createMarkdownBodyWithPlaceholders([emptyMermaid]);

    const result = await renderMermaidBlocks(container);

    expect(container.querySelector('.mermaid-error__banner')?.textContent).toContain(
      'Diagram definition is empty',
    );
    expect(result.warnings).toEqual([
      expect.objectContaining({
        type: 'mermaid-error',
        message: 'Diagram definition is empty',
      }),
    ]);
  });
});
