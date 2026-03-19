import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/server/app.js';

export async function createTestApp(opts?: { sessionDir?: string }): Promise<FastifyInstance> {
  const app = await buildApp(opts);
  await app.ready();
  return app;
}
