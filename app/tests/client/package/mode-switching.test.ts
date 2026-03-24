// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabState } from '../../../src/client/state.js';
import { emptySession } from '../../fixtures/session.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

function renderShell(): void {
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
}

function flushUi(): Promise<void> {
  return Promise.resolve().then(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

function createPackageOpenResponse(sourcePath = '/tmp/test.mpk') {
  return {
    metadata: { title: 'Sample Package' },
    navigation: [
      {
        displayName: 'Getting Started',
        filePath: 'getting-started.md',
        children: [],
        isGroup: false,
      },
    ],
    packageInfo: {
      sourcePath,
      extractedRoot: '/tmp/mdv-pkg-sample',
      format: sourcePath.endsWith('.mpkz') ? ('mpkz' as const) : ('mpk' as const),
      manifestStatus: 'present' as const,
    },
  };
}

function createTab(id: string, path: string): TabState {
  const filename = path.split('/').filter(Boolean).at(-1) ?? path;
  return {
    id,
    path,
    canonicalPath: path,
    filename,
    html: `<h1>${filename}</h1>`,
    content: `# ${filename}`,
    warnings: [],
    scrollPosition: 0,
    loading: false,
    modifiedAt: '2026-03-24T00:00:00.000Z',
    size: 128,
    status: 'ok',
    mode: 'render',
    editContent: null,
    editScrollPosition: 0,
    cursorPosition: null,
    dirty: false,
    editedSinceLastSave: false,
  };
}

async function bootstrap(
  options: {
    sessionOverrides?: Partial<typeof emptySession>;
    apiOverrides?: Record<string, unknown>;
  } = {},
) {
  renderShell();

  const session = {
    ...emptySession,
    ...options.sessionOverrides,
  };

  const api = {
    bootstrap: vi.fn().mockResolvedValue({
      session,
      availableThemes,
    }),
    setRoot: vi.fn().mockImplementation(async (root: string) => ({
      ...session,
      lastRoot: root,
      activePackage: null,
    })),
    addWorkspace: vi.fn().mockResolvedValue(session),
    removeWorkspace: vi.fn().mockResolvedValue(session),
    setTheme: vi.fn().mockResolvedValue(session),
    setDefaultMode: vi.fn().mockResolvedValue(session),
    updateSidebar: vi.fn().mockResolvedValue(session),
    getTree: vi.fn().mockImplementation(async (root: string) => ({
      root,
      tree: [],
    })),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue(null),
    readFile: vi.fn(),
    render: vi.fn().mockResolvedValue({ html: '<h1>Rendered</h1>', warnings: [] }),
    saveFile: vi.fn(),
    saveDialog: vi.fn().mockResolvedValue(null),
    openExternal: vi.fn().mockResolvedValue({ ok: true }),
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
    updateTabs: vi.fn().mockResolvedValue(session),
    touchRecentFile: vi.fn().mockResolvedValue(session),
    removeRecentFile: vi.fn().mockResolvedValue(session),
    exportDocument: vi.fn(),
    exportSaveDialog: vi.fn(),
    reveal: vi.fn(),
    setLastExportDir: vi.fn().mockResolvedValue(session),
    openPackage: vi
      .fn()
      .mockImplementation(async (filePath: string) => createPackageOpenResponse(filePath)),
    getPackageManifest: vi.fn().mockResolvedValue({
      metadata: { title: 'Restored Package' },
      navigation: [
        {
          displayName: 'Intro',
          filePath: 'intro.md',
          children: [],
          isGroup: false,
        },
      ],
      raw: '# _nav.md',
    }),
    ...options.apiOverrides,
  };

  window.__MDV_DISABLE_AUTO_BOOTSTRAP__ = true;
  const { bootstrapApp } = await import('../../../src/client/app.js');
  const result = await bootstrapApp(api as never, null);
  await flushUi();

  return {
    api,
    store: result.store,
  };
}

function dispatchDrop(path: string): void {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: [{ path }],
    },
  });
  document.dispatchEvent(event);
}

describe('package mode switching', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage?.clear?.();
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
  });

  it('TC-1.2a: drag-drop opens package', async () => {
    const { api } = await bootstrap();

    dispatchDrop('/tmp/test.mpk');
    await flushUi();

    expect(api.openPackage).toHaveBeenCalledWith('/tmp/test.mpk');
  });

  it('TC-1.2b: dropping non-package file does not change mode', async () => {
    const { api, store } = await bootstrap();

    dispatchDrop('/tmp/test.txt');
    await flushUi();

    expect(api.openPackage).not.toHaveBeenCalled();
    expect(store.get().packageState.sidebarMode).toBe('filesystem');
  });

  it('TC-1.3a: CLI argument opens package', async () => {
    const { api, store } = await bootstrap({
      sessionOverrides: {
        activePackage: {
          sourcePath: '/tmp/test.mpk',
          extractedRoot: '/tmp/mdv-pkg-sample',
          format: 'mpk',
          mode: 'extracted',
          stale: false,
          manifestStatus: 'present',
        },
      },
    });

    expect(api.getPackageManifest).toHaveBeenCalledTimes(1);
    expect(store.get().packageState).toMatchObject({
      active: true,
      sidebarMode: 'package',
      sourcePath: '/tmp/test.mpk',
      effectiveRoot: '/tmp/mdv-pkg-sample',
    });
  });

  it('TC-1.3b: CLI argument with non-existent file', async () => {
    const { store } = await bootstrap({
      sessionOverrides: {
        activePackage: null,
      },
    });

    expect(store.get().packageState.active).toBe(false);
  });

  it('TC-1.3c: CLI argument with non-package file', async () => {
    const { api, store } = await bootstrap({
      sessionOverrides: {
        lastRoot: '/workspace',
        activePackage: null,
      },
    });

    expect(api.getTree).toHaveBeenCalledWith('/workspace');
    expect(store.get().packageState.sidebarMode).toBe('filesystem');
  });

  it('TC-3.1b: package tabs closed on mode switch', async () => {
    const { api, store } = await bootstrap({
      sessionOverrides: {
        workspaces: [
          {
            path: '/workspace',
            label: 'workspace',
            addedAt: '2026-03-24T00:00:00.000Z',
          },
        ],
        lastRoot: '/tmp/mdv-pkg-sample',
      },
    });

    store.update(
      {
        session: {
          ...store.get().session,
          workspaces: [
            {
              path: '/workspace',
              label: 'workspace',
              addedAt: '2026-03-24T00:00:00.000Z',
            },
          ],
          lastRoot: '/tmp/mdv-pkg-sample',
        },
        packageState: {
          active: true,
          sidebarMode: 'package',
          sourcePath: '/tmp/test.mpk',
          effectiveRoot: '/tmp/mdv-pkg-sample',
          format: 'mpk',
          mode: 'extracted',
          navigation: [],
          metadata: {},
          stale: false,
          manifestStatus: 'present',
          manifestError: null,
          manifestPath: '/tmp/mdv-pkg-sample/_nav.md',
          collapsedGroups: new Set(),
        },
        tabs: [
          createTab('pkg-1', '/tmp/mdv-pkg-sample/intro.md'),
          createTab('pkg-2', '/tmp/mdv-pkg-sample/guide.md'),
          createTab('fs-1', '/workspace/readme.md'),
        ],
        activeTabId: 'pkg-1',
      },
      ['session', 'packageState', 'tabs', 'activeTabId'],
    );
    await flushUi();

    document.querySelector<HTMLElement>('.workspace-entry[data-path="/workspace"]')?.click();
    await flushUi();

    expect(api.setRoot).toHaveBeenCalledWith('/workspace');
    expect(store.get().tabs.map((tab) => tab.path)).toEqual(['/workspace/readme.md']);
    expect(store.get().activeTabId).toBe('fs-1');
    expect(store.get().packageState.active).toBe(false);
  });

  it('TC-3.2a: switch from filesystem to package mode', async () => {
    const { store } = await bootstrap();

    dispatchDrop('/tmp/test.mpk');
    await flushUi();

    expect(store.get().packageState.sidebarMode).toBe('package');
    expect(store.get().packageState.navigation.length).toBeGreaterThan(0);
    expect(store.get().packageState.navigation).toEqual([
      {
        displayName: 'Getting Started',
        filePath: 'getting-started.md',
        children: [],
        isGroup: false,
      },
    ]);
  });
});
