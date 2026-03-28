// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mountContextMenu,
  type ContextMenuActions,
} from '../../../src/client/components/context-menu.js';
import { mountFileTree } from '../../../src/client/components/file-tree.js';
import { simpleTree } from '../../fixtures/tree.js';
import { emptySession } from '../../fixtures/session.js';
import { createStore } from '../support.js';

function createActions(): ContextMenuActions {
  return {
    onCopyPath: vi.fn().mockResolvedValue(undefined),
    onMakeRoot: vi.fn().mockResolvedValue(undefined),
    onSaveAsWorkspace: vi.fn().mockResolvedValue(undefined),
  };
}

function setup(
  overrides: Parameters<typeof createStore>[0] = {},
  actionOverrides: Partial<ContextMenuActions> = {},
) {
  document.body.innerHTML =
    '<div id="app"><div id="tree"></div></div><div id="context-menu-root"></div>';

  const store = createStore({
    session: { ...emptySession, lastRoot: '/root' },
    tree: simpleTree,
    expandedDirsByRoot: { '/root': ['/root/docs', '/root/docs/guides'] },
    ...overrides,
  });

  const treeActions = {
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
    onToggleDir: vi.fn(),
    onSelectFile: vi.fn(),
  };
  const cleanupTree = mountFileTree(
    document.querySelector<HTMLElement>('#tree')!,
    store,
    treeActions,
  );

  const actions = { ...createActions(), ...actionOverrides };
  const cleanupMenu = mountContextMenu(
    document.querySelector<HTMLElement>('#context-menu-root')!,
    store,
    actions,
  );

  return { store, actions, cleanupTree, cleanupMenu };
}

function rightClickNode(type: 'file' | 'directory', clientX = 100, clientY = 100) {
  const selector = `[data-type="${type}"]`;
  const row = document.querySelector<HTMLElement>(selector);
  if (!row) throw new Error(`No row found for type=${type}`);

  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    clientX,
    clientY,
  });
  row.dispatchEvent(event);
}

describe('context menu', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('TC-6.1a: File right-click shows Copy Path', () => {
    setup();
    rightClickNode('file');

    const menu = document.querySelector('.context-menu');
    expect(menu).not.toBeNull();

    const items = Array.from(menu!.querySelectorAll('.context-menu__item'));
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toBe('Copy Path');
  });

  it('TC-6.1b: Copy Path copies full file path', () => {
    const { actions } = setup();
    rightClickNode('file');

    const item = document.querySelector<HTMLElement>('.context-menu__item');
    item?.click();

    expect(actions.onCopyPath).toHaveBeenCalledWith('/root/docs/getting-started.md');
  });

  it('TC-6.2a: Directory right-click shows 3 items', () => {
    setup();
    rightClickNode('directory');

    const menu = document.querySelector('.context-menu');
    expect(menu).not.toBeNull();

    const items = Array.from(menu!.querySelectorAll('.context-menu__item'));
    expect(items).toHaveLength(3);
    expect(items[0]!.textContent).toBe('Copy Path');
    expect(items[1]!.textContent).toBe('Make Root');
    expect(items[2]!.textContent).toBe('Save as Workspace');
  });

  it('TC-6.2b: Make Root changes root', () => {
    const { actions } = setup();
    rightClickNode('directory');

    const items = Array.from(document.querySelectorAll<HTMLElement>('.context-menu__item'));
    const makeRoot = items.find((i) => i.textContent === 'Make Root');
    makeRoot?.click();

    expect(actions.onMakeRoot).toHaveBeenCalledWith('/root/docs');
  });

  it('TC-6.2c: Save as Workspace adds workspace', () => {
    const { actions } = setup();
    rightClickNode('directory');

    const items = Array.from(document.querySelectorAll<HTMLElement>('.context-menu__item'));
    const saveWs = items.find((i) => i.textContent === 'Save as Workspace');
    saveWs?.click();

    expect(actions.onSaveAsWorkspace).toHaveBeenCalledWith('/root/docs');
  });

  it('TC-6.3a: Menu closes on action click', () => {
    const { store } = setup();
    rightClickNode('file');

    expect(document.querySelector('.context-menu')).not.toBeNull();

    const item = document.querySelector<HTMLElement>('.context-menu__item');
    item?.click();

    expect(store.get().contextMenu).toBeNull();
    expect(document.querySelector('.context-menu')).toBeNull();
  });

  it('TC-6.3b: Menu closes on outside click', () => {
    const { store } = setup();
    rightClickNode('file');

    expect(document.querySelector('.context-menu')).not.toBeNull();

    // Click outside the menu
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(store.get().contextMenu).toBeNull();
    expect(document.querySelector('.context-menu')).toBeNull();
  });

  it('TC-6.3c: Menu closes on Escape', () => {
    const { store } = setup();
    rightClickNode('file');

    expect(document.querySelector('.context-menu')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(store.get().contextMenu).toBeNull();
    expect(document.querySelector('.context-menu')).toBeNull();
  });

  it('TC-2.4c: Context menu keyboard navigable', () => {
    setup();
    rightClickNode('directory');

    const menu = document.querySelector('.context-menu');
    expect(menu).not.toBeNull();

    // Arrow down focuses first item
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const items = Array.from(menu!.querySelectorAll<HTMLElement>('.context-menu__item'));
    expect(document.activeElement).toBe(items[0]);

    // Arrow down again focuses second item
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);

    // Arrow up goes back
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
  });
});
