import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PreferencesStore } from '../src/main/preferences';

describe('PreferencesStore', () => {
  it('persists pinned folders and sidebar state', async () => {
    const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-prefs-'));
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-project-'));

    const store = new PreferencesStore(userDataPath);
    await store.load();

    await store.pinFolder(projectRoot);
    await store.setLastRootFolder(projectRoot);
    await store.setSidebarCollapsed(true);
    await store.setSidebarWidth(360);
    await store.setTabSession(
      [path.join(projectRoot, 'a.md'), path.join(projectRoot, 'b.md')],
      path.join(projectRoot, 'b.md')
    );

    const reloaded = new PreferencesStore(userDataPath);
    const prefs = await reloaded.load();

    expect(prefs.lastRootFolder).toBe(projectRoot);
    expect(prefs.sidebarCollapsed).toBe(true);
    expect(prefs.sidebarWidth).toBe(360);
    expect(prefs.pinnedFolders).toContain(projectRoot);
    expect(prefs.openTabs).toEqual([path.join(projectRoot, 'a.md'), path.join(projectRoot, 'b.md')]);
    expect(prefs.activeTabPath).toBe(path.join(projectRoot, 'b.md'));
    expect(reloaded.getPinnedFolders()[0]?.path).toBe(projectRoot);

    const pinsAfterUnpin = await reloaded.unpinFolder(projectRoot);
    expect(pinsAfterUnpin).toHaveLength(0);
  });

  it('deduplicates pinned folders', async () => {
    const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-prefs-dedupe-'));
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-project-dedupe-'));

    const store = new PreferencesStore(userDataPath);
    await store.load();
    await store.pinFolder(projectRoot);
    await store.pinFolder(projectRoot);

    expect(store.getPinnedFolders()).toHaveLength(1);
  });

  it('clamps sidebar width to a sensible range', async () => {
    const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-prefs-width-'));
    const store = new PreferencesStore(userDataPath);
    await store.load();

    await store.setSidebarWidth(10);
    expect(store.get().sidebarWidth).toBe(180);

    await store.setSidebarWidth(1200);
    expect(store.get().sidebarWidth).toBe(640);
  });
});
