import type { FastifyInstance } from 'fastify';
import { createConnection } from 'node:net';
import { startServer } from '../../../dist/server/index.js';

export interface ServerManagerState {
  app: FastifyInstance;
  baseURL: string;
  port: number;
}

export interface ServerStartOptions {
  sessionDir: string;
  preferredPort?: number;
}

declare global {
  var __MDV_E2E_WORKER_SERVER_MANAGER__: ServerManager | undefined;
}

const PORT_RELEASE_TIMEOUT_MS = 5_000;
const PORT_RELEASE_POLL_MS = 50;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPortRelease(port: number, host = '127.0.0.1'): Promise<void> {
  const deadline = Date.now() + PORT_RELEASE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (!(await isPortOpen(port, host))) {
      return;
    }

    await delay(PORT_RELEASE_POLL_MS);
  }

  throw new Error(
    `ServerManager: port ${port} did not release within ${PORT_RELEASE_TIMEOUT_MS}ms`,
  );
}

/**
 * Manages the Fastify server lifecycle for E2E tests.
 *
 * Covers: AC-1.1 (server lifecycle), AC-8.1/8.2 (restart for persistence)
 * Used by: global-setup.ts, global-teardown.ts, persistence.spec.ts
 */
export class ServerManager {
  private state: ServerManagerState | null = null;

  private sessionDir: string | null = null;

  /** Start the Fastify server on a random port. Returns baseURL. */
  async start(options: ServerStartOptions): Promise<ServerManagerState> {
    if (this.state !== null) {
      throw new Error('ServerManager: server already started');
    }

    this.sessionDir = options.sessionDir;
    const app = await startServer({
      preferredPort: options.preferredPort ?? 0,
      sessionDir: options.sessionDir,
      openUrl: async () => {},
      log: { log: () => {}, error: () => {} },
    });

    const addressInfo = app.server.address();
    if (!addressInfo || typeof addressInfo === 'string') {
      await app.close();
      throw new Error('ServerManager: unable to extract server port');
    }

    const port = addressInfo.port;
    const baseURL = `http://localhost:${port}`;

    this.state = { app, baseURL, port };
    return this.state;
  }

  /** Stop the running server and release the port. */
  async stop(): Promise<void> {
    if (this.state) {
      const currentState = this.state;
      this.state = null;
      await currentState.app.close();
    }
  }

  /**
   * Restart the server on the same port with the same session dir.
   * Used for session persistence tests — browser session stays alive.
   */
  async restart(): Promise<ServerManagerState> {
    if (!this.state || !this.sessionDir) {
      throw new Error('ServerManager: cannot restart — not started');
    }
    const port = this.state.port;
    const sessionDir = this.sessionDir;

    await this.stop();
    await waitForPortRelease(port);
    return this.start({ sessionDir, preferredPort: port });
  }

  /** Get current server state. Throws if not started. */
  getState(): ServerManagerState {
    if (!this.state) {
      throw new Error('ServerManager: server not started');
    }
    return this.state;
  }
}

export function getGlobalServerManager(): ServerManager {
  globalThis.__MDV_E2E_WORKER_SERVER_MANAGER__ ??= new ServerManager();
  return globalThis.__MDV_E2E_WORKER_SERVER_MANAGER__;
}

export async function ensureGlobalServer(options: ServerStartOptions): Promise<ServerManagerState> {
  const serverManager = getGlobalServerManager();

  try {
    return serverManager.getState();
  } catch {
    return serverManager.start(options);
  }
}
