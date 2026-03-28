import { constants, createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { ErrorResponseSchema, ImageRequestSchema } from '../../shared/contracts/index.js';
import { ImageService } from '../services/image.service.js';
import {
  ErrorCode,
  InvalidPathError,
  NotFileError,
  UnsupportedFormatError,
  isNotFoundError,
  isPermissionError,
  toApiError,
} from '../utils/errors.js';

export async function imageRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const imageService = new ImageService();

  typedApp.get(
    '/api/image',
    {
      attachValidation: true,
      schema: {
        querystring: ImageRequestSchema,
        response: {
          200: z.any(),
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

      const imagePath = request.query.path;

      try {
        const { contentType } = await imageService.validate(imagePath);
        await access(imagePath, constants.R_OK);
        const stream = createReadStream(imagePath);
        stream.on('error', () => {
          if (!reply.sent) {
            void reply.code(500).send(toApiError(ErrorCode.READ_ERROR, 'Stream read failed'));
          }
        });

        return reply.header('Cache-Control', 'private, max-age=60').type(contentType).send(stream);
      } catch (error) {
        if (error instanceof InvalidPathError || error instanceof NotFileError) {
          return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, error.message));
        }

        if (error instanceof UnsupportedFormatError) {
          return reply.code(400).send(toApiError(ErrorCode.UNSUPPORTED_FORMAT, error.message));
        }

        if (isPermissionError(error)) {
          return reply
            .code(403)
            .send(
              toApiError(
                ErrorCode.PERMISSION_DENIED,
                'You do not have permission to read this image.',
              ),
            );
        }

        if (isNotFoundError(error)) {
          return reply
            .code(404)
            .send(toApiError(ErrorCode.FILE_NOT_FOUND, `Image not found: ${imagePath}`));
        }

        return reply
          .code(500)
          .send(toApiError(ErrorCode.READ_ERROR, 'Failed to read the requested image.'));
      }
    },
  );
}
