import type { StateStore, ContextMenuState } from '../state.js';
import { createElement } from '../utils/dom.js';

export interface ContextMenuActions {
  onCopyPath: (path: string) => Promise<void>;
  onMakeRoot: (path: string) => Promise<void>;
  onSaveAsWorkspace: (path: string) => Promise<void>;
}

export function mountContextMenu(
  container: HTMLElement,
  store: StateStore,
  actions: ContextMenuActions,
): () => void {
  let menuEl: HTMLElement | null = null;
  let focusedIndex = -1;

  const close = () => {
    const { contextMenu } = store.get();
    if (contextMenu) {
      store.update({ contextMenu: null }, ['contextMenu']);
    }
  };

  const executeAction = (action: () => Promise<void>) => {
    close();
    void action();
  };

  const buildItems = (state: ContextMenuState): Array<{ label: string; action: () => void }> => {
    const items: Array<{ label: string; action: () => void }> = [
      {
        label: 'Copy Path',
        action: () => executeAction(() => actions.onCopyPath(state.targetPath)),
      },
    ];

    if (state.targetType === 'directory') {
      items.push(
        {
          label: 'Make Root',
          action: () => executeAction(() => actions.onMakeRoot(state.targetPath)),
        },
        {
          label: 'Save as Workspace',
          action: () => executeAction(() => actions.onSaveAsWorkspace(state.targetPath)),
        },
      );
    }

    return items;
  };

  const render = () => {
    const { contextMenu } = store.get();

    if (!contextMenu) {
      if (menuEl) {
        menuEl.remove();
        menuEl = null;
      }
      focusedIndex = -1;
      return;
    }

    const items = buildItems(contextMenu);

    menuEl = createElement('div', {
      className: 'context-menu',
      attrs: { role: 'menu', tabindex: -1 },
      children: items.map((item, index) => {
        const el = createElement('div', {
          className: 'context-menu__item',
          text: item.label,
          attrs: {
            role: 'menuitem',
            tabindex: -1,
            'data-index': index,
          },
          on: {
            click: (e: MouseEvent) => {
              e.stopPropagation();
              item.action();
            },
          },
        });
        return el;
      }),
    });

    // Add separator before directory-only items
    if (contextMenu.targetType === 'directory' && menuEl.children.length > 1) {
      const separator = createElement('div', {
        className: 'context-menu__separator',
        attrs: { role: 'separator' },
      });
      menuEl.insertBefore(separator, menuEl.children[1]);
    }

    // Position at cursor, constrained to viewport
    const menuWidth = 192; // min-width from CSS (12rem ~ 192px)
    const menuHeight = items.length * 32 + 16; // rough estimate

    let x = contextMenu.x;
    let y = contextMenu.y;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight;
    }

    menuEl.style.left = `${x}px`;
    menuEl.style.top = `${y}px`;

    container.appendChild(menuEl);
    menuEl.focus();
    focusedIndex = -1;
  };

  const handleContextMenu = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.tree-node__row');
    if (!target) return;

    const path = target.dataset.path;
    const type = target.dataset.type;
    if (!path || (type !== 'file' && type !== 'directory')) return;

    e.preventDefault();

    store.update(
      {
        contextMenu: {
          x: e.clientX,
          y: e.clientY,
          targetPath: path,
          targetType: type,
        },
      },
      ['contextMenu'],
    );
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (!menuEl) return;

    const items = Array.from(menuEl.querySelectorAll<HTMLElement>('.context-menu__item'));
    if (items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        e.stopPropagation();
        focusedIndex = focusedIndex < items.length - 1 ? focusedIndex + 1 : 0;
        items[focusedIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        e.stopPropagation();
        focusedIndex = focusedIndex > 0 ? focusedIndex - 1 : items.length - 1;
        items[focusedIndex]?.focus();
        break;
      }
      case 'Enter': {
        e.preventDefault();
        e.stopPropagation();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          items[focusedIndex]?.click();
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      }
    }
  };

  const handleOutsideClick = (e: MouseEvent) => {
    if (!menuEl) return;
    if (menuEl.contains(e.target as Node)) return;
    close();
  };

  const unsubscribe = store.subscribe((state, changed) => {
    if (changed.includes('contextMenu')) {
      render();
    }
  });

  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('mousedown', handleOutsideClick);

  return () => {
    unsubscribe();
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousedown', handleOutsideClick);
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
  };
}
