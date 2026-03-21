// @vitest-environment jsdom

import type { TreeNode } from '../../../src/shared/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountFileTree } from '../../../src/client/components/file-tree.js';
import { VirtualTree, type FlatTreeNode } from '../../../src/client/components/virtual-tree.js';
import { emptySession } from '../../fixtures/session.js';
import { createStore } from '../support.js';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn();

  disconnect = vi.fn();

  trigger(target: Element): void {
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

function setClientHeight(element: HTMLElement, state: { value: number }) {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => state.value,
  });
}

function createFlatNodes(count: number): Array<FlatTreeNode<TreeNode>> {
  return Array.from({ length: count }, (_, index) => ({
    depth: index % 3,
    node: {
      name: `node-${index}.md`,
      path: `/root/node-${index}.md`,
      type: 'file',
    },
  }));
}

function createDirectoryNodes(count: number): Array<FlatTreeNode<TreeNode>> {
  return Array.from({ length: count }, (_, index) => ({
    depth: index % 2,
    node: {
      name: `dir-${index}`,
      path: `/root/dir-${index}`,
      type: 'directory',
      mdCount: index + 1,
      children: [],
    },
  }));
}

describe('virtual tree', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    MockResizeObserver.instances = [];
    vi.unstubAllGlobals();
  });

  it('TC-2.1a: virtual tree renders only visible rows', () => {
    const container = document.createElement('div');
    const height = { value: 30 * 28 };
    setClientHeight(container, height);

    const tree = new VirtualTree<TreeNode>({
      container,
      rowHeight: 28,
      overscan: 20,
      renderRow: (flatNode) => {
        const row = document.createElement('div');
        row.className = 'tree-node__row';
        row.textContent = flatNode.node.name;
        return row;
      },
      onNodeClick: vi.fn(),
    });

    tree.setNodes(createFlatNodes(1500));

    expect(container.querySelectorAll('.tree-node__row')).toHaveLength(70);
    tree.destroy();
  });

  it('TC-2.1b: expand all with virtual tree', () => {
    const container = document.createElement('div');
    const height = { value: 30 * 28 };
    setClientHeight(container, height);

    const tree = new VirtualTree<TreeNode>({
      container,
      rowHeight: 28,
      overscan: 20,
      renderRow: (flatNode) => {
        const row = document.createElement('div');
        row.className = 'tree-node__row';
        row.textContent = flatNode.node.name;
        return row;
      },
      onNodeClick: vi.fn(),
    });

    tree.setNodes(createFlatNodes(20));
    tree.setNodes(createFlatNodes(1500));

    expect(container.querySelector<HTMLElement>('.virtual-tree__spacer')?.style.height).toBe(
      `${1500 * 28}px`,
    );
    expect(container.querySelectorAll('.tree-node__row')).toHaveLength(70);
    tree.destroy();
  });

  it('TC-2.1c: scroll updates visible rows', () => {
    const container = document.createElement('div');
    const height = { value: 30 * 28 };
    setClientHeight(container, height);

    const tree = new VirtualTree<TreeNode>({
      container,
      rowHeight: 28,
      overscan: 20,
      renderRow: (flatNode) => {
        const row = document.createElement('div');
        row.className = 'tree-node__row';
        row.textContent = flatNode.node.name;
        return row;
      },
      onNodeClick: vi.fn(),
    });

    tree.setNodes(createFlatNodes(1500));
    container.scrollTop = 750 * 28;
    container.dispatchEvent(new Event('scroll'));

    const rows = Array.from(container.querySelectorAll<HTMLElement>('.tree-node__row')).map(
      (row) => row.textContent,
    );
    expect(rows[0]).toBe('node-730.md');
    expect(rows).toContain('node-750.md');
    expect(rows).not.toContain('node-10.md');
    tree.destroy();
  });

  it('TC-2.2a: count badges render per row', () => {
    const container = document.createElement('div');
    const height = { value: 10 * 28 };
    setClientHeight(container, height);

    const tree = new VirtualTree<TreeNode>({
      container,
      rowHeight: 28,
      overscan: 20,
      renderRow: (flatNode) => {
        const row = document.createElement('div');
        row.className = 'tree-node__row';
        row.textContent = flatNode.node.name;

        if (flatNode.node.type === 'directory') {
          const badge = document.createElement('span');
          badge.className = 'tree-node__badge';
          badge.textContent = String(flatNode.node.mdCount ?? 0);
          row.appendChild(badge);
        }

        return row;
      },
      onNodeClick: vi.fn(),
    });

    tree.setNodes(createDirectoryNodes(30));

    expect(
      Array.from(container.querySelectorAll('.tree-node__badge')).map((badge) => badge.textContent),
    ).toContain('1');
    expect(
      Array.from(container.querySelectorAll('.tree-node__badge')).map((badge) => badge.textContent),
    ).toContain('30');
    tree.destroy();
  });

  it('Resize updates visible row count', () => {
    const container = document.createElement('div');
    const height = { value: 5 * 28 };
    setClientHeight(container, height);

    const tree = new VirtualTree<TreeNode>({
      container,
      rowHeight: 28,
      overscan: 20,
      renderRow: (flatNode) => {
        const row = document.createElement('div');
        row.className = 'tree-node__row';
        row.textContent = flatNode.node.name;
        return row;
      },
      onNodeClick: vi.fn(),
    });

    tree.setNodes(createFlatNodes(100));
    expect(container.querySelectorAll('.tree-node__row')).toHaveLength(45);

    height.value = 10 * 28;
    MockResizeObserver.instances[0]?.trigger(container);

    expect(container.querySelectorAll('.tree-node__row')).toHaveLength(50);
    tree.destroy();
  });

  it('Keyboard nav scrolls to focused row', () => {
    document.body.innerHTML = '<div id="tree"></div>';
    const container = document.querySelector<HTMLElement>('#tree')!;
    const height = { value: 3 * 28 };
    setClientHeight(container, height);

    const store = createStore({
      session: { ...emptySession, lastRoot: '/root' },
      tree: Array.from({ length: 40 }, (_, index) => ({
        name: `file-${index}.md`,
        path: `/root/file-${index}.md`,
        type: 'file' as const,
      })),
    });

    mountFileTree(container, store, {
      onExpandAll: vi.fn(),
      onCollapseAll: vi.fn(),
      onToggleDir: vi.fn(),
      onSelectFile: vi.fn(),
    });

    for (let index = 0; index < 10; index += 1) {
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    }

    expect(container.scrollTop).toBeGreaterThan(0);
    expect(document.activeElement).toBe(
      container.querySelector<HTMLElement>('.tree-node__row[data-index="9"]'),
    );
  });
});
