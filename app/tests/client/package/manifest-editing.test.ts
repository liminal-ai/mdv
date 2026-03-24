// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapApp } from '../../../src/client/app.js';
import { mountPackageSidebar } from '../../../src/client/components/package-sidebar.js';
import { getDefaultPackageState } from '../../../src/client/state.js';
import type { PackageNavigationNode } from '../../../src/client/state.js';
import { emptySession } from '../../fixtures/session.js';
import { createStore } from '../support.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

function flushUi(): Promise<void> {
  return Promise.resolve().then(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

function createPackageState(overrides: Partial<ReturnType<typeof getDefaultPackageState>> = {}) {
  return {
    ...getDefaultPackageState(),
    active: true,
    sidebarMode: 'package' as const,
    sourcePath: '/packages/sample.mpk',
    effectiveRoot: '/tmp/mdv-pkg-sample',
    format: 'mpk' as const,
    mode: 'extracted' as const,
    navigation: [],
    metadata: { title: 'Sample Package' },
    manifestStatus: 'present' as const,
    manifestPath: '/tmp/mdv-pkg-sample/_nav.md',
    collapsedGroups: new Set<string>(),
    ...overrides,
  };
}

function createLeaf(displayName: string, filePath: string): PackageNavigationNode {
  return {
    displayName,
    filePath,
    children: [],
    isGroup: false,
  };
}

function renderPackageSidebar(
  navigation: PackageNavigationNode[] = [],
  overrides: Partial<ReturnType<typeof createPackageState>> = {},
) {
  document.body.innerHTML = '<div id="package-sidebar"></div>';
  const store = createStore({
    packageState: createPackageState({
      navigation,
      ...overrides,
    }),
  });

  const cleanup = mountPackageSidebar(
    document.querySelector<HTMLElement>('#package-sidebar')!,
    store,
    {
      onOpenFile: vi.fn(),
      onEditManifest: vi.fn(),
    },
  );

  return { store, cleanup };
}

function getNavigationLabels(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.pkg-nav__link')).map(
    (element) => element.textContent?.trim() ?? '',
  );
}

async function renderApp() {
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

  const api = {
    bootstrap: vi.fn().mockResolvedValue({
      session: emptySession,
      availableThemes,
    }),
    setRoot: vi.fn().mockResolvedValue(emptySession),
    addWorkspace: vi.fn().mockResolvedValue(emptySession),
    removeWorkspace: vi.fn().mockResolvedValue(emptySession),
    setTheme: vi.fn().mockResolvedValue(emptySession),
    setDefaultMode: vi.fn().mockResolvedValue(emptySession),
    updateSidebar: vi.fn().mockResolvedValue(emptySession),
    getTree: vi.fn().mockResolvedValue({ root: '/workspace', tree: [] }),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue(null),
    readFile: vi.fn().mockImplementation(async (filePath: string) => ({
      path: filePath,
      canonicalPath: filePath,
      filename: filePath.split('/').filter(Boolean).at(-1) ?? filePath,
      content: '# Manifest',
      html: '<article class="markdown-body"><h1>Manifest</h1></article>',
      warnings: [],
      modifiedAt: '2026-03-24T00:00:00.000Z',
      size: 128,
    })),
    render: vi.fn().mockResolvedValue({ html: '<article></article>', warnings: [] }),
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
    openPackage: vi.fn(),
    createPackage: vi.fn(),
    getPackageManifest: vi.fn(),
  };

  const { store } = await bootstrapApp(api as never, null);
  await flushUi();

  return { api, store };
}

describe('manifest editing and sidebar updates', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage?.clear?.();
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-6.1b: clicking Edit Manifest opens the manifest in a tab', async () => {
    const { api, store } = await renderApp();

    store.update(
      {
        packageState: createPackageState({
          navigation: [createLeaf('Guide', 'guide.md')],
        }),
      },
      ['packageState'],
    );
    await flushUi();

    document.querySelector<HTMLButtonElement>('.pkg-header__edit-manifest')?.click();
    await flushUi();

    expect(api.readFile).toHaveBeenCalledWith('/tmp/mdv-pkg-sample/_nav.md');
    expect(document.querySelector('.tab')?.textContent).toContain('_nav.md');
  });

  it('TC-6.2c: reordering entries updates sidebar order', () => {
    const { store, cleanup } = renderPackageSidebar([
      createLeaf('Alpha', 'alpha.md'),
      createLeaf('Bravo', 'bravo.md'),
      createLeaf('Charlie', 'charlie.md'),
    ]);

    expect(getNavigationLabels()).toEqual(['Alpha', 'Bravo', 'Charlie']);

    store.update(
      {
        packageState: createPackageState({
          navigation: [
            createLeaf('Charlie', 'charlie.md'),
            createLeaf('Alpha', 'alpha.md'),
            createLeaf('Bravo', 'bravo.md'),
          ],
        }),
      },
      ['packageState'],
    );

    expect(getNavigationLabels()).toEqual(['Charlie', 'Alpha', 'Bravo']);
    cleanup();
  });

  it('TC-6.2d: adding a group label renders a package group heading', () => {
    const { store, cleanup } = renderPackageSidebar();

    store.update(
      {
        packageState: createPackageState({
          navigation: [
            {
              displayName: 'Guides',
              children: [createLeaf('Intro', 'guides/intro.md')],
              isGroup: true,
            },
          ],
        }),
      },
      ['packageState'],
    );

    expect(document.querySelector('.pkg-nav__group')).not.toBeNull();
    expect(document.querySelector('.pkg-nav__label')?.textContent).toBe('Guides');
    cleanup();
  });

  it('Non-TC: rendering 100+ manifest entries stays under 100ms', () => {
    const { store, cleanup } = renderPackageSidebar();
    const navigation = Array.from({ length: 125 }, (_, index) =>
      createLeaf(`Document ${index + 1}`, `docs/doc-${index + 1}.md`),
    );

    const startedAt = performance.now();
    store.update(
      {
        packageState: createPackageState({
          navigation,
        }),
      },
      ['packageState'],
    );
    const durationMs = performance.now() - startedAt;

    expect(document.querySelectorAll('.pkg-nav__link').length).toBe(125);
    expect(durationMs).toBeLessThan(100);
    cleanup();
  });
});
