import type { Workspace } from '../../shared/types.js';
import type { StateStore } from '../state.js';
import { createElement } from '../utils/dom.js';

export interface WorkspacesActions {
  onToggleCollapsed: () => void;
  onSwitchRoot: (path: string) => void;
  onRemoveWorkspace: (path: string) => void;
}

function shortenPath(fullPath: string): string {
  const macMatch = fullPath.match(/^\/Users\/[^/]+(?<rest>\/.*)?$/);
  if (macMatch) return `~${macMatch.groups?.rest ?? ''}`;
  const linuxMatch = fullPath.match(/^\/home\/[^/]+(?<rest>\/.*)?$/);
  if (linuxMatch) return `~${linuxMatch.groups?.rest ?? ''}`;
  return fullPath;
}

function createWorkspaceEntry(
  workspace: Workspace,
  activePath: string | null,
  actions: WorkspacesActions,
): HTMLElement {
  const className =
    workspace.path === activePath ? 'workspace-entry workspace-entry--active' : 'workspace-entry';
  const displayPath = shortenPath(workspace.path);

  return createElement('div', {
    className,
    attrs: {
      'data-path': workspace.path,
      title: workspace.path,
      role: 'button',
      tabindex: 0,
    },
    dataset: { path: workspace.path },
    children: [
      createElement('span', {
        className: 'workspace-entry__label',
        text: displayPath,
        attrs: { title: workspace.path },
      }),
      createElement('button', {
        className: 'workspace-entry__remove',
        text: '✕',
        attrs: {
          type: 'button',
          title: 'Remove workspace',
          'aria-label': `Remove ${workspace.label}`,
        },
        on: {
          click: (event) => {
            event.stopPropagation();
            actions.onRemoveWorkspace(workspace.path);
          },
        },
      }),
    ],
    on: {
      click: () => actions.onSwitchRoot(workspace.path),
      keydown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          actions.onSwitchRoot(workspace.path);
        }
      },
    },
  });
}

export function mountWorkspaces(
  container: HTMLElement,
  store: StateStore,
  actions: WorkspacesActions,
): () => void {
  const render = () => {
    const { session } = store.get();
    const collapsed = session.sidebarState.workspacesCollapsed;
    const entries =
      session.workspaces.length > 0
        ? session.workspaces.map((workspace) =>
            createWorkspaceEntry(workspace, session.lastRoot, actions),
          )
        : [
            createElement('p', {
              className: 'workspace-empty',
              text: 'No workspaces pinned',
            }),
          ];

    container.replaceChildren(
      createElement('button', {
        className: 'section-header',
        attrs: {
          type: 'button',
          title: 'Toggle workspaces',
          'aria-expanded': String(!collapsed),
        },
        children: [
          createElement('span', {
            className: collapsed
              ? 'disclosure-triangle disclosure-triangle--collapsed'
              : 'disclosure-triangle',
            text: '▼',
          }),
          createElement('span', {
            className: 'section-header__label',
            text: 'PINNED PATHS',
          }),
        ],
        on: {
          click: actions.onToggleCollapsed,
        },
      }),
      createElement('div', {
        className: 'section-content',
        attrs: { hidden: collapsed },
        children: entries,
      }),
    );
  };

  render();
  return store.subscribe(render);
}
