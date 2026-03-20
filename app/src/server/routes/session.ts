import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  AddWorkspaceRequestSchema,
  AppBootstrapResponseSchema,
  ErrorResponseSchema,
  RemoveRecentFileRequestSchema,
  RemoveWorkspaceRequestSchema,
  SessionStateSchema,
  SetDefaultModeRequestSchema,
  SetRootRequestSchema,
  SetThemeRequestSchema,
  TouchRecentFileRequestSchema,
  UpdateTabsRequestSchema,
  UpdateSidebarRequestSchema,
} from '../schemas/index.js';
import { SessionService } from '../services/session.service.js';
import { themeRegistry } from '../services/theme-registry.js';
import { ErrorCode, isNotFoundError, isPermissionError, toApiError } from '../utils/errors.js';

export interface SessionRoutesOptions {
  sessionService?: SessionService;
  sessionDir?: string;
}

export async function sessionRoutes(app: FastifyInstance, opts: SessionRoutesOptions) {
  const sessionService = opts.sessionService ?? new SessionService(opts.sessionDir);
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/api/session',
    {
      schema: {
        response: {
          200: AppBootstrapResponseSchema,
        },
      },
    },
    async () => ({
      session: await sessionService.load(),
      availableThemes: themeRegistry.getAll(),
    }),
  );

  typedApp.put(
    '/api/session/root',
    {
      attachValidation: true,
      schema: {
        body: SetRootRequestSchema,
        response: {
          200: SessionStateSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, 'Path must be absolute'));
      }

      const { root } = request.body;

      try {
        const rootStat = await stat(root);

        if (!rootStat.isDirectory()) {
          return reply
            .code(400)
            .send(toApiError(ErrorCode.INVALID_PATH, 'Path is not a directory'));
        }
      } catch (error) {
        if (isPermissionError(error)) {
          return reply
            .code(403)
            .send(
              toApiError(
                ErrorCode.PERMISSION_DENIED,
                'You do not have permission to access this folder.',
              ),
            );
        }

        if (isNotFoundError(error)) {
          return reply
            .code(404)
            .send(toApiError(ErrorCode.PATH_NOT_FOUND, 'The selected folder no longer exists.'));
        }

        throw error;
      }

      return sessionService.setRoot(root);
    },
  );

  typedApp.post(
    '/api/session/workspaces',
    {
      attachValidation: true,
      schema: {
        body: AddWorkspaceRequestSchema,
        response: {
          200: SessionStateSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, 'Path must be absolute'));
      }

      const { path } = request.body;

      try {
        const workspaceStat = await stat(path);

        if (!workspaceStat.isDirectory()) {
          return reply
            .code(400)
            .send(toApiError(ErrorCode.INVALID_PATH, 'Path is not a directory'));
        }
      } catch (error) {
        if (isNotFoundError(error)) {
          return reply
            .code(404)
            .send(toApiError(ErrorCode.PATH_NOT_FOUND, 'The selected folder no longer exists.'));
        }

        throw error;
      }

      return sessionService.addWorkspace(path);
    },
  );

  typedApp.delete(
    '/api/session/workspaces',
    {
      schema: {
        body: RemoveWorkspaceRequestSchema,
        response: {
          200: SessionStateSchema,
        },
      },
    },
    async (request) => {
      const { path } = request.body;
      return sessionService.removeWorkspace(path);
    },
  );

  typedApp.put(
    '/api/session/theme',
    {
      schema: {
        body: SetThemeRequestSchema,
        response: {
          200: SessionStateSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { theme } = request.body;

      if (!themeRegistry.isValid(theme)) {
        return reply
          .code(400)
          .send(toApiError(ErrorCode.INVALID_THEME, 'The requested theme does not exist.'));
      }

      return sessionService.setTheme(theme);
    },
  );

  typedApp.put(
    '/api/session/default-mode',
    {
      schema: {
        body: SetDefaultModeRequestSchema,
        response: {
          200: SessionStateSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) =>
      reply
        .code(501)
        .send(
          toApiError('NOT_IMPLEMENTED', 'PUT /api/session/default-mode is not implemented yet.'),
        ),
  );

  typedApp.put(
    '/api/session/tabs',
    {
      schema: {
        body: UpdateTabsRequestSchema,
        response: {
          200: SessionStateSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) =>
      reply
        .code(501)
        .send(toApiError('NOT_IMPLEMENTED', 'PUT /api/session/tabs is not implemented yet.')),
  );

  typedApp.put(
    '/api/session/sidebar',
    {
      schema: {
        body: UpdateSidebarRequestSchema,
        response: {
          200: SessionStateSchema,
        },
      },
    },
    async (request) => {
      const { workspacesCollapsed } = request.body;
      return sessionService.updateSidebar(workspacesCollapsed);
    },
  );

  typedApp.post(
    '/api/session/recent-files',
    {
      schema: {
        body: TouchRecentFileRequestSchema,
        response: {
          200: SessionStateSchema,
        },
      },
    },
    async (request) => {
      const { path } = request.body;
      return sessionService.touchRecentFile(path);
    },
  );

  typedApp.delete(
    '/api/session/recent-files',
    {
      schema: {
        body: RemoveRecentFileRequestSchema,
        response: {
          200: SessionStateSchema,
        },
      },
    },
    async (request) => {
      const { path } = request.body;
      return sessionService.removeRecentFile(path);
    },
  );
}
