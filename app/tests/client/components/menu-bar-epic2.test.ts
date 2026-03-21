// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountMenuBar } from '../../../src/client/components/menu-bar.js';
import { createStore } from '../support.js';
import { multipleTabs, singleTab } from '../../fixtures/tab-states.js';

const cleanups: Array<() => void> = [];

function renderMenuBar(overrides: Parameters<typeof createStore>[0] = {}) {
  document.body.innerHTML = '<header id="menu-bar"></header>';

  const store = createStore(overrides);
  const cleanup = mountMenuBar(document.querySelector<HTMLElement>('#menu-bar')!, store, {
    onOpenFile: vi.fn(),
    onBrowse: vi.fn(),
    onToggleSidebar: vi.fn(),
    onSetTheme: vi.fn(),
    onExportFormat: vi.fn(),
  });
  cleanups.push(cleanup);

  return { store };
}

describe('menu bar epic 2 path status', () => {
  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
    document.body.innerHTML = '';
  });

  it('TC-8.1a: shows the active document path in the status area', () => {
    renderMenuBar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.querySelector('.menu-bar__status')?.textContent).toBe(singleTab.path);
  });

  it('TC-8.1b: preserves the full path in the hover title', () => {
    renderMenuBar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.querySelector<HTMLElement>('.menu-bar__status')?.title).toBe(singleTab.path);
  });

  it('TC-8.1c: updates the displayed path when the active tab changes', () => {
    const { store } = renderMenuBar({
      tabs: multipleTabs,
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    store.update({ activeTabId: 'tab-3' }, ['activeTabId']);

    expect(document.querySelector('.menu-bar__status')?.textContent).toBe('/a/notes.md');
  });

  it('TC-8.1d: clears the path when all tabs are closed', () => {
    const { store } = renderMenuBar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    store.update({ tabs: [], activeTabId: null, contentToolbarVisible: false }, [
      'tabs',
      'activeTabId',
      'contentToolbarVisible',
    ]);

    const status = document.querySelector<HTMLElement>('.menu-bar__status');
    expect(status?.textContent).toBe('');
    expect(status?.title).toBe('');
  });
});
