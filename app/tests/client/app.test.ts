// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/client/api.js';
import { basicFileResponse } from '../fixtures/file-responses.js';
import { emptySession, populatedSession } from '../fixtures/session.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

describe('client bootstrap api injection', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage?.clear?.();
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
  });

  async function renderApp(session = emptySession, apiOverrides: Record<string, unknown> = {}) {
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
      pickFile: vi.fn().mockResolvedValue(null),
      readFile: vi.fn().mockImplementation(async (path: string) => ({
        ...basicFileResponse,
        path,
        canonicalPath: path,
        filename: path.split('/').filter(Boolean).at(-1) ?? path,
        html: `<h1>${path}</h1>`,
      })),
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
      ...apiOverrides,
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
    const { bootstrapApp } = await import('../../src/client/app.js');
    await bootstrapApp(api as Parameters<typeof bootstrapApp>[0]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    return api;
  }

  it('bootstraps the shell with an injected api', async () => {
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
      openTabs: [],
      activeTab: null,
    };
    await renderApp(session);

    expect(document.body.textContent).toContain('No recent files');
  });

  it('TC-10.1a: Permission denied error renders notification', async () => {
    const session = populatedSession;
    const api = await renderApp(session);
    api.getTree.mockRejectedValueOnce(new ApiError(403, 'PERMISSION_DENIED', 'Cannot read'));

    document.querySelector<HTMLButtonElement>('.root-line__refresh')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('Cannot read');
  });

  it('TC-10.2a: Deleted root on refresh shows error and clears tree', async () => {
    const session = populatedSession;
    const api = await renderApp(session);
    api.getTree.mockRejectedValueOnce(new ApiError(404, 'PATH_NOT_FOUND', 'Directory not found'));

    document.querySelector<HTMLButtonElement>('.root-line__refresh')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('Directory not found');
    expect(document.body.textContent).not.toContain('No folder selected');
    expect(document.querySelector('.root-line__path--invalid')?.textContent).toBe('~/code');
    expect(document.querySelector<HTMLButtonElement>('.root-line__copy--visible')).toBeTruthy();
    expect(document.querySelector<HTMLButtonElement>('.root-line__refresh')).toBeNull();
  });

  it('surfaces bootstrap tree-load errors to the user', async () => {
    await renderApp(populatedSession, {
      getTree: vi
        .fn()
        .mockRejectedValue(
          new ApiError(403, 'PERMISSION_DENIED', 'You do not have access to this folder.'),
        ),
    });

    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('You do not have access to this folder.');
  });

  it('reuses the existing tab when two opened paths resolve to the same canonical file', async () => {
    await renderApp(
      {
        ...emptySession,
        lastRoot: '/root',
      },
      {
        getTree: vi.fn().mockResolvedValue({
          root: '/root',
          tree: [
            { name: 'readme-a.md', path: '/root/docs/readme-a.md', type: 'file' as const },
            { name: 'readme-b.md', path: '/root/specs/readme-b.md', type: 'file' as const },
          ],
        }),
        readFile: vi.fn().mockImplementation(async (path: string) => ({
          ...basicFileResponse,
          path,
          canonicalPath: '/real/readme.md',
          filename: path.split('/').filter(Boolean).at(-1) ?? path,
          html: `<h1>${path}</h1>`,
        })),
      },
    );

    const fileRows = Array.from(document.querySelectorAll<HTMLElement>('[data-type="file"]'));
    fileRows[0]?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelectorAll('.tab')).toHaveLength(1);

    fileRows[1]?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelectorAll('.tab')).toHaveLength(1);
    expect(document.querySelector('.tab--active')?.getAttribute('title')).toBe(
      '/root/docs/readme-a.md',
    );
  });

  it('walks up parent directories until duplicate filenames are unique', async () => {
    await renderApp(
      {
        ...emptySession,
        openTabs: ['/root/one/team/readme.md', '/root/two/team/readme.md'],
        activeTab: '/root/two/team/readme.md',
      },
      {
        readFile: vi.fn().mockImplementation(async (path: string) => ({
          ...basicFileResponse,
          path,
          canonicalPath: path,
          filename: 'readme.md',
          html: `<h1>${path}</h1>`,
        })),
      },
    );

    const labels = Array.from(document.querySelectorAll('.tab__label')).map(
      (element) => element.textContent,
    );

    expect(labels).toEqual(['one/team/readme.md', 'two/team/readme.md']);
  });

  it('renders fallback shell when bootstrap fails', async () => {
    await renderApp(emptySession, {
      bootstrap: vi.fn().mockRejectedValue(new Error('Bootstrap failed')),
    });

    expect(document.body.textContent).toContain('MD Viewer');
    expect(document.body.textContent).toContain('No documents open');
    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('Bootstrap failed');
  });

  it('preserves cached theme when bootstrap fails', async () => {
    const storage = {
      getItem: vi.fn((key: string) => (key === 'mdv-theme' ? 'dark-cool' : null)),
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      key: vi.fn(),
      length: 0,
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });

    await renderApp(emptySession, {
      bootstrap: vi.fn().mockRejectedValue(new Error('Bootstrap failed')),
    });

    expect(storage.getItem('mdv-theme')).toBe('dark-cool');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe('dark-cool');
  });
});
