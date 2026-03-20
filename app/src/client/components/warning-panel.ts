import type { RenderWarning } from '../../shared/types.js';
import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

interface WarningPanelToggleDetail {
  anchorRect?: DOMRect | { left: number; bottom: number };
}

export const WARNING_PANEL_TOGGLE_EVENT = 'mdv:warning-panel-toggle';

function getActiveWarnings(store: StateStore): RenderWarning[] {
  const state = store.get();
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
  return activeTab?.warnings ?? [];
}

function getWarningPresentation(warning: RenderWarning): { icon: string; type: string } {
  switch (warning.type) {
    case 'remote-image-blocked':
      return { icon: '🔒', type: 'Remote image blocked' };
    case 'unsupported-format':
      return { icon: '⚠', type: 'Unsupported image format' };
    case 'missing-image':
    default:
      return { icon: '⚠', type: 'Missing image' };
  }
}

export function mountWarningPanel(container: HTMLElement, store: StateStore): () => void {
  let open = false;
  let anchorRect: { left: number; bottom: number } | null = null;

  const close = () => {
    if (!open) {
      return;
    }

    open = false;
    render();
  };

  const render = () => {
    const warnings = getActiveWarnings(store);
    if (!open || warnings.length === 0) {
      container.replaceChildren();
      return;
    }

    const left = anchorRect?.left ?? window.innerWidth - 340;
    const top = anchorRect?.bottom ?? 84;

    container.replaceChildren(
      createElement('section', {
        className: 'warning-panel',
        attrs: {
          role: 'dialog',
          'aria-label': 'Rendering Warnings',
        },
        children: [
          createElement('div', {
            className: 'warning-panel__header',
            children: [
              createElement('h2', {
                className: 'warning-panel__title',
                text: 'Rendering Warnings',
              }),
              createElement('button', {
                className: 'warning-panel__close',
                text: '✕',
                attrs: {
                  type: 'button',
                  'aria-label': 'Close warning panel',
                },
                on: {
                  click: () => {
                    close();
                  },
                },
              }),
            ],
          }),
          createElement('div', {
            className: 'warning-panel__list',
            children: warnings.map((warning) => {
              const presentation = getWarningPresentation(warning);
              return createElement('div', {
                className: 'warning-panel__item',
                children: [
                  createElement('span', {
                    className: 'warning-panel__icon',
                    text: presentation.icon,
                    attrs: { 'aria-hidden': 'true' },
                  }),
                  createElement('div', {
                    className: 'warning-panel__type',
                    text: presentation.type,
                  }),
                  createElement('div', {
                    className: 'warning-panel__detail',
                    text: warning.source,
                  }),
                ],
              });
            }),
          }),
        ],
      }),
    );

    const panel = container.querySelector<HTMLElement>('.warning-panel');
    if (panel) {
      panel.style.left = `${Math.max(16, Math.min(left, window.innerWidth - panel.offsetWidth - 16))}px`;
      panel.style.top = `${Math.max(16, top + 8)}px`;
    }
  };

  const handleToggle = (event: Event) => {
    const detail = (event as CustomEvent<WarningPanelToggleDetail>).detail;
    const nextAnchor = detail?.anchorRect;
    if (!getActiveWarnings(store).length) {
      return;
    }

    open = !open;
    anchorRect = nextAnchor
      ? {
          left: nextAnchor.left,
          bottom: nextAnchor.bottom,
        }
      : anchorRect;
    render();
  };

  const handleOutsideMouseDown = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (target && container.contains(target)) {
      return;
    }

    // Skip close if the click is on the warning-count trigger itself —
    // the toggle event will handle open/close in that case.
    if (target instanceof HTMLElement && target.closest('.warning-count')) {
      return;
    }

    close();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
    }
  };

  render();

  const unsubscribe = store.subscribe((state, changed) => {
    if (
      changed.includes('tabs') ||
      changed.includes('activeTabId') ||
      changed.includes('contentToolbarVisible')
    ) {
      if (!state.contentToolbarVisible || getActiveWarnings(store).length === 0) {
        open = false;
      }
      render();
    }
  });

  document.addEventListener(WARNING_PANEL_TOGGLE_EVENT, handleToggle);
  document.addEventListener('mousedown', handleOutsideMouseDown);
  document.addEventListener('keydown', handleKeydown);

  return () => {
    unsubscribe();
    document.removeEventListener(WARNING_PANEL_TOGGLE_EVENT, handleToggle);
    document.removeEventListener('mousedown', handleOutsideMouseDown);
    document.removeEventListener('keydown', handleKeydown);
  };
}
