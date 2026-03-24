import type { Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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

function makeFileStat(): Stats {
  return {
    isFile: () => true,
    isDirectory: () => false,
  } as Stats;
}

function createSessionService() {
  return {
    setActivePackage: vi.fn().mockResolvedValue({}),
  };
}

function createTempDirManager() {
  return {
    create: vi.fn().mockResolvedValueOnce('/tmp/mdv-pkg-a').mockResolvedValueOnce('/tmp/mdv-pkg-b'),
    cleanup: vi.fn().mockResolvedValue(undefined),
    cleanupDir: vi.fn().mockResolvedValue(undefined),
    getActive: vi.fn().mockReturnValueOnce(null).mockReturnValueOnce('/tmp/mdv-pkg-a'),
    setActive: vi.fn(),
    cleanupStale: vi.fn().mockResolvedValue(undefined),
  };
}

describe('temp directory cleanup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-9.1a: temp dir removed on package switch', async () => {
    const tempDirManager = createTempDirManager();
    const service = new PackageService(
      tempDirManager as unknown as TempDirManager,
      createSessionService() as never,
    );

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('manifest');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: {},
      navigation: [],
      raw: 'manifest',
    });

    await service.open('/packages/package-a.mpk');
    await service.open('/packages/package-b.mpk');

    expect(tempDirManager.cleanupDir).toHaveBeenCalledWith('/tmp/mdv-pkg-a');
  });

  it('TC-9.2a: cleanupStale removes stale temp dirs but preserves the active one', async () => {
    const manager = new TempDirManager();
    const tmpDir = os.tmpdir();
    const activeDir = path.join(tmpDir, 'mdv-pkg-active');

    manager.setActive(activeDir);
    vi.mocked(fs.readdir).mockResolvedValue(['mdv-pkg-stale', 'mdv-pkg-active', 'notes'] as never);
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    await manager.cleanupStale();

    expect(fs.rm).toHaveBeenCalledTimes(1);
    expect(fs.rm).toHaveBeenCalledWith(path.join(tmpDir, 'mdv-pkg-stale'), {
      recursive: true,
      force: true,
    });
  });

  it('Non-TC: multiple stale dirs are all removed while the active dir remains', async () => {
    const manager = new TempDirManager();
    const tmpDir = os.tmpdir();
    const activeDir = path.join(tmpDir, 'mdv-pkg-active');

    manager.setActive(activeDir);
    vi.mocked(fs.readdir).mockResolvedValue([
      'mdv-pkg-stale-a',
      'mdv-pkg-stale-b',
      'mdv-pkg-stale-c',
      'mdv-pkg-active',
    ] as never);
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    await manager.cleanupStale();

    expect(vi.mocked(fs.rm).mock.calls).toEqual([
      [path.join(tmpDir, 'mdv-pkg-stale-a'), { recursive: true, force: true }],
      [path.join(tmpDir, 'mdv-pkg-stale-b'), { recursive: true, force: true }],
      [path.join(tmpDir, 'mdv-pkg-stale-c'), { recursive: true, force: true }],
    ]);
  });
});
