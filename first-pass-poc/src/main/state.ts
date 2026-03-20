import fs from 'node:fs';

import type { BrowserWindow } from 'electron';

import type { DocumentTabSession, RenderResult, TabsStatePayload } from '../core/types';

export interface TabSessionInternal {
  tabId: string;
  filePath: string;
  title: string;
  savedMarkdown: string;
  currentMarkdown: string;
  renderedMarkdown: string;
  render: RenderResult;
  warnings: RenderResult['warnings'];
  isDirty: boolean;
  hasExternalChange: boolean;
  lastDiskMtimeMs?: number;
  ignoreWatcherEventsUntil: number;
}

export interface MainProcessState {
  mainWindow: BrowserWindow | null;
  currentRootFolder: string | null;
  tabsById: Map<string, TabSessionInternal>;
  tabOrder: string[];
  activeTabId: string | null;
  watchersByTabId: Map<string, fs.FSWatcher>;
  watcherTimersByTabId: Map<string, NodeJS.Timeout>;
  quitConfirmed: boolean;
  nextTabId: number;
}

export function createMainProcessState(): MainProcessState {
  return {
    mainWindow: null,
    currentRootFolder: null,
    tabsById: new Map<string, TabSessionInternal>(),
    tabOrder: [],
    activeTabId: null,
    watchersByTabId: new Map<string, fs.FSWatcher>(),
    watcherTimersByTabId: new Map<string, NodeJS.Timeout>(),
    quitConfirmed: false,
    nextTabId: 1
  };
}

export function createTabId(state: MainProcessState): string {
  const value = `tab-${state.nextTabId}`;
  state.nextTabId += 1;
  return value;
}

export function getActiveTab(state: MainProcessState): TabSessionInternal | null {
  if (!state.activeTabId) {
    return null;
  }

  return state.tabsById.get(state.activeTabId) ?? null;
}

export function getTabById(state: MainProcessState, tabId: string): TabSessionInternal | null {
  return state.tabsById.get(tabId) ?? null;
}

export function findTabIdByPath(state: MainProcessState, filePath: string): string | null {
  for (const [tabId, tab] of state.tabsById.entries()) {
    if (tab.filePath === filePath) {
      return tabId;
    }
  }

  return null;
}

export function toPublicTabSession(tab: TabSessionInternal): DocumentTabSession {
  return {
    tabId: tab.tabId,
    filePath: tab.filePath,
    title: tab.title,
    savedMarkdown: tab.savedMarkdown,
    currentMarkdown: tab.currentMarkdown,
    renderHtml: tab.render.html,
    renderBlocks: tab.render.previewBlocks,
    warnings: tab.warnings,
    isDirty: tab.isDirty,
    hasExternalChange: tab.hasExternalChange,
    lastDiskMtimeMs: tab.lastDiskMtimeMs
  };
}

export function buildTabsStatePayload(state: MainProcessState): TabsStatePayload {
  const tabs = state.tabOrder
    .map((tabId) => state.tabsById.get(tabId))
    .filter((tab): tab is TabSessionInternal => Boolean(tab))
    .map((tab) => toPublicTabSession(tab));

  return {
    tabs,
    activeTabId: state.activeTabId
  };
}
