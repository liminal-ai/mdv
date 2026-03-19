// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySession } from '../fixtures/session.js';

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

  it('bootstraps the shell with a mocked api module', async () => {
    const bootstrap = vi.fn().mockResolvedValue({
      session: emptySession,
      availableThemes,
    });

    vi.doMock('../../src/client/api.js', () => ({
      ApiClient: class {
        bootstrap = bootstrap;
        setRoot = vi.fn();
        addWorkspace = vi.fn();
        removeWorkspace = vi.fn();
        setTheme = vi.fn();
        updateSidebar = vi.fn();
        getTree = vi.fn();
        browse = vi.fn();
        copyToClipboard = vi.fn();
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

    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('MD Viewer');
    expect(document.body.textContent).toContain('No documents open');
  });
});
