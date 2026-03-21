import type {
  ErrorCode,
  ExportWarning,
  RenderWarning,
  SessionState,
  ThemeInfo,
  TreeNode,
} from '../shared/types.js';

export interface ClientError {
  code: ErrorCode | string;
  message: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  targetPath: string;
  targetType: 'file' | 'directory';
}

export interface TabState {
  id: string;
  path: string;
  canonicalPath: string;
  filename: string;
  html: string;
  content: string;
  warnings: RenderWarning[];
  renderGeneration?: number;
  scrollPosition: number;
  loading: boolean;
  modifiedAt: string;
  size: number;
  status: 'ok' | 'deleted' | 'error';
  errorMessage?: string;
  mode: 'render' | 'edit';
  editContent: string | null;
  editScrollPosition: number;
  cursorPosition: { line: number; column: number } | null;
  dirty: boolean;
  editedSinceLastSave: boolean;
}

export interface TabContextMenuState {
  x: number;
  y: number;
  tabId: string;
  items: Array<{
    id: string;
    label: string;
    disabled?: boolean;
  }>;
}

export interface ExportResult {
  type: 'success' | 'error';
  outputPath?: string;
  warnings: ExportWarning[];
  error?: string;
  completedAt: string;
}

export interface ExportState {
  inProgress: boolean;
  activeFormat: 'pdf' | 'docx' | 'html' | null;
  result: ExportResult | null;
}

export interface ClientState {
  session: SessionState;
  availableThemes: ThemeInfo[];
  tree: TreeNode[];
  treeLoading: boolean;
  invalidRoot: boolean;
  activeMenuId: string | null;
  contextMenu: ContextMenuState | null;
  sidebarVisible: boolean;
  expandedDirsByRoot: Record<string, string[]>;
  error: ClientError | null;
  tabs: TabState[];
  activeTabId: string | null;
  tabContextMenu: TabContextMenuState | null;
  contentToolbarVisible: boolean;
  exportState: ExportState;
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
