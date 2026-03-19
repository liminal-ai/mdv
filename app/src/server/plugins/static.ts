import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';

export async function staticPlugin(app: FastifyInstance) {
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'dist/client'),
    prefix: '/',
    decorateReply: true,
  });
}
