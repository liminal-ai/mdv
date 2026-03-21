// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { basicFileResponse } from '../../fixtures/file-responses.js';
import { emptySession } from '../../fixtures/session.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

function createPersistedTabs(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    path: `/root/doc-${index + 1}.md`,
    mode: 'render' as const,
  }));
}

function createFileResponse(path: string) {
  const filename = path.split('/').filter(Boolean).at(-1) ?? path;

  return {
    ...basicFileResponse,
    path,
    canonicalPath: path,
    filename,
    content: `# ${filename}`,
    html: `<h1>${filename}</h1>`,
  };
}

describe('startup', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
  });

  it('TC-4.1a: browser app ready within startup budget', async () => {
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

    const session = {
      ...emptySession,
      lastRoot: '/root',
      openTabs: [{ path: '/root/readme.md', mode: 'render' as const }],
      activeTab: '/root/readme.md',
    };
    const api = {
      bootstrap: vi.fn().mockResolvedValue({
        session,
        availableThemes,
      }),
      setRoot: vi.fn(),
      addWorkspace: vi.fn(),
      removeWorkspace: vi.fn(),
      setTheme: vi.fn(),
      setDefaultMode: vi.fn(),
      updateSidebar: vi.fn(),
      getTree: vi.fn().mockResolvedValue({
        root: '/root',
        tree: [{ name: 'readme.md', path: '/root/readme.md', type: 'file' as const }],
      }),
      browse: vi.fn(),
      pickFile: vi.fn(),
      readFile: vi.fn().mockResolvedValue({
        ...basicFileResponse,
        path: '/root/readme.md',
        canonicalPath: '/root/readme.md',
        filename: 'readme.md',
        html: '<h1>Ready</h1>',
      }),
      openExternal: vi.fn(),
      copyToClipboard: vi.fn(),
      updateTabs: vi.fn().mockResolvedValue(session),
      touchRecentFile: vi.fn().mockResolvedValue(session),
      removeRecentFile: vi.fn().mockResolvedValue(session),
      render: vi.fn(),
      saveFile: vi.fn(),
      saveDialog: vi.fn(),
    };

    window.__MDV_DISABLE_AUTO_BOOTSTRAP__ = true;
    const { bootstrapApp } = await import('../../../src/client/app.js');

    const start = performance.now();
    const result = await bootstrapApp(api as Parameters<typeof bootstrapApp>[0], null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000);
    expect(result.store.get().tabs).toHaveLength(1);
    expect(result.store.get().tree).toHaveLength(1);
    expect(document.body.textContent).toContain('readme.md');
    expect(document.body.textContent).toContain('Ready');
  });

  it('TC-4.1c: startup with 10 restored tabs', async () => {
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

    const openTabs = createPersistedTabs(10);
    const activeTab = openTabs[4]!.path;
    const session = {
      ...emptySession,
      lastRoot: '/root',
      openTabs,
      activeTab,
    };
    const api = {
      bootstrap: vi.fn().mockResolvedValue({
        session,
        availableThemes,
      }),
      setRoot: vi.fn(),
      addWorkspace: vi.fn(),
      removeWorkspace: vi.fn(),
      setTheme: vi.fn(),
      setDefaultMode: vi.fn(),
      updateSidebar: vi.fn(),
      getTree: vi.fn().mockResolvedValue({
        root: '/root',
        tree: openTabs.map((tab) => ({
          name: tab.path.split('/').filter(Boolean).at(-1) ?? tab.path,
          path: tab.path,
          type: 'file' as const,
        })),
      }),
      browse: vi.fn(),
      pickFile: vi.fn(),
      readFile: vi.fn().mockImplementation(async (path: string) => createFileResponse(path)),
      openExternal: vi.fn(),
      copyToClipboard: vi.fn(),
      updateTabs: vi.fn().mockResolvedValue(session),
      touchRecentFile: vi.fn().mockResolvedValue(session),
      removeRecentFile: vi.fn().mockResolvedValue(session),
      render: vi.fn(),
      saveFile: vi.fn(),
      saveDialog: vi.fn(),
    };

    window.__MDV_DISABLE_AUTO_BOOTSTRAP__ = true;
    const { bootstrapApp } = await import('../../../src/client/app.js');

    const result = await bootstrapApp(api as Parameters<typeof bootstrapApp>[0], null);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const state = result.store.get();

    expect(state.tabs).toHaveLength(10);
    expect(state.tabs.find((tab) => tab.path === activeTab)).toMatchObject({
      loading: false,
      status: 'ok',
    });
    expect(state.tabs.filter((tab) => tab.path !== activeTab && tab.loading)).toHaveLength(9);
    expect(api.readFile).toHaveBeenCalledTimes(1);
  });
});
