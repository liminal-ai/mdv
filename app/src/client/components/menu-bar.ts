import type { ClientState, StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

type MenuId = 'file' | 'export' | 'view';
type ExportFormat = 'pdf' | 'docx' | 'html';

interface MenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => void | Promise<void>;
}

export interface MenuBarActions {
  onOpenFile: () => void | Promise<void>;
  onBrowse: () => void | Promise<void>;
  onToggleSidebar: () => void | Promise<void>;
  onSetTheme: (themeId: string) => void | Promise<void>;
  onExportFormat: (format: ExportFormat) => void | Promise<void>;
}

const MENU_ORDER: MenuId[] = ['file', 'export', 'view'];
const EXPORT_FORMATS: ExportFormat[] = ['pdf', 'docx', 'html'];

function getMenuItems(menuId: MenuId, state: ClientState, actions: MenuBarActions): MenuItem[] {
  if (menuId === 'file') {
    return [
      { label: 'Open File', shortcut: 'Cmd+O', action: actions.onOpenFile },
      { label: 'Open Folder', shortcut: 'Cmd+Shift+O', action: actions.onBrowse },
    ];
  }

  if (menuId === 'export') {
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
    const exportEnabled = activeTab?.status === 'ok' && !state.exportState.inProgress;

    return EXPORT_FORMATS.map((format) => ({
      label: format.toUpperCase(),
      disabled: !exportEnabled,
      action: exportEnabled ? () => actions.onExportFormat(format) : undefined,
    }));
  }

  return [
    { label: 'Toggle Sidebar', shortcut: 'Cmd+B', action: actions.onToggleSidebar },
    ...state.availableThemes.map((theme) => ({
      label:
        theme.id === state.session.theme
          ? `Theme: ${theme.label} (Current)`
          : `Theme: ${theme.label}`,
      action: () => actions.onSetTheme(theme.id),
    })),
  ];
}

function focusTopLevelButton(container: HTMLElement, menuId: MenuId): void {
  container.querySelector<HTMLButtonElement>(`[data-menu-trigger="${menuId}"]`)?.focus();
}

function focusMenuItem(container: HTMLElement, menuId: MenuId, index: number): void {
  container.querySelector<HTMLButtonElement>(`[data-menu-item="${menuId}:${index}"]`)?.focus();
}

function scheduleFocus(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
    return;
  }

  queueMicrotask(callback);
}

function activateMenuAction(
  action: (() => void | Promise<void>) | undefined,
  closeMenus: () => void,
): void {
  void action?.();
  closeMenus();
}

export function mountMenuBar(
  container: HTMLElement,
  store: StateStore,
  actions: MenuBarActions,
): () => void {
  const closeMenus = () => {
    if (store.get().activeMenuId) {
      store.update({ activeMenuId: null }, ['activeMenuId']);
    }
  };

  const openMenu = (menuId: MenuId) => {
    store.update(
      {
        activeMenuId: store.get().activeMenuId === menuId ? null : menuId,
      },
      ['activeMenuId'],
    );
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const triggerMenuId = target.dataset.menuTrigger as MenuId | undefined;
    const itemKey = target.dataset.menuItem;
    const activeMenuId = store.get().activeMenuId as MenuId | null;

    if (triggerMenuId) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        store.update({ activeMenuId: triggerMenuId }, ['activeMenuId']);
        scheduleFocus(() => focusMenuItem(container, triggerMenuId, 0));
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const currentIndex = MENU_ORDER.indexOf(triggerMenuId);
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextMenuId =
          MENU_ORDER[(currentIndex + delta + MENU_ORDER.length) % MENU_ORDER.length];
        focusTopLevelButton(container, nextMenuId);
        store.update({ activeMenuId: nextMenuId }, ['activeMenuId']);
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenus();
      }

      return;
    }

    if (!itemKey || !activeMenuId) {
      return;
    }

    const [menuId, indexText] = itemKey.split(':') as [MenuId, string];
    const items = getMenuItems(menuId, store.get(), actions).filter((item) => !item.disabled);
    const currentIndex = Number(indexText);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + delta + items.length) % items.length;
      focusMenuItem(container, menuId, nextIndex);
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const menuIndex = MENU_ORDER.indexOf(menuId);
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const nextMenuId = MENU_ORDER[(menuIndex + delta + MENU_ORDER.length) % MENU_ORDER.length];
      store.update({ activeMenuId: nextMenuId }, ['activeMenuId']);
      scheduleFocus(() => focusMenuItem(container, nextMenuId, 0));
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      target.click();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenus();
      scheduleFocus(() => focusTopLevelButton(container, menuId));
    }
  };

  const handleOutsidePointer = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (target && container.contains(target)) {
      return;
    }

    closeMenus();
  };

  const render = () => {
    const state = store.get();
    const activeMenuId = state.activeMenuId as MenuId | null;
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
    const menuButtons = MENU_ORDER.map((menuId) => {
      const label = menuId[0].toUpperCase() + menuId.slice(1);
      return createElement('div', {
        className: 'menu-bar__group',
        children: [
          createElement('button', {
            className: 'menu-bar__trigger',
            text: label,
            attrs: {
              type: 'button',
              'aria-expanded': activeMenuId === menuId,
              'data-menu-trigger': menuId,
            },
            dataset: { menuTrigger: menuId },
            on: {
              click: () => openMenu(menuId),
            },
          }),
          activeMenuId === menuId ? createDropdown(menuId, state, actions, closeMenus) : null,
        ],
      });
    });

    const openFileQuickAction = createElement('button', {
      className: 'menu-bar__icon-button',
      text: 'File',
      attrs: {
        type: 'button',
        title: 'Open File (Cmd+O)',
        'aria-label': 'Open File',
      },
      on: {
        click: () => {
          void actions.onOpenFile();
        },
      },
    });
    const openFolderQuickAction = createElement('button', {
      className: 'menu-bar__icon-button',
      text: 'Folder',
      attrs: {
        type: 'button',
        title: 'Open Folder (Cmd+Shift+O)',
        'aria-label': 'Open Folder',
      },
      on: {
        click: () => {
          void actions.onBrowse();
        },
      },
    });

    container.replaceChildren(
      createElement('div', {
        className: 'menu-bar__shell',
        children: [
          createElement('div', {
            className: 'menu-bar__brand',
            children: [
              createElement('strong', { className: 'menu-bar__brand-mark', text: 'MD Viewer' }),
              createElement('span', {
                className: 'menu-bar__brand-copy',
                text: 'Markdown workspace shell',
              }),
            ],
          }),
          createElement('nav', {
            className: 'menu-bar__menus',
            attrs: { 'aria-label': 'Application menu' },
            children: menuButtons,
          }),
          createElement('div', {
            className: 'menu-bar__status',
            text: activeTab?.path ?? '',
            attrs: {
              title: activeTab?.path ?? '',
            },
          }),
          createElement('div', {
            className: 'menu-bar__quick-actions',
            children: [openFileQuickAction, openFolderQuickAction],
          }),
        ],
      }),
    );
  };

  container.addEventListener('keydown', handleKeydown);
  document.addEventListener('mousedown', handleOutsidePointer);

  render();
  const unsubscribe = store.subscribe(render);

  return () => {
    unsubscribe();
    container.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousedown', handleOutsidePointer);
  };
}

function createDropdown(
  menuId: MenuId,
  state: ClientState,
  actions: MenuBarActions,
  closeMenus: () => void,
): HTMLElement {
  if (menuId === 'view') {
    let enabledIndex = 0;
    return createElement('div', {
      className: 'menu-bar__dropdown',
      attrs: { role: 'menu' },
      children: [
        createElement('button', {
          className: 'menu-bar__item',
          text: 'Toggle Sidebar',
          attrs: {
            type: 'button',
            role: 'menuitem',
            'data-menu-item': `${menuId}:${enabledIndex}`,
          },
          dataset: { menuItem: `${menuId}:${enabledIndex}` },
          children: [createElement('span', { className: 'menu-bar__shortcut', text: 'Cmd+B' })],
          on: {
            click: () => {
              activateMenuAction(actions.onToggleSidebar, closeMenus);
            },
            keydown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                activateMenuAction(actions.onToggleSidebar, closeMenus);
              }
            },
          },
        }),
        createElement('div', {
          className: 'menu-bar__submenu',
          children: [
            createElement('span', {
              className: 'menu-bar__submenu-label',
              text: 'Theme',
            }),
            ...state.availableThemes.map((theme) => {
              enabledIndex += 1;
              return createElement('button', {
                className: 'menu-bar__item',
                text: theme.id === state.session.theme ? `${theme.label} ✓` : theme.label,
                attrs: {
                  type: 'button',
                  role: 'menuitem',
                  'data-menu-item': `${menuId}:${enabledIndex}`,
                },
                dataset: { menuItem: `${menuId}:${enabledIndex}` },
                on: {
                  click: () => {
                    activateMenuAction(() => actions.onSetTheme(theme.id), closeMenus);
                  },
                  keydown: (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      activateMenuAction(() => actions.onSetTheme(theme.id), closeMenus);
                    }
                  },
                },
              });
            }),
          ],
        }),
      ],
    });
  }

  return createElement('div', {
    className: 'menu-bar__dropdown',
    attrs: { role: 'menu' },
    children: (() => {
      let enabledIndex = -1;

      return getMenuItems(menuId, state, actions).map((item) => {
        const menuItemIndex = item.disabled ? null : ++enabledIndex;

        return createElement('button', {
          className: 'menu-bar__item',
          text: item.label,
          attrs: {
            type: 'button',
            role: 'menuitem',
            disabled: item.disabled,
            ...(menuItemIndex === null ? {} : { 'data-menu-item': `${menuId}:${menuItemIndex}` }),
          },
          dataset: menuItemIndex === null ? undefined : { menuItem: `${menuId}:${menuItemIndex}` },
          on: {
            click: () => {
              if (item.disabled) {
                return;
              }

              activateMenuAction(item.action, closeMenus);
            },
            keydown: (event) => {
              if (event.key === 'Enter' && !item.disabled) {
                event.preventDefault();
                event.stopPropagation();
                activateMenuAction(item.action, closeMenus);
              }
            },
          },
          children: item.shortcut
            ? [createElement('span', { className: 'menu-bar__shortcut', text: item.shortcut })]
            : undefined,
        });
      });
    })(),
  });
}
