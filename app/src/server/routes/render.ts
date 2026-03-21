import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  ErrorResponseSchema,
  RenderFromContentRequestSchema,
  RenderFromContentResponseSchema,
} from '../schemas/index.js';
import { ErrorCode, toApiError } from '../utils/errors.js';

export async function renderRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/api/render',
    {
      schema: {
        body: RenderFromContentRequestSchema,
        response: {
          200: RenderFromContentResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply.code(501).send(toApiError(ErrorCode.READ_ERROR, 'Not implemented'));
    },
  );
}
