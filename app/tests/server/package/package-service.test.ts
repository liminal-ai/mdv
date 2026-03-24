import type { Stats } from 'node:fs';
import path from 'node:path';
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

import * as pkg from '../../../src/pkg/index.js';
import { PackageService } from '../../../src/server/services/package.service.js';
import { TempDirManager } from '../../../src/server/services/temp-dir.service.js';
import { InvalidArchiveError } from '../../../src/server/utils/errors.js';

function makeFileStat(): Stats {
  return {
    isFile: () => true,
  } as Stats;
}

function createSessionService() {
  return {
    setActivePackage: vi.fn().mockResolvedValue({}),
  };
}

function createTempDirManager(tempDir = '/tmp/mdv-pkg-test') {
  return {
    create: vi.fn().mockResolvedValue(tempDir),
    cleanup: vi.fn().mockResolvedValue(undefined),
    cleanupDir: vi.fn().mockResolvedValue(undefined),
    getActive: vi.fn().mockReturnValue(null),
    setActive: vi.fn(),
    cleanupStale: vi.fn().mockResolvedValue(undefined),
  };
}

describe('PackageService.open', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-1.1a: open .mpk extracts and returns manifest metadata and navigation', async () => {
    const tempDirManager = createTempDirManager('/tmp/mdv-pkg-flat');
    const sessionService = createSessionService();
    const service = new PackageService(
      tempDirManager as unknown as TempDirManager,
      sessionService as never,
    );

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('manifest');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: {
        title: 'Sample Package',
        version: '1.0',
        author: 'Test Author',
      },
      navigation: [
        {
          displayName: 'Getting Started',
          filePath: 'getting-started.md',
          children: [],
          isGroup: false,
        },
        {
          displayName: 'API Reference',
          filePath: 'api-reference.md',
          children: [],
          isGroup: false,
        },
        { displayName: 'FAQ', filePath: 'faq.md', children: [], isGroup: false },
      ],
      raw: 'manifest',
    });

    const result = await service.open('/packages/sample.mpk');

    expect(tempDirManager.create).toHaveBeenCalledTimes(1);
    expect(pkg.extractPackage).toHaveBeenCalledWith({
      packagePath: '/packages/sample.mpk',
      outputDir: '/tmp/mdv-pkg-flat',
    });
    expect(result).toEqual({
      metadata: {
        title: 'Sample Package',
        version: '1.0',
        author: 'Test Author',
      },
      navigation: [
        {
          displayName: 'Getting Started',
          filePath: 'getting-started.md',
          children: [],
          isGroup: false,
        },
        {
          displayName: 'API Reference',
          filePath: 'api-reference.md',
          children: [],
          isGroup: false,
        },
        { displayName: 'FAQ', filePath: 'faq.md', children: [], isGroup: false },
      ],
      packageInfo: {
        sourcePath: '/packages/sample.mpk',
        extractedRoot: '/tmp/mdv-pkg-flat',
        format: 'mpk',
        manifestStatus: 'present',
      },
    });
    expect(sessionService.setActivePackage).toHaveBeenCalledWith({
      sourcePath: '/packages/sample.mpk',
      extractedRoot: '/tmp/mdv-pkg-flat',
      format: 'mpk',
      mode: 'extracted',
      stale: false,
      manifestStatus: 'present',
    });
  });

  it('TC-1.1b: open .mpkz extracts compressed package', async () => {
    const tempDirManager = createTempDirManager('/tmp/mdv-pkg-compressed');
    const sessionService = createSessionService();
    const service = new PackageService(
      tempDirManager as unknown as TempDirManager,
      sessionService as never,
    );

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('manifest');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'Compressed Package' },
      navigation: [],
      raw: 'manifest',
    });

    const result = await service.open('/packages/sample.mpkz');

    expect(result.packageInfo.format).toBe('mpkz');
    expect(result.packageInfo.extractedRoot).toBe('/tmp/mdv-pkg-compressed');
    expect(pkg.extractPackage).toHaveBeenCalledWith({
      packagePath: '/packages/sample.mpkz',
      outputDir: '/tmp/mdv-pkg-compressed',
    });
  });

  it('TC-1.1c: invalid archive returns InvalidArchiveError', async () => {
    const tempDirManager = createTempDirManager();
    const sessionService = createSessionService();
    const service = new PackageService(
      tempDirManager as unknown as TempDirManager,
      sessionService as never,
    );

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(pkg.extractPackage).mockRejectedValue(
      Object.assign(new Error('Corrupted archive'), { code: 'INVALID_ARCHIVE' }),
    );

    await expect(service.open('/packages/corrupt.mpk')).rejects.toBeInstanceOf(InvalidArchiveError);
    expect(sessionService.setActivePackage).not.toHaveBeenCalled();
  });

  it('TC-1.4a: navigation entry resolves against the extracted root', async () => {
    const tempDirManager = createTempDirManager('/tmp/mdv-pkg-nav');
    const sessionService = createSessionService();
    const service = new PackageService(
      tempDirManager as unknown as TempDirManager,
      sessionService as never,
    );

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('manifest');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: {},
      navigation: [
        {
          displayName: 'Getting Started',
          filePath: 'docs/getting-started.md',
          children: [],
          isGroup: false,
        },
      ],
      raw: 'manifest',
    });

    const result = await service.open('/packages/nav.mpk');

    expect(path.join(result.packageInfo.extractedRoot, result.navigation[0]!.filePath!)).toBe(
      '/tmp/mdv-pkg-nav/docs/getting-started.md',
    );
  });

  it('TC-1.4d: missing file references do not block package open', async () => {
    const tempDirManager = createTempDirManager('/tmp/mdv-pkg-missing');
    const sessionService = createSessionService();
    const service = new PackageService(
      tempDirManager as unknown as TempDirManager,
      sessionService as never,
    );

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('manifest');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'Missing File Package' },
      navigation: [
        { displayName: 'Missing Page', filePath: 'missing.md', children: [], isGroup: false },
      ],
      raw: 'manifest',
    });

    const result = await service.open('/packages/missing-file.mpk');

    expect(result.packageInfo.manifestStatus).toBe('present');
    expect(result.navigation[0]?.filePath).toBe('missing.md');
  });

  it('Integration: opens a real .mpk fixture with the Epic 8 extraction pipeline', async () => {
    const realFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    const realPkg = await vi.importActual<typeof import('../../../src/pkg/index.js')>(
      '../../../src/pkg/index.js',
    );
    const sessionService = createSessionService();
    const tempDirManager = new TempDirManager();
    const service = new PackageService(tempDirManager, sessionService as never);

    vi.mocked(fs.stat).mockImplementation(realFs.stat);
    vi.mocked(fs.readFile).mockImplementation(realFs.readFile as typeof fs.readFile);
    vi.mocked(fs.mkdtemp).mockImplementation(realFs.mkdtemp);
    vi.mocked(fs.rm).mockImplementation(realFs.rm);
    vi.mocked(fs.readdir).mockImplementation(realFs.readdir as typeof fs.readdir);
    vi.mocked(pkg.extractPackage).mockImplementation(realPkg.extractPackage);
    vi.mocked(pkg.parseManifest).mockImplementation(realPkg.parseManifest);

    const fixturePath = path.resolve('tests/fixtures/packages/sample.mpk');

    const result = await service.open(fixturePath);

    expect(result.packageInfo.sourcePath).toBe(fixturePath);
    expect(result.packageInfo.manifestStatus).toBe('present');
    expect(result.navigation).toHaveLength(3);
    expect(result.metadata.title).toBeTruthy();

    await service.close();
  });
});
