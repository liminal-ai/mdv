import { execFile } from 'node:child_process';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  ErrorResponseSchema,
  FilePickerResponseSchema,
  FileReadRequestSchema,
  FileReadResponseSchema,
  FileSaveRequestSchema,
  FileSaveResponseSchema,
} from '../schemas/index.js';
import { FileService } from '../services/file.service.js';
import { RenderService } from '../services/render.service.js';
import {
  ConflictError,
  ErrorCode,
  FileTooLargeError,
  InvalidPathError,
  NotFileError,
  NotMarkdownError,
  PathNotFoundError,
  ReadTimeoutError,
  isInsufficientStorageError,
  isNotFoundError,
  isPermissionError,
  toApiError,
} from '../utils/errors.js';

const FILE_PICKER_COMMAND =
  'POSIX path of (choose file of type {"md", "markdown"} with prompt "Open Markdown File")';
const FILE_PICKER_TIMEOUT_MS = 60_000;

function execOsascript(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'osascript',
      ['-e', command],
      { timeout: FILE_PICKER_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({ stdout, stderr });
      },
    );
  });
}

export async function fileRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const fileService = new FileService();
  const renderService = await RenderService.create();

  typedApp.get(
    '/api/file',
    {
      attachValidation: true,
      schema: {
        querystring: FileReadRequestSchema,
        response: {
          200: FileReadResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          413: ErrorResponseSchema,
          415: ErrorResponseSchema,
          504: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, 'Path must be absolute'));
      }

      try {
        const file = await fileService.readFile(request.query.path);
        const renderResult = renderService.render(file.content, request.query.path);
        return {
          path: file.path,
          canonicalPath: file.canonicalPath,
          filename: file.filename,
          content: file.content,
          html: renderResult.html,
          warnings: renderResult.warnings,
          modifiedAt: file.modifiedAt.toISOString(),
          size: file.size,
        };
      } catch (error) {
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
                'You do not have permission to read this file.',
              ),
            );
        }

        if (isNotFoundError(error)) {
          return reply
            .code(404)
            .send(toApiError(ErrorCode.FILE_NOT_FOUND, 'The requested file no longer exists.'));
        }

        if (error instanceof ReadTimeoutError) {
          return reply.code(504).send(toApiError(ErrorCode.READ_TIMEOUT, error.message));
        }

        return reply
          .code(500)
          .send(toApiError(ErrorCode.READ_ERROR, 'Failed to read the requested file.'));
      }
    },
  );

  typedApp.put(
    '/api/file',
    {
      attachValidation: true,
      schema: {
        body: FileSaveRequestSchema,
        response: {
          200: FileSaveResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          415: ErrorResponseSchema,
          500: ErrorResponseSchema,
          507: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, 'Path must be absolute'));
      }

      try {
        return await fileService.writeFile(request.body);
      } catch (error) {
        if (error instanceof InvalidPathError || error instanceof NotFileError) {
          return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, error.message));
        }

        if (error instanceof NotMarkdownError) {
          return reply.code(415).send(toApiError(ErrorCode.NOT_MARKDOWN, error.message));
        }

        if (error instanceof PathNotFoundError) {
          return reply.code(404).send(toApiError(ErrorCode.PATH_NOT_FOUND, error.message));
        }

        if (error instanceof ConflictError) {
          return reply.code(409).send(toApiError(ErrorCode.CONFLICT, error.message));
        }

        if (isPermissionError(error)) {
          return reply
            .code(403)
            .send(
              toApiError(
                ErrorCode.PERMISSION_DENIED,
                error instanceof Error ? error.message : 'Permission denied',
              ),
            );
        }

        if (isInsufficientStorageError(error)) {
          return reply
            .code(507)
            .send(
              toApiError(
                ErrorCode.INSUFFICIENT_STORAGE,
                error instanceof Error ? error.message : 'Insufficient storage',
              ),
            );
        }

        return reply
          .code(500)
          .send(
            toApiError(
              ErrorCode.WRITE_ERROR,
              error instanceof Error ? error.message : 'Failed to save file',
            ),
          );
      }
    },
  );

  typedApp.post(
    '/api/file/pick',
    {
      schema: {
        response: {
          200: FilePickerResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        const { stdout } = await execOsascript(FILE_PICKER_COMMAND);
        return { path: stdout.trim() };
      } catch (error) {
        if (Number((error as { code?: number | string } | undefined)?.code) === 1) {
          return null;
        }

        return reply
          .code(500)
          .send(toApiError(ErrorCode.READ_ERROR, 'Failed to open the file picker.'));
      }
    },
  );
}
