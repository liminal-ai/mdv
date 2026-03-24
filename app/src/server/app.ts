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
}

export async function buildApp(opts?: AppOptions) {
  const app = Fastify({ logger: false });
  const sessionService = opts?.sessionService ?? new SessionService(opts?.sessionDir);
  const tempDirManager = new TempDirManager();
  const packageService = new PackageService(tempDirManager, sessionService);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(staticPlugin);
  await app.register(websocket);
  await app.register(sessionRoutes, {
    sessionService,
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

  return app;
}
