import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { staticPlugin } from './plugins/static.js';

export interface AppOptions {
  sessionDir?: string;
}

export async function buildApp(opts?: AppOptions) {
  void opts;
  const app = Fastify({ logger: false });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(staticPlugin);

  return app;
}
