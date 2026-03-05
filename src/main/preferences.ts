import fs from 'node:fs/promises';
import path from 'node:path';

import { AppPreferences, PinnedFolder } from '../core/types';

const DEFAULT_PREFERENCES: AppPreferences = {
  pinnedFolders: [],
  sidebarCollapsed: false,
  sidebarWidth: 280,
  openTabs: []
};

export class PreferencesStore {
  private readonly filePath: string;

  private cache: AppPreferences = { ...DEFAULT_PREFERENCES };

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'preferences.json');
  }

  async load(): Promise<AppPreferences> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AppPreferences>;
      const pinnedFolders = Array.isArray(parsed.pinnedFolders)
        ? parsed.pinnedFolders.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

      const openTabs = Array.isArray(parsed.openTabs)
        ? parsed.openTabs.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

      this.cache = {
        pinnedFolders,
        lastRootFolder:
          typeof parsed.lastRootFolder === 'string' && parsed.lastRootFolder.trim().length > 0
            ? parsed.lastRootFolder
            : undefined,
        sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
        sidebarWidth:
          typeof parsed.sidebarWidth === 'number' && Number.isFinite(parsed.sidebarWidth) && parsed.sidebarWidth >= 180
            ? Math.min(640, Math.round(parsed.sidebarWidth))
            : DEFAULT_PREFERENCES.sidebarWidth,
        openTabs: Array.from(new Set(openTabs.map((item) => path.resolve(item)))),
        activeTabPath:
          typeof parsed.activeTabPath === 'string' && parsed.activeTabPath.trim().length > 0
            ? path.resolve(parsed.activeTabPath)
            : undefined
      };
      return this.cache;
    } catch {
      this.cache = { ...DEFAULT_PREFERENCES };
      return this.cache;
    }
  }

  get(): AppPreferences {
    return this.cache;
  }

  getPinnedFolders(): PinnedFolder[] {
    return this.cache.pinnedFolders.map((folderPath) => {
      const base = path.basename(folderPath) || folderPath;
      return {
        path: folderPath,
        label: `${base} — ${folderPath}`
      };
    });
  }

  async pinFolder(folderPath: string): Promise<PinnedFolder[]> {
    const normalized = path.resolve(folderPath);
    if (!this.cache.pinnedFolders.includes(normalized)) {
      this.cache.pinnedFolders = [...this.cache.pinnedFolders, normalized];
      await this.save();
    }
    return this.getPinnedFolders();
  }

  async unpinFolder(folderPath: string): Promise<PinnedFolder[]> {
    const normalized = path.resolve(folderPath);
    this.cache.pinnedFolders = this.cache.pinnedFolders.filter((item) => item !== normalized);

    if (this.cache.lastRootFolder === normalized) {
      this.cache.lastRootFolder = undefined;
    }

    await this.save();
    return this.getPinnedFolders();
  }

  async setLastRootFolder(folderPath?: string): Promise<void> {
    this.cache.lastRootFolder = folderPath ? path.resolve(folderPath) : undefined;
    await this.save();
  }

  async setSidebarCollapsed(collapsed: boolean): Promise<void> {
    this.cache.sidebarCollapsed = collapsed;
    await this.save();
  }

  async setSidebarWidth(width: number): Promise<void> {
    const normalized = Math.min(640, Math.max(180, Math.round(width)));
    this.cache.sidebarWidth = normalized;
    await this.save();
  }

  async setOpenTabs(openTabs: string[]): Promise<void> {
    const normalized = Array.from(
      new Set(
        openTabs
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => path.resolve(item))
      )
    );

    this.cache.openTabs = normalized;
    if (this.cache.activeTabPath && !normalized.includes(this.cache.activeTabPath)) {
      this.cache.activeTabPath = normalized[0];
    }
    await this.save();
  }

  async setActiveTabPath(filePath?: string): Promise<void> {
    this.cache.activeTabPath = filePath ? path.resolve(filePath) : undefined;
    await this.save();
  }

  async setTabSession(openTabs: string[], activeTabPath?: string): Promise<void> {
    const normalizedOpenTabs = Array.from(
      new Set(
        openTabs
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => path.resolve(item))
      )
    );

    this.cache.openTabs = normalizedOpenTabs;
    const normalizedActive = activeTabPath ? path.resolve(activeTabPath) : undefined;
    this.cache.activeTabPath = normalizedActive && normalizedOpenTabs.includes(normalizedActive) ? normalizedActive : normalizedOpenTabs[0];
    await this.save();
  }

  private async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8');
  }
}
