import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import {
  AddWorkspaceRequestSchema,
  AppBootstrapResponseSchema,
  ErrorResponseSchema,
  RemoveRecentFileRequestSchema,
  RemoveWorkspaceRequestSchema,
  SessionStateSchema,
  SetRootRequestSchema,
  SetThemeRequestSchema,
  TouchRecentFileRequestSchema,
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

  app.get(
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

  app.put(
    '/api/session/root',
    {
      schema: {
        body: SetRootRequestSchema,
        response: {
          200: SessionStateSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { root } = SetRootRequestSchema.parse(request.body);

      try {
        await stat(root);
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

  app.post(
    '/api/session/workspaces',
    {
      schema: {
        body: AddWorkspaceRequestSchema,
        response: {
          200: SessionStateSchema,
        },
      },
    },
    async (request) => {
      const { path } = AddWorkspaceRequestSchema.parse(request.body);
      return sessionService.addWorkspace(path);
    },
  );

  app.delete(
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
      const { path } = RemoveWorkspaceRequestSchema.parse(request.body);
      return sessionService.removeWorkspace(path);
    },
  );

  app.put(
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
      const { theme } = SetThemeRequestSchema.parse(request.body);

      if (!themeRegistry.isValid(theme)) {
        return reply
          .code(400)
          .send(toApiError(ErrorCode.INVALID_THEME, 'The requested theme does not exist.'));
      }

      return sessionService.setTheme(theme);
    },
  );

  app.put(
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
      const { workspacesCollapsed } = UpdateSidebarRequestSchema.parse(request.body);
      return sessionService.updateSidebar(workspacesCollapsed);
    },
  );

  app.post(
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
      const { path } = TouchRecentFileRequestSchema.parse(request.body);
      return sessionService.touchRecentFile(path);
    },
  );

  app.delete(
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
      const { path } = RemoveRecentFileRequestSchema.parse(request.body);
      return sessionService.removeRecentFile(path);
    },
  );
}
