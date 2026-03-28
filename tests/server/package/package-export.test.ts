import type { Dirent, Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    cp: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdtemp: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
  };
});

vi.mock('../../../src/pkg/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/pkg/index.js')>();
  return {
    ...actual,
    createPackage: vi.fn(),
    extractPackage: vi.fn(),
    parseManifest: vi.fn(),
    scaffoldManifest: vi.fn(),
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

function makeFileStat(options: { size?: number } = {}): Stats {
  return {
    isFile: () => true,
    isDirectory: () => false,
    size: options.size ?? 128,
  } as Stats;
}

function makeDirEntry(): Dirent {
  return {
    isFile: () => false,
    isDirectory: () => true,
  } as Dirent;
}

function makeFileEntry(): Dirent {
  return {
    isFile: () => true,
    isDirectory: () => false,
  } as Dirent;
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

function createTempDirManager(tempDir = '/tmp/mdv-pkg-export') {
  return {
    create: vi.fn().mockResolvedValue(tempDir),
    cleanup: vi.fn().mockResolvedValue(undefined),
    cleanupDir: vi.fn().mockResolvedValue(undefined),
    getActive: vi.fn().mockReturnValue(null),
    setActive: vi.fn(),
    cleanupStale: vi.fn().mockResolvedValue(undefined),
  };
}

function setActiveState(service: PackageService, overrides: Record<string, unknown> = {}): void {
  (
    service as unknown as {
      state: Record<string, unknown>;
    }
  ).state = {
    sourcePath: '/workspace/source',
    extractedRoot: '/workspace/source',
    format: 'mpk',
    mode: 'directory',
    manifestStatus: 'present',
    stale: false,
    navigation: [],
    metadata: {},
    ...overrides,
  };
}

function mockExportStatPaths(options: {
  sourceDir: string;
  outputPath: string;
  manifestExists?: boolean;
  outputSize?: number;
}) {
  vi.mocked(fs.stat).mockImplementation(async (targetPath) => {
    const normalizedPath = String(targetPath);
    const manifestPath = `${options.sourceDir}/_nav.md`;

    if (normalizedPath === manifestPath) {
      if (options.manifestExists === false) {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }

      return makeFileStat();
    }

    if (normalizedPath === options.outputPath) {
      return makeFileStat({ size: options.outputSize ?? 512 });
    }

    throw new Error(`Unexpected stat path: ${normalizedPath}`);
  });
}

describe('PackageService.export', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-5.1a: export to .mpk', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    setActiveState(service);
    mockExportStatPaths({
      sourceDir: '/workspace/source',
      outputPath: '/exports/sample.mpk',
      outputSize: 2048,
    });
    vi.mocked(fs.readdir).mockResolvedValue([
      makeFileEntry(),
      makeFileEntry(),
      makeDirEntry(),
    ] as never);
    vi.mocked(pkg.createPackage).mockResolvedValue(undefined);

    const result = await service.export('/exports/sample.mpk');

    expect(pkg.createPackage).toHaveBeenCalledWith({
      sourceDir: '/workspace/source',
      outputPath: '/exports/sample.mpk',
      compress: undefined,
    });
    expect(result).toEqual({
      outputPath: '/exports/sample.mpk',
      format: 'mpk',
      fileCount: 2,
      sizeBytes: 2048,
    });
  });

  it('TC-5.1b: export to .mpkz', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    mockExportStatPaths({
      sourceDir: '/workspace/docs',
      outputPath: '/exports/sample.mpkz',
      outputSize: 1024,
    });
    vi.mocked(fs.readdir).mockResolvedValue([makeFileEntry()] as never);
    vi.mocked(pkg.createPackage).mockResolvedValue(undefined);

    const result = await service.export('/exports/sample.mpkz', true, '/workspace/docs');

    expect(pkg.createPackage).toHaveBeenCalledWith({
      sourceDir: '/workspace/docs',
      outputPath: '/exports/sample.mpkz',
      compress: true,
    });
    expect(result.format).toBe('mpkz');
  });

  it('TC-5.1c: export includes all files', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    mockExportStatPaths({
      sourceDir: '/workspace/docs',
      outputPath: '/exports/all-files.mpk',
      outputSize: 4096,
    });
    vi.mocked(fs.readdir).mockResolvedValue([
      makeFileEntry(),
      makeDirEntry(),
      makeFileEntry(),
      makeFileEntry(),
      makeFileEntry(),
    ] as never);
    vi.mocked(pkg.createPackage).mockResolvedValue(undefined);

    const result = await service.export('/exports/all-files.mpk', false, '/workspace/docs');

    expect(result.fileCount).toBe(4);
  });

  it('TC-5.2a: auto-scaffold on export', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    mockExportStatPaths({
      sourceDir: '/workspace/no-manifest',
      outputPath: '/exports/scaffolded.mpk',
      manifestExists: false,
      outputSize: 256,
    });
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/mdv-pkg-export-stage');
    vi.mocked(fs.cp).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([makeFileEntry(), makeFileEntry()] as never);
    vi.mocked(pkg.createPackage).mockResolvedValue(undefined);

    const result = await service.export('/exports/scaffolded.mpk', false, '/workspace/no-manifest');

    expect(pkg.createPackage).toHaveBeenCalledWith({
      sourceDir: '/tmp/mdv-pkg-export-stage/source',
      outputPath: '/exports/scaffolded.mpk',
      compress: false,
    });
    expect(fs.cp).toHaveBeenCalledWith(
      '/workspace/no-manifest',
      '/tmp/mdv-pkg-export-stage/source',
      {
        recursive: true,
      },
    );
    expect(result).toMatchObject({
      outputPath: '/exports/scaffolded.mpk',
      format: 'mpk',
    });
  });

  it('TC-5.2b: source directory not modified', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    mockExportStatPaths({
      sourceDir: '/workspace/no-manifest',
      outputPath: '/exports/cleanup.mpk',
      manifestExists: false,
      outputSize: 300,
    });
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/mdv-pkg-export-cleanup');
    vi.mocked(fs.cp).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([makeFileEntry()] as never);
    vi.mocked(pkg.createPackage).mockResolvedValue(undefined);

    await service.export('/exports/cleanup.mpk', false, '/workspace/no-manifest');

    expect(fs.cp).toHaveBeenCalledWith(
      '/workspace/no-manifest',
      '/tmp/mdv-pkg-export-cleanup/source',
      { recursive: true },
    );
    expect(fs.rm).toHaveBeenCalledWith('/tmp/mdv-pkg-export-cleanup', {
      recursive: true,
      force: true,
    });
  });

  it('TC-5.3a: re-export after editing uses the extracted root', async () => {
    const tempDirManager = createTempDirManager('/tmp/mdv-pkg-extracted');
    const sessionService = createSessionService();
    const service = new PackageService(
      tempDirManager as unknown as TempDirManager,
      sessionService as never,
    );

    vi.mocked(fs.stat).mockImplementation(async (targetPath) => {
      const normalizedPath = String(targetPath);

      if (normalizedPath === '/packages/original.mpk') {
        return makeFileStat();
      }

      if (normalizedPath === '/tmp/mdv-pkg-extracted/_nav.md') {
        return makeFileStat();
      }

      if (normalizedPath === '/exports/re-exported.mpk') {
        return makeFileStat({ size: 640 });
      }

      throw new Error(`Unexpected stat path: ${normalizedPath}`);
    });
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('manifest');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'Sample Package' },
      navigation: [{ displayName: 'Guide', filePath: 'guide.md', children: [], isGroup: false }],
      raw: 'manifest',
    });
    vi.mocked(fs.readdir).mockResolvedValue([makeFileEntry(), makeFileEntry()] as never);
    vi.mocked(pkg.createPackage).mockResolvedValue(undefined);

    await service.open('/packages/original.mpk');
    await service.export('/exports/re-exported.mpk');

    expect(pkg.createPackage).toHaveBeenCalledWith({
      sourceDir: '/tmp/mdv-pkg-extracted',
      outputPath: '/exports/re-exported.mpk',
      compress: undefined,
    });
  });

  it('Non-TC: round-trip export then re-open succeeds', async () => {
    const sessionService = createFullSessionService();
    const app = await buildApp({
      sessionService: sessionService as never,
    });

    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/mdv-pkg-roundtrip');
    vi.mocked(fs.stat).mockImplementation(async (targetPath) => {
      const normalizedPath = String(targetPath);

      if (normalizedPath === '/workspace/project/_nav.md') {
        return makeFileStat();
      }

      if (normalizedPath === '/exports/roundtrip.mpk') {
        return makeFileStat({ size: 900 });
      }

      return makeFileStat();
    });
    vi.mocked(fs.readdir).mockResolvedValue([makeFileEntry(), makeFileEntry()] as never);
    vi.mocked(pkg.createPackage).mockResolvedValue(undefined);
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('manifest');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'Round Trip' },
      navigation: [{ displayName: 'Intro', filePath: 'intro.md', children: [], isGroup: false }],
      raw: 'manifest',
    });

    try {
      const exportResponse = await app.inject({
        method: 'POST',
        url: '/api/package/export',
        payload: {
          outputPath: '/exports/roundtrip.mpk',
          sourceDir: '/workspace/project',
        },
      });

      expect(exportResponse.statusCode).toBe(200);
      expect(exportResponse.json()).toMatchObject({
        outputPath: '/exports/roundtrip.mpk',
        format: 'mpk',
      });

      const openResponse = await app.inject({
        method: 'POST',
        url: '/api/package/open',
        payload: {
          filePath: '/exports/roundtrip.mpk',
        },
      });

      expect(openResponse.statusCode).toBe(200);
      expect(pkg.extractPackage).toHaveBeenCalledWith({
        packagePath: '/exports/roundtrip.mpk',
        outputDir: '/tmp/mdv-pkg-roundtrip',
      });
    } finally {
      await app.close();
    }
  });

  it('Non-TC: export route returns 400 INVALID_OUTPUT_PATH for relative paths', async () => {
    const app = await buildApp({
      sessionService: createFullSessionService() as never,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/package/export',
      payload: {
        outputPath: 'relative/output.mpk',
        sourceDir: '/workspace/project',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_OUTPUT_PATH',
        message: 'Path must be absolute',
      },
    });

    await app.close();
  });
});
