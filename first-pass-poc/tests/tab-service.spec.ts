import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PreferencesStore } from '../src/main/preferences';
import { createMainProcessState } from '../src/main/state';
import { createTabService } from '../src/main/tabService';
import type { MermaidRenderer } from '../src/core/types';

class FakeMermaidRenderer implements MermaidRenderer {
  async renderDiagram(id: string): Promise<{ ok: boolean; svg?: string }> {
    return {
      ok: true,
      svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg"></svg>`
    };
  }

  async dispose(): Promise<void> {
    return Promise.resolve();
  }
}

describe('TabService', () => {
  it('reuses already-open tabs by file path and can stop watchers cleanly', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-tab-service-'));
    const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-tab-service-user-'));
    const filePath = path.join(root, 'notes.md');
    await fs.writeFile(filePath, '# hello', 'utf8');

    const prefs = new PreferencesStore(userData);
    await prefs.load();

    const state = createMainProcessState();
    const service = createTabService({
      state,
      mermaidRenderer: new FakeMermaidRenderer(),
      getPreferencesStore: () => prefs,
      sendTabsStateUpdated: () => {},
      sendDiskChanged: () => {}
    });

    const first = await service.openOrReuseTab(filePath);
    const second = await service.openOrReuseTab(filePath);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.tabId).toBe(second.tabId);
    expect(state.tabsById.size).toBe(1);
    expect(state.watchersByTabId.size).toBe(1);

    service.stopWatchingAllTabs();
    expect(state.watchersByTabId.size).toBe(0);
  });
});
