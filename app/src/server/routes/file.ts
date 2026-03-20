import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  ErrorResponseSchema,
  FilePickerResponseSchema,
  FileReadRequestSchema,
  FileReadResponseSchema,
} from '../schemas/index.js';
import { toApiError } from '../utils/errors.js';

export async function fileRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/api/file',
    {
      schema: {
        querystring: FileReadRequestSchema,
        response: {
          200: FileReadResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) =>
      reply.code(501).send(toApiError('NOT_IMPLEMENTED', 'GET /api/file is not implemented yet.')),
  );

  typedApp.post(
    '/api/file/pick',
    {
      schema: {
        response: {
          200: FilePickerResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) =>
      reply
        .code(501)
        .send(toApiError('NOT_IMPLEMENTED', 'POST /api/file/pick is not implemented yet.')),
  );
}
