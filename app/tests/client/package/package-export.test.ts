// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapApp } from '../../../src/client/app.js';
import { getDefaultPackageState } from '../../../src/client/state.js';
import { emptySession } from '../../fixtures/session.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

function flushUi(): Promise<void> {
  return Promise.resolve().then(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

function getButtonByExactText(text: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text,
  );

  if (!match) {
    throw new Error(`Button not found: ${text}`);
  }

  return match;
}

function createPackageState(overrides: Partial<ReturnType<typeof getDefaultPackageState>> = {}) {
  return {
    ...getDefaultPackageState(),
    active: true,
    sidebarMode: 'package' as const,
    sourcePath: '/original.mpk',
    effectiveRoot: '/tmp/mdv-pkg-sample',
    format: 'mpk' as const,
    mode: 'extracted' as const,
    metadata: { title: 'Sample Package' },
    stale: true,
    manifestStatus: 'present' as const,
    manifestPath: '/tmp/mdv-pkg-sample/_nav.md',
    collapsedGroups: new Set<string>(),
    ...overrides,
  };
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
    createPackage: vi.fn(),
    exportPackage: vi.fn().mockResolvedValue({
      outputPath: '/exports/sample.mpk',
      format: 'mpk',
      fileCount: 2,
      sizeBytes: 128,
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

async function renderApp(apiOverrides: Record<string, unknown> = {}) {
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

  const api = createApi(apiOverrides);
  const { store } = await bootstrapApp(api as never, null);
  await flushUi();

  return { api, store };
}

async function triggerExportPackage(): Promise<void> {
  document.querySelector<HTMLButtonElement>('[data-menu-trigger="export"]')?.click();
  getButtonByExactText('Export Package').click();
  await flushUi();
}

describe('package export client flow', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage?.clear?.();
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-5.3b: stale clears on re-export to original path', async () => {
    const { api, store } = await renderApp({
      saveDialog: vi.fn().mockResolvedValue({ path: '/original.mpk' }),
    });

    store.update(
      {
        packageState: createPackageState(),
      },
      ['packageState'],
    );
    await flushUi();

    await triggerExportPackage();

    expect(api.exportPackage).toHaveBeenCalledWith({
      outputPath: '/original.mpk',
      compress: false,
      sourceDir: '/tmp/mdv-pkg-sample',
    });
    expect(store.get().packageState.stale).toBe(false);
    expect(store.get().error).toEqual({
      code: 'EXPORT_SUCCESS',
      message: 'Package exported to /exports/sample.mpk',
      severity: 'info',
    });
  });

  it('TC-5.3c: stale remains on different path', async () => {
    const { store } = await renderApp({
      saveDialog: vi.fn().mockResolvedValue({ path: '/different.mpk' }),
    });

    store.update(
      {
        packageState: createPackageState(),
      },
      ['packageState'],
    );
    await flushUi();

    await triggerExportPackage();

    expect(store.get().packageState.stale).toBe(true);
  });

  it('TC-5.4a: cancel export', async () => {
    const { api, store } = await renderApp({
      saveDialog: vi.fn().mockResolvedValue(null),
    });

    store.update(
      {
        packageState: createPackageState({
          active: false,
          sourcePath: null,
          effectiveRoot: null,
          format: null,
          mode: null,
          stale: false,
          manifestStatus: null,
          manifestPath: null,
        }),
      },
      ['packageState'],
    );
    await flushUi();

    await triggerExportPackage();

    expect(api.exportPackage).not.toHaveBeenCalled();
  });
});
