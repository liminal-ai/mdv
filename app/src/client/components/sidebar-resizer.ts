import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

const STORAGE_KEY = 'mdv-sidebar-width';
const MIN_WIDTH = 140;
const MAX_WIDTH = 500;
const LEGACY_DEFAULT_WIDTH = 240;
const DEFAULT_WIDTH = 260;
const DRAG_THRESHOLD = 3;

export function mountSidebarResizer(
  resizer: HTMLElement,
  main: HTMLElement,
  store: StateStore,
  onToggleSidebar: () => void,
): () => void {
  const stored = localStorage.getItem(STORAGE_KEY);
  const parsedWidth = stored ? parseInt(stored, 10) : NaN;
  let width = stored
    ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsedWidth))
    : DEFAULT_WIDTH;
  if (Number.isNaN(width)) width = DEFAULT_WIDTH;

  if (width === LEGACY_DEFAULT_WIDTH) {
    width = DEFAULT_WIDTH;
    try {
      localStorage.setItem(STORAGE_KEY, String(DEFAULT_WIDTH));
    } catch {
      // localStorage may be unavailable — ignore
    }
  }

  main.style.setProperty('--sidebar-width', `${width}px`);

  let startX = 0;
  let startWidth = 0;
  let didDrag = false;

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startX;
    if (Math.abs(delta) > DRAG_THRESHOLD) didDrag = true;
    width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
    main.style.setProperty('--sidebar-width', `${width}px`);
  };

  const onMouseUp = () => {
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (didDrag) {
      try {
        localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
      } catch {
        // localStorage may be unavailable — ignore
      }
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    startX = e.clientX;
    startWidth = width;
    didDrag = false;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onDblClick = (e: MouseEvent) => {
    e.preventDefault();
    onToggleSidebar();
  };

  resizer.addEventListener('mousedown', onMouseDown);
  resizer.addEventListener('dblclick', onDblClick);

  const revealBtn = createElement('button', {
    className: 'sidebar-reveal',
    text: '▶',
    attrs: {
      type: 'button',
      title: 'Show sidebar (⌘B)',
      'aria-label': 'Show sidebar',
    },
    on: { click: onToggleSidebar },
  });
  main.appendChild(revealBtn);

  const renderReveal = () => {
    const { sidebarVisible } = store.get();
    revealBtn.hidden = sidebarVisible;
  };
  renderReveal();
  const unsubscribe = store.subscribe(renderReveal);

  return () => {
    resizer.removeEventListener('mousedown', onMouseDown);
    resizer.removeEventListener('dblclick', onDblClick);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    unsubscribe();
    revealBtn.remove();
  };
}
