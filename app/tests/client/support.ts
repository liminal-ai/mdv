import { StateStore, type ClientState } from '../../src/client/state.js';
import { emptySession } from '../fixtures/session.js';

export function createClientState(overrides: Partial<ClientState> = {}): ClientState {
  return {
    session: emptySession,
    availableThemes: [
      { id: 'light-default', label: 'Light Default', variant: 'light' },
      { id: 'light-warm', label: 'Light Warm', variant: 'light' },
      { id: 'dark-default', label: 'Dark Default', variant: 'dark' },
      { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' },
    ],
    tree: [],
    treeLoading: false,
    activeMenuId: null,
    contextMenu: null,
    sidebarVisible: true,
    expandedDirsByRoot: {},
    error: null,
    ...overrides,
  };
}

export function createStore(overrides: Partial<ClientState> = {}): StateStore {
  return new StateStore(createClientState(overrides));
}

export function getButtonByText(text: string): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  const match = buttons.find((button) => button.textContent?.includes(text));

  if (!match) {
    throw new Error(`Button not found: ${text}`);
  }

  return match;
}

export function getByText<T extends Element = HTMLElement>(text: string): T {
  const allElements = Array.from(document.querySelectorAll<T>('*'));
  const match = allElements.find((element) => element.textContent?.includes(text));

  if (!match) {
    throw new Error(`Element not found: ${text}`);
  }

  return match;
}
