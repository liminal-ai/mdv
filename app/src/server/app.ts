import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { staticPlugin } from './plugins/static.js';
import { browseRoutes } from './routes/browse.js';
import { clipboardRoutes } from './routes/clipboard.js';
import { sessionRoutes } from './routes/session.js';
import type { BrowseService } from './services/browse.service.js';
import type { SessionService } from './services/session.service.js';

export interface AppOptions {
  sessionDir?: string;
  sessionService?: SessionService;
  browseService?: BrowseService;
}

export async function buildApp(opts?: AppOptions) {
  const app = Fastify({ logger: false });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(staticPlugin);
  await app.register(sessionRoutes, {
    sessionService: opts?.sessionService,
    sessionDir: opts?.sessionDir,
  });
  await app.register(browseRoutes, {
    browseService: opts?.browseService,
  });
  await app.register(clipboardRoutes);

  return app;
}
