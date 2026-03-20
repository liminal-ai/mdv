import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

function fileName(filePath: string): string {
  const segments = filePath.split('/').filter(Boolean);
  return segments.at(-1) ?? filePath;
}

export interface ContentAreaActions {
  onBrowse: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onOpenRecentFile?: (path: string) => void | Promise<void>;
}

export function mountContentArea(
  container: HTMLElement,
  store: StateStore,
  actions: ContentAreaActions,
): () => void {
  const renderEmptyState = () => {
    const { session } = store.get();
    const recentFiles =
      session.recentFiles.length > 0
        ? createElement('ul', {
            className: 'content-area__recent-list',
            children: session.recentFiles.map((recentFile) =>
              createElement('li', {
                className: 'content-area__recent-item',
                children: [
                  createElement('button', {
                    className: 'content-area__recent-button',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        void actions.onOpenRecentFile?.(recentFile.path);
                      },
                    },
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
      attrs: { type: 'button' },
      on: {
        click: () => {
          void actions.onOpenFile();
        },
      },
    });

    container.replaceChildren(
      createElement('section', {
        className: 'content-area__empty-state',
        children: [
          createElement('p', { className: 'content-area__eyebrow', text: 'MD Viewer' }),
          createElement('h1', {
            className: 'content-area__title',
            text: 'Open a markdown file to begin.',
          }),
          createElement('p', {
            className: 'content-area__copy',
            text: 'Keep related docs open in tabs and jump back into recent reading quickly.',
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

  const render = () => {
    const state = store.get();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;

    if (!activeTab) {
      renderEmptyState();
      return;
    }

    const bodyChildren: Array<Node | null> = [];

    if (activeTab.loading) {
      bodyChildren.push(
        createElement('div', {
          className: 'content-area__loading',
          children: [
            createElement('div', {
              className: 'content-area__spinner',
              attrs: { 'aria-hidden': 'true' },
            }),
            createElement('p', {
              className: 'content-area__loading-copy',
              text: `Loading ${activeTab.filename}...`,
            }),
          ],
        }),
      );
    } else if (activeTab.status === 'deleted') {
      bodyChildren.push(
        createElement('div', {
          className: 'content-area__deleted',
          children: [
            createElement('div', {
              className: 'content-area__deleted-banner',
              text: 'File not found. Showing the last known rendered content.',
            }),
            createElement('article', {
              className: 'markdown-body markdown-body--muted',
              attrs: { 'aria-label': activeTab.filename },
            }),
          ],
        }),
      );
    } else if (activeTab.status === 'error') {
      bodyChildren.push(
        createElement('div', {
          className: 'content-area__error',
          text: activeTab.errorMessage ?? 'Failed to load this document.',
        }),
      );
    } else {
      bodyChildren.push(
        createElement('article', {
          className: 'markdown-body',
          attrs: { 'aria-label': activeTab.filename },
        }),
      );
    }

    container.replaceChildren(
      createElement('section', {
        className: 'content-area__view',
        children: [
          createElement('div', {
            className: 'content-area__body',
            children: bodyChildren,
          }),
        ],
      }),
    );

    if (!activeTab.loading && activeTab.status !== 'error') {
      const markdownBody = container.querySelector<HTMLElement>('.markdown-body');
      if (markdownBody) {
        markdownBody.innerHTML = activeTab.html;
      }
    }
  };

  render();
  return store.subscribe(render);
}
