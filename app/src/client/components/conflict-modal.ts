import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

export interface ConflictModalActions {
  onKeep: () => void | Promise<void>;
  onReload: () => void | Promise<void>;
  onSaveCopy: () => void | Promise<void>;
}

export function mountConflictModal(
  container: HTMLElement,
  store: StateStore,
  actions: ConflictModalActions,
): () => void {
  const render = () => {
    const modal = store.get().conflictModal;

    container.replaceChildren();
    if (!modal) {
      return;
    }

    container.replaceChildren(
      createElement('div', {
        className: 'modal-overlay',
        children: [
          createElement('div', {
            className: 'modal',
            attrs: {
              role: 'dialog',
              'aria-modal': 'true',
              'aria-labelledby': 'conflict-modal-title',
            },
            children: [
              createElement('h2', {
                className: 'modal__title',
                text: 'File changed externally',
                attrs: { id: 'conflict-modal-title' },
              }),
              createElement('p', {
                className: 'modal__message',
                text: `${modal.filename} has been modified externally.`,
              }),
              createElement('div', {
                className: 'modal__actions',
                children: [
                  createElement('button', {
                    className: 'button--primary',
                    text: 'Keep My Changes',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        void actions.onKeep();
                      },
                    },
                  }),
                  createElement('button', {
                    className: 'button--danger',
                    text: 'Reload from Disk',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        void actions.onReload();
                      },
                    },
                  }),
                  createElement('button', {
                    text: 'Save Copy',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        void actions.onSaveCopy();
                      },
                    },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !store.get().conflictModal) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    void actions.onKeep();
  };

  document.addEventListener('keydown', handleKeyDown);
  render();

  const unsubscribe = store.subscribe(render);
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    unsubscribe();
  };
}
