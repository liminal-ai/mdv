import type { TreeNode } from '../../shared/types.js';
import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';
import { VirtualTree, type FlatTreeNode } from './virtual-tree.js';

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

function flattenVisible(
  nodes: TreeNode[],
  expandedSet: Set<string>,
  depth = 0,
): Array<FlatTreeNode<TreeNode>> {
  const result: Array<FlatTreeNode<TreeNode>> = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.type === 'directory' && expandedSet.has(node.path) && node.children) {
      result.push(...flattenVisible(node.children, expandedSet, depth + 1));
    }
  }
  return result;
}

function createTreeRow(flatNode: FlatTreeNode<TreeNode>, expandedSet: Set<string>): HTMLElement {
  const { node, depth } = flatNode;
  const isDir = node.type === 'directory';
  const isExpanded = isDir && expandedSet.has(node.path);

  return createElement('div', {
    className: `tree-node__row tree-node tree-node--${node.type}`,
    attrs: {
      tabindex: -1,
      role: 'treeitem',
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
  });
}

export function mountFileTree(
  container: HTMLElement,
  store: StateStore,
  actions: FileTreeActions,
): () => void {
  let focusedIndex = -1;
  let virtualTree: VirtualTree<TreeNode> | null = null;
  let currentExpandedSet = new Set<string>();

  container.tabIndex = 0;

  const focusIndex = (index: number) => {
    virtualTree?.scrollToIndex(index);
    container.querySelector<HTMLElement>(`.tree-node__row[data-index="${index}"]`)?.focus();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const state = store.get();
    const root = state.session.lastRoot;
    if (!root || !state.tree.length) return;

    const expandedArr = state.expandedDirsByRoot[root] ?? [];
    const expandedSet = new Set(expandedArr);
    const visible = flattenVisible(state.tree, expandedSet);
    if (visible.length === 0) return;

    const hasValidFocus = focusedIndex >= 0 && focusedIndex < visible.length;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        focusedIndex = hasValidFocus ? Math.min(focusedIndex + 1, visible.length - 1) : 0;
        focusIndex(focusedIndex);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        focusedIndex = hasValidFocus ? Math.max(focusedIndex - 1, 0) : 0;
        focusIndex(focusedIndex);
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        if (!hasValidFocus) {
          focusedIndex = 0;
        }
        const currentNode = visible[focusedIndex]?.node;
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
        const currentNode = visible[focusedIndex]?.node;
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
        const currentNode = visible[focusedIndex]?.node;
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
      if (virtualTree) {
        virtualTree.destroy();
        virtualTree = null;
      }
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
    const visible = flattenVisible(tree, expandedSet);
    currentExpandedSet = expandedSet;

    if (!virtualTree) {
      container.replaceChildren();
      virtualTree = new VirtualTree<TreeNode>({
        container,
        rowHeight: 28,
        overscan: 20,
        renderRow: (flatNode) => createTreeRow(flatNode, currentExpandedSet),
        onNodeClick: (flatNode) => {
          if (flatNode.node.type === 'directory') {
            actions.onToggleDir(flatNode.node.path);
          } else {
            actions.onSelectFile(flatNode.node.path);
          }
        },
      });
    }

    virtualTree.setNodes(visible);
  };

  render();
  const unsubscribe = store.subscribe(render);

  return () => {
    container.removeEventListener('keydown', handleKeydown);
    virtualTree?.destroy();
    unsubscribe();
    container.replaceChildren();
  };
}

export { collectAllDirPaths, flattenVisible };
