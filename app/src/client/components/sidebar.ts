import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

function workspaceName(workspacePath: string): string {
  const segments = workspacePath.split('/').filter(Boolean);
  return segments.at(-1) ?? workspacePath;
}

export function mountSidebar(container: HTMLElement, store: StateStore): () => void {
  const render = () => {
    const state = store.get();
    const workspaces = state.session.workspaces;
    const listItems =
      workspaces.length > 0
        ? workspaces.map((workspace) =>
            createElement('li', {
              className: 'sidebar-workspace',
              children: [
                createElement('span', {
                  className: 'sidebar-workspace__label',
                  text: workspace.label || workspaceName(workspace.path),
                }),
                createElement('span', {
                  className: 'sidebar-workspace__path',
                  text: workspace.path,
                }),
              ],
            }),
          )
        : [
            createElement('li', {
              className: 'sidebar-empty',
              text: 'No workspaces pinned yet.',
            }),
          ];

    container.hidden = !state.sidebarVisible;
    container.setAttribute('aria-hidden', String(!state.sidebarVisible));
    container.dataset.visible = String(state.sidebarVisible);
    container.parentElement?.setAttribute('data-sidebar-visible', String(state.sidebarVisible));
    container.replaceChildren(
      createElement('div', {
        className: 'sidebar-panel',
        children: [
          createElement('div', {
            className: 'sidebar-panel__header',
            children: [
              createElement('span', { className: 'sidebar-panel__eyebrow', text: 'Workspaces' }),
              createElement('strong', {
                className: 'sidebar-panel__title',
                text: 'Pinned folders',
              }),
            ],
          }),
          createElement('ul', {
            className: 'sidebar-workspaces',
            children: listItems,
          }),
        ],
      }),
    );
  };

  render();
  return store.subscribe(render);
}
