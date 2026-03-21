import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  ErrorResponseSchema,
  SaveDialogRequestSchema,
  SaveDialogResponseSchema,
} from '../schemas/index.js';
import { openSaveDialog } from '../utils/save-dialog.js';
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
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const selected = await openSaveDialog(
          request.body.defaultPath,
          request.body.defaultFilename,
          request.body.prompt ?? 'Save',
        );
        return selected ? { path: selected } : null;
      } catch {
        return reply
          .code(500)
          .send(toApiError(ErrorCode.WRITE_ERROR, 'Failed to open save dialog.'));
      }
    },
  );
}
