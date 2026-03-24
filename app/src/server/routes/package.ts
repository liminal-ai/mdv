import { execFile } from 'node:child_process';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ErrorResponseSchema, FilePickerResponseSchema } from '../schemas/index.js';
import {
  PackageCreateRequestSchema,
  PackageCreateResponseSchema,
  PackageErrorCode,
  PackageExportRequestSchema,
  PackageExportResponseSchema,
  PackageManifestResponseSchema,
  PackageOpenRequestSchema,
  PackageOpenResponseSchema,
} from '../schemas/package.js';
import type { PackageService } from '../services/package.service.js';
import {
  ExtractionError,
  InvalidArchiveError,
  InvalidPathError,
  ManifestNotFoundError,
  ManifestParseError,
  ManifestExistsError,
  NoActivePackageError,
  PackageNotFoundError,
  isNotFoundError,
  toApiError,
} from '../utils/errors.js';

const PACKAGE_PICKER_COMMAND =
  'POSIX path of (choose file of type {"mpk", "mpkz"} with prompt "Open Package")';
const PACKAGE_PICKER_TIMEOUT_MS = 60_000;

function execOsascript(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'osascript',
      ['-e', command],
      { timeout: PACKAGE_PICKER_TIMEOUT_MS },
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

export interface PackageRoutesOptions {
  packageService: PackageService;
}

export async function packageRoutes(app: FastifyInstance, opts: PackageRoutesOptions) {
  const { packageService } = opts;
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/api/package/open',
    {
      attachValidation: true,
      schema: {
        body: PackageOpenRequestSchema,
        response: {
          200: PackageOpenResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply
          .code(400)
          .send(toApiError(PackageErrorCode.INVALID_FILE_PATH, 'Path must be absolute'));
      }

      try {
        return await packageService.open(request.body.filePath);
      } catch (error) {
        if (error instanceof PackageNotFoundError) {
          return reply.code(404).send(toApiError(PackageErrorCode.FILE_NOT_FOUND, error.message));
        }
        if (error instanceof InvalidArchiveError) {
          return reply.code(400).send(toApiError(PackageErrorCode.INVALID_ARCHIVE, error.message));
        }
        if (error instanceof ExtractionError) {
          return reply.code(500).send(toApiError(PackageErrorCode.EXTRACTION_ERROR, error.message));
        }

        return reply
          .code(500)
          .send(toApiError(PackageErrorCode.EXTRACTION_ERROR, 'Unexpected error opening package'));
      }
    },
  );

  typedApp.get(
    '/api/package/manifest',
    {
      schema: {
        response: {
          200: PackageManifestResponseSchema,
          422: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        return await packageService.getManifest();
      } catch (error) {
        if (error instanceof NoActivePackageError) {
          return reply
            .code(404)
            .send(toApiError(PackageErrorCode.NO_ACTIVE_PACKAGE, error.message));
        }

        if (error instanceof ManifestNotFoundError) {
          return reply
            .code(404)
            .send(toApiError(PackageErrorCode.MANIFEST_NOT_FOUND, error.message));
        }

        if (error instanceof ManifestParseError) {
          return reply
            .code(422)
            .send(toApiError(PackageErrorCode.MANIFEST_PARSE_ERROR, error.message));
        }

        return reply
          .code(500)
          .send(
            toApiError(PackageErrorCode.MANIFEST_PARSE_ERROR, 'Unexpected error loading manifest'),
          );
      }
    },
  );

  typedApp.post(
    '/api/package/create',
    {
      attachValidation: true,
      schema: {
        body: PackageCreateRequestSchema,
        response: {
          200: PackageCreateResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply
          .code(400)
          .send(toApiError(PackageErrorCode.INVALID_DIR_PATH, 'Path must be absolute'));
      }

      try {
        return await packageService.create(request.body.rootDir, request.body.overwrite);
      } catch (error) {
        if (error instanceof ManifestExistsError) {
          return reply.code(409).send(toApiError(PackageErrorCode.MANIFEST_EXISTS, error.message));
        }

        if (error instanceof InvalidPathError) {
          return reply.code(400).send(toApiError(PackageErrorCode.INVALID_DIR_PATH, error.message));
        }

        if (isNotFoundError(error)) {
          return reply
            .code(404)
            .send(
              toApiError(
                PackageErrorCode.DIR_NOT_FOUND,
                `Directory not found: ${request.body.rootDir}`,
              ),
            );
        }

        return reply
          .code(400)
          .send(
            toApiError(
              PackageErrorCode.INVALID_DIR_PATH,
              error instanceof Error ? error.message : 'Invalid directory',
            ),
          );
      }
    },
  );

  typedApp.post(
    '/api/package/export',
    {
      attachValidation: true,
      schema: {
        body: PackageExportRequestSchema,
        response: {
          200: PackageExportResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply
          .code(400)
          .send(toApiError(PackageErrorCode.INVALID_OUTPUT_PATH, 'Path must be absolute'));
      }

      try {
        const result = await packageService.export(
          request.body.outputPath,
          request.body.compress,
          request.body.sourceDir,
        );
        return result;
      } catch (err) {
        if (err instanceof InvalidPathError) {
          return reply
            .code(400)
            .send(toApiError(PackageErrorCode.INVALID_OUTPUT_PATH, err.message));
        }
        if (err instanceof NoActivePackageError) {
          return reply
            .code(400)
            .send(toApiError(PackageErrorCode.NO_SOURCE, 'No active root or package to export'));
        }
        if (
          err instanceof Error &&
          'code' in err &&
          ((err as NodeJS.ErrnoException).code === 'EPERM' ||
            (err as NodeJS.ErrnoException).code === 'EACCES')
        ) {
          return reply
            .code(500)
            .send(
              toApiError(
                PackageErrorCode.EXPORT_ERROR,
                `Permission denied: cannot write to ${request.body.outputPath}`,
              ),
            );
        }
        return reply
          .code(500)
          .send(
            toApiError(
              PackageErrorCode.EXPORT_ERROR,
              err instanceof Error ? err.message : 'Export failed',
            ),
          );
      }
    },
  );

  typedApp.post(
    '/api/package/pick',
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
        const { stdout } = await execOsascript(PACKAGE_PICKER_COMMAND);
        return { path: stdout.trim() };
      } catch (error) {
        if (Number((error as { code?: number | string } | undefined)?.code) === 1) {
          return null;
        }

        return reply
          .code(500)
          .send(
            toApiError(PackageErrorCode.EXTRACTION_ERROR, 'Failed to open the package picker.'),
          );
      }
    },
  );
}
