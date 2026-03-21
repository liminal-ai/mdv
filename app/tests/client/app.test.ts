// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../../src/client/api.js';
import { basicFileResponse } from '../fixtures/file-responses.js';
import { emptySession, populatedSession } from '../fixtures/session.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

function openRootContextMenu(): HTMLElement {
  const rootLine = document.querySelector<HTMLElement>('.root-line');
  if (!rootLine) {
    throw new Error('Root line not found');
  }

  rootLine.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 24,
    }),
  );

  const menu = document.querySelector<HTMLElement>('.root-line-context');
  if (!menu) {
    throw new Error('Root context menu not found');
  }

  return menu;
}

function clickRootMenuItem(label: string): void {
  const item = Array.from(
    openRootContextMenu().querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((element) => element.textContent === label);

  if (!item) {
    throw new Error(`Root menu item not found: ${label}`);
  }

  item.click();
}

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
      setDefaultMode: vi.fn().mockResolvedValue(session),
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

    clickRootMenuItem('Refresh Tree');
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

    clickRootMenuItem('Refresh Tree');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('Cannot read');
  });

  it('TC-10.2a: Deleted root on refresh shows error and clears tree', async () => {
    const session = populatedSession;
    const api = await renderApp(session);
    api.getTree.mockRejectedValueOnce(new ApiError(404, 'PATH_NOT_FOUND', 'Directory not found'));

    clickRootMenuItem('Refresh Tree');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('Directory not found');
    expect(document.body.textContent).not.toContain('No folder selected');
    expect(document.querySelector('.root-line__path--invalid')?.textContent).toBe('~/code');
    const itemLabels = Array.from(
      openRootContextMenu().querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).map((item) => item.textContent);
    expect(itemLabels).toContain('Copy Path');
    expect(itemLabels).not.toContain('Refresh Tree');
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

  it('opens rendered relative markdown links through the existing file flow', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const api = await renderApp(
        {
          ...emptySession,
          lastRoot: '/root',
        },
        {
          getTree: vi.fn().mockResolvedValue({
            root: '/root',
            tree: [{ name: 'readme.md', path: '/root/docs/readme.md', type: 'file' as const }],
          }),
          readFile: vi.fn().mockImplementation(async (path: string) => {
            if (path === '/root/docs/readme.md') {
              return {
                ...basicFileResponse,
                path,
                canonicalPath: path,
                filename: 'readme.md',
                html: '<p><a href="./guide.md">Guide</a></p>',
              };
            }

            return {
              ...basicFileResponse,
              path,
              canonicalPath: path,
              filename: 'guide.md',
              html: '<h1 id="guide">Guide</h1>',
            };
          }),
        },
      );

      document.querySelector<HTMLElement>('[data-type="file"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      document
        .querySelector<HTMLAnchorElement>('.markdown-body a')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(api.readFile).toHaveBeenNthCalledWith(1, '/root/docs/readme.md');
      expect(api.readFile).toHaveBeenNthCalledWith(2, '/root/docs/guide.md');
      expect(document.querySelectorAll('.tab')).toHaveLength(2);
      expect(document.querySelector('.tab--active')?.getAttribute('title')).toBe(
        '/root/docs/guide.md',
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('shows an error notification when a rendered relative markdown link is missing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await renderApp(
        {
          ...emptySession,
          lastRoot: '/root',
        },
        {
          getTree: vi.fn().mockResolvedValue({
            root: '/root',
            tree: [{ name: 'readme.md', path: '/root/docs/readme.md', type: 'file' as const }],
          }),
          readFile: vi.fn().mockImplementation(async (path: string) => {
            if (path === '/root/docs/readme.md') {
              return {
                ...basicFileResponse,
                path,
                canonicalPath: path,
                filename: 'readme.md',
                html: '<p><a href="./missing.md">Missing</a></p>',
              };
            }

            throw new ApiError(404, 'FILE_NOT_FOUND', 'The requested file no longer exists.');
          }),
        },
      );

      document.querySelector<HTMLElement>('[data-type="file"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      document
        .querySelector<HTMLAnchorElement>('.markdown-body a')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(document.querySelector('[role="alert"]')).toBeTruthy();
      expect(document.body.textContent).toContain('The requested file no longer exists.');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('prompts before opening files between 1 MB and 5 MB and removes the loading tab on cancel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    try {
      const api = await renderApp(
        {
          ...emptySession,
          lastRoot: '/root',
        },
        {
          getTree: vi.fn().mockResolvedValue({
            root: '/root',
            tree: [{ name: 'large.md', path: '/root/large.md', type: 'file' as const }],
          }),
          readFile: vi.fn().mockResolvedValue({
            ...basicFileResponse,
            path: '/root/large.md',
            canonicalPath: '/root/large.md',
            filename: 'large.md',
            html: '<h1>large</h1>',
            size: 1_572_864,
          }),
        },
      );

      document.querySelector<HTMLElement>('[data-type="file"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(confirmSpy).toHaveBeenCalledWith('This file is 1.5 MB. Open anyway?');
      expect(api.touchRecentFile).not.toHaveBeenCalled();
      expect(document.querySelectorAll('.tab')).toHaveLength(0);
      expect(document.querySelector('.tab--loading')).toBeNull();
      expect(document.body.textContent).toContain('No documents open');
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('removes stale recent files and refreshes the tree when an opened file returns 404', async () => {
    const api = await renderApp(
      {
        ...emptySession,
        lastRoot: '/root',
      },
      {
        getTree: vi
          .fn()
          .mockResolvedValueOnce({
            root: '/root',
            tree: [{ name: 'missing.md', path: '/root/missing.md', type: 'file' as const }],
          })
          .mockResolvedValueOnce({
            root: '/root',
            tree: [],
          }),
        readFile: vi
          .fn()
          .mockRejectedValue(
            new ApiError(404, 'FILE_NOT_FOUND', 'The requested file no longer exists.'),
          ),
      },
    );

    document.querySelector<HTMLElement>('[data-type="file"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.removeRecentFile).toHaveBeenCalledWith('/root/missing.md');
    expect(api.getTree).toHaveBeenNthCalledWith(1, '/root');
    expect(api.getTree).toHaveBeenNthCalledWith(2, '/root');
    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('The requested file no longer exists.');
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

  it('TC-9.3b (client): removes loading tab and shows error on read timeout', async () => {
    vi.useFakeTimers();

    try {
      const fetchMock = vi.fn().mockImplementation((_input, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            },
            { once: true },
          );
        });
      });
      const timeoutClient = new ApiClient(fetchMock as typeof fetch);
      const renderPromise = renderApp(
        {
          ...emptySession,
          lastRoot: '/root',
        },
        {
          getTree: vi.fn().mockResolvedValue({
            root: '/root',
            tree: [{ name: 'slow.md', path: '/root/slow.md', type: 'file' as const }],
          }),
          readFile: vi.fn().mockImplementation((path: string) => timeoutClient.readFile(path)),
        },
      );
      await vi.runAllTimersAsync();
      const api = await renderPromise;

      document.querySelector<HTMLElement>('[data-type="file"]')?.click();
      await Promise.resolve();

      expect(document.querySelector('.tab--loading')).toBeTruthy();

      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.resolve();

      expect(api.readFile).toHaveBeenCalledWith('/root/slow.md');
      expect(fetchMock).toHaveBeenCalledWith('/api/file?path=%2Froot%2Fslow.md', {
        method: 'GET',
        headers: undefined,
        body: undefined,
        signal: expect.any(AbortSignal),
      });
      expect(document.querySelector('.tab--loading')).toBeNull();
      expect(document.querySelector('[role="alert"]')).toBeTruthy();
      expect(document.body.textContent).toContain('File read timed out');
    } finally {
      vi.useRealTimers();
    }
  });

  it('TC-4.3e (integration): Close Other Tabs removes all tabs except the target', async () => {
    const api = await renderApp(
      {
        ...emptySession,
        lastRoot: '/root',
      },
      {
        getTree: vi.fn().mockResolvedValue({
          root: '/root',
          tree: [
            { name: 'a.md', path: '/root/a.md', type: 'file' as const },
            { name: 'b.md', path: '/root/b.md', type: 'file' as const },
            { name: 'c.md', path: '/root/c.md', type: 'file' as const },
          ],
        }),
        readFile: vi.fn().mockImplementation(async (path: string) => ({
          ...basicFileResponse,
          path,
          canonicalPath: path,
          filename: path.split('/').filter(Boolean).at(-1) ?? path,
          html: `<h1>${path}</h1>`,
        })),
      },
    );

    const fileRows = document.querySelectorAll<HTMLElement>('[data-type="file"]');
    for (const row of fileRows) {
      row.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const tabs = document.querySelectorAll<HTMLElement>('.tab');
    tabs[1]?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    Array.from(document.querySelectorAll<HTMLButtonElement>('.context-menu button'))
      .find((button) => button.textContent === 'Close Others')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelectorAll('.tab')).toHaveLength(1);
    expect(document.querySelector('.tab--active')?.getAttribute('title')).toBe('/root/b.md');
    expect(document.querySelector('.markdown-body h1')?.textContent).toBe('/root/b.md');
    expect(api.updateTabs).toHaveBeenLastCalledWith(
      [{ path: '/root/b.md', mode: 'render', scrollPosition: 0 }],
      '/root/b.md',
    );
  });

  it('TC-4.3f (integration): Close Tabs to Right removes tabs after the target', async () => {
    const api = await renderApp(
      {
        ...emptySession,
        lastRoot: '/root',
      },
      {
        getTree: vi.fn().mockResolvedValue({
          root: '/root',
          tree: [
            { name: 'a.md', path: '/root/a.md', type: 'file' as const },
            { name: 'b.md', path: '/root/b.md', type: 'file' as const },
            { name: 'c.md', path: '/root/c.md', type: 'file' as const },
            { name: 'd.md', path: '/root/d.md', type: 'file' as const },
          ],
        }),
        readFile: vi.fn().mockImplementation(async (path: string) => ({
          ...basicFileResponse,
          path,
          canonicalPath: path,
          filename: path.split('/').filter(Boolean).at(-1) ?? path,
          html: `<h1>${path}</h1>`,
        })),
      },
    );

    const fileRows = document.querySelectorAll<HTMLElement>('[data-type="file"]');
    for (const row of fileRows) {
      row.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const tabs = document.querySelectorAll<HTMLElement>('.tab');
    tabs[1]?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    Array.from(document.querySelectorAll<HTMLButtonElement>('.context-menu button'))
      .find((button) => button.textContent === 'Close Tabs to the Right')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const remainingTabs = Array.from(document.querySelectorAll<HTMLElement>('.tab')).map((tab) =>
      tab.getAttribute('title'),
    );

    expect(remainingTabs).toEqual(['/root/a.md', '/root/b.md']);
    expect(document.querySelector('.tab--active')?.getAttribute('title')).toBe('/root/b.md');
    expect(document.querySelector('.markdown-body h1')?.textContent).toBe('/root/b.md');
    expect(api.updateTabs).toHaveBeenLastCalledWith(
      [
        { path: '/root/a.md', mode: 'render', scrollPosition: 0 },
        { path: '/root/b.md', mode: 'render', scrollPosition: 0 },
      ],
      '/root/b.md',
    );
  });

  it('TC-4.3g (integration): Copy Path copies the tab file path to clipboard', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard write denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      const api = await renderApp(
        {
          ...emptySession,
          lastRoot: '/root',
        },
        {
          getTree: vi.fn().mockResolvedValue({
            root: '/root',
            tree: [{ name: 'a.md', path: '/root/a.md', type: 'file' as const }],
          }),
        },
      );

      document.querySelector<HTMLElement>('[data-type="file"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      document.querySelector<HTMLElement>('.tab')?.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 100,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));

      Array.from(document.querySelectorAll<HTMLButtonElement>('.context-menu button'))
        .find((button) => button.textContent === 'Copy Path')
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(writeText).toHaveBeenCalledWith('/root/a.md');
      expect(api.copyToClipboard).toHaveBeenCalledWith('/root/a.md');
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, 'clipboard', originalClipboard);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    }
  });
});
