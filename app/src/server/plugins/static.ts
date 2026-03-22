import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveClientRoot(
  baseDir = __dirname,
  fileExists: (target: string) => boolean = existsSync,
): string {
  // Standard path: dist/server/plugins/ -> ../../client = dist/client/
  const standard = path.resolve(baseDir, '../../client');

  // Electron asar: unpacked files live alongside app.asar at app.asar.unpacked/
  const asarUnpacked = standard.replace('app.asar', 'app.asar.unpacked');

  const candidates = asarUnpacked !== standard ? [asarUnpacked, standard] : [standard];

  for (const candidate of candidates) {
    if (fileExists(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  throw new Error(
    `Client build not found. Expected index.html in one of: ${candidates.join(', ')}. ` +
      'Run `npm run build` before starting Electron.',
  );
}

export async function staticPlugin(app: FastifyInstance) {
  await app.register(fastifyStatic, {
    root: resolveClientRoot(),
    prefix: '/',
    decorateReply: true,
  });
}
