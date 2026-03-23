import type { FullConfig } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { cleanupFixtures, type FixtureWorkspace } from '../utils/e2e/fixtures.js';
import type { ServerManager } from '../utils/e2e/server-manager.js';
import { readE2EState, removeE2EState } from '../utils/e2e/state.js';

interface RuntimeState {
  serverManager: ServerManager;
  workspace: FixtureWorkspace;
}

declare global {
  var __MDV_E2E_RUNTIME__: RuntimeState | undefined;
}

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  const runtime = globalThis.__MDV_E2E_RUNTIME__;
  const persistedState = safeReadState();

  try {
    if (runtime) {
      await runtime.serverManager.stop();
      await cleanupFixtures(runtime.workspace);
      return;
    }

    if (persistedState) {
      await Promise.all([
        rm(persistedState.fixtureDir, { recursive: true, force: true }),
        rm(persistedState.sessionDir, { recursive: true, force: true }),
        rm(persistedState.exportDir, { recursive: true, force: true }),
      ]);
    }
  } finally {
    removeE2EState();
    delete globalThis.__MDV_E2E_RUNTIME__;
  }
}

function safeReadState() {
  try {
    return readE2EState();
  } catch {
    return null;
  }
}
