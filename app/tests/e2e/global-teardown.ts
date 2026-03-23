import type { FullConfig } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { readE2EState, removeE2EState } from '../utils/e2e/state.js';

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  const persistedState = safeReadState();

  try {
    if (persistedState) {
      await Promise.all([
        rm(persistedState.fixtureDir, { recursive: true, force: true }),
        rm(persistedState.sessionDir, { recursive: true, force: true }),
        rm(persistedState.exportDir, { recursive: true, force: true }),
      ]);
    }
  } finally {
    removeE2EState();
  }
}

function safeReadState() {
  try {
    return readE2EState();
  } catch {
    return null;
  }
}
