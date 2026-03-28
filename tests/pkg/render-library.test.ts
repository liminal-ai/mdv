import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/pkg/render/index.js';

describe('renderMarkdown', () => {
  it('TC-8.1a: Basic rendering', async () => {
    const result = await renderMarkdown('# Hello\n\nWorld');

    expect(result.html).toContain('<h1>');
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('<p>World</p>');
  });

  it('TC-8.1b: Syntax highlighting', async () => {
    const result = await renderMarkdown('```javascript\nconst x = 42;\n```');

    expect(result.html).toContain('<pre');
    expect(result.html).toContain('<code');
    expect(result.html).toContain('<span');
  });

  it('TC-8.2a: Mermaid processing', async () => {
    const result = await renderMarkdown('```mermaid\ngraph TD\n  A --> B\n```');

    expect(result.html).toContain('mermaid-diagram');
    expect(result.html).not.toContain('language-mermaid');
  });

  it('TC-8.2b: Invalid Mermaid', async () => {
    await expect(renderMarkdown('```mermaid\n\n```')).resolves.toMatchObject({
      html: expect.stringContaining('mermaid-error'),
    });
  });

  it('TC-8.3a: Standalone import', () => {
    expect(typeof renderMarkdown).toBe('function');
  });

  it('TC-8.3b: No server dependency', async () => {
    const result = await renderMarkdown('# Hello');

    expect(result.html).toContain('<h1>');
    expect(result.html).toContain('Hello');
  });

  it('Empty input', async () => {
    const result = await renderMarkdown('');

    expect(result).toHaveProperty('html');
    expect(typeof result.html).toBe('string');
  });

  it('mermaid: false', async () => {
    const result = await renderMarkdown('```mermaid\ngraph TD\n  A --> B\n```', {
      mermaid: false,
    });

    expect(result.html).toContain('language-mermaid');
    expect(result.html).not.toContain('mermaid-diagram');
  });
});
