import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

function fileName(filePath: string | null): string {
  if (!filePath) {
    return 'Package';
  }

  return filePath.split('/').filter(Boolean).at(-1) ?? filePath;
}

export function mountPackageHeader(
  container: HTMLElement,
  store: StateStore,
  actions: { onEditManifest: () => void | Promise<void> },
): () => void {
  const render = () => {
    const { metadata, sourcePath, stale, mode } = store.get().packageState;

    container.replaceChildren(
      createElement('div', {
        className: 'pkg-header',
        children: [
          createElement('span', {
            className: 'pkg-header__mode',
            text: 'Package',
          }),
          createElement('span', {
            className: 'pkg-header__title',
            text: metadata.title || fileName(sourcePath),
          }),
          metadata.version
            ? createElement('span', {
                className: 'pkg-header__version',
                text: metadata.version,
              })
            : null,
          metadata.author
            ? createElement('span', {
                className: 'pkg-header__author',
                text: metadata.author,
              })
            : null,
          createElement('button', {
            className: 'pkg-header__edit-manifest',
            text: 'Edit Manifest',
            attrs: { type: 'button' },
            on: {
              click: () => {
                void actions.onEditManifest();
              },
            },
          }),
          stale && mode === 'extracted'
            ? createElement('span', {
                className: 'pkg-header__stale',
                text: 'Modified',
              })
            : null,
        ],
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
