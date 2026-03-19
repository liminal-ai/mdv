import type { ErrorCode, SessionState, ThemeInfo, TreeNode } from '../shared/types.js';

export interface ClientError {
  code: ErrorCode | string;
  message: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  targetPath?: string;
}

export interface ClientState {
  session: SessionState;
  availableThemes: ThemeInfo[];
  tree: TreeNode[];
  treeLoading: boolean;
  activeMenuId: string | null;
  contextMenu: ContextMenuState | null;
  sidebarVisible: boolean;
  expandedDirsByRoot: Record<string, string[]>;
  error: ClientError | null;
}

type StateListener = (state: ClientState, changed: Array<keyof ClientState>) => void;

export class StateStore {
  private state: ClientState;

  private readonly listeners = new Set<StateListener>();

  constructor(initialState: ClientState) {
    this.state = initialState;
  }

  get(): ClientState {
    return this.state;
  }

  update(partial: Partial<ClientState>, changed?: Array<keyof ClientState>): void {
    const changedKeys = changed ?? (Object.keys(partial) as Array<keyof ClientState>);
    this.state = {
      ...this.state,
      ...partial,
    };

    for (const listener of this.listeners) {
      listener(this.state, changedKeys);
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
