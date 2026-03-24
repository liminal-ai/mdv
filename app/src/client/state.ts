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
  severity?: 'error' | 'warning';
  onRetry?: () => void;
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

export interface ConflictModalState {
  tabId: string;
  filename: string;
}

export interface UnsavedModalState {
  tabId: string | null;
  filenames: string[];
  context: 'close-tab' | 'close-others' | 'close-right' | 'quit' | 'save-as-replace';
}

export interface ExportDirtyWarningState {
  tabId: string;
  format: 'pdf' | 'docx' | 'html';
}

export interface PackageNavigationNode {
  displayName: string;
  filePath?: string;
  children: PackageNavigationNode[];
  isGroup: boolean;
}

export interface PackageMetadata {
  title?: string;
  version?: string;
  author?: string;
}

export interface PackageState {
  active: boolean;
  sidebarMode: 'filesystem' | 'package' | 'fallback';
  sourcePath: string | null;
  effectiveRoot: string | null;
  format: 'mpk' | 'mpkz' | null;
  mode: 'extracted' | 'directory' | null;
  navigation: PackageNavigationNode[];
  metadata: PackageMetadata;
  stale: boolean;
  manifestStatus: 'present' | 'missing' | 'unreadable' | null;
  manifestError: string | null;
  manifestPath: string | null;
  collapsedGroups: Set<string>;
}

export function getDefaultPackageState(): PackageState {
  return {
    active: false,
    sidebarMode: 'filesystem',
    sourcePath: null,
    effectiveRoot: null,
    format: null,
    mode: null,
    navigation: [],
    metadata: {},
    stale: false,
    manifestStatus: null,
    manifestError: null,
    manifestPath: null,
    collapsedGroups: new Set(),
  };
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
  conflictModal: ConflictModalState | null;
  unsavedModal: UnsavedModalState | null;
  exportDirtyWarning: ExportDirtyWarningState | null;
  packageState: PackageState;
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
