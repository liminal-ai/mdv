// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapApp } from '../../../src/client/app.js';
import { mountMenuBar } from '../../../src/client/components/menu-bar.js';
import { getDefaultPackageState } from '../../../src/client/state.js';
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

function createApi(overrides: Record<string, unknown> = {}) {
  return {
    bootstrap: vi.fn().mockResolvedValue({
      session: { ...emptySession, lastRoot: '/workspace' },
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
    readFile: vi.fn(),
    createPackage: vi.fn().mockResolvedValue({
      metadata: { title: 'workspace' },
      navigation: [{ displayName: 'Guide', filePath: 'guide.md', children: [], isGroup: false }],
      manifestPath: '/workspace/_nav.md',
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

describe('package creation client flow', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage?.clear?.();
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
  });

  it('TC-4.1c: sidebar switches to package mode', async () => {
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
    const { store } = await bootstrapApp(api as never, null);

    document.querySelector<HTMLButtonElement>('[data-menu-trigger="file"]')?.click();
    getButtonByExactText('New Package').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.createPackage).toHaveBeenCalledWith({ rootDir: '/workspace' });
    expect(store.get().packageState.active).toBe(true);
    expect(store.get().packageState.sidebarMode).toBe('package');
    expect(store.get().packageState.manifestPath).toBe('/workspace/_nav.md');
  });

  it('TC-4.4a: New Package disabled for extracted packages', () => {
    document.body.innerHTML = '<div id="menu-bar"></div>';

    const store = createStore({
      activeMenuId: 'file',
      packageState: {
        ...getDefaultPackageState(),
        active: true,
        sidebarMode: 'package',
        sourcePath: '/packages/sample.mpk',
        effectiveRoot: '/tmp/mdv-pkg-sample',
        format: 'mpk',
        mode: 'extracted',
        manifestStatus: 'present',
        manifestPath: '/tmp/mdv-pkg-sample/_nav.md',
      },
    });

    const cleanup = mountMenuBar(document.querySelector<HTMLElement>('#menu-bar')!, store, {
      onOpenFile: vi.fn(),
      onBrowse: vi.fn(),
      onOpenPackage: vi.fn(),
      onNewPackage: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onToggleSidebar: vi.fn(),
      onSetTheme: vi.fn(),
      onExportFormat: vi.fn(),
    });

    const newPackageButton = getButtonByExactText('New Package');
    expect(newPackageButton.hasAttribute('disabled')).toBe(true);

    cleanup();
  });
});
