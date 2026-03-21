// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
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
  invalidSyntaxMermaid,
  mindmapMermaid,
  pieMermaid,
  sequenceMermaid,
  stateMermaid,
  whitespaceOnlyMermaid,
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

const mermaidCss = readFileSync(
  path.resolve(process.cwd(), 'src/client/styles/mermaid.css'),
  'utf8',
);
const markdownBodyCss = readFileSync(
  path.resolve(process.cwd(), 'src/client/styles/markdown-body.css'),
  'utf8',
);

function wrapInContentArea(markdownBody: HTMLElement): HTMLElement {
  const host = document.createElement('div');
  host.className = 'content-area__body';
  host.append(markdownBody);
  document.body.append(host);
  return markdownBody;
}

function injectStyle(css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
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
    document.head.innerHTML = '';
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
    // Config-verification test: verifies securityLevel:'strict' is passed.
    // Actual SVG sanitization verified manually (checklist item 14).
    vi.mocked(mermaid.render).mockResolvedValueOnce({
      svg: '<svg viewBox="0 0 100 100"><g onclick="evil()"><rect width="100" height="100"/></g></svg>',
    });
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

  it('TC-2.2c: no warnings for successful renders', async () => {
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

  it('TC-2.1a: syntax error shows error fallback', async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Parse error on line 3'));
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    await renderMermaidBlocks(container);

    expect(container.querySelector('.mermaid-error')).not.toBeNull();
    expect(container.querySelector('.mermaid-error__banner')).not.toBeNull();
    expect(container.querySelector('.mermaid-error__source')).not.toBeNull();
  });

  it('TC-2.1b: error banner has indicator, description, and selectable source', async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Unexpected token'));
    injectStyle(mermaidCss);
    const container = createMarkdownBodyWithPlaceholders([invalidSyntaxMermaid]);

    await renderMermaidBlocks(container);

    const banner = container.querySelector<HTMLElement>('.mermaid-error__banner');
    const source = container.querySelector<HTMLElement>('.mermaid-error__source');
    const code = source?.querySelector('code');

    expect(banner?.textContent).toContain('⚠');
    expect(banner?.textContent).toContain('Mermaid error:');
    expect(banner?.textContent).toContain('Unexpected token');
    expect(code?.textContent).toBe(invalidSyntaxMermaid);
    expect(source?.classList.contains('mermaid-error__source')).toBe(true);
  });

  it('TC-2.1c: partial success - 2 valid + 1 invalid', async () => {
    vi.mocked(mermaid.render)
      .mockResolvedValueOnce({
        svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
      })
      .mockRejectedValueOnce(new Error('Parse error in middle diagram'))
      .mockResolvedValueOnce({
        svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="25"/></svg>',
      });
    const container = createMarkdownBodyWithPlaceholders([
      flowchartMermaid,
      invalidSyntaxMermaid,
      sequenceMermaid,
    ]);

    await renderMermaidBlocks(container);

    expect(container.querySelectorAll('.mermaid-diagram')).toHaveLength(2);
    expect(container.querySelectorAll('.mermaid-error')).toHaveLength(1);

    const children = Array.from(container.children).map(
      (child) => child.className || child.tagName.toLowerCase(),
    );
    expect(children).toEqual(['mermaid-diagram', 'p', 'mermaid-error', 'p', 'mermaid-diagram']);
  });

  it('TC-2.1d: empty mermaid block shows error', async () => {
    const container = createMarkdownBodyWithPlaceholders([emptyMermaid]);

    await renderMermaidBlocks(container);

    expect(container.querySelector('.mermaid-error')).not.toBeNull();
    expect(container.querySelector('.mermaid-error__banner')?.textContent?.toLowerCase()).toContain(
      'empty',
    );
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it('TC-2.2a: warning count includes mermaid errors', async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Invalid diagram'));
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    const result = await renderMermaidBlocks(container);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toEqual(
      expect.objectContaining({
        type: 'mermaid-error',
      }),
    );
  });

  it('TC-2.2b: warning detail has type and message', async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Syntax error near line 5'));
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    const result = await renderMermaidBlocks(container);

    expect(result.warnings[0]?.type).toBe('mermaid-error');
    expect(result.warnings[0]?.message).toContain('Syntax error near line 5');
  });

  it('TC-2.3a: document renders despite mermaid failure', async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Broken diagram'));
    const container = document.createElement('div');
    container.className = 'markdown-body';
    container.innerHTML = [
      '<h1>Document Title</h1>',
      '<p>Lead paragraph.</p>',
      createPlaceholderHtml(flowchartMermaid),
    ].join('');
    document.body.append(container);

    await renderMermaidBlocks(container);

    expect(container.querySelector('h1')?.textContent).toBe('Document Title');
    expect(container.querySelector('p')?.textContent).toBe('Lead paragraph.');
    expect(container.querySelector('.mermaid-error')).not.toBeNull();
  });

  it('TC-2.3b: rendering timeout triggers fallback', async () => {
    vi.useFakeTimers();

    try {
      vi.mocked(mermaid.render).mockReturnValue(new Promise<{ svg: string }>(() => {}));
      const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

      const renderPromise = renderMermaidBlocks(container);

      await vi.advanceTimersByTimeAsync(5_001);

      const result = await renderPromise;

      expect(container.querySelector('.mermaid-error')).not.toBeNull();
      expect(result.warnings[0]?.message).toContain('timed out');
    } finally {
      vi.useRealTimers();
    }
  });

  it('TC-3.4c: theme switch updates Shiki highlighting (CSS verification)', () => {
    injectStyle(markdownBodyCss);
    const markdownBody = wrapInContentArea(document.createElement('div'));
    markdownBody.className = 'markdown-body';
    markdownBody.innerHTML = [
      '<pre class="shiki"><code>',
      '<span style="--shiki-light: #111111; --shiki-dark: #eeeeee; --shiki-light-bg: #ffffff; --shiki-dark-bg: #000000;">const value = 1;</span>',
      '</code></pre>',
    ].join('');

    setTheme('dark-default');

    const token = markdownBody.querySelector<HTMLElement>('pre.shiki span');
    const tokenStyles = getComputedStyle(token as HTMLElement);

    expect(document.documentElement.dataset.theme).toBe('dark-default');
    expect(token?.getAttribute('style')).toContain('--shiki-light: #111111');
    expect(token?.getAttribute('style')).toContain('--shiki-dark: #eeeeee');
    expect(['var(--shiki-dark)', 'rgb(238, 238, 238)']).toContain(tokenStyles.color);
    expect(['var(--shiki-dark-bg)', 'rgb(0, 0, 0)']).toContain(tokenStyles.backgroundColor);
  });

  it('TC-5.1a: multiple failure types in one document', async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Diagram failed'));
    const container = document.createElement('div');
    container.className = 'markdown-body';
    container.innerHTML = [
      createPlaceholderHtml(flowchartMermaid),
      '<div class="image-placeholder">Missing image placeholder</div>',
      '<pre><code class="language-ts">const untouched = true;</code></pre>',
    ].join('');
    document.body.append(container);

    await renderMermaidBlocks(container);

    expect(container.querySelector('.mermaid-error')).not.toBeNull();
    expect(container.querySelector('.image-placeholder')?.textContent).toBe(
      'Missing image placeholder',
    );
    expect(container.querySelector('code.language-ts')?.textContent).toBe(
      'const untouched = true;',
    );
  });

  it('TC-5.1b: mermaid error in re-rendered content', async () => {
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);

    await renderMermaidBlocks(container);
    expect(container.querySelector('.mermaid-diagram')).not.toBeNull();

    container.innerHTML = createPlaceholderHtml(sequenceMermaid);
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Re-render failure'));

    await renderMermaidBlocks(container);

    expect(container.querySelector('.mermaid-error')).not.toBeNull();
    expect(container.querySelector('.mermaid-diagram')).toBeNull();
  });

  it('TC-5.2a: new diagram in re-rendered content', async () => {
    const container = document.createElement('div');
    container.className = 'markdown-body';
    document.body.append(container);

    const firstResult = await renderMermaidBlocks(container);
    expect(firstResult.warnings).toEqual([]);
    expect(container.querySelector('.mermaid-diagram')).toBeNull();

    container.innerHTML = createPlaceholderHtml(flowchartMermaid);

    await renderMermaidBlocks(container);

    expect(container.querySelector('.mermaid-diagram')).not.toBeNull();
  });

  it('Non-TC: source truncated at 200 chars in warning', async () => {
    const longSource = `graph TD\n${'A'.repeat(500)}`;
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Very long diagram source failed'));
    const container = createMarkdownBodyWithPlaceholders([longSource]);

    const result = await renderMermaidBlocks(container);

    expect(result.warnings[0]?.source.length).toBeLessThanOrEqual(203);
    expect(result.warnings[0]?.source.endsWith('...')).toBe(true);
  });

  it('Non-TC: re-render clears old mermaid warnings', async () => {
    const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('First render failed'));

    const firstResult = await renderMermaidBlocks(container);
    expect(firstResult.warnings).toHaveLength(1);

    container.innerHTML = createPlaceholderHtml(sequenceMermaid);

    const secondResult = await renderMermaidBlocks(container);

    expect(secondResult.warnings).toEqual([]);
  });

  it('Non-TC: whitespace-only source uses the tech design error message', async () => {
    const container = createMarkdownBodyWithPlaceholders([whitespaceOnlyMermaid]);

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

  it("Non-TC: render errors don't leak to other diagrams", async () => {
    vi.mocked(mermaid.render)
      .mockResolvedValueOnce({
        svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
      })
      .mockResolvedValueOnce({
        svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
      })
      .mockRejectedValueOnce(new Error('Third diagram failed'))
      .mockResolvedValueOnce({
        svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
      })
      .mockResolvedValueOnce({
        svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
      });
    const container = createMarkdownBodyWithPlaceholders([
      flowchartMermaid,
      sequenceMermaid,
      invalidSyntaxMermaid,
      classMermaid,
      stateMermaid,
    ]);

    await renderMermaidBlocks(container);

    const renderedBlocks = Array.from(
      container.querySelectorAll<HTMLElement>('.mermaid-diagram, .mermaid-error'),
    );

    expect(renderedBlocks).toHaveLength(5);
    expect(renderedBlocks[0]?.className).toBe('mermaid-diagram');
    expect(renderedBlocks[1]?.className).toBe('mermaid-diagram');
    expect(renderedBlocks[2]?.className).toBe('mermaid-error');
    expect(renderedBlocks[3]?.className).toBe('mermaid-diagram');
    expect(renderedBlocks[4]?.className).toBe('mermaid-diagram');
  });
});
