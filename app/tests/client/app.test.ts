// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySession, populatedSession } from '../fixtures/session.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

describe('client bootstrap api mocks', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../../src/client/api.js');
    document.body.innerHTML = '';
    window.localStorage?.clear?.();
  });

  async function renderApp(session = emptySession) {
    vi.resetModules();

    const api = {
      bootstrap: vi.fn().mockResolvedValue({
        session,
        availableThemes,
      }),
      setRoot: vi.fn().mockImplementation(async (root: string) => ({
        ...session,
        lastRoot: root,
      })),
      addWorkspace: vi.fn().mockResolvedValue({
        ...session,
        workspaces: session.lastRoot
          ? [
              ...session.workspaces,
              {
                path: session.lastRoot,
                label: session.lastRoot.split('/').filter(Boolean).at(-1) ?? session.lastRoot,
                addedAt: '2026-03-19T00:00:00.000Z',
              },
            ]
          : session.workspaces,
      }),
      removeWorkspace: vi.fn().mockImplementation(async (path: string) => ({
        ...session,
        workspaces: session.workspaces.filter((workspace) => workspace.path !== path),
      })),
      setTheme: vi.fn().mockResolvedValue(session),
      updateSidebar: vi.fn().mockImplementation(async (workspacesCollapsed: boolean) => ({
        ...session,
        sidebarState: { workspacesCollapsed },
      })),
      getTree: vi.fn().mockImplementation(async (root: string) => ({
        root,
        tree: [],
      })),
      browse: vi.fn().mockResolvedValue(null),
      copyToClipboard: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock('../../src/client/api.js', () => ({
      ApiClient: class {
        bootstrap = api.bootstrap;
        setRoot = api.setRoot;
        addWorkspace = api.addWorkspace;
        removeWorkspace = api.removeWorkspace;
        setTheme = api.setTheme;
        updateSidebar = api.updateSidebar;
        getTree = api.getTree;
        browse = api.browse;
        copyToClipboard = api.copyToClipboard;
      },
      ApiError: class extends Error {
        constructor(
          public readonly status: number,
          public readonly code: string,
          message: string,
        ) {
          super(message);
          this.name = 'ApiError';
        }
      },
    }));

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

    await import('../../src/client/app.js');
    await new Promise((resolve) => setTimeout(resolve, 0));

    return api;
  }

  it('bootstraps the shell with a mocked api module', async () => {
    const api = await renderApp();

    expect(api.bootstrap).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('MD Viewer');
    expect(document.body.textContent).toContain('No documents open');
  });

  it('TC-1.2c (integration): Bootstrap with default session renders clean state', async () => {
    await renderApp(emptySession);

    expect(document.body.textContent).toContain('MD Viewer');
    expect(document.body.textContent).toContain('No documents open');
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('light-default');
  });

  it('TC-1.2d (integration): Theme applied from session during bootstrap', async () => {
    await renderApp(populatedSession);

    expect(document.documentElement.dataset.theme).toBe('dark-default');
  });

  it('TC-8.2b (integration): Bootstrap with null root shows empty tree state', async () => {
    const api = await renderApp({
      ...populatedSession,
      lastRoot: null,
    });

    expect(document.body.textContent).toContain('leemoore');
    expect(document.body.textContent).toContain('liminal');
    expect(document.body.textContent).toContain('code');
    expect(document.body.textContent).toContain('No folder selected');
    expect(api.getTree).not.toHaveBeenCalled();
  });

  it('TC-8.3a (integration): Recent files rendered on bootstrap', async () => {
    await renderApp(populatedSession);

    expect(document.body.textContent).toContain('README.md');
    expect(document.body.textContent).toContain('/Users/leemoore/code/README.md');
  });

  it('keeps the sidebar visible on startup even when workspaces are collapsed', async () => {
    await renderApp({
      ...emptySession,
      sidebarState: { workspacesCollapsed: true },
    });

    expect(document.querySelector<HTMLElement>('#sidebar')?.hidden).toBe(false);
  });

  it('toggles sidebar visibility without persisting workspace collapse', async () => {
    const api = await renderApp(populatedSession);

    const viewButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === 'View',
    );
    viewButton?.click();
    const toggleButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Toggle Sidebar'),
    );
    toggleButton?.click();

    expect(document.querySelector<HTMLElement>('#sidebar')?.hidden).toBe(true);
    expect(api.updateSidebar).not.toHaveBeenCalled();
  });

  it('persists workspace collapse from the sidebar disclosure', async () => {
    const api = await renderApp(populatedSession);

    document.querySelector<HTMLButtonElement>('.section-header')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.updateSidebar).toHaveBeenCalledWith(true);
    expect(document.querySelector<HTMLElement>('.section-content')?.hidden).toBe(true);
  });

  it('refreshes the tree from the root line using the current root', async () => {
    const api = await renderApp(populatedSession);

    document.querySelector<HTMLButtonElement>('.root-line__refresh')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.getTree).toHaveBeenCalledWith('/Users/leemoore/code');
  });

  it('TC-8.3b: Session with no recent files after healing shows empty message', async () => {
    const session = {
      ...populatedSession,
      recentFiles: [],
    };
    await renderApp(session);

    expect(document.body.textContent).toContain('No recent files');
  });

  it('TC-10.1a: Permission denied error renders notification', async () => {
    const session = populatedSession;
    const api = await renderApp(session);

    const { ApiError } = await import('../../src/client/api.js');
    api.getTree.mockRejectedValueOnce(new ApiError(403, 'PERMISSION_DENIED', 'Cannot read'));

    document.querySelector<HTMLButtonElement>('.root-line__refresh')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('Cannot read');
  });

  it('TC-10.2a: Deleted root on refresh shows error and clears tree', async () => {
    const session = populatedSession;
    const api = await renderApp(session);

    const { ApiError } = await import('../../src/client/api.js');
    api.getTree.mockRejectedValueOnce(new ApiError(404, 'PATH_NOT_FOUND', 'Directory not found'));

    document.querySelector<HTMLButtonElement>('.root-line__refresh')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('Directory not found');
  });
});
