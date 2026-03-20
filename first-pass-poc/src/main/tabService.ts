import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { dialog } from 'electron';

import type { ActionResult } from '../core/ipc';
import { isMarkdownPath } from '../core/drop';
import { readMarkdownFile, renderMarkdown } from '../core/render/markdown';
import type { MermaidRenderer, OpenDocumentResult, RenderPreviewPayload, TabsStatePayload } from '../core/types';
import { PreferencesStore } from './preferences';
import {
  buildTabsStatePayload,
  createTabId,
  findTabIdByPath,
  getActiveTab,
  getTabById,
  type MainProcessState,
  type TabSessionInternal
} from './state';

interface TabServiceOptions {
  state: MainProcessState;
  mermaidRenderer: MermaidRenderer;
  getPreferencesStore: () => PreferencesStore | null;
  sendTabsStateUpdated: () => void;
  sendDiskChanged: (tabId: string, filePath: string) => void;
}

export interface TabService {
  buildTabsStatePayload(): TabsStatePayload;
  getActiveTab(): TabSessionInternal | null;
  getTabById(tabId: string): TabSessionInternal | null;
  getActivePublicTab(): ReturnType<typeof getActiveTab>;
  openTabDialog(): Promise<OpenDocumentResult>;
  openOrReuseTab(rawPath: string, options?: { activate?: boolean; sendUpdate?: boolean; persist?: boolean }): Promise<OpenDocumentResult>;
  activateTab(tabId: string): Promise<OpenDocumentResult>;
  closeTab(tabId: string): Promise<OpenDocumentResult>;
  closeOtherTabs(tabId: string): Promise<OpenDocumentResult>;
  saveTab(tabId: string, markdown: string): Promise<ActionResult>;
  saveTabAs(tabId: string, markdown: string): Promise<ActionResult>;
  renderTabPreview(tabId: string, markdown: string): Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }>;
  readTabFromDisk(tabId: string): Promise<{ ok: boolean; reason?: string; markdown?: string }>;
  reloadTabFromDisk(tabId: string): Promise<ActionResult>;
  ackDiskChange(tabId: string): { ok: boolean; reason?: string };
  persistTabSession(): Promise<void>;
  restoreTabsFromPreferences(openTabs: string[], activeTabPath?: string): Promise<void>;
  stopWatchingTab(tabId: string): void;
  stopWatchingAllTabs(): void;
}

export function createTabService({
  state,
  mermaidRenderer,
  getPreferencesStore,
  sendTabsStateUpdated,
  sendDiskChanged
}: TabServiceOptions): TabService {
  function getPrefs(): PreferencesStore | null {
    return getPreferencesStore();
  }

  function getActive(): TabSessionInternal | null {
    return getActiveTab(state);
  }

  function getById(tabId: string): TabSessionInternal | null {
    return getTabById(state, tabId);
  }

  function getActivePublicTab() {
    return getActive();
  }

  async function openTabDialog(): Promise<OpenDocumentResult> {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, reason: 'cancelled' };
    }

    const selectedPath = result.filePaths[0];
    if (!selectedPath) {
      return { ok: false, reason: 'cancelled' };
    }

    return openOrReuseTab(selectedPath, { activate: true, sendUpdate: true, persist: true });
  }

  async function openOrReuseTab(
    rawPath: string,
    options?: { activate?: boolean; sendUpdate?: boolean; persist?: boolean }
  ): Promise<OpenDocumentResult> {
    const activate = options?.activate ?? true;
    const sendUpdate = options?.sendUpdate ?? true;
    const persist = options?.persist ?? true;
    const resolvedPath = path.resolve(rawPath);

    try {
      await fsp.access(resolvedPath, fs.constants.R_OK);
    } catch {
      return { ok: false, reason: `Cannot read file: ${resolvedPath}` };
    }

    if (!isMarkdownPath(resolvedPath)) {
      return { ok: false, reason: 'Only .md or .markdown files are supported.' };
    }

    const existingTabId = findTabIdByPath(state, resolvedPath);
    if (existingTabId) {
      if (activate) {
        state.activeTabId = existingTabId;
      }

      if (persist) {
        await persistTabSession();
      }

      if (sendUpdate) {
        sendTabsStateUpdated();
      }

      return { ok: true, tabId: existingTabId };
    }

    try {
      const markdown = await readMarkdownFile(resolvedPath);
      const rendered = await renderMarkdown(
        {
          inputPath: resolvedPath,
          markdown,
          baseDir: path.dirname(resolvedPath),
          offline: true
        },
        mermaidRenderer
      );

      const st = await fsp.stat(resolvedPath);
      const tabId = createTabId(state);
      const tab: TabSessionInternal = {
        tabId,
        filePath: resolvedPath,
        title: path.basename(resolvedPath),
        savedMarkdown: markdown,
        currentMarkdown: markdown,
        renderedMarkdown: markdown,
        render: rendered,
        warnings: rendered.warnings,
        isDirty: false,
        hasExternalChange: false,
        lastDiskMtimeMs: st.mtimeMs,
        ignoreWatcherEventsUntil: 0
      };

      state.tabsById.set(tabId, tab);
      state.tabOrder.push(tabId);
      if (activate || !state.activeTabId) {
        state.activeTabId = tabId;
      }

      if (!state.currentRootFolder) {
        state.currentRootFolder = path.dirname(resolvedPath);
        const prefs = getPrefs();
        if (prefs) {
          await prefs.setLastRootFolder(state.currentRootFolder);
        }
      }

      watchTabFile(tabId, resolvedPath);

      if (persist) {
        await persistTabSession();
      }

      if (sendUpdate) {
        sendTabsStateUpdated();
      }

      return { ok: true, tabId };
    } catch (error) {
      return {
        ok: false,
        reason: String(error)
      };
    }
  }

  async function activateTab(tabId: string): Promise<OpenDocumentResult> {
    if (!state.tabsById.has(tabId)) {
      return { ok: false, reason: 'Tab not found.' };
    }

    state.activeTabId = tabId;
    await persistTabSession();
    sendTabsStateUpdated();
    return { ok: true, tabId };
  }

  async function closeTab(tabId: string): Promise<OpenDocumentResult> {
    if (!state.tabsById.has(tabId)) {
      return { ok: false, reason: 'Tab not found.' };
    }

    stopWatchingTab(tabId);
    state.tabsById.delete(tabId);
    state.tabOrder = state.tabOrder.filter((id) => id !== tabId);

    if (state.activeTabId === tabId) {
      state.activeTabId = state.tabOrder.at(-1) ?? null;
    }

    await persistTabSession();
    sendTabsStateUpdated();
    return { ok: true, tabId: state.activeTabId ?? undefined };
  }

  async function closeOtherTabs(tabId: string): Promise<OpenDocumentResult> {
    if (!state.tabsById.has(tabId)) {
      return { ok: false, reason: 'Tab not found.' };
    }

    for (const id of [...state.tabOrder]) {
      if (id === tabId) {
        continue;
      }

      stopWatchingTab(id);
      state.tabsById.delete(id);
    }

    state.tabOrder = [tabId];
    state.activeTabId = tabId;
    await persistTabSession();
    sendTabsStateUpdated();
    return { ok: true, tabId };
  }

  async function saveTab(tabId: string, markdown: string): Promise<ActionResult> {
    const tab = getById(tabId);
    if (!tab) {
      return { ok: false, reason: 'Tab not found.' };
    }

    try {
      return await writeMarkdownToTabPath(tab, tab.filePath, markdown, false);
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }

  async function saveTabAs(tabId: string, markdown: string): Promise<ActionResult> {
    const tab = getById(tabId);
    if (!tab) {
      return { ok: false, reason: 'Tab not found.' };
    }

    const preferredBase = tab.filePath ?? path.join(state.currentRootFolder ?? os.homedir(), 'untitled.md');
    const defaultPath =
      preferredBase.toLowerCase().endsWith('.md') || preferredBase.toLowerCase().endsWith('.markdown')
        ? preferredBase
        : `${preferredBase}.md`;

    const selection = await dialog.showSaveDialog({
      title: 'Save Markdown As',
      defaultPath,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    });

    if (selection.canceled || !selection.filePath) {
      return { ok: false, reason: 'cancelled' };
    }

    const resolvedPath = path.resolve(selection.filePath);
    const existingTab = findTabIdByPath(state, resolvedPath);
    if (existingTab && existingTab !== tabId) {
      return { ok: false, reason: 'Another open tab already uses this file.' };
    }

    try {
      return await writeMarkdownToTabPath(tab, resolvedPath, markdown, true);
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }

  async function writeMarkdownToTabPath(
    tab: TabSessionInternal,
    targetPath: string,
    markdown: string,
    switchPath: boolean
  ): Promise<ActionResult> {
    const resolvedPath = path.resolve(targetPath);
    const baseDir = path.dirname(resolvedPath);
    tab.ignoreWatcherEventsUntil = Date.now() + 1200;

    await fsp.writeFile(resolvedPath, markdown, 'utf8');

    const rendered = await renderMarkdown(
      {
        inputPath: resolvedPath,
        markdown,
        baseDir,
        offline: true
      },
      mermaidRenderer
    );

    tab.savedMarkdown = markdown;
    tab.currentMarkdown = markdown;
    tab.renderedMarkdown = markdown;
    tab.render = rendered;
    tab.warnings = rendered.warnings;
    tab.isDirty = false;
    tab.hasExternalChange = false;
    tab.lastDiskMtimeMs = (await fsp.stat(resolvedPath)).mtimeMs;

    if (switchPath && tab.filePath !== resolvedPath) {
      const previousPath = tab.filePath;
      tab.filePath = resolvedPath;
      tab.title = path.basename(resolvedPath);

      stopWatchingTab(tab.tabId);
      watchTabFile(tab.tabId, resolvedPath);

      if (state.currentRootFolder === path.dirname(previousPath)) {
        state.currentRootFolder = baseDir;
      }
    }

    if (!switchPath && tab.filePath === resolvedPath) {
      watchTabFile(tab.tabId, resolvedPath);
    }

    state.activeTabId = tab.tabId;

    if (switchPath) {
      state.currentRootFolder = baseDir;
      const prefs = getPrefs();
      if (prefs) {
        await prefs.setLastRootFolder(baseDir);
      }
    }

    await persistTabSession();
    sendTabsStateUpdated();

    return { ok: true, filePath: resolvedPath };
  }

  async function renderTabPreview(
    tabId: string,
    markdown: string
  ): Promise<{ ok: boolean; reason?: string; preview?: RenderPreviewPayload }> {
    const tab = getById(tabId);
    if (!tab) {
      return { ok: false, reason: 'Tab not found.' };
    }

    try {
      const rendered = await renderMarkdown(
        {
          inputPath: tab.filePath,
          markdown,
          baseDir: path.dirname(tab.filePath),
          offline: true
        },
        mermaidRenderer
      );

      tab.currentMarkdown = markdown;
      tab.renderedMarkdown = markdown;
      tab.render = rendered;
      tab.warnings = rendered.warnings;
      tab.isDirty = markdown !== tab.savedMarkdown;

      return {
        ok: true,
        preview: {
          html: rendered.html,
          blocks: rendered.previewBlocks,
          warnings: rendered.warnings
        }
      };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }

  async function readTabFromDisk(tabId: string): Promise<{ ok: boolean; reason?: string; markdown?: string }> {
    const tab = getById(tabId);
    if (!tab) {
      return { ok: false, reason: 'Tab not found.' };
    }

    try {
      const markdown = await readMarkdownFile(tab.filePath);
      return { ok: true, markdown };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }

  async function reloadTabFromDisk(tabId: string): Promise<ActionResult> {
    const tab = getById(tabId);
    if (!tab) {
      return { ok: false, reason: 'Tab not found.' };
    }

    try {
      const markdown = await readMarkdownFile(tab.filePath);
      const rendered = await renderMarkdown(
        {
          inputPath: tab.filePath,
          markdown,
          baseDir: path.dirname(tab.filePath),
          offline: true
        },
        mermaidRenderer
      );

      tab.savedMarkdown = markdown;
      tab.currentMarkdown = markdown;
      tab.renderedMarkdown = markdown;
      tab.render = rendered;
      tab.warnings = rendered.warnings;
      tab.isDirty = false;
      tab.hasExternalChange = false;
      tab.lastDiskMtimeMs = (await fsp.stat(tab.filePath)).mtimeMs;

      sendTabsStateUpdated();
      return { ok: true, filePath: tab.filePath };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }

  function ackDiskChange(tabId: string): { ok: boolean; reason?: string } {
    const tab = getById(tabId);
    if (!tab) {
      return { ok: false, reason: 'Tab not found.' };
    }

    tab.hasExternalChange = false;
    sendTabsStateUpdated();
    return { ok: true };
  }

  function watchTabFile(tabId: string, filePath: string): void {
    stopWatchingTab(tabId);

    try {
      const watcher = fs.watch(filePath, () => {
        const existingTimer = state.watcherTimersByTabId.get(tabId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
          const tab = getById(tabId);
          if (!tab) {
            return;
          }

          if (Date.now() < tab.ignoreWatcherEventsUntil) {
            return;
          }

          try {
            const st = await fsp.stat(filePath);
            tab.lastDiskMtimeMs = st.mtimeMs;
          } catch (error) {
            console.warn(`[watch] Unable to read mtime for ${filePath}: ${String(error)}`);
          }

          tab.hasExternalChange = true;
          sendTabsStateUpdated();
          sendDiskChanged(tabId, filePath);
        }, 180);

        state.watcherTimersByTabId.set(tabId, timer);
      });

      state.watchersByTabId.set(tabId, watcher);
    } catch (error) {
      console.warn(`[watch] Unable to watch ${filePath}: ${String(error)}`);
    }
  }

  function stopWatchingTab(tabId: string): void {
    const watcher = state.watchersByTabId.get(tabId);
    if (watcher) {
      watcher.close();
      state.watchersByTabId.delete(tabId);
    }

    const timer = state.watcherTimersByTabId.get(tabId);
    if (timer) {
      clearTimeout(timer);
      state.watcherTimersByTabId.delete(tabId);
    }
  }

  function stopWatchingAllTabs(): void {
    for (const tabId of [...state.watchersByTabId.keys()]) {
      stopWatchingTab(tabId);
    }
  }

  async function persistTabSession(): Promise<void> {
    const prefs = getPrefs();
    if (!prefs) {
      return;
    }

    const openTabs = state.tabOrder
      .map((tabId) => state.tabsById.get(tabId)?.filePath)
      .filter((item): item is string => Boolean(item));
    const activeTabPath = state.activeTabId ? state.tabsById.get(state.activeTabId)?.filePath : undefined;

    await prefs.setTabSession(openTabs, activeTabPath);
  }

  async function restoreTabsFromPreferences(openTabs: string[], activeTabPath?: string): Promise<void> {
    for (const candidate of openTabs) {
      if (!candidate || !isMarkdownPath(candidate)) {
        continue;
      }

      const result = await openOrReuseTab(candidate, {
        activate: false,
        sendUpdate: false,
        persist: false
      });

      if (!result.ok) {
        console.warn(`[restore] Skipping tab ${candidate}: ${result.reason ?? 'unknown reason'}`);
      }
    }

    if (activeTabPath) {
      const existingTabId = findTabIdByPath(state, path.resolve(activeTabPath));
      if (existingTabId) {
        state.activeTabId = existingTabId;
      }
    }

    if (!state.activeTabId && state.tabOrder.length > 0) {
      state.activeTabId = state.tabOrder[0] ?? null;
    }
  }

  return {
    buildTabsStatePayload: () => buildTabsStatePayload(state),
    getActiveTab: getActive,
    getTabById: getById,
    getActivePublicTab,
    openTabDialog,
    openOrReuseTab,
    activateTab,
    closeTab,
    closeOtherTabs,
    saveTab,
    saveTabAs,
    renderTabPreview,
    readTabFromDisk,
    reloadTabFromDisk,
    ackDiskChange,
    persistTabSession,
    restoreTabsFromPreferences,
    stopWatchingTab,
    stopWatchingAllTabs
  };
}
