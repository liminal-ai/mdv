import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { SessionStateSchema, type SessionState } from '../schemas/index.js';
import { isNotFoundError, isPermissionError } from '../utils/errors.js';

const SESSION_FILE_NAME = 'session.json';
const MAX_RECENT_FILES = 20;

function getDefaultSession(): SessionState {
  return {
    workspaces: [],
    lastRoot: null,
    lastExportDir: null,
    recentFiles: [],
    theme: 'light-default',
    sidebarState: { workspacesCollapsed: false },
    defaultOpenMode: 'render',
    openTabs: [],
    activeTab: null,
  };
}

function cloneSession(session: SessionState): SessionState {
  return structuredClone(session);
}

interface SessionFileSystem {
  mkdir: typeof fs.mkdir;
  readFile: typeof fs.readFile;
  rename: typeof fs.rename;
  stat: typeof fs.stat;
  writeFile: typeof fs.writeFile;
}

export class SessionService {
  private readonly sessionDir: string;

  private readonly sessionFile: string;

  private cache: SessionState | null = null;

  constructor(
    dir = path.join(homedir(), 'Library', 'Application Support', 'md-viewer'),
    private readonly fileSystem: SessionFileSystem = fs,
  ) {
    this.sessionDir = dir;
    this.sessionFile = path.join(dir, SESSION_FILE_NAME);
  }

  async load(): Promise<SessionState> {
    if (this.cache) {
      return cloneSession(this.cache);
    }

    await this.fileSystem.mkdir(this.sessionDir, { recursive: true });

    const session = await this.readSessionFromDisk();
    const healedSession = await this.healLastRoot(session);
    const fullyHealed = await this.healRecentFiles(healedSession);

    this.cache = fullyHealed;
    await this.persist(this.cache);

    return cloneSession(this.cache);
  }

  async setRoot(root: string): Promise<SessionState> {
    return this.mutate((session) => {
      session.lastRoot = root;
    });
  }

  async addWorkspace(workspacePath: string): Promise<SessionState> {
    return this.mutate((session) => {
      if (session.workspaces.some((workspace) => workspace.path === workspacePath)) {
        return;
      }

      session.workspaces.push({
        path: workspacePath,
        label: path.basename(workspacePath) || workspacePath,
        addedAt: new Date().toISOString(),
      });
    });
  }

  async removeWorkspace(workspacePath: string): Promise<SessionState> {
    return this.mutate((session) => {
      session.workspaces = session.workspaces.filter(
        (workspace) => workspace.path !== workspacePath,
      );
    });
  }

  async setTheme(theme: string): Promise<SessionState> {
    return this.mutate((session) => {
      session.theme = theme;
    });
  }

  async setDefaultMode(mode: SessionState['defaultOpenMode']): Promise<SessionState> {
    return this.mutate((session) => {
      session.defaultOpenMode = mode;
    });
  }

  async updateTabs(openTabs: string[], activeTab: string | null): Promise<SessionState> {
    return this.mutate((session) => {
      if (activeTab !== null && !openTabs.includes(activeTab)) {
        activeTab = openTabs.length > 0 ? openTabs[0] : null;
      }

      session.openTabs = [...openTabs];
      session.activeTab = activeTab;
    });
  }

  async updateSidebar(workspacesCollapsed: boolean): Promise<SessionState> {
    return this.mutate((session) => {
      session.sidebarState = { workspacesCollapsed };
    });
  }

  async touchRecentFile(filePath: string): Promise<SessionState> {
    return this.mutate((session) => {
      const nextEntry = {
        path: filePath,
        openedAt: new Date().toISOString(),
      };

      const remaining = session.recentFiles.filter((entry) => entry.path !== filePath);
      session.recentFiles = [nextEntry, ...remaining].slice(0, MAX_RECENT_FILES);
    });
  }

  async removeRecentFile(filePath: string): Promise<SessionState> {
    return this.mutate((session) => {
      session.recentFiles = session.recentFiles.filter((entry) => entry.path !== filePath);
    });
  }

  private async mutate(mutator: (session: SessionState) => void): Promise<SessionState> {
    const session = await this.readSessionForMutation();
    const nextSession = cloneSession(session);
    mutator(nextSession);

    this.cache = nextSession;
    await this.persist(this.cache);

    return cloneSession(this.cache);
  }

  private async readSessionForMutation(): Promise<SessionState> {
    if (this.cache) {
      return cloneSession(this.cache);
    }

    await this.fileSystem.mkdir(this.sessionDir, { recursive: true });

    const session = await this.readSessionFromDisk();
    this.cache = session;

    return cloneSession(this.cache);
  }

  private async readSessionFromDisk(): Promise<SessionState> {
    try {
      const raw = await this.fileSystem.readFile(this.sessionFile, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      const result = SessionStateSchema.safeParse(parsed);

      return result.success ? result.data : getDefaultSession();
    } catch (error) {
      if (isNotFoundError(error)) {
        return getDefaultSession();
      }

      return getDefaultSession();
    }
  }

  private async healLastRoot(session: SessionState): Promise<SessionState> {
    if (!session.lastRoot) {
      return session;
    }

    const exists = await this.pathExists(session.lastRoot);
    if (exists) {
      return session;
    }

    return {
      ...session,
      lastRoot: null,
    };
  }

  private async healRecentFiles(session: SessionState): Promise<SessionState> {
    if (session.recentFiles.length === 0) {
      return session;
    }

    const validFiles: Array<{ path: string; openedAt: string }> = [];
    for (const file of session.recentFiles) {
      if (await this.pathExists(file.path)) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === session.recentFiles.length) {
      return session;
    }

    return {
      ...session,
      recentFiles: validFiles,
    };
  }

  private async persist(session: SessionState): Promise<void> {
    await this.fileSystem.mkdir(this.sessionDir, { recursive: true });

    const tempFile = `${this.sessionFile}.${process.pid}.${Date.now()}.tmp`;
    const contents = `${JSON.stringify(session, null, 2)}\n`;

    await this.fileSystem.writeFile(tempFile, contents, 'utf8');
    await this.fileSystem.rename(tempFile, this.sessionFile);
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await this.fileSystem.stat(targetPath);
      return true;
    } catch (error) {
      if (isNotFoundError(error) || isPermissionError(error)) {
        return false;
      }

      throw error;
    }
  }
}
