import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

export interface UnsavedModalActions {
  onSaveAndClose: () => void | Promise<void>;
  onDiscardChanges: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}

export function mountUnsavedModal(
  container: HTMLElement,
  store: StateStore,
  actions: UnsavedModalActions,
): () => void {
  const render = () => {
    const modal = store.get().unsavedModal;

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
              'aria-labelledby': 'unsaved-modal-title',
            },
            children: [
              createElement('h2', {
                className: 'modal__title',
                text: 'Unsaved changes',
                attrs: { id: 'unsaved-modal-title' },
              }),
              createElement('p', {
                className: 'modal__message',
                text: `You have unsaved changes in ${modal.filename}.`,
              }),
              createElement('div', {
                className: 'modal__actions',
                children: [
                  createElement('button', {
                    className: 'button--primary',
                    text: 'Save and Close',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        void actions.onSaveAndClose();
                      },
                    },
                  }),
                  createElement('button', {
                    className: 'button--danger',
                    text: 'Discard Changes',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        void actions.onDiscardChanges();
                      },
                    },
                  }),
                  createElement('button', {
                    text: 'Cancel',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        void actions.onCancel();
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
    if (event.key !== 'Escape' || !store.get().unsavedModal) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    void actions.onCancel();
  };

  document.addEventListener('keydown', handleKeyDown);
  render();

  const unsubscribe = store.subscribe(render);
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    unsubscribe();
  };
}
