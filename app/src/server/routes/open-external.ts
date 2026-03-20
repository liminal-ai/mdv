import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { ErrorResponseSchema, OpenExternalRequestSchema } from '../schemas/index.js';
import { toApiError } from '../utils/errors.js';

const OpenExternalResponseSchema = z.object({ ok: z.literal(true) });

export async function openExternalRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/open-external',
    {
      schema: {
        body: OpenExternalRequestSchema,
        response: {
          200: OpenExternalResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) =>
      reply
        .code(501)
        .send(toApiError('NOT_IMPLEMENTED', 'POST /api/open-external is not implemented yet.')),
  );
}
