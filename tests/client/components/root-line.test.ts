// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountRootLine } from '../../../src/client/components/root-line.js';
import { emptySession } from '../../fixtures/session.js';
import { createStore } from '../support.js';

function renderRootLine(lastRoot: string | null = '/Users/leemoore/code/project-atlas') {
  document.body.innerHTML = '<div id="root-line"></div>';
  const store = createStore({
    session: {
      ...emptySession,
      lastRoot,
    },
    expandedDirsByRoot: {
      '/Users/leemoore/code/project-atlas': ['/Users/leemoore/code/project-atlas/docs'],
    },
  });
  const actions = {
    onBrowse: vi.fn(),
    onPin: vi.fn(),
    onCopy: vi.fn(),
    onRefresh: vi.fn(),
  };

  const cleanup = mountRootLine(document.querySelector<HTMLElement>('#root-line')!, store, actions);

  return { store, actions, cleanup };
}

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

describe('root line', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('TC-4.1a: Path displayed truncated with tooltip', () => {
    renderRootLine();

    const path = document.querySelector<HTMLElement>('.root-line__path');

    expect(path?.textContent).toBe('~/code/project-atlas');
    expect(path?.title).toBe('/Users/leemoore/code/project-atlas');
  });

  it('TC-4.1b: No root selected state', () => {
    renderRootLine(null);

    expect(document.body.textContent).toContain('No folder selected');
    expect(document.querySelector('.root-line__pin')).toBeNull();
    expect(document.querySelector('.root-line__copy')).toBeNull();
    expect(document.querySelector('.root-line__refresh')).toBeNull();
  });

  it('TC-4.2a: Browse action triggers folder picker', () => {
    const { actions } = renderRootLine();

    document.querySelector<HTMLButtonElement>('.root-line__browse')?.click();

    expect(actions.onBrowse).toHaveBeenCalledTimes(1);
  });

  it('TC-4.2c: Browse icon always visible', () => {
    renderRootLine();

    expect(document.querySelector('.root-line__browse')?.className).toContain('root-line__browse');
    expect(document.querySelector<HTMLButtonElement>('.root-line__browse')?.title).toBe(
      'Browse folder',
    );
  });

  it('TC-4.3a: Pin adds workspace', () => {
    const { actions } = renderRootLine();

    openRootContextMenu()
      .querySelectorAll<HTMLElement>('[role="menuitem"]')
      .forEach((item) => {
        if (item.textContent === 'Pin as Path') {
          item.click();
        }
      });

    expect(actions.onPin).toHaveBeenCalledTimes(1);
  });

  it('TC-4.4a: Copy copies root path', () => {
    const { actions } = renderRootLine();

    openRootContextMenu()
      .querySelectorAll<HTMLElement>('[role="menuitem"]')
      .forEach((item) => {
        if (item.textContent === 'Copy Path') {
          item.click();
        }
      });

    expect(actions.onCopy).toHaveBeenCalledTimes(1);
  });

  it('TC-4.5a: Refresh reloads tree', () => {
    const { actions } = renderRootLine();

    openRootContextMenu()
      .querySelectorAll<HTMLElement>('[role="menuitem"]')
      .forEach((item) => {
        if (item.textContent === 'Refresh Tree') {
          item.click();
        }
      });

    expect(actions.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('TC-4.5b: Refresh preserves expand state', () => {
    const { store } = renderRootLine();
    const before = store.get().expandedDirsByRoot;

    openRootContextMenu()
      .querySelectorAll<HTMLElement>('[role="menuitem"]')
      .forEach((item) => {
        if (item.textContent === 'Refresh Tree') {
          item.click();
        }
      });

    expect(store.get().expandedDirsByRoot).toEqual(before);
  });

  it('TC-4.6a: Context menu reveals pin copy and refresh actions', () => {
    renderRootLine();
    const menu = openRootContextMenu();
    const itemLabels = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(
      (item) => item.textContent,
    );

    expect(itemLabels).toContain('Pin as Path');
    expect(itemLabels).toContain('Copy Path');
    expect(itemLabels).toContain('Refresh Tree');
  });

  it('TC-4.6b: Browse always visible without hover', () => {
    renderRootLine();

    expect(document.querySelector('.root-line__browse')).not.toBeNull();
  });
});
