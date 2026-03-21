export interface FlatTreeNode<TNode = unknown> {
  node: TNode;
  depth: number;
}

export interface VirtualTreeOptions<TNode = unknown> {
  container: HTMLElement;
  rowHeight: number;
  overscan?: number;
  renderRow: (node: FlatTreeNode<TNode>, index: number) => HTMLElement;
  onNodeClick: (node: FlatTreeNode<TNode>) => void;
  onNodeContextMenu?: (node: FlatTreeNode<TNode>, event: MouseEvent) => void;
}

export class VirtualTree<TNode = unknown> {
  private nodes: Array<FlatTreeNode<TNode>> = [];

  private scrollTop = 0;

  private viewportHeight = 0;

  private readonly overscan: number;

  private readonly spacer: HTMLDivElement;

  private readonly viewport: HTMLDivElement;

  private readonly resizeObserver: ResizeObserver | null;

  private readonly originalPosition: string;

  private readonly originalOverflowAnchor: string;

  private readonly handleScroll = () => {
    this.scrollTop = this.options.container.scrollTop;
    this.render();
  };

  private readonly handleResize = () => {
    this.viewportHeight = this.getViewportHeight();
    this.render();
  };

  constructor(private readonly options: VirtualTreeOptions<TNode>) {
    this.overscan = options.overscan ?? 20;
    this.originalPosition = options.container.style.position;
    this.originalOverflowAnchor = options.container.style.overflowAnchor;

    if (!options.container.style.position) {
      options.container.style.position = 'relative';
    }
    options.container.style.overflowAnchor = 'none';

    this.spacer = document.createElement('div');
    this.spacer.className = 'virtual-tree__spacer';

    this.viewport = document.createElement('div');
    this.viewport.className = 'virtual-tree__viewport';
    this.viewport.style.position = 'absolute';
    this.viewport.style.top = '0';
    this.viewport.style.left = '0';
    this.viewport.style.right = '0';

    options.container.append(this.spacer, this.viewport);
    options.container.addEventListener('scroll', this.handleScroll);

    this.viewportHeight = this.getViewportHeight();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(options.container);
    } else {
      this.resizeObserver = null;
      window.addEventListener('resize', this.handleResize);
    }

    this.render();
  }

  setNodes(nodes: Array<FlatTreeNode<TNode>>): void {
    this.nodes = nodes;
    this.spacer.style.height = `${nodes.length * this.options.rowHeight}px`;
    const maxScrollTop = Math.max(
      0,
      nodes.length * this.options.rowHeight - this.getViewportHeight(),
    );
    if (this.options.container.scrollTop > maxScrollTop) {
      this.options.container.scrollTop = maxScrollTop;
    }
    this.scrollTop = this.options.container.scrollTop;
    this.render();
  }

  scrollToIndex(index: number): void {
    if (index < 0 || index >= this.nodes.length) {
      return;
    }

    const previousScrollTop = this.options.container.scrollTop;
    const viewportHeight = this.getViewportHeight();
    const rowTop = index * this.options.rowHeight;
    const rowBottom = rowTop + this.options.rowHeight;
    const viewportTop = this.options.container.scrollTop;
    const viewportBottom = viewportTop + viewportHeight;

    if (rowTop < viewportTop) {
      this.options.container.scrollTop = rowTop;
    } else if (rowBottom > viewportBottom) {
      this.options.container.scrollTop = Math.max(0, rowBottom - viewportHeight);
    }

    this.scrollTop = this.options.container.scrollTop;
    if (
      this.options.container.scrollTop !== previousScrollTop ||
      !this.viewport.querySelector<HTMLElement>(`.tree-node__row[data-index="${index}"]`)
    ) {
      this.render();
    }
  }

  destroy(): void {
    this.options.container.removeEventListener('scroll', this.handleScroll);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', this.handleResize);
    }

    this.spacer.remove();
    this.viewport.remove();
    this.options.container.style.position = this.originalPosition;
    this.options.container.style.overflowAnchor = this.originalOverflowAnchor;
  }

  private render(): void {
    const { rowHeight, renderRow, onNodeClick, onNodeContextMenu } = this.options;
    const viewportHeight = this.getViewportHeight();
    const startIndex = Math.max(0, Math.floor(this.scrollTop / rowHeight) - this.overscan);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + 2 * this.overscan;
    const endIndex = Math.min(this.nodes.length, startIndex + visibleCount);

    this.viewport.style.transform = `translateY(${startIndex * rowHeight}px)`;
    this.viewport.replaceChildren();

    const fragment = document.createDocumentFragment();
    for (let index = startIndex; index < endIndex; index += 1) {
      const flatNode = this.nodes[index]!;
      const row = renderRow(flatNode, index);
      row.dataset.index = String(index);
      row.style.height = `${rowHeight}px`;
      row.style.boxSizing = 'border-box';
      row.addEventListener('click', () => {
        onNodeClick(flatNode);
      });

      if (onNodeContextMenu) {
        row.addEventListener('contextmenu', (event) => {
          onNodeContextMenu(flatNode, event);
        });
      }

      fragment.appendChild(row);
    }

    this.viewport.appendChild(fragment);
  }

  private getViewportHeight(): number {
    return Math.max(
      this.options.container.clientHeight,
      this.viewportHeight,
      this.options.rowHeight,
    );
  }
}
