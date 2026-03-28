import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { AbsolutePathSchema } from '../schemas/index.js';
import { BrowseService } from '../services/browse.service.js';

const BrowseResponseSchema = z.union([z.object({ path: AbsolutePathSchema }), z.null()]);

export interface BrowseRoutesOptions {
  browseService?: BrowseService;
}

export async function browseRoutes(app: FastifyInstance, opts: BrowseRoutesOptions) {
  const browseService = opts.browseService ?? new BrowseService();

  app.post(
    '/api/browse',
    {
      schema: {
        response: {
          200: BrowseResponseSchema,
        },
      },
    },
    async () => {
      const selectedPath = await browseService.openFolderPicker();
      return selectedPath ? { path: selectedPath } : null;
    },
  );
}
