export type UnsavedDecision = 'save' | 'discard' | 'cancel';
export type SwitchOutcome = 'proceed-save' | 'proceed-discard' | 'cancel';

export type ConflictDecision = 'keep-mine' | 'reload-disk' | 'save-copy';
export type ConflictOutcome = 'keep' | 'reload' | 'save-copy';

export interface TabIdentity {
  tabId: string;
  filePath: string;
}

export function computeDirty(savedMarkdown: string, currentMarkdown: string): boolean {
  return savedMarkdown !== currentMarkdown;
}

export function resolveSwitchOutcome(isDirty: boolean, decision: UnsavedDecision = 'cancel'): SwitchOutcome {
  if (!isDirty) {
    return 'proceed-discard';
  }

  if (decision === 'save') {
    return 'proceed-save';
  }

  if (decision === 'discard') {
    return 'proceed-discard';
  }

  return 'cancel';
}

export function resolveConflictOutcome(decision: ConflictDecision): ConflictOutcome {
  if (decision === 'reload-disk') {
    return 'reload';
  }

  if (decision === 'save-copy') {
    return 'save-copy';
  }

  return 'keep';
}

export function createDebouncedRunner(
  delayMs: number,
  run: () => void,
  setTimer: (fn: () => void, ms: number) => unknown,
  clearTimer: (handle: unknown) => void
): () => void {
  let handle: unknown = null;

  return () => {
    if (handle !== null) {
      clearTimer(handle);
    }

    handle = setTimer(() => {
      handle = null;
      run();
    }, delayMs);
  };
}

export function findOpenTabIdByPath(tabs: TabIdentity[], filePath: string): string | null {
  const match = tabs.find((tab) => tab.filePath === filePath);
  return match?.tabId ?? null;
}

export function nextActiveTabAfterClose(tabOrder: string[], closingTabId: string, activeTabId: string | null): string | null {
  const remaining = tabOrder.filter((tabId) => tabId !== closingTabId);
  if (remaining.length === 0) {
    return null;
  }

  if (activeTabId !== closingTabId) {
    return activeTabId && remaining.includes(activeTabId) ? activeTabId : (remaining[0] ?? null);
  }

  const closedIndex = tabOrder.indexOf(closingTabId);
  if (closedIndex <= 0) {
    return remaining[0] ?? null;
  }

  return remaining[Math.min(closedIndex - 1, remaining.length - 1)] ?? remaining[0] ?? null;
}
