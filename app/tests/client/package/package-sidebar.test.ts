// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPackageSidebar } from '../../../src/client/components/package-sidebar.js';
import { mountSidebar } from '../../../src/client/components/sidebar.js';
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
    metadata: {},
    manifestStatus: 'present' as const,
    manifestPath: '/tmp/mdv-pkg-sample/_nav.md',
    collapsedGroups: new Set<string>(),
    ...overrides,
  };
}

function renderPackageSidebar(
  packageStateOverrides: Partial<ReturnType<typeof createPackageState>> = {},
  actionOverrides: Partial<{
    onOpenFile: (path: string) => void | Promise<void>;
    onEditManifest: () => void | Promise<void>;
  }> = {},
) {
  document.body.innerHTML = '<div id="package-sidebar"></div>';
  const store = createStore({
    packageState: createPackageState(packageStateOverrides),
  });
  const actions = {
    onOpenFile: vi.fn(),
    onEditManifest: vi.fn(),
    ...actionOverrides,
  };

  const cleanup = mountPackageSidebar(
    document.querySelector<HTMLElement>('#package-sidebar')!,
    store,
    actions,
  );

  return { store, actions, cleanup };
}

function renderSidebar(packageStateOverrides: Partial<ReturnType<typeof createPackageState>> = {}) {
  document.body.innerHTML = '<div id="sidebar"></div>';
  const store = createStore({
    session: { ...emptySession, lastRoot: '/workspace' },
    packageState: createPackageState({
      active: false,
      sidebarMode: 'filesystem',
      sourcePath: null,
      effectiveRoot: null,
      format: null,
      mode: null,
      manifestStatus: null,
      manifestPath: null,
      ...packageStateOverrides,
    }),
  });

  const cleanup = mountSidebar(document.querySelector<HTMLElement>('#sidebar')!, store, {
    onToggleWorkspacesCollapsed: vi.fn(),
    onSwitchRoot: vi.fn(),
    onRemoveWorkspace: vi.fn(),
    onBrowse: vi.fn(),
    onPin: vi.fn(),
    onCopy: vi.fn(),
    onRefresh: vi.fn(),
    onOpenFile: vi.fn(),
  });

  return { store, cleanup };
}

async function renderAppWithPackage(navigation: PackageNavigationNode[], html: string) {
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
      content: '# Package Document',
      html,
      warnings: [],
      modifiedAt: '2026-03-24T00:00:00.000Z',
      size: 128,
    })),
    render: vi.fn().mockResolvedValue({ html, warnings: [] }),
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
  };

  const { bootstrapApp } = await import('../../../src/client/app.js');
  const { store } = await bootstrapApp(api as never, null);
  store.update(
    {
      session: { ...store.get().session, lastRoot: '/tmp/mdv-pkg-sample' },
      packageState: createPackageState({
        navigation,
        metadata: { title: 'Sample Package' },
      }),
    },
    ['session', 'packageState'],
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { store, api };
}

describe('package sidebar', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage?.clear?.();
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
  });

  it('TC-1.4b: nested navigation entry opens the correct extracted document', () => {
    const { actions } = renderPackageSidebar({
      navigation: [
        {
          displayName: 'Authentication',
          children: [
            {
              displayName: 'OAuth2 Flow',
              filePath: 'auth/oauth2.md',
              children: [],
              isGroup: false,
            },
          ],
          isGroup: true,
        },
      ],
    });

    document
      .querySelector<HTMLButtonElement>('.pkg-nav__link[data-path="auth/oauth2.md"]')
      ?.click();

    expect(actions.onOpenFile).toHaveBeenCalledWith('/tmp/mdv-pkg-sample/auth/oauth2.md');
  });

  it('TC-1.4c: clicking an entry creates a tab with the manifest display name', async () => {
    await renderAppWithPackage(
      [
        {
          displayName: 'Getting Started',
          filePath: 'getting-started.md',
          children: [],
          isGroup: false,
        },
      ],
      '<article class="markdown-body"><h1>Getting Started</h1></article>',
    );

    document
      .querySelector<HTMLButtonElement>('.pkg-nav__link[data-path="getting-started.md"]')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const tab = document.querySelector('.tab');
    expect(tab).not.toBeNull();
    expect(tab!.textContent!.trim()).toContain('Getting Started');
  });

  it('TC-1.4e: package files render with the same mermaid and code block output as filesystem files', async () => {
    await renderAppWithPackage(
      [{ displayName: 'Architecture', filePath: 'architecture.md', children: [], isGroup: false }],
      '<article class="markdown-body"><svg data-testid="mermaid"></svg><pre class="shiki"><code>const x = 1;</code></pre></article>',
    );

    document
      .querySelector<HTMLButtonElement>('.pkg-nav__link[data-path="architecture.md"]')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('svg[data-testid="mermaid"]')).not.toBeNull();
    expect(document.querySelector('pre.shiki')).not.toBeNull();
  });

  it('TC-1.5a: group labels are headings and do not open a document when clicked', () => {
    const { actions } = renderPackageSidebar({
      navigation: [
        {
          displayName: 'Endpoints',
          children: [
            { displayName: 'List', filePath: 'endpoints/list.md', children: [], isGroup: false },
          ],
          isGroup: true,
        },
      ],
    });

    document
      .querySelector<HTMLElement>('.pkg-nav__group')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(actions.onOpenFile).not.toHaveBeenCalled();
    expect(document.querySelector('.pkg-nav__label')?.textContent).toBe('Endpoints');
  });

  it('TC-1.5b: group labels collapse and expand their children', () => {
    renderPackageSidebar({
      navigation: [
        {
          displayName: 'Endpoints',
          children: [
            { displayName: 'List', filePath: 'endpoints/list.md', children: [], isGroup: false },
          ],
          isGroup: true,
        },
      ],
    });

    expect(document.querySelector<HTMLElement>('.pkg-nav__children')?.hidden).toBe(false);
    document.querySelector<HTMLButtonElement>('.pkg-nav__toggle')?.click();
    expect(document.querySelector<HTMLElement>('.pkg-nav__children')?.hidden).toBe(true);
    document.querySelector<HTMLButtonElement>('.pkg-nav__toggle')?.click();
    expect(document.querySelector<HTMLElement>('.pkg-nav__children')?.hidden).toBe(false);
  });

  it('TC-2.1a: full metadata shows title, version, and author', () => {
    renderPackageSidebar({
      metadata: {
        title: 'Sample Package',
        version: '1.0.0',
        author: 'Test Author',
      },
    });

    expect(document.querySelector('.pkg-header__title')?.textContent).toBe('Sample Package');
    expect(document.querySelector('.pkg-header__version')?.textContent).toBe('1.0.0');
    expect(document.querySelector('.pkg-header__author')?.textContent).toBe('Test Author');
  });

  it('TC-2.1b: partial metadata omits empty placeholders', () => {
    renderPackageSidebar({
      metadata: { title: 'Title Only' },
    });

    expect(document.querySelector('.pkg-header__title')?.textContent).toBe('Title Only');
    expect(document.querySelector('.pkg-header__version')).toBeNull();
    expect(document.querySelector('.pkg-header__author')).toBeNull();
  });

  it('TC-2.1c: missing metadata falls back to the package filename', () => {
    renderPackageSidebar({
      metadata: {},
      sourcePath: '/packages/no-meta.mpk',
    });

    expect(document.querySelector('.pkg-header__title')?.textContent).toBe('no-meta.mpk');
  });

  it('TC-2.2a: package mode shows a Package indicator', () => {
    renderPackageSidebar();

    expect(document.querySelector('.pkg-header__mode')?.textContent).toBe('Package');
  });

  it('TC-2.2b: filesystem mode shows a Folder indicator', () => {
    renderSidebar();

    expect(document.querySelector('.sidebar__mode-indicator')?.textContent).toBe('Folder');
  });

  it('TC-2.3a: a flat list renders five top-level entries', () => {
    renderPackageSidebar({
      navigation: Array.from({ length: 5 }, (_, index) => ({
        displayName: `Page ${index + 1}`,
        filePath: `page-${index + 1}.md`,
        children: [],
        isGroup: false,
      })),
    });

    expect(document.querySelectorAll('.pkg-nav__link')).toHaveLength(5);
  });

  it('TC-2.3b: nested hierarchy renders groups and children', () => {
    renderPackageSidebar({
      navigation: [
        { displayName: 'Overview', filePath: 'overview.md', children: [], isGroup: false },
        {
          displayName: 'Guides',
          children: [
            {
              displayName: 'Quick Start',
              filePath: 'guides/quick-start.md',
              children: [],
              isGroup: false,
            },
          ],
          isGroup: true,
        },
      ],
    });

    expect(document.querySelectorAll('.pkg-nav__group')).toHaveLength(1);
    expect(
      document.querySelector('.pkg-nav__link[data-path="guides/quick-start.md"]'),
    ).not.toBeNull();
  });

  it('TC-2.3c: three levels of nesting render with progressive indentation', () => {
    renderPackageSidebar({
      navigation: [
        {
          displayName: 'Reference',
          children: [
            {
              displayName: 'API',
              children: [
                {
                  displayName: 'Authentication',
                  filePath: 'reference/api/authentication.md',
                  children: [],
                  isGroup: false,
                },
              ],
              isGroup: true,
            },
          ],
          isGroup: true,
        },
      ],
    });

    const topGroup = document.querySelectorAll<HTMLElement>('.pkg-nav__group')[0];
    const nestedGroup = document.querySelectorAll<HTMLElement>('.pkg-nav__group')[1];
    const nestedLink = document.querySelector<HTMLElement>(
      '.pkg-nav__link[data-path="reference/api/authentication.md"]',
    );

    expect(topGroup?.style.paddingLeft).toBe('0rem');
    expect(nestedGroup?.style.paddingLeft).toBe('1rem');
    expect(nestedLink?.style.marginLeft).toBe('2rem');
  });

  it('Performance: 100+ package entries render in under 100ms', () => {
    const start = performance.now();
    renderPackageSidebar({
      navigation: Array.from({ length: 120 }, (_, index) => ({
        displayName: `Page ${index + 1}`,
        filePath: `docs/page-${index + 1}.md`,
        children: [],
        isGroup: false,
      })),
    });
    const duration = performance.now() - start;

    expect(document.querySelectorAll('.pkg-nav__link')).toHaveLength(120);
    expect(duration).toBeLessThan(100);
  });
});
