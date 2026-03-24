import type { Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: vi.fn(),
    readFile: vi.fn(),
    mkdtemp: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
  };
});

vi.mock('../../../src/pkg/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/pkg/index.js')>();
  return {
    ...actual,
    extractPackage: vi.fn(),
    parseManifest: vi.fn(),
    MANIFEST_FILENAME: '_nav.md',
  };
});

vi.mock('../../../src/server/plugins/static.js', () => ({
  staticPlugin: async () => {},
}));

import * as pkg from '../../../src/pkg/index.js';
import { buildApp } from '../../../src/server/app.js';
import { PackageService } from '../../../src/server/services/package.service.js';
import { TempDirManager } from '../../../src/server/services/temp-dir.service.js';
import { emptySession } from '../../fixtures/session.js';

const manifestContent = [
  '---',
  'title: Sample Package',
  'version: 1.0',
  'author: Test Author',
  '---',
  '',
  '- [Guide](guide.md)',
].join('\n');

const parsedManifest = {
  metadata: {
    title: 'Sample Package',
    version: '1.0',
    author: 'Test Author',
  },
  navigation: [{ displayName: 'Guide', filePath: 'guide.md', children: [], isGroup: false }],
  raw: manifestContent,
};

function makeFileStat(options: { size?: number; modifiedAt?: string } = {}): Stats {
  return {
    isFile: () => true,
    isDirectory: () => false,
    size: options.size ?? 128,
    mtime: new Date(options.modifiedAt ?? '2026-03-24T00:00:00.000Z'),
  } as Stats;
}

function makeDirStat(): Stats {
  return {
    isFile: () => false,
    isDirectory: () => true,
  } as Stats;
}

function createSessionService() {
  return {
    setActivePackage: vi.fn().mockResolvedValue({}),
  };
}

function createFullSessionService() {
  const state = { ...emptySession };

  return {
    getState: () => state,
    load: vi.fn().mockImplementation(async () => ({ ...state })),
    setRoot: vi.fn().mockImplementation(async (root: string) => {
      state.lastRoot = root;
      return { ...state };
    }),
    setActivePackage: vi.fn().mockImplementation(async (activePackage) => {
      state.activePackage = activePackage;
      return { ...state };
    }),
    addWorkspace: vi.fn().mockResolvedValue(state),
    removeWorkspace: vi.fn().mockResolvedValue(state),
    setTheme: vi.fn().mockResolvedValue(state),
    setDefaultMode: vi.fn().mockResolvedValue(state),
    updateTabs: vi.fn().mockResolvedValue(state),
    updateSidebar: vi.fn().mockResolvedValue(state),
    touchRecentFile: vi.fn().mockResolvedValue(state),
    removeRecentFile: vi.fn().mockResolvedValue(state),
  };
}

function createTempDirManager(tempDir = '/tmp/mdv-pkg-stale') {
  return {
    create: vi.fn().mockResolvedValue(tempDir),
    cleanup: vi.fn().mockResolvedValue(undefined),
    cleanupDir: vi.fn().mockResolvedValue(undefined),
    getActive: vi.fn().mockReturnValue(null),
    setActive: vi.fn(),
    cleanupStale: vi.fn().mockResolvedValue(undefined),
  };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
}

async function openPackage(service: PackageService) {
  vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
  vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
  vi.mocked(fs.readFile).mockResolvedValueOnce(manifestContent);
  vi.mocked(pkg.parseManifest).mockReturnValueOnce(parsedManifest);

  await service.open('/packages/sample.mpk');
}

async function buildOpenedApp(tempDir = '/tmp/mdv-pkg-stale') {
  const sessionService = createFullSessionService();
  const savedPath = `${tempDir}/guide.md`;

  vi.mocked(fs.mkdtemp).mockResolvedValue(tempDir);
  vi.mocked(fs.stat).mockImplementation(async (targetPath) => {
    const normalizedPath = String(targetPath);

    if (normalizedPath === '/packages/sample.mpk') {
      return makeFileStat();
    }

    if (normalizedPath === tempDir) {
      return makeDirStat();
    }

    if (normalizedPath === savedPath) {
      return makeFileStat({
        size: 256,
        modifiedAt: '2026-03-24T12:00:00.000Z',
      });
    }

    return makeFileStat();
  });
  vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
  vi.mocked(fs.readFile).mockResolvedValueOnce(manifestContent);
  vi.mocked(pkg.parseManifest).mockReturnValueOnce(parsedManifest);
  vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  vi.mocked(fs.rename).mockResolvedValue(undefined);
  vi.mocked(fs.unlink).mockResolvedValue(undefined);

  const app = await buildApp({
    sessionService: sessionService as never,
    cliArg: '/packages/sample.mpk',
  });

  return { app, savedPath, sessionService, tempDir };
}

describe('package stale tracking', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-7.1a: edit in extracted package modifies temp dir', async () => {
    const { app, savedPath, sessionService, tempDir } = await buildOpenedApp();

    try {
      expect(sessionService.getState().activePackage).toMatchObject({
        extractedRoot: tempDir,
        mode: 'extracted',
        stale: false,
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/file',
        payload: {
          path: savedPath,
          content: '# Updated',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
        expect.stringContaining(`${tempDir}/.guide.md.`),
        '# Updated',
        'utf-8',
      );
      expect(vi.mocked(fs.rename)).toHaveBeenCalledWith(expect.any(String), savedPath);
    } finally {
      await app.close();
    }
  });

  it('TC-7.2a: stale flag set after first edit', async () => {
    const { app, savedPath, sessionService } = await buildOpenedApp();

    try {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/file',
        payload: {
          path: savedPath,
          content: '# Updated',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(sessionService.getState().activePackage).toMatchObject({
        sourcePath: '/packages/sample.mpk',
        mode: 'extracted',
        stale: true,
      });
      expect(sessionService.setActivePackage).toHaveBeenLastCalledWith(
        expect.objectContaining({ stale: true }),
      );
    } finally {
      await app.close();
    }
  });

  it('TC-7.2b: stale remains after multiple edits', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    await openPackage(service);

    service.markStale();
    await flushAsyncWork();
    expect(service.getState()?.stale).toBe(true);

    service.markStale();
    await flushAsyncWork();
    expect(service.getState()?.stale).toBe(true);
  });

  it('Non-TC: stale flag persists in session state', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    await openPackage(service);
    service.markStale();
    await flushAsyncWork();

    expect(sessionService.setActivePackage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sourcePath: '/packages/sample.mpk',
        mode: 'extracted',
        stale: true,
      }),
    );
  });
});
