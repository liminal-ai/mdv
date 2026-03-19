import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

export function mountTabStrip(container: HTMLElement, store: StateStore): () => void {
  const render = () => {
    void store.get();
    container.replaceChildren(
      createElement('div', {
        className: 'tab-strip-empty',
        text: 'No documents open',
      }),
    );
  };

  render();
  return store.subscribe(render);
}
