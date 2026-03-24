// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/client/components/file-tree.js', () => ({
  collectAllDirPaths: vi.fn(() => []),
  mountFileTree: vi.fn((container: HTMLElement, store, actions) => {
    const fileButtons = store
      .get()
      .tree.filter((node: { type: string }) => node.type === 'file')
      .map((node: { name: string; path: string }) => {
        const button = document.createElement('button');
        button.className = 'mock-file-tree__file';
        button.dataset.path = node.path;
        button.textContent = node.name;
        button.addEventListener('click', () => {
          actions.onSelectFile(node.path);
        });
        return button;
      });

    container.replaceChildren(...fileButtons);
    return () => {
      container.replaceChildren();
    };
  }),
}));

vi.mock('../../../src/client/components/package-sidebar.js', () => ({
  mountPackageSidebar: vi.fn(() => () => {}),
}));

vi.mock('../../../src/client/components/package-header.js', () => ({
  mountPackageHeader: vi.fn(() => () => {}),
}));

vi.mock('../../../src/client/components/root-line.js', () => ({
  mountRootLine: vi.fn(() => () => {}),
}));

vi.mock('../../../src/client/components/workspaces.js', () => ({
  mountWorkspaces: vi.fn(() => () => {}),
}));

import { bootstrapApp } from '../../../src/client/app.js';
import { mountSidebar } from '../../../src/client/components/sidebar.js';
import { getDefaultPackageState } from '../../../src/client/state.js';
import type { ClientState } from '../../../src/client/state.js';
import { emptySession } from '../../fixtures/session.js';
import { createStore } from '../support.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

function getButtonByExactText(text: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text,
  );

  if (!match) {
    throw new Error(`Button not found: ${text}`);
  }

  return match;
}

function createPackageState(
  overrides: Partial<ReturnType<typeof getDefaultPackageState>> = {},
): ReturnType<typeof getDefaultPackageState> {
  return {
    ...getDefaultPackageState(),
    active: true,
    sidebarMode: 'fallback',
    sourcePath: '/packages/sample.mpk',
    effectiveRoot: '/tmp/mdv-pkg-sample',
    format: 'mpk',
    mode: 'extracted',
    navigation: [],
    metadata: {},
    stale: false,
    manifestStatus: 'missing',
    manifestError: null,
    manifestPath: null,
    collapsedGroups: new Set<string>(),
    ...overrides,
  };
}

function renderSidebar(
  overrides: Partial<ClientState> = {},
  packageStateOverrides: Partial<ReturnType<typeof createPackageState>> = {},
) {
  document.body.innerHTML = '<div id="sidebar"></div>';
  const store = createStore({
    session: { ...emptySession, lastRoot: '/tmp/mdv-pkg-sample' },
    tree: [
      {
        name: 'guide.md',
        path: '/tmp/mdv-pkg-sample/guide.md',
        type: 'file',
      },
    ],
    packageState: createPackageState(packageStateOverrides),
    ...overrides,
  });
  const actions = {
    onToggleWorkspacesCollapsed: vi.fn(),
    onSwitchRoot: vi.fn(),
    onRemoveWorkspace: vi.fn(),
    onBrowse: vi.fn(),
    onPin: vi.fn(),
    onCopy: vi.fn(),
    onRefresh: vi.fn(),
    onOpenFile: vi.fn(),
  };

  const cleanup = mountSidebar(document.querySelector<HTMLElement>('#sidebar')!, store, actions);

  return { cleanup, store, actions };
}

function createApi(overrides: Record<string, unknown> = {}) {
  return {
    bootstrap: vi.fn().mockResolvedValue({
      session: {
        ...emptySession,
        activePackage: {
          sourcePath: '/packages/sample.mpk',
          extractedRoot: '/tmp/mdv-pkg-sample',
          format: 'mpk' as const,
          mode: 'extracted' as const,
          stale: false,
          manifestStatus: 'unreadable' as const,
        },
      },
      availableThemes,
    }),
    setRoot: vi.fn().mockResolvedValue(emptySession),
    addWorkspace: vi.fn().mockResolvedValue(emptySession),
    removeWorkspace: vi.fn().mockResolvedValue(emptySession),
    setTheme: vi.fn().mockResolvedValue(emptySession),
    setDefaultMode: vi.fn().mockResolvedValue(emptySession),
    updateSidebar: vi.fn().mockResolvedValue(emptySession),
    getTree: vi.fn().mockResolvedValue({ root: '/tmp/mdv-pkg-sample', tree: [] }),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue(null),
    readFile: vi.fn(),
    createPackage: vi.fn().mockResolvedValue({
      metadata: { title: 'sample' },
      navigation: [{ displayName: 'Guide', filePath: 'guide.md', children: [], isGroup: false }],
      manifestPath: '/tmp/mdv-pkg-sample/_nav.md',
    }),
    openPackage: vi.fn(),
    getPackageManifest: vi.fn(),
    render: vi.fn().mockResolvedValue({ html: '', warnings: [] }),
    saveFile: vi.fn(),
    saveDialog: vi.fn().mockResolvedValue(null),
    openExternal: vi.fn().mockResolvedValue({ ok: true }),
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
    updateTabs: vi.fn().mockResolvedValue(emptySession),
    touchRecentFile: vi.fn().mockResolvedValue(emptySession),
    removeRecentFile: vi.fn().mockResolvedValue(emptySession),
    exportDocument: vi.fn(),
    exportSaveDialog: vi.fn(),
    reveal: vi.fn(),
    setLastExportDir: vi.fn().mockResolvedValue(emptySession),
    ...overrides,
  };
}

describe('package fallback sidebar', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage?.clear?.();
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-8.1b: files remain navigable in fallback mode', () => {
    const { cleanup, actions } = renderSidebar();

    document.querySelector<HTMLButtonElement>('.mock-file-tree__file')?.click();

    expect(actions.onOpenFile).toHaveBeenCalledWith('/tmp/mdv-pkg-sample/guide.md');
    cleanup();
  });

  it('Non-TC: restore fetches the extracted tree in fallback mode', async () => {
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

    const api = createApi({
      getTree: vi.fn().mockResolvedValue({
        root: '/tmp/mdv-pkg-sample',
        tree: [
          {
            name: 'guide.md',
            path: '/tmp/mdv-pkg-sample/guide.md',
            type: 'file',
          },
        ],
      }),
    });

    const { store } = await bootstrapApp(api as never, null);

    expect(api.getTree).toHaveBeenCalledWith('/tmp/mdv-pkg-sample');
    expect(store.get().tree).toEqual([
      {
        name: 'guide.md',
        path: '/tmp/mdv-pkg-sample/guide.md',
        type: 'file',
      },
    ]);
  });

  it('TC-8.2a: fallback indicator is shown for missing manifests', () => {
    const { cleanup } = renderSidebar();

    expect(document.querySelector('.sidebar__fallback-indicator')?.textContent).toBe(
      'No manifest — showing filesystem view',
    );
    cleanup();
  });

  it('TC-8.2b: fallback indicator is not shown in folder mode', () => {
    const { cleanup } = renderSidebar(
      {},
      {
        active: false,
        sidebarMode: 'filesystem',
        sourcePath: null,
        effectiveRoot: null,
        format: null,
        mode: null,
        manifestStatus: null,
      },
    );

    expect(document.querySelector('.sidebar__fallback-indicator')).toBeNull();
    cleanup();
  });

  it('TC-8.2c: unreadable manifest shows a distinct fallback indicator', () => {
    const { cleanup } = renderSidebar({}, { manifestStatus: 'unreadable' });

    expect(document.querySelector('.sidebar__fallback-indicator')?.textContent).toContain(
      'could not be parsed',
    );
    cleanup();
  });

  it('TC-8.3b: scaffolding unreadable fallback package asks for overwrite confirmation', async () => {
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

    const api = createApi();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { store } = await bootstrapApp(api as never, null);

    document.querySelector<HTMLButtonElement>('[data-menu-trigger="file"]')?.click();
    getButtonByExactText('New Package').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(confirmSpy).toHaveBeenCalledWith(
      'The existing manifest could not be parsed. Overwrite with a new scaffold?',
    );
    expect(api.createPackage).toHaveBeenCalledWith({
      rootDir: '/tmp/mdv-pkg-sample',
      overwrite: true,
    });
    expect(store.get().packageState).toMatchObject({
      sidebarMode: 'package',
      manifestStatus: 'present',
      stale: true,
      manifestPath: '/tmp/mdv-pkg-sample/_nav.md',
    });
  });
});
