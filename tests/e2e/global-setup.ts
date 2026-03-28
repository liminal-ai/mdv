import type { FullConfig } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createFixtureWorkspace } from '../utils/e2e/fixtures.js';
import { ServerManager } from '../utils/e2e/server-manager.js';
import { setE2EStatePath, writeE2EState } from '../utils/e2e/state.js';

async function verifyPortConflictHandling(): Promise<void> {
  const occupiedServer = createServer();
  await new Promise<void>((resolve, reject) => {
    occupiedServer.once('error', reject);
    occupiedServer.listen(0, '127.0.0.1', () => resolve());
  });

  const occupiedAddress = occupiedServer.address();
  if (!occupiedAddress || typeof occupiedAddress === 'string') {
    await new Promise<void>((resolve, reject) => {
      occupiedServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    throw new Error('Unable to determine the occupied port during E2E setup.');
  }

  const tempSessionDir = await mkdtemp(path.join(os.tmpdir(), 'mdv-e2e-port-check-'));
  const probeManager = new ServerManager();

  try {
    const probeState = await probeManager.start({
      sessionDir: tempSessionDir,
      preferredPort: occupiedAddress.port,
    });

    if (probeState.port === occupiedAddress.port) {
      throw new Error(
        `Expected port fallback away from ${occupiedAddress.port}, but it did not occur.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const looksLikePortConflict =
      message.includes('EADDRINUSE') || message.toLowerCase().includes('address already in use');

    if (!looksLikePortConflict) {
      throw error;
    }
  } finally {
    await probeManager.stop();
    await new Promise<void>((resolve, reject) => {
      occupiedServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await rm(tempSessionDir, { recursive: true, force: true });
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await verifyPortConflictHandling();
  setE2EStatePath();

  const workspace = await createFixtureWorkspace();

  writeE2EState({
    baseURL: '',
    port: 0,
    fixtureDir: workspace.rootPath,
    sessionDir: workspace.sessionDir,
    exportDir: workspace.exportDir,
    files: {
      kitchenSink: workspace.files.kitchenSink,
      invalidMermaid: workspace.files.invalidMermaid,
      simple: workspace.files.simple,
      nested: workspace.files.nested,
    },
  });
}
