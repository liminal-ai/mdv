import type { PackageNavigationNode, StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';
import { mountPackageHeader } from './package-header.js';

function normalizePath(input: string): string {
  const absolute = input.startsWith('/');
  const segments: string[] = [];

  for (const segment of input.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (segments.length > 0) {
        segments.pop();
      }
      continue;
    }

    segments.push(segment);
  }

  if (segments.length === 0) {
    return absolute ? '/' : '.';
  }

  return `${absolute ? '/' : ''}${segments.join('/')}`;
}

function isWithinRoot(root: string, targetPath: string): boolean {
  const normalizedRoot = normalizePath(root).replace(/\/$/, '') || '/';
  return targetPath === normalizedRoot || targetPath.startsWith(`${normalizedRoot}/`);
}

function toAbsolutePath(root: string | null, filePath: string): string | null {
  if (!root) {
    return filePath;
  }

  const absolutePath = normalizePath(`${root.replace(/\/$/, '')}/${filePath}`);
  return isWithinRoot(root, absolutePath) ? absolutePath : null;
}

function toggleGroup(store: StateStore, displayName: string): void {
  const packageState = store.get().packageState;
  const collapsedGroups = new Set(packageState.collapsedGroups);

  if (collapsedGroups.has(displayName)) {
    collapsedGroups.delete(displayName);
  } else {
    collapsedGroups.add(displayName);
  }

  store.update(
    {
      packageState: {
        ...packageState,
        collapsedGroups,
      },
    },
    ['packageState'],
  );
}

function renderNode(
  node: PackageNavigationNode,
  depth: number,
  store: StateStore,
  actions: { onOpenFile: (path: string) => void | Promise<void> },
): HTMLElement {
  const entry = createElement('div', { className: 'pkg-nav__entry' });

  if (node.isGroup) {
    const collapsed = store.get().packageState.collapsedGroups.has(node.displayName);
    const children = createElement('div', {
      className: 'pkg-nav__children',
      attrs: { hidden: collapsed },
      children: node.children.map((child) => renderNode(child, depth + 1, store, actions)),
    });

    const handleToggle = () => {
      toggleGroup(store, node.displayName);
    };

    entry.append(
      createElement('div', {
        className: 'pkg-nav__group',
        attrs: { style: `padding-left: ${depth}rem` },
        on: {
          click: (event: Event) => {
            if ((event.target as HTMLElement).closest('.pkg-nav__toggle')) {
              return;
            }
            handleToggle();
          },
        },
        children: [
          createElement('button', {
            className: `pkg-nav__toggle${collapsed ? ' pkg-nav__toggle--collapsed' : ''}`,
            text: '▾',
            attrs: {
              type: 'button',
              'aria-label': `${collapsed ? 'Expand' : 'Collapse'} ${node.displayName}`,
            },
            on: {
              click: handleToggle,
            },
          }),
          createElement('span', {
            className: 'pkg-nav__label',
            text: node.displayName,
          }),
        ],
      }),
      children,
    );

    return entry;
  }

  entry.append(
    createElement('button', {
      className: 'pkg-nav__link',
      text: node.displayName,
      attrs: {
        type: 'button',
        'data-path': node.filePath,
        style: `margin-left: ${depth}rem`,
      },
      on: {
        click: () => {
          if (!node.filePath) {
            return;
          }

          const root = store.get().packageState.effectiveRoot;
          const absolutePath = toAbsolutePath(root, node.filePath);
          if (!absolutePath) {
            return;
          }

          if (root && !isWithinRoot(root, absolutePath)) {
            return;
          }

          void actions.onOpenFile(absolutePath);
        },
      },
    }),
  );

  return entry;
}

export function mountPackageNavigation(
  container: HTMLElement,
  store: StateStore,
  actions: { onOpenFile: (path: string) => void | Promise<void> },
): () => void {
  const render = () => {
    const { navigation } = store.get().packageState;

    container.replaceChildren(
      createElement('div', {
        className: 'pkg-nav',
        children: navigation.map((node) => renderNode(node, 0, store, actions)),
      }),
    );
  };

  render();
  const unsubscribe = store.subscribe((_state, changed) => {
    if (changed.includes('packageState')) {
      render();
    }
  });

  return () => {
    unsubscribe();
    container.replaceChildren();
  };
}

export function mountPackageSidebar(
  container: HTMLElement,
  store: StateStore,
  actions: {
    onOpenFile: (path: string) => void | Promise<void>;
    onEditManifest: () => void | Promise<void>;
  },
): () => void {
  const headerHost = createElement('div', { className: 'pkg-sidebar__header' });
  const navHost = createElement('div', { className: 'pkg-sidebar__nav' });
  container.replaceChildren(headerHost, navHost);

  const cleanupHeader = mountPackageHeader(headerHost, store, {
    onEditManifest: actions.onEditManifest,
  });
  const cleanupNavigation = mountPackageNavigation(navHost, store, {
    onOpenFile: actions.onOpenFile,
  });

  return () => {
    cleanupHeader();
    cleanupNavigation();
    container.replaceChildren();
  };
}
