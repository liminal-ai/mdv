import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import {
  ErrorResponseSchema,
  ExportRequestSchema,
  ExportResponseSchema,
  RevealRequestSchema,
  SaveDialogRequestSchema,
  SaveDialogResponseSchema,
  SessionStateSchema,
  SetLastExportDirSchema,
} from '../schemas/index.js';
import { toApiError } from '../utils/errors.js';

const RevealResponseSchema = z.object({ ok: z.literal(true) });

export async function exportRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/api/export',
    {
      schema: {
        body: ExportRequestSchema,
        response: {
          200: ExportResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply.code(501).send(toApiError('NOT_IMPLEMENTED', 'Export not yet implemented'));
    },
  );

  typedApp.post(
    '/api/export/save-dialog',
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
      return reply.code(501).send(toApiError('NOT_IMPLEMENTED', 'Save dialog not yet implemented'));
    },
  );

  typedApp.post(
    '/api/export/reveal',
    {
      schema: {
        body: RevealRequestSchema,
        response: {
          200: RevealResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply.code(501).send(toApiError('NOT_IMPLEMENTED', 'Reveal not yet implemented'));
    },
  );

  typedApp.put(
    '/api/session/last-export-dir',
    {
      schema: {
        body: SetLastExportDirSchema,
        response: {
          200: SessionStateSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      return reply
        .code(501)
        .send(toApiError('NOT_IMPLEMENTED', 'Last export dir not yet implemented'));
    },
  );
}
