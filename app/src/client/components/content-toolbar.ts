import type { SessionState } from '../../shared/types.js';
import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';
import { WARNING_PANEL_TOGGLE_EVENT } from './warning-panel.js';

type OpenMenuId = 'default-mode' | 'export' | null;
type ExportFormat = 'pdf' | 'docx' | 'html';

export interface ContentToolbarActions {
  onSetDefaultMode: (mode: SessionState['defaultOpenMode']) => void | Promise<void>;
  onExportFormat: (format: ExportFormat) => void | Promise<void>;
}

export const SHOW_EDIT_MODE_TOOLTIP_EVENT = 'mdv:content-toolbar-show-edit-mode-tooltip';
export const TOGGLE_EXPORT_DROPDOWN_EVENT = 'mdv:toggle-export-dropdown';

const EDIT_MODE_TOOLTIP = 'Edit mode coming soon';
const EXPORT_FORMATS: ExportFormat[] = ['pdf', 'docx', 'html'];

function getActiveTab(store: StateStore) {
  const state = store.get();
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
}

function canExport(store: StateStore): boolean {
  const state = store.get();
  const activeTab = getActiveTab(store);
  return activeTab?.status === 'ok' && !state.exportState.inProgress;
}

export function showEditModeComingSoonTooltip(): void {
  document.dispatchEvent(new CustomEvent(SHOW_EDIT_MODE_TOOLTIP_EVENT));
}

export function mountContentToolbar(
  container: HTMLElement,
  store: StateStore,
  actions: ContentToolbarActions,
): () => void {
  let openMenuId: OpenMenuId = null;
  let tooltipVisible = false;

  const focusExportTrigger = () => {
    container.querySelector<HTMLButtonElement>('[data-export-trigger="true"]')?.focus();
  };

  const focusExportItem = (index: number) => {
    container.querySelector<HTMLButtonElement>(`[data-export-item="${index}"]`)?.focus();
  };

  const scheduleFocus = (callback: () => void) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(callback);
      return;
    }

    queueMicrotask(callback);
  };

  const closeTransientUi = () => {
    if (!openMenuId && !tooltipVisible) {
      return;
    }

    openMenuId = null;
    tooltipVisible = false;
    render();
  };

  const showEditTooltip = () => {
    const state = store.get();
    if (!state.contentToolbarVisible || !state.activeTabId) {
      return;
    }

    openMenuId = null;
    tooltipVisible = true;
    render();
  };

  const toggleMenu = (menuId: Exclude<OpenMenuId, null>) => {
    openMenuId = openMenuId === menuId ? null : menuId;
    tooltipVisible = false;
    render();
  };

  const render = () => {
    const state = store.get();
    const activeTab = getActiveTab(store);

    if (!state.contentToolbarVisible || !activeTab) {
      openMenuId = null;
      tooltipVisible = false;
      container.replaceChildren();
      return;
    }

    const warningCount = activeTab.warnings.length;
    const defaultModeLabel = 'Render';
    const exportEnabled = canExport(store);

    const defaultModeDropdown =
      openMenuId === 'default-mode'
        ? createElement('div', {
            className: 'dropdown',
            attrs: { role: 'menu' },
            children: [
              createElement('button', {
                className: 'dropdown__item dropdown__item--active',
                text: '✓ Render',
                attrs: { type: 'button', role: 'menuitem' },
                on: {
                  click: () => {
                    openMenuId = null;
                    void actions.onSetDefaultMode('render');
                    render();
                  },
                },
              }),
              createElement('button', {
                className: 'dropdown__item dropdown__item--disabled',
                text: 'Edit (coming soon)',
                attrs: {
                  type: 'button',
                  role: 'menuitem',
                  disabled: true,
                  title: EDIT_MODE_TOOLTIP,
                },
              }),
            ],
          })
        : null;

    const exportDropdown =
      openMenuId === 'export'
        ? createElement('div', {
            className: 'dropdown',
            attrs: { role: 'menu' },
            children: EXPORT_FORMATS.map((format, index) =>
              createElement('button', {
                className: exportEnabled
                  ? 'dropdown__item'
                  : 'dropdown__item dropdown__item--disabled',
                text: format.toUpperCase(),
                attrs: {
                  type: 'button',
                  role: 'menuitem',
                  ...(exportEnabled
                    ? { 'data-export-item': String(index) }
                    : { 'aria-disabled': 'true', disabled: true }),
                },
                dataset: exportEnabled ? { exportItem: String(index) } : undefined,
                on: exportEnabled
                  ? {
                      click: () => {
                        openMenuId = null;
                        render();
                        void actions.onExportFormat(format);
                      },
                    }
                  : undefined,
              }),
            ),
          })
        : null;

    container.replaceChildren(
      createElement('div', {
        className: 'content-toolbar',
        children: [
          createElement('div', {
            className: 'content-toolbar__left',
            children: [
              createElement('div', {
                className: 'content-toolbar__menu',
                children: [
                  createElement('div', {
                    className: 'mode-toggle',
                    children: [
                      createElement('button', {
                        className: 'mode-toggle--active',
                        text: 'Render',
                        attrs: { type: 'button' },
                      }),
                      createElement('button', {
                        className: 'mode-toggle--disabled',
                        text: 'Edit',
                        attrs: {
                          type: 'button',
                          'aria-disabled': 'true',
                          title: EDIT_MODE_TOOLTIP,
                        },
                        on: {
                          click: () => {
                            showEditTooltip();
                          },
                        },
                      }),
                    ],
                  }),
                  tooltipVisible
                    ? createElement('div', {
                        className: 'content-toolbar__tooltip',
                        text: EDIT_MODE_TOOLTIP,
                        attrs: { role: 'tooltip' },
                      })
                    : null,
                ],
              }),
              createElement('div', {
                className: 'content-toolbar__menu default-mode-picker',
                children: [
                  createElement('button', {
                    className: 'content-toolbar__button',
                    text: `Opens in: ${defaultModeLabel} ▾`,
                    attrs: {
                      type: 'button',
                      'aria-expanded': String(openMenuId === 'default-mode'),
                    },
                    on: {
                      click: () => {
                        toggleMenu('default-mode');
                      },
                    },
                  }),
                  defaultModeDropdown,
                ],
              }),
            ],
          }),
          createElement('div', {
            className: 'content-toolbar__right',
            children: [
              createElement('div', {
                className: 'content-toolbar__menu export-dropdown',
                children: [
                  createElement('button', {
                    className: 'content-toolbar__button',
                    text: 'Export ▾',
                    attrs: {
                      type: 'button',
                      'aria-expanded': String(openMenuId === 'export'),
                      'data-export-trigger': 'true',
                    },
                    dataset: { exportTrigger: 'true' },
                    on: {
                      click: () => {
                        toggleMenu('export');
                      },
                    },
                  }),
                  exportDropdown,
                ],
              }),
              createElement('div', {
                className: 'status-area',
                children:
                  warningCount > 0
                    ? [
                        createElement('button', {
                          className: 'warning-count',
                          text: `⚠ ${warningCount} warning${warningCount === 1 ? '' : 's'}`,
                          attrs: {
                            type: 'button',
                            title: 'Show rendering warnings',
                          },
                          on: {
                            click: (event) => {
                              const target = event.currentTarget as HTMLElement;
                              document.dispatchEvent(
                                new CustomEvent(WARNING_PANEL_TOGGLE_EVENT, {
                                  detail: {
                                    anchorRect: target.getBoundingClientRect(),
                                  },
                                }),
                              );
                            },
                          },
                        }),
                      ]
                    : [],
              }),
            ],
          }),
        ],
      }),
    );
  };

  const handleDocumentMouseDown = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (target && container.contains(target)) {
      return;
    }

    closeTransientUi();
  };

  const handleDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeTransientUi();
    }
  };

  const handleShowTooltip = () => {
    showEditTooltip();
  };

  const handleToggleExportDropdown = () => {
    const activeTab = getActiveTab(store);
    if (!store.get().contentToolbarVisible || activeTab?.status !== 'ok') {
      return;
    }

    toggleMenu('export');
    if (openMenuId === 'export' && canExport(store)) {
      scheduleFocus(() => focusExportItem(0));
    }
  };

  const handleContainerKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const itemIndex = target.dataset.exportItem;
    const isTrigger = target.dataset.exportTrigger === 'true';

    if (isTrigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      if (!canExport(store)) {
        return;
      }

      event.preventDefault();
      if (openMenuId !== 'export') {
        openMenuId = 'export';
        tooltipVisible = false;
        render();
      }

      scheduleFocus(() =>
        focusExportItem(event.key === 'ArrowDown' ? 0 : EXPORT_FORMATS.length - 1),
      );
      return;
    }

    if (itemIndex === undefined) {
      return;
    }

    const currentIndex = Number(itemIndex);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + delta + EXPORT_FORMATS.length) % EXPORT_FORMATS.length;
      focusExportItem(nextIndex);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      openMenuId = null;
      render();
      scheduleFocus(focusExportTrigger);
    }
  };

  render();

  const unsubscribe = store.subscribe((state, changed) => {
    if (
      changed.includes('tabs') ||
      changed.includes('activeTabId') ||
      changed.includes('contentToolbarVisible') ||
      changed.includes('session') ||
      changed.includes('exportState')
    ) {
      if (!state.contentToolbarVisible) {
        openMenuId = null;
        tooltipVisible = false;
      }
      render();
    }
  });

  document.addEventListener('mousedown', handleDocumentMouseDown);
  document.addEventListener('keydown', handleDocumentKeydown);
  document.addEventListener(SHOW_EDIT_MODE_TOOLTIP_EVENT, handleShowTooltip);
  document.addEventListener(TOGGLE_EXPORT_DROPDOWN_EVENT, handleToggleExportDropdown);
  container.addEventListener('keydown', handleContainerKeydown);

  return () => {
    unsubscribe();
    document.removeEventListener('mousedown', handleDocumentMouseDown);
    document.removeEventListener('keydown', handleDocumentKeydown);
    document.removeEventListener(SHOW_EDIT_MODE_TOOLTIP_EVENT, handleShowTooltip);
    document.removeEventListener(TOGGLE_EXPORT_DROPDOWN_EVENT, handleToggleExportDropdown);
    container.removeEventListener('keydown', handleContainerKeydown);
  };
}
