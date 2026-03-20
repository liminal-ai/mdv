import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../src/server/app.js';
import { startServer } from '../../../src/server/index.js';
import { SessionService } from '../../../src/server/services/session.service.js';
import { corruptedSessionJson, emptySession } from '../../fixtures/session.js';
import { createTempDir, removeTempDir } from '../../utils/tmp.js';

const SESSION_FILE = 'session.json';

async function writeSessionFile(sessionDir: string, session: unknown): Promise<void> {
  await mkdir(sessionDir, { recursive: true });
  await writeFile(sessionFilePath(sessionDir), `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

async function writeRawSessionFile(sessionDir: string, contents: string): Promise<void> {
  await mkdir(sessionDir, { recursive: true });
  await writeFile(sessionFilePath(sessionDir), contents, 'utf8');
}

async function readSessionFile(sessionDir: string) {
  const raw = await readFile(sessionFilePath(sessionDir), 'utf8');
  return JSON.parse(raw) as {
    workspaces: Array<{ path: string; label: string; addedAt: string }>;
    lastRoot: string | null;
    recentFiles: Array<{ path: string; openedAt: string }>;
    theme: string;
    sidebarState: { workspacesCollapsed: boolean };
  };
}

function sessionFilePath(sessionDir: string): string {
  return path.join(sessionDir, SESSION_FILE);
}

async function createPopulatedPaths(baseDir: string) {
  const workspaceA = path.join(baseDir, 'alpha');
  const workspaceB = path.join(baseDir, 'beta');
  const root = path.join(baseDir, 'root');
  const recentFile = path.join(root, 'README.md');

  await mkdir(workspaceA, { recursive: true });
  await mkdir(workspaceB, { recursive: true });
  await mkdir(root, { recursive: true });
  await writeFile(recentFile, '# MD Viewer\n', 'utf8');

  return {
    workspaceA,
    workspaceB,
    root,
    recentFile,
  };
}

function createFakeApp() {
  return {
    listen: vi.fn<FastifyInstance['listen']>(),
  } as unknown as FastifyInstance;
}

describe('session routes', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();

    await Promise.all(tempDirs.splice(0).map((dir) => removeTempDir(dir)));
  });

  it('TC-1.1a: First launch with no prior session returns default session with available themes', async () => {
    const sessionDir = path.join(await createTempDir(), 'session');
    tempDirs.push(path.dirname(sessionDir));
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      session: emptySession,
      availableThemes: expect.arrayContaining([
        expect.objectContaining({ id: 'light-default' }),
        expect.objectContaining({ id: 'light-warm' }),
        expect.objectContaining({ id: 'dark-default' }),
        expect.objectContaining({ id: 'dark-cool' }),
      ]),
    });

    await app.close();
  });

  it('TC-1.1b: Server binds to localhost only', async () => {
    const app = createFakeApp();
    app.listen = vi.fn().mockResolvedValue('http://127.0.0.1:3000');
    const openUrl = vi.fn().mockResolvedValue(undefined);

    await startServer({
      buildApp: vi.fn().mockResolvedValue(app),
      openUrl,
      log: { log: vi.fn(), error: vi.fn() },
    });

    expect(app.listen).toHaveBeenCalledWith({ port: 3000, host: '127.0.0.1' });
    expect(openUrl).toHaveBeenCalledWith('http://localhost:3000');
  });

  it('TC-1.1c: Port conflict fallback retries on an ephemeral port', async () => {
    const app = createFakeApp();
    const portInUse = Object.assign(new Error('Port already in use'), { code: 'EADDRINUSE' });
    app.listen = vi
      .fn()
      .mockRejectedValueOnce(portInUse)
      .mockResolvedValueOnce('http://127.0.0.1:43123');

    await startServer({
      buildApp: vi.fn().mockResolvedValue(app),
      openUrl: vi.fn().mockResolvedValue(undefined),
      log: { log: vi.fn(), error: vi.fn() },
    });

    expect(app.listen).toHaveBeenNthCalledWith(1, { port: 3000, host: '127.0.0.1' });
    expect(app.listen).toHaveBeenNthCalledWith(2, { port: 0, host: '127.0.0.1' });
  });

  it('TC-1.2a: Session with saved workspaces and root restored', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const paths = await createPopulatedPaths(sessionDir);
    await writeSessionFile(sessionDir, {
      workspaces: [
        { path: paths.workspaceA, label: 'alpha', addedAt: '2026-03-01T00:00:00.000Z' },
        { path: paths.workspaceB, label: 'beta', addedAt: '2026-03-02T00:00:00.000Z' },
      ],
      lastRoot: paths.root,
      recentFiles: [{ path: paths.recentFile, openedAt: '2026-03-03T00:00:00.000Z' }],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.statusCode).toBe(200);
    expect(response.json().session).toMatchObject({
      workspaces: [
        { path: paths.workspaceA, label: 'alpha' },
        { path: paths.workspaceB, label: 'beta' },
      ],
      lastRoot: paths.root,
    });

    await app.close();
  });

  it('TC-1.2b: Session with workspaces but no root is restored', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const paths = await createPopulatedPaths(sessionDir);
    await writeSessionFile(sessionDir, {
      workspaces: [{ path: paths.workspaceA, label: 'alpha', addedAt: '2026-03-01T00:00:00.000Z' }],
      lastRoot: null,
      recentFiles: [],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.statusCode).toBe(200);
    expect(response.json().session.lastRoot).toBeNull();
    expect(response.json().session.workspaces).toHaveLength(1);

    await app.close();
  });

  it('TC-1.2c: Corrupted session file resets to defaults', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    await writeRawSessionFile(sessionDir, corruptedSessionJson);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });
    const persisted = await readSessionFile(sessionDir);

    expect(response.statusCode).toBe(200);
    expect(response.json().session).toEqual(emptySession);
    expect(persisted).toEqual(emptySession);

    await app.close();
  });

  it('TC-1.2d: Theme restored from session', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const paths = await createPopulatedPaths(sessionDir);
    await writeSessionFile(sessionDir, {
      workspaces: [],
      lastRoot: paths.root,
      recentFiles: [],
      theme: 'dark-cool',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.json().session.theme).toBe('dark-cool');

    await app.close();
  });

  it('TC-3.3a: Switch root via PUT', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const root = path.join(sessionDir, 'project-root');
    await mkdir(root, { recursive: true });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/root',
      payload: { root },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().lastRoot).toBe(root);

    await app.close();
  });

  it('TC-3.3c: Switch to deleted workspace path returns 404', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/root',
      payload: { root: path.join(sessionDir, 'missing-root') },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'PATH_NOT_FOUND',
        message: 'The selected folder no longer exists.',
      },
    });

    await app.close();
  });

  it('PUT /api/session/root rejects file paths with 400 INVALID_PATH', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const filePath = path.join(sessionDir, 'README.md');
    await writeFile(filePath, '# not a directory\n', 'utf8');
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/root',
      payload: { root: filePath },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Path is not a directory',
      },
    });

    await app.close();
  });

  it('TC-3.4a: Remove workspace', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const paths = await createPopulatedPaths(sessionDir);
    await writeSessionFile(sessionDir, {
      workspaces: [
        { path: paths.workspaceA, label: 'alpha', addedAt: '2026-03-01T00:00:00.000Z' },
        { path: paths.workspaceB, label: 'beta', addedAt: '2026-03-02T00:00:00.000Z' },
      ],
      lastRoot: paths.root,
      recentFiles: [],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/session/workspaces',
      payload: { path: paths.workspaceA },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workspaces).toEqual([
      expect.objectContaining({ path: paths.workspaceB, label: 'beta' }),
    ]);

    await app.close();
  });

  it("TC-3.4c: Removing the active workspace doesn't clear the root", async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const root = path.join(sessionDir, 'active-root');
    await mkdir(root, { recursive: true });
    await writeSessionFile(sessionDir, {
      workspaces: [{ path: root, label: 'active-root', addedAt: '2026-03-01T00:00:00.000Z' }],
      lastRoot: root,
      recentFiles: [],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/session/workspaces',
      payload: { path: root },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workspaces).toEqual([]);
    expect(response.json().lastRoot).toBe(root);

    await app.close();
  });

  it('TC-4.3a: Pin new workspace', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const workspace = path.join(sessionDir, 'workspace');
    await mkdir(workspace, { recursive: true });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'POST',
      url: '/api/session/workspaces',
      payload: { path: workspace },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workspaces).toEqual([
      expect.objectContaining({
        path: workspace,
        label: 'workspace',
        addedAt: expect.any(String),
      }),
    ]);
    expect(Number.isNaN(Date.parse(response.json().workspaces[0].addedAt))).toBe(false);

    await app.close();
  });

  it('TC-4.3b: Pin already-saved workspace is a no-op', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const workspace = path.join(sessionDir, 'workspace');
    await mkdir(workspace, { recursive: true });
    await writeSessionFile(sessionDir, {
      workspaces: [{ path: workspace, label: 'workspace', addedAt: '2026-03-01T00:00:00.000Z' }],
      lastRoot: null,
      recentFiles: [],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'POST',
      url: '/api/session/workspaces',
      payload: { path: workspace },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workspaces).toEqual([
      { path: workspace, label: 'workspace', addedAt: '2026-03-01T00:00:00.000Z' },
    ]);

    await app.close();
  });

  it('POST /api/session/workspaces returns 404 when the path does not exist', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'POST',
      url: '/api/session/workspaces',
      payload: { path: path.join(sessionDir, 'missing-workspace') },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'PATH_NOT_FOUND',
        message: 'The selected folder no longer exists.',
      },
    });

    await app.close();
  });

  it('POST /api/session/workspaces returns 400 INVALID_PATH for relative paths', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'POST',
      url: '/api/session/workspaces',
      payload: { path: 'relative/path' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Path must be absolute',
      },
    });

    await app.close();
  });

  it('POST /api/session/workspaces returns 400 when the path is a file', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const filePath = path.join(sessionDir, 'workspace.md');
    await writeFile(filePath, '# not a directory\n', 'utf8');
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'POST',
      url: '/api/session/workspaces',
      payload: { path: filePath },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Path is not a directory',
      },
    });

    await app.close();
  });

  it('TC-7.2a: Set theme', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/theme',
      payload: { theme: 'dark-default' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().theme).toBe('dark-default');

    await app.close();
  });

  it('TC-7.3a: Theme persists after reload', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    await app.inject({
      method: 'PUT',
      url: '/api/session/theme',
      payload: { theme: 'light-warm' },
    });
    await app.close();

    const reloadedApp = await buildApp({ sessionDir });
    const response = await reloadedApp.inject({ method: 'GET', url: '/api/session' });

    expect(response.json().session.theme).toBe('light-warm');

    await reloadedApp.close();
  });

  it('TC-8.1a: Workspaces restored in insertion order', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const workspaces = ['alpha', 'beta', 'gamma'].map((name) => path.join(sessionDir, name));
    await Promise.all(workspaces.map((workspace) => mkdir(workspace, { recursive: true })));
    const app = await buildApp({ sessionDir });

    for (const workspace of workspaces) {
      await app.inject({
        method: 'POST',
        url: '/api/session/workspaces',
        payload: { path: workspace },
      });
    }

    await app.close();

    const reloadedApp = await buildApp({ sessionDir });
    const response = await reloadedApp.inject({ method: 'GET', url: '/api/session' });

    expect(
      response.json().session.workspaces.map((workspace: { path: string }) => workspace.path),
    ).toEqual(workspaces);

    await reloadedApp.close();
  });

  it('TC-8.2a: Root restored', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const root = path.join(sessionDir, 'root');
    await mkdir(root, { recursive: true });
    const app = await buildApp({ sessionDir });

    await app.inject({
      method: 'PUT',
      url: '/api/session/root',
      payload: { root },
    });
    await app.close();

    const reloadedApp = await buildApp({ sessionDir });
    const response = await reloadedApp.inject({ method: 'GET', url: '/api/session' });

    expect(response.json().session.lastRoot).toBe(root);

    await reloadedApp.close();
  });

  it('TC-8.2b: Deleted persisted root is healed on load and rewritten', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    await writeSessionFile(sessionDir, {
      workspaces: [],
      lastRoot: path.join(sessionDir, 'missing-root'),
      recentFiles: [],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });
    const persisted = await readSessionFile(sessionDir);

    expect(response.json().session.lastRoot).toBeNull();
    expect(persisted.lastRoot).toBeNull();

    await app.close();
  });

  it('TC-3.1c: Sidebar collapse state persists', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    await app.inject({
      method: 'PUT',
      url: '/api/session/sidebar',
      payload: { workspacesCollapsed: true },
    });
    await app.close();

    const reloadedApp = await buildApp({ sessionDir });
    const response = await reloadedApp.inject({ method: 'GET', url: '/api/session' });

    expect(response.json().session.sidebarState.workspacesCollapsed).toBe(true);

    await reloadedApp.close();
  });

  it('TC-8.3a: Recent files restored', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const paths = await createPopulatedPaths(sessionDir);
    await writeSessionFile(sessionDir, {
      workspaces: [],
      lastRoot: paths.root,
      recentFiles: [{ path: paths.recentFile, openedAt: '2026-03-03T00:00:00.000Z' }],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.json().session.recentFiles).toEqual([
      { path: paths.recentFile, openedAt: '2026-03-03T00:00:00.000Z' },
    ]);

    await app.close();
  });

  it('TC-8.3b: Stale recent file removed during bootstrap', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const paths = await createPopulatedPaths(sessionDir);
    await writeSessionFile(sessionDir, {
      workspaces: [],
      lastRoot: paths.root,
      recentFiles: [
        { path: paths.recentFile, openedAt: '2026-03-03T00:00:00.000Z' },
        { path: '/nonexistent/stale-file.md', openedAt: '2026-03-02T00:00:00.000Z' },
      ],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.json().session.recentFiles).toEqual([
      { path: paths.recentFile, openedAt: '2026-03-03T00:00:00.000Z' },
    ]);

    const persisted = await readSessionFile(sessionDir);
    expect(persisted.recentFiles).toEqual([
      { path: paths.recentFile, openedAt: '2026-03-03T00:00:00.000Z' },
    ]);

    await app.close();
  });

  it('Invalid theme id is rejected with 400', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/theme',
      payload: { theme: 'made-up-theme' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_THEME',
        message: 'The requested theme does not exist.',
      },
    });

    await app.close();
  });

  it('Non-absolute path is rejected with 400', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/root',
      payload: { root: 'relative/path' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Path must be absolute',
      },
    });

    await app.close();
  });

  it('Session writes are atomic via writeFile then rename', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const fileSystem = {
      mkdir: vi.fn(fs.mkdir),
      readFile: vi.fn(fs.readFile),
      rename: vi.fn(fs.rename),
      stat: vi.fn(fs.stat),
      writeFile: vi.fn(fs.writeFile),
    };
    const service = new SessionService(sessionDir, fileSystem);

    await service.addWorkspace('/tmp/project');

    expect(fileSystem.writeFile).toHaveBeenCalled();
    expect(fileSystem.rename).toHaveBeenCalled();
    expect(String(fileSystem.writeFile.mock.calls.at(-1)?.[0])).toContain('.tmp');
    expect(fileSystem.rename.mock.calls.at(-1)).toEqual([
      expect.stringContaining('.tmp'),
      sessionFilePath(sessionDir),
    ]);
    expect(fileSystem.writeFile.mock.invocationCallOrder.at(-1)).toBeLessThan(
      fileSystem.rename.mock.invocationCallOrder.at(-1) ?? Number.POSITIVE_INFINITY,
    );
  });

  it('Touch recent file adds a new entry', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'POST',
      url: '/api/session/recent-files',
      payload: { path: '/tmp/notes.md' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().recentFiles).toEqual([
      expect.objectContaining({ path: '/tmp/notes.md', openedAt: expect.any(String) }),
    ]);
    expect(Number.isNaN(Date.parse(response.json().recentFiles[0].openedAt))).toBe(false);

    await app.close();
  });

  it('Touch existing recent file updates openedAt and moves it to the front', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    await writeSessionFile(sessionDir, {
      workspaces: [],
      lastRoot: null,
      recentFiles: [
        { path: '/tmp/old.md', openedAt: '2026-03-18T00:00:00.000Z' },
        { path: '/tmp/newer.md', openedAt: '2026-03-19T00:00:00.000Z' },
      ],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    await new Promise((resolve) => setTimeout(resolve, 10));
    const response = await app.inject({
      method: 'POST',
      url: '/api/session/recent-files',
      payload: { path: '/tmp/old.md' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().recentFiles[0].path).toBe('/tmp/old.md');
    expect(response.json().recentFiles[1]).toEqual({
      path: '/tmp/newer.md',
      openedAt: '2026-03-19T00:00:00.000Z',
    });
    expect(response.json().recentFiles[0].openedAt).not.toBe('2026-03-18T00:00:00.000Z');
    expect(Date.parse(response.json().recentFiles[0].openedAt)).toBeGreaterThan(
      Date.parse('2026-03-19T00:00:00.000Z'),
    );

    await app.close();
  });

  it('Remove recent file deletes the entry', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    await writeSessionFile(sessionDir, {
      workspaces: [],
      lastRoot: null,
      recentFiles: [
        { path: '/tmp/remove-me.md', openedAt: '2026-03-18T00:00:00.000Z' },
        { path: '/tmp/keep-me.md', openedAt: '2026-03-19T00:00:00.000Z' },
      ],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/session/recent-files',
      payload: { path: '/tmp/remove-me.md' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().recentFiles).toEqual([
      { path: '/tmp/keep-me.md', openedAt: '2026-03-19T00:00:00.000Z' },
    ]);

    await app.close();
  });

  it('Bootstrap includes all available themes', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.statusCode).toBe(200);
    expect(response.json().availableThemes).toHaveLength(4);

    await app.close();
  });

  it('First launch creates the session directory', async () => {
    const baseDir = await createTempDir();
    tempDirs.push(baseDir);
    const sessionDir = path.join(baseDir, 'app-support', 'session-store');
    const app = await buildApp({ sessionDir });

    await app.inject({ method: 'GET', url: '/api/session' });

    await expect(stat(sessionDir)).resolves.toBeDefined();
    await app.close();
  });
});
