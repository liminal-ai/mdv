import { ApiClient } from '../api.js';
import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

const SUCCESS_DISMISS_MS = 10_000;

function dismissResult(store: StateStore): void {
  const state = store.get();
  store.update(
    {
      exportState: {
        ...state.exportState,
        result: null,
      },
    },
    ['exportState'],
  );
}

export function mountExportResult(container: HTMLElement, store: StateStore): () => void {
  const api = new ApiClient();
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const clearDismissTimer = () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  };

  const render = () => {
    clearDismissTimer();

    const result = store.get().exportState.result;
    container.replaceChildren();

    if (!result) {
      return;
    }

    const isDegraded = result.type === 'success' && result.warnings.length > 0;
    const variant = result.type === 'error' ? 'error' : isDegraded ? 'degraded' : 'success';
    const title =
      result.type === 'error'
        ? 'Export failed'
        : isDegraded
          ? 'Export complete with warnings'
          : 'Export complete';
    const detail =
      result.type === 'error'
        ? (result.error ?? 'The export could not be completed.')
        : (result.outputPath ?? '');

    const warningDetails =
      isDegraded && result.warnings.length > 0
        ? createElement('details', {
            className: 'export-result__warnings',
            children: [
              createElement('summary', {
                text: `${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`,
              }),
              createElement('div', {
                children: result.warnings.map((warning) =>
                  createElement('div', {
                    className: 'export-result__warning',
                    text: warning.message,
                  }),
                ),
              }),
            ],
          })
        : null;

    container.replaceChildren(
      createElement('div', {
        className: `export-result export-result--${variant}`,
        attrs: {
          role: result.type === 'error' ? 'alert' : 'status',
          'aria-live': result.type === 'error' ? 'assertive' : 'polite',
        },
        children: [
          createElement('span', {
            className: 'export-result__icon',
            text: result.type === 'error' ? '✕' : isDegraded ? '⚠' : '✓',
            attrs: { 'aria-hidden': 'true' },
          }),
          createElement('div', {
            className: 'export-result__body',
            children: [
              createElement('div', {
                className: 'export-result__header',
                children: [
                  createElement('strong', {
                    className: 'export-result__title',
                    text: title,
                  }),
                ],
              }),
              detail
                ? createElement('div', {
                    className:
                      result.type === 'error' ? 'export-result__detail' : 'export-result__path',
                    text: detail,
                    attrs: result.type !== 'error' ? { title: detail } : undefined,
                  })
                : null,
              warningDetails,
            ],
          }),
          createElement('div', {
            className: 'export-result__actions',
            children: [
              result.outputPath
                ? createElement('button', {
                    className: 'export-result__reveal',
                    text: 'Reveal in Finder',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        void api.reveal(result.outputPath!).catch(() => {});
                      },
                    },
                  })
                : null,
              createElement('button', {
                className: 'export-result__dismiss',
                text: 'Dismiss',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    dismissResult(store);
                  },
                },
              }),
            ],
          }),
        ],
      }),
    );

    if (result.type === 'success' && result.warnings.length === 0) {
      dismissTimer = setTimeout(() => {
        dismissResult(store);
      }, SUCCESS_DISMISS_MS);
    }
  };

  render();
  const unsubscribe = store.subscribe((_state, changed) => {
    if (changed.includes('exportState')) {
      render();
    }
  });

  return () => {
    clearDismissTimer();
    unsubscribe();
  };
}
