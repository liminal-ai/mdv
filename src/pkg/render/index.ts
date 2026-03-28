import MarkdownIt from 'markdown-it';
import { fromHighlighter } from '@shikijs/markdown-it';
import { createHighlighter } from 'shiki';
import type { RenderOptions, RenderResult } from '../types.js';
import { MERMAID_DIAGRAM_TYPES } from '../types.js';

const MERMAID_RE = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi;

const SHIKI_THEMES = {
  light: 'github-light',
  dark: 'github-dark',
} as const;

const SHIKI_LANGS = [
  'javascript',
  'typescript',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'sql',
  'yaml',
  'json',
  'bash',
  'html',
  'css',
  'markdown',
  'toml',
  'dockerfile',
] as const;

const SHIKI_LANG_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  yml: 'yaml',
} as const;

let shikiHighlighterPromise: ReturnType<typeof createHighlighter> | undefined;

function getShikiHighlighter(): ReturnType<typeof createHighlighter> {
  if (!shikiHighlighterPromise) {
    shikiHighlighterPromise = createHighlighter({
      themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
      langs: [...SHIKI_LANGS],
      langAlias: SHIKI_LANG_ALIASES,
    });
  }

  return shikiHighlighterPromise;
}

async function createRenderer(options?: RenderOptions): Promise<MarkdownIt> {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  });

  if (options?.syntaxHighlight !== false) {
    const originalFence = md.renderer.rules.fence;
    const originalHighlight = md.options.highlight;
    const highlighter = await getShikiHighlighter();

    md.use(
      fromHighlighter(highlighter, {
        themes: SHIKI_THEMES,
        defaultColor: false,
        fallbackLanguage: undefined,
      }),
    );

    if (options?.mermaid !== false) {
      const shikiHighlight = md.options.highlight;
      md.options.highlight = (code, lang, attrs) => {
        const normalizedLang = lang.trim().toLowerCase();

        if (normalizedLang === 'mermaid') {
          return '';
        }

        return shikiHighlight ? shikiHighlight(code, normalizedLang, attrs) : '';
      };
    }

    const shikiFence = md.renderer.rules.fence;
    md.renderer.rules.fence = (tokens, idx, renderOptions, env, self) => {
      try {
        return shikiFence
          ? shikiFence(tokens, idx, renderOptions, env, self)
          : self.renderToken(tokens, idx, renderOptions);
      } catch {
        const previousHighlight = md.options.highlight;
        md.options.highlight = originalHighlight;

        try {
          return originalFence
            ? originalFence(tokens, idx, renderOptions, env, self)
            : self.renderToken(tokens, idx, renderOptions);
        } finally {
          md.options.highlight = previousHighlight;
        }
      }
    };
  }

  return md;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&amp;/g, '&');
}

function processMermaidBlocks(html: string): string {
  return html.replace(MERMAID_RE, (_match, content: string) => {
    const source = decodeHtmlEntities(content);
    const trimmedSource = source.trim();

    if (!trimmedSource) {
      return '<div class="mermaid-error">Mermaid error: empty diagram</div>';
    }

    const [firstToken = ''] = trimmedSource.split(/\s+/, 1);
    const normalizedToken = firstToken.toLowerCase();

    if (!MERMAID_DIAGRAM_TYPES.has(normalizedToken)) {
      return `<div class="mermaid-error">Mermaid error: unrecognized diagram type "${firstToken}"</div>`;
    }

    return `<div class="mermaid-diagram">${source}</div>`;
  });
}

export async function renderMarkdown(
  markdown: string,
  options?: RenderOptions,
): Promise<RenderResult> {
  const md = await createRenderer(options);
  const renderedHtml = md.render(markdown);

  return {
    html: options?.mermaid === false ? renderedHtml : processMermaidBlocks(renderedHtml),
  };
}
