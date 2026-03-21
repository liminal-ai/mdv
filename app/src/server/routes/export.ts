import { execFile } from 'node:child_process';
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
import { AssetService } from '../services/asset.service.js';
import { DocxService } from '../services/docx.service.js';
import { ExportService } from '../services/export.service.js';
import { FileService } from '../services/file.service.js';
import { HtmlExportService } from '../services/html-export.service.js';
import { MermaidSsrService } from '../services/mermaid-ssr.service.js';
import { PdfService } from '../services/pdf.service.js';
import { RenderService } from '../services/render.service.js';
import { SessionService } from '../services/session.service.js';
import {
  ErrorCode,
  ExportInProgressError,
  FileTooLargeError,
  InvalidPathError,
  NotFileError,
  NotMarkdownError,
  isInsufficientStorageError,
  isNotFoundError,
  isPermissionError,
  toApiError,
} from '../utils/errors.js';

const RevealResponseSchema = z.object({ ok: z.literal(true) });
const EXPORT_TIMEOUT_MS = 120_000;

async function openSaveDialog(defaultDir: string, defaultName: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const script =
      'POSIX path of (choose file name ' +
      'with prompt "Export document" ' +
      `default name ${JSON.stringify(defaultName)} ` +
      `default location POSIX file ${JSON.stringify(defaultDir)})`;

    execFile('osascript', ['-e', script], { timeout: 60_000 }, (error, stdout) => {
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

function isAbsolutePath(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('/');
}

function classifyValidationError(body: unknown) {
  const candidate = body as Partial<{
    path: string;
    savePath: string;
    format: string;
  }> | null;

  if (!isAbsolutePath(candidate?.path) || !isAbsolutePath(candidate?.savePath)) {
    return toApiError(ErrorCode.INVALID_PATH, 'Path must be absolute');
  }

  return toApiError(ErrorCode.INVALID_FORMAT, 'Format must be one of pdf, docx, or html');
}

export async function exportRoutes(app: FastifyInstance, opts: ExportRoutesOptions) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const sessionService = opts.sessionService ?? new SessionService(opts.sessionDir);
  const renderService = await RenderService.create();
  const exportService = new ExportService(
    new FileService(),
    renderService,
    new MermaidSsrService(),
    new AssetService(),
    new PdfService(),
    new DocxService(),
    new HtmlExportService(),
  );

  typedApp.post(
    '/api/export',
    {
      attachValidation: true,
      config: {
        timeout: EXPORT_TIMEOUT_MS,
      },
      schema: {
        body: ExportRequestSchema,
        response: {
          200: ExportResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          413: ErrorResponseSchema,
          415: ErrorResponseSchema,
          500: ErrorResponseSchema,
          507: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send(classifyValidationError(request.body));
      }

      try {
        return await exportService.export(request.body);
      } catch (error) {
        if (error instanceof ExportInProgressError) {
          return reply.code(409).send(toApiError(ErrorCode.EXPORT_IN_PROGRESS, error.message));
        }

        if (error instanceof InvalidPathError || error instanceof NotFileError) {
          return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, error.message));
        }

        if (error instanceof NotMarkdownError) {
          return reply.code(415).send(toApiError(ErrorCode.NOT_MARKDOWN, error.message));
        }

        if (error instanceof FileTooLargeError) {
          return reply.code(413).send(toApiError(ErrorCode.FILE_TOO_LARGE, error.message));
        }

        if (isPermissionError(error)) {
          return reply
            .code(403)
            .send(
              toApiError(ErrorCode.PERMISSION_DENIED, 'You do not have permission to export here.'),
            );
        }

        if (isNotFoundError(error)) {
          return reply
            .code(404)
            .send(toApiError(ErrorCode.FILE_NOT_FOUND, 'The requested file no longer exists.'));
        }

        if (isInsufficientStorageError(error)) {
          return reply
            .code(507)
            .send(
              toApiError(
                ErrorCode.INSUFFICIENT_STORAGE,
                'There is not enough free space to complete this export.',
              ),
            );
        }

        return reply
          .code(500)
          .send(toApiError(ErrorCode.EXPORT_ERROR, 'The export could not be completed.'));
      }
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
      attachValidation: true,
      schema: {
        body: RevealRequestSchema,
        response: {
          200: RevealResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, 'Path must be absolute'));
      }

      execFile('open', ['-R', request.body.path]);
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
