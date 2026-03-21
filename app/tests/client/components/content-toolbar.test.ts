// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountContentToolbar } from '../../../src/client/components/content-toolbar.js';
import { mountMenuBar } from '../../../src/client/components/menu-bar.js';
import { mountWarningPanel } from '../../../src/client/components/warning-panel.js';
import { createStore } from '../support.js';
import { singleTab } from '../../fixtures/tab-states.js';

const cleanups: Array<() => void> = [];

function renderContentToolbar(
  overrides: Parameters<typeof createStore>[0] = {},
  actionOverrides: Partial<Parameters<typeof mountContentToolbar>[2]> = {},
) {
  document.body.innerHTML = `
    <header id="menu-bar"></header>
    <div id="content-toolbar"></div>
    <div id="warning-panel-root"></div>
  `;

  const store = createStore(overrides);
  const actions = {
    onSetDefaultMode: vi.fn(),
    onExportFormat: vi.fn(),
    ...actionOverrides,
  };

  const cleanupToolbar = mountContentToolbar(
    document.querySelector<HTMLElement>('#content-toolbar')!,
    store,
    actions,
  );
  const cleanupPanel = mountWarningPanel(
    document.querySelector<HTMLElement>('#warning-panel-root')!,
    store,
  );
  cleanups.push(cleanupToolbar, cleanupPanel);

  return { store, actions, cleanupToolbar, cleanupPanel };
}

describe('content toolbar', () => {
  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
    document.body.innerHTML = '';
  });

  it('TC-6.1a: shows the toolbar when a document is open', () => {
    renderContentToolbar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.querySelector('.content-toolbar')).not.toBeNull();
  });

  it('TC-6.1b: hides the toolbar in the empty state', () => {
    renderContentToolbar();

    expect(document.querySelector('.content-toolbar')).toBeNull();
  });

  it('TC-6.2a: marks Render active and Edit unavailable', () => {
    renderContentToolbar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-toggle button'));
    const renderButton = buttons.find((button) => button.textContent === 'Render');
    const editButton = buttons.find((button) => button.textContent === 'Edit');

    expect(renderButton?.className).toContain('mode-toggle--active');
    expect(editButton?.className).toContain('mode-toggle--disabled');
    expect(editButton?.getAttribute('aria-disabled')).toBe('true');
  });

  it('TC-6.2b: clicking Edit shows the coming soon tooltip without changing mode', () => {
    const { actions } = renderContentToolbar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-toggle button'))
      .find((button) => button.textContent === 'Edit')
      ?.click();

    expect(document.body.textContent).toContain('Edit mode coming soon');
    expect(actions.onSetDefaultMode).not.toHaveBeenCalled();
  });

  it('TC-6.3a: shows the default mode picker', () => {
    renderContentToolbar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(
      document.querySelector('.default-mode-picker .content-toolbar__button')?.textContent,
    ).toBe('Opens in: Render ▾');
  });

  it('TC-6.3b: keeps Edit disabled in the default mode picker and allows Render selection', () => {
    const { actions } = renderContentToolbar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    document
      .querySelector<HTMLButtonElement>('.default-mode-picker .content-toolbar__button')
      ?.click();

    const dropdownItems = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.default-mode-picker .dropdown__item'),
    );
    const renderItem = dropdownItems.find((item) => item.textContent?.includes('Render'));
    const editItem = dropdownItems.find((item) => item.textContent?.includes('Edit'));

    expect(editItem?.disabled).toBe(true);
    expect(editItem?.textContent).toContain('coming soon');

    renderItem?.click();

    expect(actions.onSetDefaultMode).toHaveBeenCalledWith('render');
  });

  it('TC-6.4a: shows the export dropdown button', () => {
    renderContentToolbar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.querySelector('.export-dropdown .content-toolbar__button')?.textContent).toBe(
      'Export ▾',
    );
  });

  it('TC-6.4b: lists export options', () => {
    const { actions } = renderContentToolbar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    document.querySelector<HTMLButtonElement>('.export-dropdown .content-toolbar__button')?.click();

    const exportItems = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.export-dropdown .dropdown__item'),
    );

    expect(exportItems.map((item) => item.textContent)).toEqual(['PDF', 'DOCX', 'HTML']);
    expect(exportItems.every((item) => !item.disabled)).toBe(true);

    exportItems[0]?.click();

    expect(actions.onExportFormat).toHaveBeenCalledWith('pdf');
  });

  it('TC-6.5a: shows the warning count when the active tab has warnings', () => {
    renderContentToolbar({
      tabs: [
        {
          ...singleTab,
          warnings: Array.from({ length: 3 }, (_, index) => ({
            type: 'missing-image' as const,
            source: `./image-${index}.png`,
            message: 'Missing image',
          })),
        },
      ],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.querySelector('.warning-count')?.textContent).toBe('⚠ 3 warnings');
  });

  it('TC-6.5b: clicking the warning count opens the warning panel with details', () => {
    renderContentToolbar({
      tabs: [
        {
          ...singleTab,
          warnings: [
            {
              type: 'missing-image',
              source: './images/diagram.png',
              message: 'Missing image: ./images/diagram.png',
            },
            {
              type: 'remote-image-blocked',
              source: 'https://example.com/logo.png',
              message: 'Remote image blocked: https://example.com/logo.png',
            },
          ],
        },
      ],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    document.querySelector<HTMLButtonElement>('.warning-count')?.click();

    expect(document.querySelector('.warning-panel')).not.toBeNull();
    expect(document.body.textContent).toContain('Rendering Warnings');
    expect(document.body.textContent).toContain('Missing image');
    expect(document.body.textContent).toContain('./images/diagram.png');
    expect(document.body.textContent).toContain('Remote image blocked');
    expect(document.body.textContent).toContain('https://example.com/logo.png');
  });

  it('TC-6.5b2: mermaid-error warnings render with correct icon and show message as detail', () => {
    renderContentToolbar({
      tabs: [
        {
          ...singleTab,
          warnings: [
            {
              type: 'mermaid-error',
              source: 'mermaid-block-1',
              message: 'Parse error on line 3: unexpected token',
            },
          ],
        },
      ],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    document.querySelector<HTMLButtonElement>('.warning-count')?.click();

    const panel = document.querySelector('.warning-panel');
    expect(panel).not.toBeNull();

    const icon = panel!.querySelector('.warning-panel__icon');
    const type = panel!.querySelector('.warning-panel__type');
    const detail = panel!.querySelector('.warning-panel__detail');

    expect(icon?.textContent).toBe('⚠');
    expect(type?.textContent).toBe('Mermaid error');
    expect(detail?.textContent).toBe('Parse error on line 3: unexpected token');
  });

  it('TC-6.5c: hides the warning indicator when there are no warnings', () => {
    renderContentToolbar({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.querySelector('.warning-count')).toBeNull();
  });

  it('TC-1.1c: opening a file shows its path in the menu bar status area', () => {
    document.body.innerHTML = `
      <header id="menu-bar"></header>
      <div id="content-toolbar"></div>
      <div id="warning-panel-root"></div>
    `;

    const store = createStore({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    const cleanupMenuBar = mountMenuBar(document.querySelector<HTMLElement>('#menu-bar')!, store, {
      onOpenFile: vi.fn(),
      onBrowse: vi.fn(),
      onToggleSidebar: vi.fn(),
      onSetTheme: vi.fn(),
      onExportFormat: vi.fn(),
    });
    cleanups.push(cleanupMenuBar);

    const status = document.querySelector<HTMLElement>('.menu-bar__status');
    expect(status?.textContent).toBe(singleTab.path);
    expect(status?.title).toBe(singleTab.path);
  });
});
