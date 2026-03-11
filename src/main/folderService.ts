import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { dialog } from 'electron';

import type { FolderStatePayload, FolderTreeResult, PinnedFoldersResult, RootFolderResult } from '../core/ipc';
import type { FolderNode } from '../core/types';
import { listMarkdownChildren } from './folders';
import { PreferencesStore } from './preferences';
import type { MainProcessState } from './state';

interface FolderServiceOptions {
  state: MainProcessState;
  getPreferencesStore: () => PreferencesStore | null;
}

export interface FolderService {
  getFolderState(): FolderStatePayload;
  initializeRootFolder(): Promise<void>;
  chooseRootFolderViaDialog(): Promise<RootFolderResult>;
  listFolderTree(requestedRoot?: string): Promise<FolderTreeResult>;
  getPinnedFolders(): ReturnType<PreferencesStore['getPinnedFolders']>;
  pinFolder(folderPath?: string): Promise<PinnedFoldersResult>;
  unpinFolder(folderPath: string): Promise<PinnedFoldersResult>;
  setRootFromPin(folderPath: string): Promise<RootFolderResult>;
  refreshFolders(): Promise<FolderTreeResult>;
  setSidebarCollapsed(collapsed: boolean): Promise<{ ok: boolean }>;
  setSidebarWidth(width: number): Promise<{ ok: boolean }>;
}

export function createFolderService({ state, getPreferencesStore }: FolderServiceOptions): FolderService {
  function getPrefs(): PreferencesStore | null {
    return getPreferencesStore();
  }

  function getFolderState(): FolderStatePayload {
    return {
      rootPath: state.currentRootFolder,
      pinnedFolders: getPrefs()?.getPinnedFolders() ?? [],
      sidebarCollapsed: getPrefs()?.get().sidebarCollapsed ?? false,
      sidebarWidth: getPrefs()?.get().sidebarWidth ?? 280
    };
  }

  async function initializeRootFolder(): Promise<void> {
    const prefs = getPrefs();
    const preferredRoot = prefs?.get().lastRootFolder;

    if (preferredRoot) {
      try {
        const st = await fsp.stat(preferredRoot);
        if (st.isDirectory()) {
          state.currentRootFolder = preferredRoot;
        }
      } catch (error) {
        console.warn(`[folders] Unable to restore root folder ${preferredRoot}: ${String(error)}`);
      }
    }

    if (!state.currentRootFolder) {
      const homeDir = os.homedir();
      try {
        const st = await fsp.stat(homeDir);
        if (st.isDirectory()) {
          state.currentRootFolder = homeDir;
        }
      } catch (error) {
        console.warn(`[folders] Unable to use home directory as fallback root: ${String(error)}`);
        state.currentRootFolder = null;
      }
    }

    if (state.currentRootFolder && prefs && prefs.get().lastRootFolder !== state.currentRootFolder) {
      await prefs.setLastRootFolder(state.currentRootFolder);
    }
  }

  async function chooseRootFolderViaDialog(): Promise<RootFolderResult> {
    const result = await dialog.showOpenDialog({
      title: 'Select Root Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, reason: 'cancelled' };
    }

    const rootPath = result.filePaths[0];
    if (!rootPath) {
      return { ok: false, reason: 'cancelled' };
    }

    state.currentRootFolder = rootPath;
    const prefs = getPrefs();
    if (prefs) {
      await prefs.setLastRootFolder(rootPath);
    }

    const tree = await listMarkdownChildren(rootPath);
    return {
      ok: true,
      rootPath,
      tree
    };
  }

  async function listFolderTree(requestedRoot?: string): Promise<FolderTreeResult> {
    const rootPath = requestedRoot ? path.resolve(requestedRoot) : state.currentRootFolder;
    if (!rootPath) {
      return { ok: false, reason: 'No root folder selected.', tree: [] as FolderNode[] };
    }

    const tree = await listMarkdownChildren(rootPath);
    return { ok: true, rootPath, tree };
  }

  function getPinnedFolders() {
    return getPrefs()?.getPinnedFolders() ?? [];
  }

  async function pinFolder(folderPath?: string): Promise<PinnedFoldersResult> {
    const prefs = getPrefs();
    if (!prefs) {
      return { ok: false, reason: 'Preferences unavailable.' };
    }

    const candidate = folderPath ? path.resolve(folderPath) : state.currentRootFolder;
    if (!candidate) {
      return { ok: false, reason: 'No folder provided.' };
    }

    try {
      const st = await fsp.stat(candidate);
      if (!st.isDirectory()) {
        return { ok: false, reason: 'Selected path is not a directory.' };
      }
    } catch {
      return { ok: false, reason: 'Folder is not accessible.' };
    }

    const pinnedFolders = await prefs.pinFolder(candidate);
    return { ok: true, pinnedFolders };
  }

  async function unpinFolder(folderPath: string): Promise<PinnedFoldersResult> {
    const prefs = getPrefs();
    if (!prefs) {
      return { ok: false, reason: 'Preferences unavailable.' };
    }

    const pinnedFolders = await prefs.unpinFolder(folderPath);
    return { ok: true, pinnedFolders };
  }

  async function setRootFromPin(folderPath: string): Promise<RootFolderResult> {
    const normalized = path.resolve(folderPath);

    try {
      const st = await fsp.stat(normalized);
      if (!st.isDirectory()) {
        return { ok: false, reason: 'Pinned path is not a directory.' };
      }
    } catch {
      return { ok: false, reason: 'Pinned folder is not accessible.' };
    }

    state.currentRootFolder = normalized;
    const prefs = getPrefs();
    if (prefs) {
      await prefs.setLastRootFolder(normalized);
    }

    const tree = await listMarkdownChildren(normalized);
    return { ok: true, rootPath: normalized, tree };
  }

  async function refreshFolders(): Promise<FolderTreeResult> {
    if (!state.currentRootFolder) {
      return { ok: false, reason: 'No root folder selected.', tree: [] as FolderNode[] };
    }

    const tree = await listMarkdownChildren(state.currentRootFolder);
    return { ok: true, rootPath: state.currentRootFolder, tree };
  }

  async function setSidebarCollapsed(collapsed: boolean): Promise<{ ok: boolean }> {
    const prefs = getPrefs();
    if (prefs) {
      await prefs.setSidebarCollapsed(collapsed);
    }
    return { ok: true };
  }

  async function setSidebarWidth(width: number): Promise<{ ok: boolean }> {
    const prefs = getPrefs();
    if (prefs && Number.isFinite(width)) {
      await prefs.setSidebarWidth(width);
    }
    return { ok: true };
  }

  return {
    getFolderState,
    initializeRootFolder,
    chooseRootFolderViaDialog,
    listFolderTree,
    getPinnedFolders,
    pinFolder,
    unpinFolder,
    setRootFromPin,
    refreshFolders,
    setSidebarCollapsed,
    setSidebarWidth
  };
}
