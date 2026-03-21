import { exec } from 'node:child_process';
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
import { SessionService } from '../services/session.service.js';
import { toApiError } from '../utils/errors.js';

const RevealResponseSchema = z.object({ ok: z.literal(true) });

async function openSaveDialog(defaultDir: string, defaultName: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const script =
      'POSIX path of (choose file name ' +
      'with prompt "Export document" ' +
      `default name ${JSON.stringify(defaultName)} ` +
      `default location POSIX file ${JSON.stringify(defaultDir)})`;

    exec(`osascript -e '${script}'`, { timeout: 60_000 }, (error, stdout) => {
      if (error) {
        const errorCode = (error as NodeJS.ErrnoException & { code?: number | string }).code;
        if (String(errorCode) === '1') {
          resolve(null);
          return;
        }

        reject(error);
        return;
      }

      resolve(stdout.trim());
    });
  });
}

export interface ExportRoutesOptions {
  sessionService?: SessionService;
  sessionDir?: string;
}

export async function exportRoutes(app: FastifyInstance, opts: ExportRoutesOptions) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const sessionService = opts.sessionService ?? new SessionService(opts.sessionDir);

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
        },
      },
    },
    async (request) => {
      const selected = await openSaveDialog(request.body.defaultPath, request.body.defaultFilename);
      return selected ? { path: selected } : null;
    },
  );

  typedApp.post(
    '/api/export/reveal',
    {
      schema: {
        body: RevealRequestSchema,
        response: {
          200: RevealResponseSchema,
        },
      },
    },
    async (request) => {
      exec(`open -R ${JSON.stringify(request.body.path)}`);
      return { ok: true as const };
    },
  );

  typedApp.put(
    '/api/session/last-export-dir',
    {
      attachValidation: true,
      schema: {
        body: SetLastExportDirSchema,
        response: {
          200: SessionStateSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send(toApiError('INVALID_PATH', 'Path must be absolute'));
      }

      return sessionService.setLastExportDir(request.body.path);
    },
  );
}
