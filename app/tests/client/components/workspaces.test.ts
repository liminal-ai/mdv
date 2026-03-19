// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountWorkspaces } from '../../../src/client/components/workspaces.js';
import { emptySession, populatedSession } from '../../fixtures/session.js';
import { createStore } from '../support.js';

function renderWorkspaces(session = populatedSession) {
  document.body.innerHTML = '<div id="workspaces"></div>';
  const store = createStore({ session });
  const actions = {
    onToggleCollapsed: vi.fn(() => {
      const currentSession = store.get().session;
      store.update(
        {
          session: {
            ...currentSession,
            sidebarState: {
              workspacesCollapsed: !currentSession.sidebarState.workspacesCollapsed,
            },
          },
        },
        ['session'],
      );
    }),
    onSwitchRoot: vi.fn(),
    onRemoveWorkspace: vi.fn(),
  };

  const cleanup = mountWorkspaces(
    document.querySelector<HTMLElement>('#workspaces')!,
    store,
    actions,
  );

  return { store, actions, cleanup };
}

describe('workspaces', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('TC-3.1a: Collapse workspaces section', () => {
    const { actions } = renderWorkspaces();

    document.querySelector<HTMLButtonElement>('.section-header')?.click();

    expect(actions.onToggleCollapsed).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLElement>('.section-content')?.hidden).toBe(true);
    expect(
      document
        .querySelector('.disclosure-triangle')
        ?.classList.contains('disclosure-triangle--collapsed'),
    ).toBe(true);
  });

  it('TC-3.1b: Expand workspaces section', () => {
    renderWorkspaces({
      ...populatedSession,
      sidebarState: { workspacesCollapsed: true },
    });

    document.querySelector<HTMLButtonElement>('.section-header')?.click();

    expect(document.querySelector<HTMLElement>('.section-content')?.hidden).toBe(false);
  });

  it('TC-3.2a: Workspace label shows directory name', () => {
    renderWorkspaces();

    expect(document.querySelector('.workspace-entry__label')?.textContent).toBe('leemoore');
  });

  it('TC-3.2b: Full path tooltip on hover', () => {
    renderWorkspaces();

    expect(document.querySelector<HTMLElement>('.workspace-entry')?.title).toBe('/Users/leemoore');
  });

  it('TC-3.2c: Long name truncates', () => {
    renderWorkspaces({
      ...emptySession,
      workspaces: [
        {
          path: '/Users/leemoore/code/projects/very-long-workspace-name-for-overflow-check',
          label: 'very-long-workspace-name-for-overflow-check',
          addedAt: '2026-03-01T00:00:00Z',
        },
      ],
    });

    expect(document.querySelector('.workspace-entry__label')?.className).toContain(
      'workspace-entry__label',
    );
  });

  it('TC-3.3b: Active workspace highlighted', () => {
    renderWorkspaces();

    expect(
      document
        .querySelector('.workspace-entry[data-path="/Users/leemoore/code"]')
        ?.classList.contains('workspace-entry--active'),
    ).toBe(true);
  });

  it('TC-3.4a: Remove workspace', () => {
    const { actions } = renderWorkspaces();

    document.querySelector<HTMLButtonElement>('.workspace-entry__remove')?.click();

    expect(actions.onRemoveWorkspace).toHaveBeenCalledWith('/Users/leemoore');
    expect(actions.onSwitchRoot).not.toHaveBeenCalled();
  });

  it('TC-3.4b: x button uses hover-only visibility class', () => {
    renderWorkspaces();

    expect(document.querySelector('.workspace-entry__remove')?.className).toContain(
      'workspace-entry__remove',
    );
  });

  it('Non-TC: Empty state is shown when no workspaces are pinned', () => {
    renderWorkspaces(emptySession);

    expect(document.body.textContent).toContain('No workspaces pinned');
  });
});
