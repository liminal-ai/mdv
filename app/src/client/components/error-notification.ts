import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

export interface ErrorNotificationActions {
  onDismiss: () => void;
}

export function mountErrorNotification(
  container: HTMLElement,
  store: StateStore,
  actions: ErrorNotificationActions,
): () => void {
  const render = () => {
    const { error } = store.get();

    container.replaceChildren();
    if (!error) {
      return;
    }

    container.replaceChildren(
      createElement('div', {
        className: 'error-notification',
        attrs: { role: 'alert' },
        children: [
          createElement('div', {
            className: 'error-notification__body',
            children: [
              createElement('strong', {
                className: 'error-notification__title',
                text: error.code.replaceAll('_', ' '),
              }),
              createElement('p', {
                className: 'error-notification__message',
                text: error.message,
              }),
            ],
          }),
          createElement('button', {
            className: 'error-notification__dismiss',
            text: 'Dismiss',
            attrs: { type: 'button' },
            on: {
              click: actions.onDismiss,
            },
          }),
        ],
      }),
    );
  };

  render();
  return store.subscribe(render);
}
