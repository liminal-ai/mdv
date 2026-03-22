import { exec } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { FastifyInstance } from 'fastify';
import { buildApp, type AppOptions } from './app.js';

const execAsync = promisify(exec);

export interface StartServerOptions extends AppOptions {
  buildApp?: (opts?: AppOptions) => Promise<FastifyInstance>;
  host?: string;
  preferredPort?: number;
  openUrl?: (url: string) => Promise<void>;
  log?: Pick<Console, 'log' | 'error'>;
}

export async function openBrowser(url: string): Promise<void> {
  await execAsync(`open ${url}`);
}

export async function startServer(options: StartServerOptions = {}): Promise<FastifyInstance> {
  const build = options.buildApp ?? buildApp;
  const app = await build({
    sessionDir: options.sessionDir,
    sessionService: options.sessionService,
    browseService: options.browseService,
  });
  const host = options.host ?? '127.0.0.1';
  const preferredPort = options.preferredPort ?? 3000;
  const openUrl = options.openUrl ?? openBrowser;
  const log = options.log ?? console;

  let address: string;

  try {
    address = await app.listen({ port: preferredPort, host });
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException | undefined)?.code !== 'EADDRINUSE' ||
      preferredPort === 0
    ) {
      throw error;
    }

    address = await app.listen({ port: 0, host });
  }

  const url = new URL(address);
  const localUrl = `http://localhost:${url.port}`;

  try {
    await openUrl(localUrl);
  } catch (error) {
    log.error(error);
  }

  log.log(`mdv running at ${localUrl}`);

  return app;
}

async function main() {
  await startServer();
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (entryUrl === import.meta.url) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
