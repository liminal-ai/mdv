import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ErrorResponseSchema } from '../schemas/index.js';
import {
  PackageCreateRequestSchema,
  PackageCreateResponseSchema,
  PackageExportRequestSchema,
  PackageExportResponseSchema,
  PackageManifestResponseSchema,
  PackageOpenRequestSchema,
  PackageOpenResponseSchema,
} from '../schemas/package.js';
import type { PackageService } from '../services/package.service.js';
import { toApiError } from '../utils/errors.js';

export interface PackageRoutesOptions {
  packageService: PackageService;
}

const NotImplementedResponse = toApiError('NOT_IMPLEMENTED', 'Not implemented');

export async function packageRoutes(app: FastifyInstance, opts: PackageRoutesOptions) {
  const { packageService } = opts;
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  void packageService;

  typedApp.post(
    '/api/package/open',
    {
      schema: {
        body: PackageOpenRequestSchema,
        response: {
          200: PackageOpenResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => reply.code(501).send(NotImplementedResponse),
  );

  typedApp.get(
    '/api/package/manifest',
    {
      schema: {
        response: {
          200: PackageManifestResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => reply.code(501).send(NotImplementedResponse),
  );

  typedApp.post(
    '/api/package/create',
    {
      schema: {
        body: PackageCreateRequestSchema,
        response: {
          200: PackageCreateResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => reply.code(501).send(NotImplementedResponse),
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
