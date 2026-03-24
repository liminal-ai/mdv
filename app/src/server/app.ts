import { stat } from 'node:fs/promises';
import path from 'node:path';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { staticPlugin } from './plugins/static.js';
import { browseRoutes } from './routes/browse.js';
import { clipboardRoutes } from './routes/clipboard.js';
import { exportRoutes } from './routes/export.js';
import { fileRoutes } from './routes/file.js';
import { imageRoutes } from './routes/image.js';
import { openExternalRoutes } from './routes/open-external.js';
import { packageRoutes } from './routes/package.js';
import { renderRoutes } from './routes/render.js';
import { saveDialogRoutes } from './routes/save-dialog.js';
import { sessionRoutes } from './routes/session.js';
import { treeRoutes } from './routes/tree.js';
import { wsRoutes } from './routes/ws.js';
import type { BrowseService } from './services/browse.service.js';
import { PackageService } from './services/package.service.js';
import { SessionService } from './services/session.service.js';
import { TempDirManager } from './services/temp-dir.service.js';

export interface AppOptions {
  sessionDir?: string;
  sessionService?: SessionService;
  browseService?: BrowseService;
  cliArg?: string;
  runStartupTasks?: boolean;
}

export async function buildApp(opts?: AppOptions) {
  const app = Fastify({ logger: false });
  const sessionService = opts?.sessionService ?? new SessionService(opts?.sessionDir);
  const tempDirManager = new TempDirManager();
  const packageService = new PackageService(tempDirManager, sessionService);
  const runStartupTasks = opts?.runStartupTasks ?? !process.env.VITEST;

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(staticPlugin);
  await app.register(websocket);
  await app.register(sessionRoutes, {
    sessionService,
    packageService,
  });
  await app.register(packageRoutes, { packageService });
  await app.register(browseRoutes, {
    browseService: opts?.browseService,
  });
  await app.register(treeRoutes);
  await app.register(clipboardRoutes);
  await app.register(fileRoutes);
  await app.register(imageRoutes);
  await app.register(openExternalRoutes);
  await app.register(renderRoutes);
  await app.register(saveDialogRoutes);
  await app.register(exportRoutes, {
    sessionService,
  });
  await app.register(wsRoutes);

  if (opts?.cliArg) {
    const resolvedPath = path.resolve(opts.cliArg);
    const ext = path.extname(opts.cliArg).toLowerCase();

    if (ext === '.mpk' || ext === '.mpkz') {
      await packageService.open(resolvedPath);
    } else {
      try {
        const stats = await stat(resolvedPath);
        if (stats.isDirectory()) {
          await sessionService.setRoot(resolvedPath);
        }
        // If it's a file, don't call setRoot — existing file-open behavior handles it
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          console.warn(`CLI argument path does not exist: ${resolvedPath}`);
          // App starts in default empty state
        } else {
          throw error;
        }
      }
    }
  }

  if (runStartupTasks) {
    await packageService.restore();
    await tempDirManager.cleanupStale();
  }

  app.addHook('onResponse', async (request, reply) => {
    if (request.method === 'PUT' && request.url === '/api/file' && reply.statusCode === 200) {
      const state = packageService.getState();
      if (state && state.mode === 'extracted' && !state.stale) {
        const savedPath = (request.body as { path?: string })?.path;
        if (savedPath && savedPath.startsWith(state.extractedRoot)) {
          packageService.markStale();
        }
      }
    }
  });

  app.addHook('onClose', async () => {
    await tempDirManager.cleanup();
  });

  return app;
}
