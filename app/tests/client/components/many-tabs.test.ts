// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountContentArea } from '../../../src/client/components/content-area.js';
import { mountTabStrip } from '../../../src/client/components/tab-strip.js';
import type { TabState } from '../../../src/client/state.js';
import { basicFileResponse } from '../../fixtures/file-responses.js';
import { emptySession } from '../../fixtures/session.js';
import { singleTab } from '../../fixtures/tab-states.js';
import { createStore } from '../support.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

class MockWsClient {
  readonly sent = vi.fn<(message: unknown) => void>();

  readonly connect = vi.fn();

  private readonly handlers = new Map<string, Set<(event: unknown) => void>>();

  on(type: string, handler: (event: unknown) => void): () => void {
    const nextHandlers = this.handlers.get(type) ?? new Set();
    nextHandlers.add(handler);
    this.handlers.set(type, nextHandlers);

    return () => {
      nextHandlers.delete(handler);
    };
  }

  send(message: unknown): void {
    this.sent(message);
  }
}

function createTab(index: number): TabState {
  return {
    ...singleTab,
    id: `tab-${index + 1}`,
    path: `/docs/doc-${index + 1}.md`,
    canonicalPath: `/docs/doc-${index + 1}.md`,
    filename: `doc-${index + 1}.md`,
    html: `<h1>Document ${index + 1}</h1>`,
    content: `# Document ${index + 1}`,
  };
}

function createTabs(count: number): TabState[] {
  return Array.from({ length: count }, (_, index) => createTab(index));
}

async function flushUi(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function renderAppWithTabs(paths: string[]) {
  const session = {
    ...emptySession,
    openTabs: paths,
    activeTab: paths.at(-1) ?? null,
  };

  const api = {
    bootstrap: vi.fn().mockResolvedValue({
      session,
      availableThemes,
    }),
    setRoot: vi.fn(),
    addWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
    setTheme: vi.fn().mockResolvedValue(session),
    setDefaultMode: vi.fn().mockResolvedValue(session),
    updateSidebar: vi.fn().mockResolvedValue(session),
    getTree: vi.fn().mockResolvedValue({ root: '/root', tree: [] }),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue(null),
    readFile: vi.fn().mockImplementation(async (path: string) => ({
      ...basicFileResponse,
      path,
      canonicalPath: path,
      filename: path.split('/').filter(Boolean).at(-1) ?? path,
      html: `<h1>${path}</h1>`,
      content: `# ${path}`,
    })),
    openExternal: vi.fn().mockResolvedValue({ ok: true }),
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
    updateTabs: vi
      .fn()
      .mockImplementation(async (openTabs: string[], activeTab: string | null) => ({
        ...session,
        openTabs,
        activeTab,
      })),
    touchRecentFile: vi.fn().mockResolvedValue(session),
    removeRecentFile: vi.fn().mockResolvedValue(session),
  };

  document.body.innerHTML = `
    <div id="app">
      <header id="menu-bar"></header>
      <div id="main">
        <aside id="sidebar"></aside>
        <div id="workspace">
          <div id="tab-strip"></div>
          <div id="content-area"></div>
        </div>
      </div>
    </div>
  `;

  window.__MDV_DISABLE_AUTO_BOOTSTRAP__ = true;
  vi.resetModules();

  const wsClient = new MockWsClient();
  const { bootstrapApp } = await import('../../../src/client/app.js');
  const result = await bootstrapApp(api as never, wsClient as never);
  await flushUi();

  return {
    api,
    wsClient,
    store: result.store,
  };
}

describe('many tabs', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('TC-3.1a: tab switch with 25 tabs', () => {
    document.body.innerHTML = '<div id="content-area"></div>';

    const tabs = createTabs(25);
    const store = createStore({
      tabs: tabs.map((tab, index) => ({
        ...tab,
        html: `<h1>Document ${index + 1}</h1>`,
      })),
      activeTabId: tabs[0]?.id ?? null,
      contentToolbarVisible: true,
    });

    mountContentArea(document.querySelector<HTMLElement>('#content-area')!, store, {
      onBrowse: vi.fn(),
      onOpenFile: vi.fn(),
    });

    for (const tab of tabs) {
      store.update({ activeTabId: tab.id }, ['activeTabId']);

      expect(store.get().activeTabId).toBe(tab.id);
      expect(document.querySelector('.markdown-body')?.innerHTML).toContain(
        `Document ${tab.id.replace('tab-', '')}`,
      );
    }
  });

  it('TC-3.1b: open 21st tab', () => {
    const tabs = createTabs(20);
    const store = createStore({
      tabs,
      activeTabId: tabs[19]?.id ?? null,
      contentToolbarVisible: true,
    });
    const newTab = createTab(20);

    store.update(
      {
        tabs: [...tabs, newTab],
        activeTabId: newTab.id,
      },
      ['tabs', 'activeTabId'],
    );

    expect(store.get().tabs).toHaveLength(21);
    expect(store.get().activeTabId).toBe(newTab.id);
  });

  it('TC-3.1c: tab strip with 30 tabs', () => {
    document.body.innerHTML = '<div id="tab-strip"></div>';

    const tabs = createTabs(30);
    const store = createStore({
      tabs,
      activeTabId: tabs[0]?.id ?? null,
      contentToolbarVisible: true,
    });

    mountTabStrip(document.querySelector<HTMLElement>('#tab-strip')!, store, {
      onActivateTab: vi.fn(),
      onCloseTab: vi.fn(),
      onCloseOtherTabs: vi.fn(),
      onCloseTabsToRight: vi.fn(),
      onCopyTabPath: vi.fn(),
    });

    const scrollContainer = document.querySelector<HTMLElement>('.tab-strip__scroll-container')!;
    Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 3200 });
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 400 });
    window.dispatchEvent(new Event('resize'));

    expect(document.querySelector('.tab-strip__scroll-container')).not.toBeNull();
    expect(document.querySelector('.tab-strip__count')?.hasAttribute('hidden')).toBe(false);
    expect(document.body.textContent).toContain('30 tabs');
  });

  it('TC-3.2a: memory released on tab close', () => {
    const tabs = createTabs(25);
    const store = createStore({
      tabs,
      activeTabId: tabs[24]?.id ?? null,
      contentToolbarVisible: true,
    });

    store.update(
      {
        tabs: tabs.slice(20),
        activeTabId: tabs[24]?.id ?? null,
      },
      ['tabs', 'activeTabId'],
    );

    expect(store.get().tabs).toHaveLength(5);
    expect(store.get().tabs.map((tab) => tab.id)).toEqual([
      'tab-21',
      'tab-22',
      'tab-23',
      'tab-24',
      'tab-25',
    ]);
  });

  it('TC-3.2b: file watchers released on tab close', async () => {
    const paths = Array.from({ length: 25 }, (_, index) => `/docs/doc-${index + 1}.md`);
    const closedPaths = paths.slice(0, 20);
    const { store, wsClient } = await renderAppWithTabs(paths);

    for (const expectedPath of closedPaths) {
      document.querySelector<HTMLButtonElement>('.tab__close')?.click();
      await flushUi();

      const unwatchMessages = wsClient.sent.mock.calls
        .map(([message]) => message as { type?: string; path?: string })
        .filter((message) => message.type === 'unwatch')
        .map((message) => message.path);

      expect(unwatchMessages).toContain(expectedPath);
    }

    const unwatchMessages = wsClient.sent.mock.calls
      .map(([message]) => message as { type?: string; path?: string })
      .filter((message) => message.type === 'unwatch')
      .map((message) => message.path);

    expect(unwatchMessages).toEqual(closedPaths);
    expect(store.get().tabs).toHaveLength(5);
  });
});
