import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

export interface RootLineActions {
  onBrowse: () => void;
  onPin: () => void;
  onCopy: () => void;
  onRefresh: () => void;
}

function shortenRootPath(root: string): string {
  const macHomeMatch = root.match(/^\/Users\/[^/]+(?<rest>\/.*)?$/);
  if (macHomeMatch) {
    return `~${macHomeMatch.groups?.rest ?? ''}`;
  }

  const linuxHomeMatch = root.match(/^\/home\/[^/]+(?<rest>\/.*)?$/);
  if (linuxHomeMatch) {
    return `~${linuxHomeMatch.groups?.rest ?? ''}`;
  }

  return root;
}

function showRootContextMenu(
  e: MouseEvent,
  actions: RootLineActions,
  hasRoot: boolean,
  invalidRoot: boolean,
): void {
  e.preventDefault();
  const existing = document.querySelector('.root-line-context');
  if (existing) existing.remove();

  const items: Array<{ label: string; action: () => void }> = [
    { label: 'Browse Folder…', action: actions.onBrowse },
  ];
  if (hasRoot && !invalidRoot) {
    items.push({ label: 'Pin as Path', action: actions.onPin });
  }
  if (hasRoot) {
    items.push({ label: 'Copy Path', action: actions.onCopy });
  }
  if (hasRoot && !invalidRoot) {
    items.push({ label: 'Refresh Tree', action: actions.onRefresh });
  }

  const menu = createElement('div', {
    className: 'root-line-context context-menu',
    attrs: { role: 'menu' },
    children: items.map((item) =>
      createElement('div', {
        className: 'context-menu__item',
        text: item.label,
        attrs: { role: 'menuitem', tabindex: -1 },
        on: {
          click: (ev: MouseEvent) => {
            ev.stopPropagation();
            menu.remove();
            item.action();
          },
        },
      }),
    ),
  });

  const x = Math.min(e.clientX, window.innerWidth - 180);
  const y = Math.min(e.clientY, window.innerHeight - items.length * 32 - 16);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  document.body.appendChild(menu);

  const dismiss = (ev: Event) => {
    if (!menu.contains(ev.target as Node)) {
      menu.remove();
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', escHandler);
    }
  };
  const escHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      menu.remove();
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', escHandler);
    }
  };
  setTimeout(() => {
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', escHandler);
  }, 0);
}

export function mountRootLine(
  container: HTMLElement,
  store: StateStore,
  actions: RootLineActions,
): () => void {
  const render = () => {
    const state = store.get();
    const root = state.session.lastRoot;
    const hasRoot = root !== null;
    const invalidRoot = hasRoot && state.invalidRoot;
    const pathClassName = [
      'root-line__path',
      !hasRoot ? 'root-line__path--placeholder' : null,
      invalidRoot ? 'root-line__path--invalid' : null,
    ]
      .filter(Boolean)
      .join(' ');

    const rootLineEl = createElement('div', {
      className: invalidRoot ? 'root-line root-line--invalid' : 'root-line',
      children: [
        createElement('span', {
          className: pathClassName,
          text: hasRoot ? shortenRootPath(root) : 'No folder selected',
          attrs: hasRoot ? { title: invalidRoot ? `${root} (Directory not found)` : root } : {},
        }),
        createElement('button', {
          className: 'root-line__browse',
          text: '📁',
          attrs: {
            type: 'button',
            title: 'Browse folder',
            'aria-label': 'Browse folder',
          },
          on: {
            click: (e: MouseEvent) => {
              e.stopPropagation();
              actions.onBrowse();
            },
          },
        }),
      ],
      on: {
        contextmenu: (e: MouseEvent) =>
          showRootContextMenu(e, actions, hasRoot, invalidRoot),
      },
    });

    container.replaceChildren(rootLineEl);
  };

  render();
  return store.subscribe(render);
}
