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
    scaffoldManifest: vi.fn(),
    MANIFEST_FILENAME: '_nav.md',
  };
});

vi.mock('../../../src/server/plugins/static.js', () => ({
  staticPlugin: async () => {},
}));

import * as pkg from '../../../src/pkg/index.js';
import { PackageService } from '../../../src/server/services/package.service.js';
import { TempDirManager } from '../../../src/server/services/temp-dir.service.js';

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

function makeNotFoundError() {
  return Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
}

function createSessionService() {
  return {
    setActivePackage: vi.fn().mockResolvedValue({}),
  };
}

function createTempDirManager(tempDir = '/tmp/mdv-pkg-fallback') {
  return {
    create: vi.fn().mockResolvedValue(tempDir),
    cleanup: vi.fn().mockResolvedValue(undefined),
    cleanupDir: vi.fn().mockResolvedValue(undefined),
    getActive: vi.fn().mockReturnValue(null),
    setActive: vi.fn(),
    cleanupStale: vi.fn().mockResolvedValue(undefined),
  };
}

describe('package fallback behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-8.1a: no-manifest package opens in fallback response mode', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager('/tmp/mdv-pkg-missing') as unknown as TempDirManager,
      sessionService as never,
    );

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockRejectedValue(makeNotFoundError());

    const result = await service.open('/packages/no-manifest.mpk');

    expect(result).toEqual({
      metadata: {},
      navigation: [],
      packageInfo: {
        sourcePath: '/packages/no-manifest.mpk',
        extractedRoot: '/tmp/mdv-pkg-missing',
        format: 'mpk',
        manifestStatus: 'missing',
      },
    });
    expect(sessionService.setActivePackage).toHaveBeenCalledWith({
      sourcePath: '/packages/no-manifest.mpk',
      extractedRoot: '/tmp/mdv-pkg-missing',
      format: 'mpk',
      mode: 'extracted',
      stale: false,
      manifestStatus: 'missing',
    });
  });

  it('TC-8.1c: unreadable manifest opens in fallback response mode', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager('/tmp/mdv-pkg-unreadable') as unknown as TempDirManager,
      sessionService as never,
    );

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('broken manifest');
    vi.mocked(pkg.parseManifest).mockImplementation(() => {
      throw new Error('Manifest parse failed');
    });

    const result = await service.open('/packages/unreadable.mpk');

    expect(result.metadata).toEqual({});
    expect(result.navigation).toEqual([]);
    expect(result.packageInfo).toEqual({
      sourcePath: '/packages/unreadable.mpk',
      extractedRoot: '/tmp/mdv-pkg-unreadable',
      format: 'mpk',
      manifestStatus: 'unreadable',
      manifestError: 'Manifest parse failed',
    });
  });

  it('TC-8.3a: scaffolding in extracted fallback package marks it stale', async () => {
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager('/tmp/mdv-pkg-fallback') as unknown as TempDirManager,
      sessionService as never,
    );

    vi.mocked(fs.stat).mockImplementation(async (targetPath) => {
      if (targetPath === '/packages/sample.mpk') {
        return makeFileStat();
      }
      if (targetPath === '/tmp/mdv-pkg-fallback') {
        return makeDirStat();
      }
      if (targetPath === '/tmp/mdv-pkg-fallback/_nav.md') {
        throw makeNotFoundError();
      }

      throw new Error(`Unexpected stat path: ${String(targetPath)}`);
    });
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockRejectedValueOnce(makeNotFoundError());
    vi.mocked(pkg.scaffoldManifest).mockResolvedValue('- [Guide](guide.md)');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'sample' },
      navigation: [{ displayName: 'Guide', filePath: 'guide.md', children: [], isGroup: false }],
      raw: 'manifest',
    });

    await service.open('/packages/sample.mpk');
    await service.create('/tmp/mdv-pkg-fallback');

    expect(service.getState()).toMatchObject({
      sourcePath: '/packages/sample.mpk',
      extractedRoot: '/tmp/mdv-pkg-fallback',
      format: 'mpk',
      mode: 'extracted',
      manifestStatus: 'present',
      stale: true,
    });
    expect(sessionService.setActivePackage).toHaveBeenLastCalledWith({
      sourcePath: '/packages/sample.mpk',
      extractedRoot: '/tmp/mdv-pkg-fallback',
      format: 'mpk',
      mode: 'extracted',
      stale: true,
      manifestStatus: 'present',
    });
  });
});
