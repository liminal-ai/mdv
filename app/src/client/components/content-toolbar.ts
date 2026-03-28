import type { SessionState } from '../../shared/types.js';
import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';
import { INSERT_TABLE_EVENT } from '../utils/keyboard.js';
import { WARNING_PANEL_TOGGLE_EVENT } from './warning-panel.js';

type OpenMenuId = 'default-mode' | 'export' | null;
type ExportFormat = 'pdf' | 'docx' | 'html';
type ExportDirtyChoice = 'save-and-export' | 'export-anyway' | 'cancel';
const READING_ZOOM_STORAGE_KEY = 'mdv-reading-zoom';
const READING_ZOOM_DEFAULT = 1;
const READING_ZOOM_STEP = 0.06;
const READING_ZOOM_MIN = 0.5;
const READING_ZOOM_MAX = 1.6;

export interface ContentToolbarActions {
  onSetDefaultMode: (mode: SessionState['defaultOpenMode']) => void | Promise<void>;
  onExportFormat: (
    format: ExportFormat,
    options?: { allowDirty?: boolean; tabId?: string },
  ) => void | Promise<void>;
  onResolveExportDirtyWarning?: (choice: ExportDirtyChoice) => void | Promise<void>;
}

export const TOGGLE_EXPORT_DROPDOWN_EVENT = 'mdv:toggle-export-dropdown';
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

function readReadingZoom(): number {
  try {
    const stored = localStorage.getItem(READING_ZOOM_STORAGE_KEY);
    const parsed = stored ? parseFloat(stored) : NaN;
    if (!Number.isNaN(parsed)) {
      return Math.max(READING_ZOOM_MIN, Math.min(READING_ZOOM_MAX, parsed));
    }
  } catch {
    // localStorage may be unavailable — ignore.
  }

  return READING_ZOOM_DEFAULT;
}

function applyReadingZoom(zoom: number): void {
  document.documentElement.style.setProperty('--reading-zoom', zoom.toFixed(2));
}

function persistReadingZoom(zoom: number): void {
  try {
    localStorage.setItem(READING_ZOOM_STORAGE_KEY, zoom.toFixed(2));
  } catch {
    // localStorage may be unavailable — ignore.
  }
}

export function mountContentToolbar(
  container: HTMLElement,
  store: StateStore,
  actions: ContentToolbarActions,
): () => void {
  let openMenuId: OpenMenuId = null;
  let readingZoom = readReadingZoom();
  applyReadingZoom(readingZoom);

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
    if (!openMenuId) {
      return;
    }

    openMenuId = null;
    render();
  };

  const toggleMenu = (menuId: Exclude<OpenMenuId, null>) => {
    openMenuId = openMenuId === menuId ? null : menuId;
    render();
  };

  const setActiveTabMode = (mode: 'render' | 'edit') => {
    const state = store.get();
    const activeTab = getActiveTab(store);
    if (!activeTab || activeTab.mode === mode) {
      return;
    }

    store.update(
      {
        tabs: state.tabs.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                mode,
                renderGeneration: (tab.renderGeneration ?? -1) + 1,
              }
            : tab,
        ),
      },
      ['tabs'],
    );
  };

  const adjustReadingZoom = (delta: number) => {
    const roundedNextZoom = Number(
      Math.max(READING_ZOOM_MIN, Math.min(READING_ZOOM_MAX, readingZoom + delta)).toFixed(2),
    );
    if (roundedNextZoom === readingZoom) {
      return;
    }

    readingZoom = roundedNextZoom;
    applyReadingZoom(readingZoom);
    persistReadingZoom(readingZoom);
    render();
  };

  const render = () => {
    const state = store.get();
    const activeTab = getActiveTab(store);

    if (!state.contentToolbarVisible || !activeTab) {
      openMenuId = null;
      container.replaceChildren();
      return;
    }

    const warningCount = activeTab.mode === 'render' ? activeTab.warnings.length : 0;
    const defaultModeLabel = state.session.defaultOpenMode === 'edit' ? 'Edit' : 'Render';
    const exportEnabled = canExport(store);
    const cursorLabel =
      activeTab.cursorPosition === null
        ? 'Ln 1, Col 1'
        : `Ln ${activeTab.cursorPosition.line}, Col ${activeTab.cursorPosition.column}`;
    const canDecreaseReadingZoom = readingZoom > READING_ZOOM_MIN;
    const canIncreaseReadingZoom = readingZoom < READING_ZOOM_MAX;

    const defaultModeDropdown =
      openMenuId === 'default-mode'
        ? createElement('div', {
            className: 'dropdown',
            attrs: { role: 'menu' },
            children: [
              createElement('button', {
                className:
                  state.session.defaultOpenMode === 'render'
                    ? 'dropdown__item dropdown__item--active'
                    : 'dropdown__item',
                text: state.session.defaultOpenMode === 'render' ? '✓ Render' : 'Render',
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
                className:
                  state.session.defaultOpenMode === 'edit'
                    ? 'dropdown__item dropdown__item--active'
                    : 'dropdown__item',
                text: state.session.defaultOpenMode === 'edit' ? '✓ Edit' : 'Edit',
                attrs: { type: 'button', role: 'menuitem' },
                on: {
                  click: () => {
                    openMenuId = null;
                    void actions.onSetDefaultMode('edit');
                    render();
                  },
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
                        if (activeTab?.dirty) {
                          openMenuId = null;
                          store.update(
                            {
                              exportDirtyWarning: {
                                tabId: activeTab.id,
                                format,
                              },
                            },
                            ['exportDirtyWarning'],
                          );
                          return;
                        }

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

    const exportDirtyWarning = state.exportDirtyWarning
      ? createElement('div', {
          className: 'modal-overlay',
          children: [
            createElement('div', {
              className: 'modal',
              attrs: {
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'export-dirty-warning-title',
              },
              children: [
                createElement('h2', {
                  className: 'modal__title',
                  text: 'Unsaved changes',
                  attrs: { id: 'export-dirty-warning-title' },
                }),
                createElement('p', {
                  className: 'modal__message',
                  text: 'This file has unsaved changes. The export will use the saved version on disk, not your current edits.',
                }),
                createElement('div', {
                  className: 'modal__actions',
                  children: [
                    createElement('button', {
                      className: 'button--primary',
                      text: 'Save and Export',
                      attrs: { type: 'button' },
                      on: {
                        click: () => {
                          void actions.onResolveExportDirtyWarning?.('save-and-export');
                        },
                      },
                    }),
                    createElement('button', {
                      className: 'button--danger',
                      text: 'Export Anyway',
                      attrs: { type: 'button' },
                      on: {
                        click: () => {
                          void actions.onResolveExportDirtyWarning?.('export-anyway');
                        },
                      },
                    }),
                    createElement('button', {
                      text: 'Cancel',
                      attrs: { type: 'button' },
                      on: {
                        click: () => {
                          void actions.onResolveExportDirtyWarning?.('cancel');
                        },
                      },
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      : null;

    container.replaceChildren(
      createElement('div', {
        children: [
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
                            className: activeTab.mode === 'render' ? 'mode-toggle--active' : '',
                            text: 'Render',
                            attrs: { type: 'button' },
                            on: {
                              click: () => {
                                setActiveTabMode('render');
                              },
                            },
                          }),
                          createElement('button', {
                            className: activeTab.mode === 'edit' ? 'mode-toggle--active' : '',
                            text: 'Edit',
                            attrs: { type: 'button' },
                            on: {
                              click: () => {
                                setActiveTabMode('edit');
                              },
                            },
                          }),
                        ],
                      }),
                    ],
                  }),
                  activeTab.dirty
                    ? createElement('span', {
                        className: 'dirty-indicator',
                        text: 'Modified',
                      })
                    : null,
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
                  activeTab.mode === 'render'
                    ? createElement('div', {
                        className: 'reading-width-controls',
                        attrs: { 'aria-label': 'Adjust reading width' },
                        children: [
                          createElement('button', {
                            className: 'content-toolbar__button content-toolbar__button--compact',
                            text: '+',
                            attrs: {
                              type: 'button',
                              title: 'Make rendered preview bigger',
                              'aria-label': 'Make rendered preview bigger',
                              ...(canIncreaseReadingZoom ? {} : { disabled: true }),
                            },
                            on: {
                              click: () => {
                                adjustReadingZoom(READING_ZOOM_STEP);
                              },
                            },
                          }),
                          createElement('button', {
                            className: 'content-toolbar__button content-toolbar__button--compact',
                            text: '−',
                            attrs: {
                              type: 'button',
                              title: 'Make rendered preview smaller',
                              'aria-label': 'Make rendered preview smaller',
                              ...(canDecreaseReadingZoom ? {} : { disabled: true }),
                            },
                            on: {
                              click: () => {
                                adjustReadingZoom(-READING_ZOOM_STEP);
                              },
                            },
                          }),
                        ],
                      })
                    : null,
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
                      activeTab.mode === 'edit'
                        ? [
                            createElement('div', {
                              className: 'content-toolbar__edit-tools',
                              children: [
                                createElement('button', {
                                  className: 'content-toolbar__button',
                                  text: 'Insert Table',
                                  attrs: {
                                    type: 'button',
                                    title: 'Insert markdown table',
                                  },
                                  on: {
                                    click: () => {
                                      document.dispatchEvent(new CustomEvent(INSERT_TABLE_EVENT));
                                    },
                                  },
                                }),
                              ],
                            }),
                            createElement('span', {
                              className: 'cursor-position',
                              text: cursorLabel,
                            }),
                          ]
                        : [
                            ...(warningCount > 0
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
                              : []),
                          ],
                  }),
                ],
              }),
            ],
          }),
          exportDirtyWarning,
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
      if (store.get().exportDirtyWarning) {
        event.preventDefault();
        void actions.onResolveExportDirtyWarning?.('cancel');
        return;
      }

      closeTransientUi();
    }
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
      changed.includes('exportState') ||
      changed.includes('exportDirtyWarning')
    ) {
      if (!state.contentToolbarVisible) {
        openMenuId = null;
      }
      render();
    }
  });

  document.addEventListener('mousedown', handleDocumentMouseDown);
  document.addEventListener('keydown', handleDocumentKeydown);
  document.addEventListener(TOGGLE_EXPORT_DROPDOWN_EVENT, handleToggleExportDropdown);
  container.addEventListener('keydown', handleContainerKeydown);

  return () => {
    unsubscribe();
    document.removeEventListener('mousedown', handleDocumentMouseDown);
    document.removeEventListener('keydown', handleDocumentKeydown);
    document.removeEventListener(TOGGLE_EXPORT_DROPDOWN_EVENT, handleToggleExportDropdown);
    container.removeEventListener('keydown', handleContainerKeydown);
  };
}
