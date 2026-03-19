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

export function mountRootLine(
  container: HTMLElement,
  store: StateStore,
  actions: RootLineActions,
): () => void {
  const render = () => {
    const root = store.get().session.lastRoot;
    const hasRoot = root !== null;

    container.replaceChildren(
      createElement('div', {
        className: 'root-line',
        children: [
          createElement('span', {
            className: hasRoot ? 'root-line__path' : 'root-line__path root-line__path--placeholder',
            text: hasRoot ? shortenRootPath(root) : 'No folder selected',
            attrs: hasRoot ? { title: root } : {},
          }),
          createElement('div', {
            className: 'root-line__actions',
            children: [
              createElement('button', {
                className: 'root-line__browse',
                text: '📁',
                attrs: {
                  type: 'button',
                  title: 'Browse folder',
                  'aria-label': 'Browse folder',
                },
                on: {
                  click: actions.onBrowse,
                },
              }),
              hasRoot
                ? createElement('button', {
                    className: 'root-line__pin',
                    text: '📌',
                    attrs: {
                      type: 'button',
                      title: 'Pin as workspace',
                      'aria-label': 'Pin as workspace',
                    },
                    on: {
                      click: actions.onPin,
                    },
                  })
                : null,
              hasRoot
                ? createElement('button', {
                    className: 'root-line__copy',
                    text: '📋',
                    attrs: {
                      type: 'button',
                      title: 'Copy path',
                      'aria-label': 'Copy path',
                    },
                    on: {
                      click: actions.onCopy,
                    },
                  })
                : null,
              hasRoot
                ? createElement('button', {
                    className: 'root-line__refresh',
                    text: '↻',
                    attrs: {
                      type: 'button',
                      title: 'Refresh tree',
                      'aria-label': 'Refresh tree',
                    },
                    on: {
                      click: actions.onRefresh,
                    },
                  })
                : null,
            ],
          }),
        ],
      }),
    );
  };

  render();
  return store.subscribe(render);
}
