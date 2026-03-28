import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

function getProgressLabel(format: 'pdf' | 'docx' | 'html' | null): string {
  switch (format) {
    case 'pdf':
      return 'Exporting PDF...';
    case 'docx':
      return 'Exporting DOCX...';
    case 'html':
      return 'Exporting HTML...';
    default:
      return 'Exporting...';
  }
}

export function mountExportProgress(container: HTMLElement, store: StateStore): () => void {
  const render = () => {
    const { exportState } = store.get();

    container.replaceChildren();
    if (!exportState.inProgress || !exportState.activeFormat) {
      return;
    }

    container.replaceChildren(
      createElement('div', {
        className: 'export-progress',
        attrs: {
          role: 'status',
          'aria-live': 'polite',
        },
        children: [
          createElement('div', {
            className: 'export-progress__spinner',
            attrs: { 'aria-hidden': 'true' },
          }),
          createElement('span', {
            className: 'export-progress__label',
            text: getProgressLabel(exportState.activeFormat),
          }),
        ],
      }),
    );
  };

  render();
  return store.subscribe((_state, changed) => {
    if (changed.includes('exportState')) {
      render();
    }
  });
}
