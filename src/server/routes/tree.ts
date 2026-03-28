import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { ErrorResponseSchema, FileTreeResponseSchema } from '../../shared/contracts/index.js';
import { scanTree } from '../services/tree.service.js';
import {
  ErrorCode,
  ScanTimeoutError,
  isNotFoundError,
  isPermissionError,
  toApiError,
} from '../utils/errors.js';

export async function treeRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/tree',
    {
      schema: {
        querystring: z.object({ root: z.string() }),
        response: {
          200: FileTreeResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { root } = request.query;

      if (!root.startsWith('/')) {
        return reply
          .code(400)
          .send(toApiError(ErrorCode.INVALID_PATH, 'Root path must be absolute.'));
      }

      try {
        const tree = await scanTree(root);
        return { root, tree };
      } catch (err) {
        if (err instanceof ScanTimeoutError) {
          return reply
            .code(500)
            .send(toApiError(ErrorCode.SCAN_ERROR, err.message, { timeout: true }));
        }

        if (isPermissionError(err)) {
          return reply
            .code(403)
            .send(toApiError(ErrorCode.PERMISSION_DENIED, `Cannot read directory: ${root}`));
        }

        if (isNotFoundError(err)) {
          return reply
            .code(404)
            .send(toApiError(ErrorCode.PATH_NOT_FOUND, `Directory not found: ${root}`));
        }

        return reply
          .code(500)
          .send(toApiError(ErrorCode.SCAN_ERROR, `Failed to scan directory: ${root}`));
      }
    },
  );
}
