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

function makeFileStat(): Stats {
  return {
    isFile: () => true,
    isDirectory: () => false,
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
    load: vi.fn().mockResolvedValue({ ...state }),
    setRoot: vi.fn().mockImplementation(async (root: string) => ({
      ...state,
      lastRoot: root,
    })),
    setActivePackage: vi.fn().mockResolvedValue({}),
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

function setupPackageMocks(tempDir = '/tmp/mdv-pkg-cli') {
  vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
  vi.mocked(fs.mkdtemp).mockResolvedValue(tempDir);
  vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
  vi.mocked(fs.readFile).mockResolvedValue('manifest');
  vi.mocked(pkg.parseManifest).mockReturnValue({
    metadata: { title: 'CLI Package' },
    navigation: [{ displayName: 'Intro', filePath: 'intro.md', children: [], isGroup: false }],
    raw: 'manifest',
  });
}

describe('package mode switching', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-3.1a: opening folder while in package mode closes package', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(new TempDirManager(), sessionService as never);

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/mdv-pkg-a');
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('manifest-a');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'Package A' },
      navigation: [],
      raw: 'manifest-a',
    });

    await service.open('/packages/package-a.mpk');
    await service.close();

    expect(service.getState()).toBeNull();
    expect(sessionService.setActivePackage).toHaveBeenLastCalledWith(null);
  });

  it('TC-3.3a: opening different package replaces current', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(new TempDirManager(), sessionService as never);

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.mkdtemp)
      .mockResolvedValueOnce('/tmp/mdv-pkg-a')
      .mockResolvedValueOnce('/tmp/mdv-pkg-b');
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValueOnce('manifest-a').mockResolvedValueOnce('manifest-b');
    vi.mocked(pkg.parseManifest)
      .mockReturnValueOnce({
        metadata: { title: 'Package A' },
        navigation: [],
        raw: 'manifest-a',
      })
      .mockReturnValueOnce({
        metadata: { title: 'Package B' },
        navigation: [],
        raw: 'manifest-b',
      });

    await service.open('/packages/package-a.mpk');
    await service.open('/packages/package-b.mpkz');

    expect(service.getState()).toMatchObject({
      sourcePath: '/packages/package-b.mpkz',
      extractedRoot: '/tmp/mdv-pkg-b',
      format: 'mpkz',
      manifestStatus: 'present',
    });
  });

  it('TC-9.1a: temp directory removed on package switch', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(new TempDirManager(), sessionService as never);

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.mkdtemp)
      .mockResolvedValueOnce('/tmp/mdv-pkg-a')
      .mockResolvedValueOnce('/tmp/mdv-pkg-b');
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('manifest');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: {},
      navigation: [],
      raw: 'manifest',
    });

    await service.open('/packages/package-a.mpk');
    await service.open('/packages/package-b.mpk');

    expect(fs.rm).toHaveBeenCalledWith('/tmp/mdv-pkg-a', { recursive: true, force: true });
  });
});

describe('CLI routing (server)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-1.3a-server: .mpk CLI arg opens package', async () => {
    setupPackageMocks();

    const app = await buildApp({
      sessionService: createFullSessionService() as never,
      cliArg: '/packages/test.mpk',
    });

    const response = await app.inject({ method: 'GET', url: '/api/package/manifest' });
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.metadata.title).toBe('CLI Package');

    await app.close();
  });

  it('TC-1.3b-server: missing CLI package starts app in empty state with warning', async () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    vi.mocked(fs.stat).mockRejectedValue(enoent);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const sessionService = createFullSessionService();
    const app = await buildApp({
      sessionService: sessionService as never,
      cliArg: '/nonexistent/path.mpk',
    });

    expect(sessionService.setRoot).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to open CLI package /nonexistent/path.mpk: Package file not found: /nonexistent/path.mpk',
    );

    const manifestResponse = await app.inject({ method: 'GET', url: '/api/package/manifest' });
    expect(manifestResponse.statusCode).toBe(404);

    await app.close();
  });

  it('TC-1.3c-server: non-package file not treated as package', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());

    const sessionService = createFullSessionService();
    const app = await buildApp({
      sessionService: sessionService as never,
      cliArg: '/documents/readme.txt',
    });

    // File (not directory) should not trigger setRoot
    expect(sessionService.setRoot).not.toHaveBeenCalled();

    await app.close();
  });
});

describe('route-level package→filesystem transition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-3.1a-route: PUT /api/session/root clears package state', async () => {
    setupPackageMocks('/tmp/mdv-pkg-route');

    const sessionService = createFullSessionService();
    const app = await buildApp({
      sessionService: sessionService as never,
      cliArg: '/packages/test.mpk',
    });

    // Verify package is active
    const manifestBefore = await app.inject({ method: 'GET', url: '/api/package/manifest' });
    expect(manifestBefore.statusCode).toBe(200);

    // Switch to filesystem mode via PUT /api/session/root
    vi.mocked(fs.stat).mockResolvedValue(makeDirStat());

    const setRootResponse = await app.inject({
      method: 'PUT',
      url: '/api/session/root',
      payload: { root: '/workspace' },
    });
    expect(setRootResponse.statusCode).toBe(200);

    // Package state should be cleared
    const manifestAfter = await app.inject({ method: 'GET', url: '/api/package/manifest' });
    expect(manifestAfter.statusCode).toBe(404);

    await app.close();
  });
});
