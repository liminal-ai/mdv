import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { ErrorResponseSchema, OpenExternalRequestSchema } from '../../shared/contracts/index.js';
import { ErrorCode, isNotFoundError, isPermissionError, toApiError } from '../utils/errors.js';

const OpenExternalResponseSchema = z.object({ ok: z.literal(true) });

export async function openExternalRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/open-external',
    {
      attachValidation: true,
      schema: {
        body: OpenExternalRequestSchema,
        response: {
          200: OpenExternalResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, 'Path must be absolute'));
      }

      const filePath = request.body.path;

      try {
        await stat(filePath);
        await new Promise<void>((resolve, reject) => {
          execFile('open', [filePath], (error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });

        return { ok: true } as const;
      } catch (error) {
        if (isPermissionError(error)) {
          return reply
            .code(403)
            .send(
              toApiError(
                ErrorCode.PERMISSION_DENIED,
                'You do not have permission to open this file.',
              ),
            );
        }

        if (isNotFoundError(error)) {
          return reply
            .code(404)
            .send(toApiError(ErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`));
        }

        return reply
          .code(500)
          .send(
            toApiError(
              ErrorCode.READ_ERROR,
              'Failed to open the requested file with the system handler.',
            ),
          );
      }
    },
  );
}
