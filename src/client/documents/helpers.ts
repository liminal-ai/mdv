import type { FileReadResponse, PersistedTab, RenderWarning } from '../../shared/types.js';
import type { ClientState, TabState } from '../state.js';
import { fileName } from '../utils/file-paths.js';

let tabSequence = 0;

export interface ScrollSnapshot {
  offset: number;
  ratio: number;
}

export function extractMermaidSources(html: string): string[] {
  if (!html) {
    return [];
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  return Array.from(template.content.querySelectorAll('code.language-mermaid'))
    .map((block) => block.textContent?.trim() ?? '')
    .filter((source) => source.length > 0);
}

export function createTabId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  tabSequence += 1;
  return `tab-${Date.now()}-${tabSequence}`;
}

export function createLoadingTab(
  path: string,
  mode: ClientState['session']['defaultOpenMode'] = 'render',
  scrollPosition = 0,
  filename = fileName(path),
): TabState {
  return {
    id: createTabId(),
    path,
    canonicalPath: path,
    filename,
    html: '',
    content: '',
    warnings: [],
    renderGeneration: 0,
    scrollPosition,
    loading: true,
    modifiedAt: '',
    size: 0,
    status: 'ok',
    mode,
    editContent: null,
    editScrollPosition: 0,
    cursorPosition: null,
    dirty: false,
    editedSinceLastSave: false,
  };
}

export function buildLoadedTab(
  response: FileReadResponse,
  existing?: TabState,
  defaultMode: ClientState['session']['defaultOpenMode'] = 'render',
): TabState {
  const preserveEditState = Boolean(existing?.dirty);

  return {
    id: existing?.id ?? createTabId(),
    path: existing?.path ?? response.path,
    canonicalPath: response.canonicalPath,
    filename: existing?.filename ?? response.filename,
    html: response.html,
    content: response.content,
    warnings: response.warnings,
    renderGeneration: (existing?.renderGeneration ?? -1) + 1,
    scrollPosition: existing?.scrollPosition ?? 0,
    loading: false,
    modifiedAt: response.modifiedAt,
    size: response.size,
    status: 'ok',
    mode: existing?.mode ?? defaultMode,
    editContent: preserveEditState ? (existing?.editContent ?? null) : null,
    editScrollPosition: existing?.editScrollPosition ?? 0,
    cursorPosition: existing?.cursorPosition ?? null,
    dirty: preserveEditState,
    editedSinceLastSave: preserveEditState ? (existing?.editedSinceLastSave ?? false) : false,
  };
}

export function normalizePersistedTab(
  tab: string | PersistedTab,
  defaultMode: ClientState['session']['defaultOpenMode'],
): PersistedTab {
  if (typeof tab === 'string') {
    return {
      path: tab,
      mode: defaultMode,
    };
  }

  return tab;
}

export function disambiguateDisplayNames(tabs: TabState[]): TabState[] {
  const nextTabs = tabs.map((tab) => ({ ...tab }));
  const groups = new Map<string, TabState[]>();

  for (const tab of nextTabs) {
    const base = fileName(tab.path);
    if (!groups.has(base)) {
      groups.set(base, []);
    }
    groups.get(base)?.push(tab);
  }

  for (const [, group] of groups) {
    if (group.length === 1) {
      continue;
    }

    const segments = group.map((tab) => tab.path.split('/').filter(Boolean));
    const maxDepth = Math.max(...segments.map((parts) => parts.length));

    for (let depth = 2; depth <= maxDepth; depth += 1) {
      const names = segments.map((parts) => parts.slice(-depth).join('/'));
      if (new Set(names).size === names.length) {
        group.forEach((tab, index) => {
          tab.filename = names[index] ?? tab.path;
        });
        break;
      }

      if (depth === maxDepth) {
        group.forEach((tab) => {
          tab.filename = tab.path;
        });
      }
    }
  }

  return nextTabs;
}

export function getContentBody(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.content-area__body');
}

export function saveScrollPosition(tabs: TabState[], activeTabId: string | null): TabState[] {
  if (!activeTabId) {
    return tabs;
  }

  const scrollTop = getContentBody()?.scrollTop ?? 0;
  return tabs.map((tab) => (tab.id === activeTabId ? { ...tab, scrollPosition: scrollTop } : tab));
}

export function restoreScrollPosition(scrollPosition: number): void {
  const applyScroll = () => {
    const body = getContentBody();
    if (body) {
      body.scrollTop = scrollPosition;
    }
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(applyScroll);
    return;
  }

  queueMicrotask(applyScroll);
}

export function captureScrollSnapshot(): ScrollSnapshot {
  const body = getContentBody();
  if (!body) {
    return { offset: 0, ratio: 0 };
  }

  const scrollableHeight = Math.max(body.scrollHeight - body.clientHeight, 0);
  return {
    offset: body.scrollTop,
    ratio: scrollableHeight > 0 ? body.scrollTop / scrollableHeight : 0,
  };
}

export function restoreScrollSnapshot(snapshot: ScrollSnapshot): void {
  const applyScroll = () => {
    const body = getContentBody();
    if (!body) {
      return;
    }

    const scrollableHeight = Math.max(body.scrollHeight - body.clientHeight, 0);
    body.scrollTop =
      scrollableHeight > 0 ? Math.round(scrollableHeight * snapshot.ratio) : snapshot.offset;
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(applyScroll);
    return;
  }

  queueMicrotask(applyScroll);
}

export function scrollToHeading(anchor: string): void {
  const scroll = () => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(scroll);
    return;
  }

  queueMicrotask(scroll);
}

export function buildSavedTab(
  tab: TabState,
  options: {
    path?: string;
    canonicalPath?: string;
    filename?: string;
    content: string;
    html?: string;
    warnings?: RenderWarning[];
    modifiedAt: string;
    size: number;
  },
): TabState {
  return {
    ...tab,
    path: options.path ?? tab.path,
    canonicalPath: options.canonicalPath ?? tab.canonicalPath,
    filename: options.filename ?? tab.filename,
    content: options.content,
    editContent: options.content,
    html: options.html ?? tab.html,
    warnings: options.warnings ?? tab.warnings,
    modifiedAt: options.modifiedAt,
    size: options.size,
    dirty: false,
    editedSinceLastSave: false,
    loading: false,
    status: 'ok',
    errorMessage: undefined,
  };
}

export function canPersistDirtyTab(tab: TabState | null): tab is TabState {
  return Boolean(
    tab &&
    (tab.status === 'ok' || (tab.status === 'deleted' && tab.dirty && tab.editContent !== null)),
  );
}
