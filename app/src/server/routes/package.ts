import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ErrorResponseSchema } from '../schemas/index.js';
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

export interface PackageRoutesOptions {
  packageService: PackageService;
}

const NotImplementedResponse = toApiError('NOT_IMPLEMENTED', 'Not implemented');

export async function packageRoutes(app: FastifyInstance, opts: PackageRoutesOptions) {
  const { packageService } = opts;
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/api/package/open',
    {
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
          400: ErrorResponseSchema,
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
            .code(400)
            .send(toApiError(PackageErrorCode.MANIFEST_PARSE_ERROR, error.message));
        }

        return reply
          .code(500)
          .send(toApiError(PackageErrorCode.EXTRACTION_ERROR, 'Unexpected error loading manifest'));
      }
    },
  );

  typedApp.post(
    '/api/package/create',
    {
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
      schema: {
        body: PackageExportRequestSchema,
        response: {
          200: PackageExportResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => reply.code(501).send(NotImplementedResponse),
  );
}
