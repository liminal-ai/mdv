import type { FastifyInstance } from 'fastify';
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
