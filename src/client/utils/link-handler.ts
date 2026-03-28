import type { TabState } from '../state.js';

export type LinkAction =
  | { type: 'external'; url: string }
  | { type: 'anchor'; id: string }
  | { type: 'markdown'; path: string; anchor?: string }
  | { type: 'local-file'; path: string };

export interface LinkHandlerState {
  tabs: TabState[];
  activeTabId: string | null;
  openFile: (path: string, anchor?: string) => void | Promise<void>;
  api: {
    openExternal: (path: string) => Promise<{ ok: true }>;
  };
  showError: (error: unknown) => void;
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

function isExternalHref(href: string): boolean {
  const normalizedHref = href.toLowerCase();
  return normalizedHref.startsWith('http://') || normalizedHref.startsWith('https://');
}

function hasUnsupportedScheme(href: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(href) && !isExternalHref(href);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function splitHref(href: string): { path: string; anchor?: string } {
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) {
    return { path: href };
  }

  return {
    path: href.slice(0, hashIndex),
    anchor: href.slice(hashIndex + 1),
  };
}

function normalizeAbsolutePath(inputPath: string): string {
  const parts = inputPath.split('/');
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }

    if (part === '..') {
      normalized.pop();
      continue;
    }

    normalized.push(part);
  }

  return `/${normalized.join('/')}`;
}

function dirname(filePath: string): string {
  const normalizedPath = normalizeAbsolutePath(filePath);
  const segments = normalizedPath.split('/').filter(Boolean);
  segments.pop();

  return segments.length > 0 ? `/${segments.join('/')}` : '/';
}

function resolvePath(hrefPath: string, documentPath: string): string {
  const decodedPath = safeDecode(hrefPath);
  if (decodedPath.startsWith('/')) {
    return normalizeAbsolutePath(decodedPath);
  }

  return normalizeAbsolutePath(`${dirname(documentPath)}/${decodedPath}`);
}

function extname(filePath: string): string {
  const fileName = filePath.split('/').filter(Boolean).at(-1) ?? '';
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return '';
  }

  return fileName.slice(dotIndex).toLowerCase();
}

export function classifyLink(href: string, documentPath: string): LinkAction {
  if (isExternalHref(href)) {
    return { type: 'external', url: href };
  }

  if (href.startsWith('#')) {
    return { type: 'anchor', id: safeDecode(href.slice(1)) };
  }

  const { path, anchor } = splitHref(href);
  const resolvedPath = resolvePath(path, documentPath);
  const decodedAnchor = anchor ? safeDecode(anchor) : undefined;

  if (MARKDOWN_EXTENSIONS.has(extname(resolvedPath))) {
    return { type: 'markdown', path: resolvedPath, anchor: decodedAnchor };
  }

  return { type: 'local-file', path: resolvedPath };
}

export function attach(container: HTMLElement, state: LinkHandlerState): void {
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
  if (!activeTab) {
    return;
  }

  container.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest('a[href]');
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    if (hasUnsupportedScheme(href)) {
      return;
    }

    event.preventDefault();

    const action = classifyLink(href, activeTab.path);

    switch (action.type) {
      case 'external':
        window.open(action.url, '_blank', 'noopener');
        break;
      case 'anchor':
        document.getElementById(action.id)?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'markdown':
        void Promise.resolve(state.openFile(action.path, action.anchor)).catch((error) => {
          state.showError(error);
        });
        break;
      case 'local-file':
        void state.api.openExternal(action.path).catch((error) => {
          state.showError(error);
        });
        break;
    }
  });
}
