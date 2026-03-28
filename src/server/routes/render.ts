import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  RenderFromContentRequestSchema,
  RenderFromContentResponseSchema,
} from '../../shared/contracts/index.js';
import { RenderService } from '../services/render.service.js';

export async function renderRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const renderService = await RenderService.create();

  typedApp.post(
    '/api/render',
    {
      schema: {
        body: RenderFromContentRequestSchema,
        response: {
          200: RenderFromContentResponseSchema,
        },
      },
    },
    async (request) => {
      return renderService.render(request.body.content, request.body.documentPath);
    },
  );
}
