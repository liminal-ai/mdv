import type { RenderWarning } from '../../shared/types.js';

export interface MermaidRenderResult {
  warnings: RenderWarning[];
}

const RENDER_TIMEOUT_MS = 5_000;

let mermaidModule: typeof import('mermaid') | null = null;

async function getMermaid() {
  if (!mermaidModule) {
    mermaidModule = await import('mermaid');
  }

  return mermaidModule.default;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function applySvgSizing(container: ParentNode): void {
  const svgElement = container.querySelector<SVGElement>('svg');
  if (!svgElement) {
    return;
  }

  svgElement.style.maxWidth = '100%';
  svgElement.style.height = 'auto';
  svgElement.removeAttribute('width');
  svgElement.removeAttribute('height');
}

export function getMermaidTheme(): 'default' | 'dark' {
  const themeId = document.documentElement.dataset.theme ?? 'light-default';
  return themeId.startsWith('dark') ? 'dark' : 'default';
}

export async function renderWithTimeout(
  source: string,
  id: string,
  theme: 'default' | 'dark',
): Promise<{ svg: string }> {
  const mermaid = await getMermaid();
  const mermaidConfig: Parameters<typeof mermaid.initialize>[0] & { suppressErrors: boolean } = {
    startOnLoad: false,
    securityLevel: 'strict',
    theme,
    suppressErrors: true,
    logLevel: 'fatal',
  };
  mermaid.initialize(mermaidConfig);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Diagram rendering timed out after 5 seconds'));
    }, RENDER_TIMEOUT_MS);
  });

  try {
    const result = (await Promise.race([
      Promise.resolve(mermaid.render(id, source)),
      timeoutPromise,
    ])) as { svg: string };

    return { svg: result.svg };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function replacePlaceholderWithSvg(placeholder: Element, svg: string, source: string): void {
  const container = document.createElement('div');
  container.className = 'mermaid-diagram';
  container.dataset.mermaidSource = source;
  container.innerHTML = svg;
  applySvgSizing(container);
  placeholder.replaceWith(container);
}

export function replacePlaceholderWithError(
  placeholder: Element,
  source: string,
  errorMessage: string,
): void {
  const container = document.createElement('div');
  container.className = 'mermaid-error';

  const banner = document.createElement('div');
  banner.className = 'mermaid-error__banner';
  banner.textContent = `⚠ Mermaid error: ${errorMessage}`;

  const pre = document.createElement('pre');
  pre.className = 'mermaid-error__source';

  const code = document.createElement('code');
  code.textContent = source;

  pre.append(code);
  container.append(banner, pre);
  placeholder.replaceWith(container);
}

export function createMermaidWarning(source: string, message: string): RenderWarning {
  const truncatedSource = source.length > 200 ? `${source.slice(0, 200)}...` : source;
  return {
    type: 'mermaid-error',
    source: truncatedSource,
    message,
  };
}

export async function renderMermaidBlocks(container: HTMLElement): Promise<MermaidRenderResult> {
  const placeholders = Array.from(container.querySelectorAll('.mermaid-placeholder'));
  const warnings: RenderWarning[] = [];

  if (placeholders.length === 0) {
    return { warnings };
  }

  const theme = getMermaidTheme();
  let renderIndex = 0;

  for (const placeholder of placeholders) {
    const source = placeholder.querySelector('code.language-mermaid')?.textContent?.trim() ?? '';

    if (!source) {
      const message = 'Diagram definition is empty';
      replacePlaceholderWithError(placeholder, source, message);
      warnings.push(createMermaidWarning(source, message));
      continue;
    }

    try {
      const { svg } = await renderWithTimeout(source, `mermaid-${renderIndex++}`, theme);
      replacePlaceholderWithSvg(placeholder, svg, source);
    } catch (error) {
      const message = getErrorMessage(error);
      replacePlaceholderWithError(placeholder, source, message);
      warnings.push(createMermaidWarning(source, message));
    }
  }

  return { warnings };
}

export async function reRenderMermaidDiagrams(): Promise<void> {
  const markdownBody = document.querySelector<HTMLElement>('.content-area__body .markdown-body');
  if (!markdownBody) {
    return;
  }

  const diagrams = Array.from(markdownBody.querySelectorAll<HTMLElement>('.mermaid-diagram'));
  if (diagrams.length === 0) {
    return;
  }

  const theme = getMermaidTheme();
  let renderIndex = 0;

  for (const diagram of diagrams) {
    const source = diagram.dataset.mermaidSource;
    if (!source) {
      continue;
    }

    try {
      const { svg } = await renderWithTimeout(source, `mermaid-re-${renderIndex++}`, theme);
      diagram.innerHTML = svg;
      applySvgSizing(diagram);
    } catch {
      // Keep the last successfully rendered SVG on theme-change failures.
    }
  }
}
