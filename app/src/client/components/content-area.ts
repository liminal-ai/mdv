import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

function fileName(filePath: string): string {
  const segments = filePath.split('/').filter(Boolean);
  return segments.at(-1) ?? filePath;
}

export interface ContentAreaActions {
  onBrowse: () => void | Promise<void>;
}

export function mountContentArea(
  container: HTMLElement,
  store: StateStore,
  actions: ContentAreaActions,
): () => void {
  const render = () => {
    const { session } = store.get();
    const recentFiles =
      session.recentFiles.length > 0
        ? createElement('ul', {
            className: 'content-area__recent-list',
            children: session.recentFiles.map((recentFile) =>
              createElement('li', {
                className: 'content-area__recent-item',
                children: [
                  createElement('span', {
                    className: 'content-area__recent-name',
                    text: fileName(recentFile.path),
                  }),
                  createElement('span', {
                    className: 'content-area__recent-path',
                    text: recentFile.path,
                  }),
                ],
              }),
            ),
          })
        : createElement('p', {
            className: 'content-area__empty-recent',
            text: 'No recent files',
          });

    const openFolderButton = createElement('button', {
      className: 'content-area__button content-area__button--primary',
      text: 'Open Folder',
      attrs: { type: 'button' },
      on: {
        click: () => {
          void actions.onBrowse();
        },
      },
    });
    const openFileButton = createElement('button', {
      className: 'content-area__button',
      text: 'Open File',
      attrs: { type: 'button', disabled: true },
    });

    container.replaceChildren(
      createElement('section', {
        className: 'content-area__empty-state',
        children: [
          createElement('p', { className: 'content-area__eyebrow', text: 'MD Viewer' }),
          createElement('h1', {
            className: 'content-area__title',
            text: 'Open a folder to begin.',
          }),
          createElement('p', {
            className: 'content-area__copy',
            text: 'Bring a Markdown workspace into focus and keep recent files close at hand.',
          }),
          createElement('div', {
            className: 'content-area__actions',
            children: [openFileButton, openFolderButton],
          }),
          createElement('div', {
            className: 'content-area__recent',
            children: [
              createElement('h2', {
                className: 'content-area__recent-title',
                text: 'Recent files',
              }),
              recentFiles,
            ],
          }),
        ],
      }),
    );
  };

  render();
  return store.subscribe(render);
}
