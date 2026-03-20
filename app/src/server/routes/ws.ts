import type { FastifyInstance } from 'fastify';
import { ErrorResponseSchema } from '../schemas/index.js';
import { toApiError } from '../utils/errors.js';

export async function wsRoutes(app: FastifyInstance) {
  // Story 0 keeps WebSocket support as a placeholder until the plugin is added.
  app.get(
    '/ws',
    {
      schema: {
        response: {
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) =>
      reply
        .code(501)
        .send(toApiError('NOT_IMPLEMENTED', 'WebSocket support is not implemented yet.')),
  );
}
