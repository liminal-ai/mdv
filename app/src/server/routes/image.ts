import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ErrorResponseSchema, ImageRequestSchema } from '../schemas/index.js';
import { toApiError } from '../utils/errors.js';

export async function imageRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/image',
    {
      schema: {
        querystring: ImageRequestSchema,
        response: {
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) =>
      reply.code(501).send(toApiError('NOT_IMPLEMENTED', 'GET /api/image is not implemented yet.')),
  );
}
