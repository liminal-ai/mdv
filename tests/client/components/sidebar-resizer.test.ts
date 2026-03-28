// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSidebarResizer } from '../../../src/client/components/sidebar-resizer.js';
import { createStore } from '../support.js';

describe('sidebar resizer', () => {
  const storage = new Map<string, string>();

  afterEach(() => {
    document.body.innerHTML = '';
    storage.clear();
  });

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      clear: () => {
        storage.clear();
      },
    },
  });

  function render() {
    document.body.innerHTML = `
      <div id="main">
        <div id="sidebar-resizer"></div>
      </div>
    `;

    const main = document.querySelector<HTMLElement>('#main');
    const resizer = document.querySelector<HTMLElement>('#sidebar-resizer');

    if (!main || !resizer) {
      throw new Error('Expected sidebar resizer test DOM to exist.');
    }

    const cleanup = mountSidebarResizer(resizer, main, createStore(), vi.fn());
    return { main, cleanup };
  }

  it('uses the wider default width on first launch', () => {
    const { main, cleanup } = render();

    expect(main.style.getPropertyValue('--sidebar-width')).toBe('260px');

    cleanup();
  });

  it('migrates the legacy default width to the new default', () => {
    window.localStorage.setItem('mdv-sidebar-width', '240');

    const { main, cleanup } = render();

    expect(main.style.getPropertyValue('--sidebar-width')).toBe('260px');
    expect(window.localStorage.getItem('mdv-sidebar-width')).toBe('260');

    cleanup();
  });
});
