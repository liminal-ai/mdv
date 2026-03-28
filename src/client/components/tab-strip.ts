import type { StateStore, TabContextMenuState } from '../state.js';
import { createElement } from '../utils/dom.js';

export interface TabStripActions {
  onActivateTab: (tabId: string) => void | Promise<void>;
  onCloseTab: (tabId: string) => void | Promise<void>;
  onCloseOtherTabs: (tabId: string) => void | Promise<void>;
  onCloseTabsToRight: (tabId: string) => void | Promise<void>;
  onCopyTabPath: (tabId: string) => void | Promise<void>;
}

const FALLBACK_ACTIONS: TabStripActions = {
  onActivateTab: () => undefined,
  onCloseTab: () => undefined,
  onCloseOtherTabs: () => undefined,
  onCloseTabsToRight: () => undefined,
  onCopyTabPath: () => undefined,
};

function buildContextItems(tabId: string, totalTabs: number, index: number): TabContextMenuState {
  return {
    x: 0,
    y: 0,
    tabId,
    items: [
      { id: 'close', label: 'Close' },
      { id: 'close-others', label: 'Close Others', disabled: totalTabs < 2 },
      {
        id: 'close-right',
        label: 'Close Tabs to the Right',
        disabled: index >= totalTabs - 1,
      },
      { id: 'copy-path', label: 'Copy Path' },
    ],
  };
}

export function mountTabStrip(
  container: HTMLElement,
  store: StateStore,
  callbacks: Partial<TabStripActions> = {},
): () => void {
  const actions = { ...FALLBACK_ACTIONS, ...callbacks };

  let menuEl: HTMLElement | null = null;
  let scrollContainerEl: HTMLElement | null = null;
  let overflowLeftEl: HTMLElement | null = null;
  let overflowRightEl: HTMLElement | null = null;
  let countEl: HTMLElement | null = null;
  let lastActiveTabId: string | null = null;

  const closeContextMenu = () => {
    if (store.get().tabContextMenu) {
      store.update({ tabContextMenu: null }, ['tabContextMenu']);
    }
  };

  const syncOverflowState = () => {
    if (!scrollContainerEl || !overflowLeftEl || !overflowRightEl || !countEl) {
      return;
    }

    const overflowing = scrollContainerEl.scrollWidth > scrollContainerEl.clientWidth + 1;
    const canScrollLeft = scrollContainerEl.scrollLeft > 0;
    const canScrollRight =
      scrollContainerEl.scrollLeft + scrollContainerEl.clientWidth <
      scrollContainerEl.scrollWidth - 1;

    overflowLeftEl.hidden = !overflowing || !canScrollLeft;
    overflowRightEl.hidden = !overflowing || !canScrollRight;
    countEl.hidden = !overflowing;
  };

  const scheduleOverflowSync = () => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(syncOverflowState);
      return;
    }

    queueMicrotask(syncOverflowState);
  };

  const ensureActiveVisible = (tabId: string | null) => {
    if (!tabId) {
      return;
    }

    const tab = container.querySelector<HTMLElement>(`.tab[data-tab-id="${tabId}"]`);
    if (tab && typeof tab.scrollIntoView === 'function') {
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  };

  const executeContextAction = (itemId: string, tabId: string) => {
    closeContextMenu();

    switch (itemId) {
      case 'close':
        void actions.onCloseTab(tabId);
        break;
      case 'close-others':
        void actions.onCloseOtherTabs(tabId);
        break;
      case 'close-right':
        void actions.onCloseTabsToRight(tabId);
        break;
      case 'copy-path':
        void actions.onCopyTabPath(tabId);
        break;
    }
  };

  const renderContextMenu = () => {
    const state = store.get();
    const menuState = state.tabContextMenu;

    if (!menuState) {
      menuEl?.remove();
      menuEl = null;
      return;
    }

    menuEl?.remove();
    menuEl = createElement('div', {
      className: 'context-menu',
      attrs: { role: 'menu', tabindex: -1 },
      children: menuState.items.map((item) =>
        createElement('button', {
          className: item.disabled
            ? 'context-menu__item context-menu__item--disabled'
            : 'context-menu__item',
          text: item.label,
          attrs: {
            type: 'button',
            role: 'menuitem',
            disabled: item.disabled,
          },
          on: {
            click: (event) => {
              event.stopPropagation();
              if (item.disabled) {
                return;
              }
              executeContextAction(item.id, menuState.tabId);
            },
          },
        }),
      ),
    });

    const menuWidth = 220;
    const menuHeight = menuState.items.length * 36 + 12;
    const maxX = Math.max(window.innerWidth - menuWidth - 8, 8);
    const maxY = Math.max(window.innerHeight - menuHeight - 8, 8);

    menuEl.style.left = `${Math.min(menuState.x, maxX)}px`;
    menuEl.style.top = `${Math.min(menuState.y, maxY)}px`;

    document.body.append(menuEl);
    menuEl.focus();
  };

  const render = () => {
    const state = store.get();

    if (!state.tabs.length) {
      scrollContainerEl = null;
      overflowLeftEl = null;
      overflowRightEl = null;
      countEl = null;
      container.replaceChildren(
        createElement('div', {
          className: 'tab-strip-empty',
          text: 'No documents open',
        }),
      );
      renderContextMenu();
      lastActiveTabId = null;
      return;
    }

    scrollContainerEl = createElement('div', {
      className: 'tab-strip__scroll-container',
      attrs: { role: 'tablist', 'aria-label': 'Open documents' },
      children: state.tabs.map((tab, index) =>
        createElement('div', {
          className: `tab${tab.id === state.activeTabId ? ' tab--active' : ''}${tab.loading ? ' tab--loading' : ''}`,
          attrs: {
            role: 'tab',
            tabindex: 0,
            'aria-selected': String(tab.id === state.activeTabId),
            'data-tab-id': tab.id,
            title: tab.path,
          },
          dataset: { tabId: tab.id },
          on: {
            click: () => {
              void actions.onActivateTab(tab.id);
            },
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                void actions.onActivateTab(tab.id);
              }
            },
            contextmenu: (event) => {
              event.preventDefault();
              const nextMenu = buildContextItems(tab.id, state.tabs.length, index);
              store.update(
                {
                  tabContextMenu: {
                    ...nextMenu,
                    x: event.clientX,
                    y: event.clientY,
                  },
                },
                ['tabContextMenu'],
              );
            },
          },
          children: [
            tab.dirty
              ? createElement('span', {
                  className: 'tab__dirty-dot',
                  attrs: { 'aria-hidden': 'true' },
                })
              : null,
            createElement('span', {
              className: 'tab__label',
              text: tab.filename,
            }),
            tab.loading
              ? createElement('span', {
                  className: 'tab__spinner',
                  attrs: { 'aria-hidden': 'true' },
                })
              : null,
            createElement('button', {
              className: 'tab__close',
              text: 'x',
              attrs: {
                type: 'button',
                'aria-label': `Close ${tab.filename}`,
              },
              on: {
                click: (event) => {
                  event.stopPropagation();
                  void actions.onCloseTab(tab.id);
                },
              },
            }),
          ],
        }),
      ),
    });

    scrollContainerEl.addEventListener('scroll', syncOverflowState);

    overflowLeftEl = createElement('div', {
      className: 'tab-strip__overflow tab-strip__overflow--left',
      attrs: { 'aria-hidden': 'true' },
    });
    overflowRightEl = createElement('div', {
      className: 'tab-strip__overflow tab-strip__overflow--right',
      attrs: { 'aria-hidden': 'true' },
    });
    countEl = createElement('div', {
      className: 'tab-strip__count',
      text: `${state.tabs.length} tabs`,
    });

    container.replaceChildren(
      createElement('div', {
        className: 'tab-strip',
        children: [scrollContainerEl, overflowLeftEl, overflowRightEl, countEl],
      }),
    );

    renderContextMenu();
    scheduleOverflowSync();

    if (state.activeTabId !== lastActiveTabId || state.tabs.length > 1) {
      ensureActiveVisible(state.activeTabId);
    }
    lastActiveTabId = state.activeTabId;
  };

  const handleWindowResize = () => {
    scheduleOverflowSync();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && store.get().tabContextMenu) {
      closeContextMenu();
    }
  };

  const handleOutsideMouseDown = (event: MouseEvent) => {
    if (!menuEl) {
      return;
    }

    if (menuEl.contains(event.target as Node)) {
      return;
    }

    closeContextMenu();
  };

  const unsubscribe = store.subscribe((state, changed) => {
    if (
      changed.includes('tabs') ||
      changed.includes('activeTabId') ||
      changed.includes('tabContextMenu')
    ) {
      render();
    }

    if (changed.includes('tabContextMenu') && !state.tabContextMenu) {
      renderContextMenu();
    }
  });

  window.addEventListener('resize', handleWindowResize);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('mousedown', handleOutsideMouseDown);

  render();

  return () => {
    unsubscribe();
    window.removeEventListener('resize', handleWindowResize);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousedown', handleOutsideMouseDown);
    menuEl?.remove();
    container.replaceChildren();
  };
}
