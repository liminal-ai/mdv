import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  ErrorResponseSchema,
  SaveDialogRequestSchema,
  SaveDialogResponseSchema,
} from '../schemas/index.js';
import { ErrorCode, toApiError } from '../utils/errors.js';

export async function saveDialogRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/api/save-dialog',
    {
      schema: {
        body: SaveDialogRequestSchema,
        response: {
          200: SaveDialogResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply.code(501).send(toApiError(ErrorCode.WRITE_ERROR, 'Not implemented'));
    },
  );
}
