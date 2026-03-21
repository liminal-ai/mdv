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
import { openSaveDialog } from '../utils/save-dialog.js';
import {
  ErrorCode,
  ExportInProgressError,
  ExportInsufficientStorageError,
  ExportWriteError,
  ExportWritePermissionError,
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
const SAVE_DIALOG_TIMEOUT_MS = 70_000;

function execFileAsync(
  file: string,
  args: string[],
  options: { timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
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

        if (error instanceof ExportWritePermissionError) {
          return reply.code(403).send(toApiError(ErrorCode.PERMISSION_DENIED, error.message));
        }

        if (error instanceof ExportInsufficientStorageError) {
          return reply.code(507).send(toApiError(ErrorCode.INSUFFICIENT_STORAGE, error.message));
        }

        if (error instanceof ExportWriteError) {
          return reply.code(500).send(toApiError(ErrorCode.EXPORT_ERROR, error.message));
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
              toApiError(
                ErrorCode.PERMISSION_DENIED,
                `Could not read source file ${request.body.path}: permission denied.`,
              ),
            );
        }

        if (isNotFoundError(error)) {
          return reply
            .code(404)
            .send(
              toApiError(ErrorCode.FILE_NOT_FOUND, `Source file not found: ${request.body.path}`),
            );
        }

        if (isInsufficientStorageError(error)) {
          return reply
            .code(507)
            .send(
              toApiError(
                ErrorCode.INSUFFICIENT_STORAGE,
                `Could not write export to ${request.body.savePath}: insufficient disk space.`,
              ),
            );
        }

        return reply
          .code(500)
          .send(
            toApiError(
              ErrorCode.EXPORT_ERROR,
              `Export failed for ${request.body.savePath}: ${
                error instanceof Error ? error.message : 'Unknown export error'
              }`,
            ),
          );
      }
    },
  );

  typedApp.post(
    '/api/export/save-dialog',
    {
      config: {
        timeout: SAVE_DIALOG_TIMEOUT_MS,
      },
      schema: {
        body: SaveDialogRequestSchema,
        response: {
          200: SaveDialogResponseSchema,
        },
      },
    },
    async (request) => {
      const selected = await openSaveDialog(
        request.body.defaultPath,
        request.body.defaultFilename,
        request.body.prompt ?? 'Export document',
      );
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
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, 'Path must be absolute'));
      }

      try {
        await execFileAsync('open', ['-R', request.body.path], { timeout: 15_000 });
        return { ok: true as const };
      } catch (error) {
        return reply
          .code(500)
          .send(
            toApiError(
              ErrorCode.EXPORT_ERROR,
              `Could not reveal exported file in Finder: ${
                error instanceof Error ? error.message : request.body.path
              }`,
            ),
          );
      }
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
