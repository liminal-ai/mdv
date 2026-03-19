import { exec } from 'node:child_process';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { ClipboardRequestSchema } from '../schemas/index.js';

const ClipboardResponseSchema = z.object({ ok: z.literal(true) });

export async function clipboardRoutes(app: FastifyInstance) {
  app.post(
    '/api/clipboard',
    {
      schema: {
        body: ClipboardRequestSchema,
        response: {
          200: ClipboardResponseSchema,
        },
      },
    },
    async (request) => {
      const { text } = ClipboardRequestSchema.parse(request.body);

      await new Promise<void>((resolve, reject) => {
        const proc = exec('pbcopy');

        proc.stdin?.write(text);
        proc.stdin?.end();
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(new Error('pbcopy failed'));
        });
      });

      return { ok: true as const };
    },
  );
}
