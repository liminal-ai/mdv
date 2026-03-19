// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { createClientState } from './support.js';
import { StateStore } from '../../src/client/state.js';

describe('StateStore', () => {
  it('State update notifies listeners', () => {
    const store = new StateStore(createClientState());
    const listener = vi.fn();

    store.subscribe(listener);
    store.update({ activeMenuId: 'file' }, ['activeMenuId']);

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ activeMenuId: 'file' }), [
      'activeMenuId',
    ]);
  });

  it('Unsubscribe stops notifications', () => {
    const store = new StateStore(createClientState());
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.update({ activeMenuId: 'view' }, ['activeMenuId']);

    expect(listener).not.toHaveBeenCalled();
  });

  it('Session replacement is atomic', () => {
    const store = new StateStore(createClientState());
    const nextSession = {
      ...store.get().session,
      theme: 'dark-default',
      sidebarState: { workspacesCollapsed: true },
    };

    store.update(
      {
        session: nextSession,
        sidebarVisible: false,
      },
      ['session', 'sidebarVisible'],
    );

    expect(store.get().session).toBe(nextSession);
    expect(store.get().sidebarVisible).toBe(false);
  });
});
