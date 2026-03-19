// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountMenuBar } from '../../../src/client/components/menu-bar.js';
import { createStore, getButtonByText } from '../support.js';

function renderMenuBar(overrides = {}) {
  document.body.innerHTML = '<header id="menu-bar"></header>';
  const store = createStore(overrides);
  const actions = {
    onBrowse: vi.fn(),
    onToggleSidebar: vi.fn(() => {
      const state = store.get();
      store.update({ sidebarVisible: !state.sidebarVisible }, ['sidebarVisible']);
    }),
    onSetTheme: vi.fn(),
  };

  const cleanup = mountMenuBar(document.querySelector<HTMLElement>('#menu-bar')!, store, actions);
  return { store, actions, cleanup };
}

describe('menu bar', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('TC-2.1a: File menu contains Open File and Open Folder with shortcuts', () => {
    renderMenuBar();

    getButtonByText('File').click();

    expect(document.body.textContent).toContain('Open File');
    expect(document.body.textContent).toContain('Cmd+O');
    expect(document.body.textContent).toContain('Open Folder');
    expect(document.body.textContent).toContain('Cmd+Shift+O');
  });

  it('TC-2.1b: Export menu items are disabled', () => {
    renderMenuBar();

    getButtonByText('Export').click();

    expect(getButtonByText('PDF').disabled).toBe(true);
    expect(getButtonByText('DOCX').disabled).toBe(true);
    expect(getButtonByText('HTML').disabled).toBe(true);
  });

  it('TC-2.1c: View menu contains Toggle Sidebar and Theme submenu', () => {
    renderMenuBar();

    getButtonByText('View').click();

    expect(document.body.textContent).toContain('Toggle Sidebar');
    expect(document.body.textContent).toContain('Theme');
    expect(document.body.textContent).toContain('Light Default');
  });

  it('TC-2.1d: Menu closes on outside click', () => {
    renderMenuBar();

    getButtonByText('File').click();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(document.body.textContent).not.toContain('Open Folder');
  });

  it('TC-2.1e: Only one menu open at a time', () => {
    renderMenuBar();

    getButtonByText('File').click();
    getButtonByText('View').click();

    expect(document.body.textContent).not.toContain('Cmd+Shift+O');
    expect(document.body.textContent).toContain('Toggle Sidebar');
  });

  it('TC-2.2a: Quick-action icons have tooltips', () => {
    renderMenuBar();

    const openFileButton = document.querySelector<HTMLButtonElement>('[aria-label="Open File"]');
    const openFolderButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Open Folder"]',
    );

    expect(openFileButton?.title).toBe('Open File — available when file opening is supported');
    expect(openFolderButton?.title).toBe('Open Folder (Cmd+Shift+O)');
  });

  it('TC-2.2b: Open Folder icon click triggers browse', () => {
    const { actions } = renderMenuBar();

    document.querySelector<HTMLButtonElement>('[aria-label="Open Folder"]')?.click();

    expect(actions.onBrowse).toHaveBeenCalledTimes(1);
  });

  it('TC-2.2c: Open File icon is disabled', () => {
    renderMenuBar();

    expect(document.querySelector<HTMLButtonElement>('[aria-label="Open File"]')?.disabled).toBe(
      true,
    );
  });

  it('TC-9.1b: File menu Open Folder triggers browse', () => {
    const { actions } = renderMenuBar();

    getButtonByText('File').click();
    getButtonByText('Open Folder').click();

    expect(actions.onBrowse).toHaveBeenCalledTimes(1);
  });

  it('TC-2.4a: Dropdown menus are keyboard navigable', async () => {
    const { actions, store } = renderMenuBar();
    const fileButton = getButtonByText('File');

    fileButton.focus();
    fileButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await Promise.resolve();

    const openFolderItem = getButtonByText('Open Folder');
    expect((document.activeElement as HTMLElement | null)?.textContent).toContain('Open Folder');
    openFolderItem.focus();
    openFolderItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(actions.onBrowse).toHaveBeenCalledTimes(1);

    getButtonByText('File').click();
    const reopenedOpenFolderItem = getButtonByText('Open Folder');
    reopenedOpenFolderItem.focus();
    reopenedOpenFolderItem.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(store.get().activeMenuId).toBeNull();
  });

  it('TC-2.5a: Toggle sidebar closed', () => {
    const { store } = renderMenuBar({ sidebarVisible: true });

    getButtonByText('View').click();
    getButtonByText('Toggle Sidebar').click();

    expect(store.get().sidebarVisible).toBe(false);
  });

  it('TC-2.5b: Toggle sidebar open', () => {
    const { store } = renderMenuBar({ sidebarVisible: false });

    getButtonByText('View').click();
    getButtonByText('Toggle Sidebar').click();

    expect(store.get().sidebarVisible).toBe(true);
  });
});
