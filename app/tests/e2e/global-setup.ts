import type { FullConfig } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {
  cleanupFixtures,
  createFixtureWorkspace,
  type FixtureWorkspace,
} from '../utils/e2e/fixtures.js';
import { ServerManager } from '../utils/e2e/server-manager.js';
import { writeE2EState } from '../utils/e2e/state.js';

interface RuntimeState {
  serverManager: ServerManager;
  workspace: FixtureWorkspace;
}

declare global {
  var __MDV_E2E_RUNTIME__: RuntimeState | undefined;
}

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

  const workspace = await createFixtureWorkspace();
  const serverManager = new ServerManager();

  try {
    const { baseURL, port } = await serverManager.start({
      sessionDir: workspace.sessionDir,
      preferredPort: 0,
    });

    const response = await fetch(new URL('/api/session/root', baseURL), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ root: workspace.rootPath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to set workspace root: ${response.status} ${response.statusText}`);
    }

    writeE2EState({
      baseURL,
      port,
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

    globalThis.__MDV_E2E_RUNTIME__ = {
      serverManager,
      workspace,
    };
  } catch (error) {
    await serverManager.stop();
    await cleanupFixtures(workspace);
    throw error;
  }
}
