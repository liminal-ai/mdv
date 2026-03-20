import type { TreeNode } from '../../shared/types.js';
import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

export interface FileTreeActions {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
}

function collectAllDirPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === 'directory') {
      paths.push(node.path);
      if (node.children) {
        paths.push(...collectAllDirPaths(node.children));
      }
    }
  }
  return paths;
}

function flattenVisible(nodes: TreeNode[], expandedSet: Set<string>): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.type === 'directory' && expandedSet.has(node.path) && node.children) {
      result.push(...flattenVisible(node.children, expandedSet));
    }
  }
  return result;
}

function createTreeNode(
  node: TreeNode,
  expandedSet: Set<string>,
  depth: number,
  actions: FileTreeActions,
): HTMLElement {
  const isDir = node.type === 'directory';
  const isExpanded = isDir && expandedSet.has(node.path);

  const row = createElement('div', {
    className: 'tree-node__row',
    attrs: {
      tabindex: -1,
      role: isDir ? 'treeitem' : 'treeitem',
      'aria-expanded': isDir ? String(isExpanded) : null,
      'data-path': node.path,
      'data-type': node.type,
      style: `padding-left: ${depth * 1.2}rem`,
    },
    dataset: { path: node.path, type: node.type },
    children: [
      isDir
        ? createElement('span', {
            className: isExpanded
              ? 'disclosure-triangle'
              : 'disclosure-triangle disclosure-triangle--collapsed',
            text: '▼',
          })
        : createElement('span', { className: 'tree-node__spacer', text: '' }),
      createElement('span', {
        className: 'tree-node__icon',
        text: isDir ? '📁' : '📄',
      }),
      createElement('span', {
        className: 'tree-node__name',
        text: node.name,
        attrs: { title: node.path },
      }),
      isDir && node.mdCount !== undefined
        ? createElement('span', {
            className: 'tree-node__badge',
            text: String(node.mdCount),
          })
        : null,
    ],
    on: {
      click: () => {
        if (isDir) {
          actions.onToggleDir(node.path);
        } else {
          actions.onSelectFile(node.path);
        }
      },
    },
  });

  const children: HTMLElement[] = [];
  if (isDir && isExpanded && node.children) {
    for (const child of node.children) {
      children.push(createTreeNode(child, expandedSet, depth + 1, actions));
    }
  }

  return createElement('div', {
    className: `tree-node tree-node--${node.type}`,
    children: [row, ...children],
  });
}

export function mountFileTree(
  container: HTMLElement,
  store: StateStore,
  actions: FileTreeActions,
): () => void {
  let focusedIndex = -1;

  container.tabIndex = 0;

  const handleKeydown = (event: KeyboardEvent) => {
    const state = store.get();
    const root = state.session.lastRoot;
    if (!root || !state.tree.length) return;

    const expandedArr = state.expandedDirsByRoot[root] ?? [];
    const expandedSet = new Set(expandedArr);
    const visible = flattenVisible(state.tree, expandedSet);
    if (visible.length === 0) return;

    const rows = Array.from(container.querySelectorAll<HTMLElement>('.tree-node__row'));
    if (rows.length === 0) return;

    const hasValidFocus = focusedIndex >= 0 && focusedIndex < rows.length;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        focusedIndex = hasValidFocus ? Math.min(focusedIndex + 1, rows.length - 1) : 0;
        rows[focusedIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        focusedIndex = hasValidFocus ? Math.max(focusedIndex - 1, 0) : 0;
        rows[focusedIndex]?.focus();
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        if (!hasValidFocus) {
          focusedIndex = 0;
        }
        const currentNode = visible[focusedIndex];
        if (currentNode?.type === 'directory' && !expandedSet.has(currentNode.path)) {
          actions.onToggleDir(currentNode.path);
        }
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        if (!hasValidFocus) {
          focusedIndex = 0;
        }
        const currentNode = visible[focusedIndex];
        if (currentNode?.type === 'directory' && expandedSet.has(currentNode.path)) {
          actions.onToggleDir(currentNode.path);
        }
        break;
      }
      case 'Enter': {
        event.preventDefault();
        if (!hasValidFocus) {
          focusedIndex = 0;
        }
        const currentNode = visible[focusedIndex];
        if (currentNode) {
          if (currentNode.type === 'directory') {
            actions.onToggleDir(currentNode.path);
          } else {
            actions.onSelectFile(currentNode.path);
          }
        }
        break;
      }
    }
  };

  container.addEventListener('keydown', handleKeydown);

  const render = () => {
    const state = store.get();
    const root = state.session.lastRoot;
    const tree = state.tree;

    if (!root || tree.length === 0) {
      container.replaceChildren(
        createElement('p', {
          className: 'tree-empty',
          text: state.treeLoading ? 'Loading…' : 'No markdown files found',
        }),
      );
      return;
    }

    const expandedArr = state.expandedDirsByRoot[root] ?? [];
    const expandedSet = new Set(expandedArr);

    const fragment = document.createDocumentFragment();
    for (const node of tree) {
      fragment.appendChild(createTreeNode(node, expandedSet, 0, actions));
    }

    container.replaceChildren(fragment);
  };

  render();
  const unsubscribe = store.subscribe(render);

  return () => {
    container.removeEventListener('keydown', handleKeydown);
    unsubscribe();
    container.replaceChildren();
  };
}

export { collectAllDirPaths };
