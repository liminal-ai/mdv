import type { Stats } from 'node:fs';
import * as fs from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdtemp: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
  };
});

vi.mock('../../../src/pkg/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/pkg/index.js')>();
  return {
    ...actual,
    scaffoldManifest: vi.fn(),
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
import { ManifestExistsError } from '../../../src/server/utils/errors.js';
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

function setCreateStats(rootDir: string, manifestExists = false) {
  vi.mocked(fs.stat).mockImplementation(async (targetPath: fs.PathLike) => {
    if (targetPath === rootDir) {
      return makeDirStat();
    }

    if (targetPath === `${rootDir}/_nav.md`) {
      if (manifestExists) {
        return makeFileStat();
      }

      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    }

    throw new Error(`Unexpected stat path: ${String(targetPath)}`);
  });
}

describe('PackageService.create', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('TC-4.1a: scaffold manifest with discovered files', async () => {
    const rootDir = '/path/to/my-project';
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    setCreateStats(rootDir);
    vi.mocked(pkg.scaffoldManifest).mockResolvedValue(
      ['- [Alpha](alpha.md)', '- [Bravo](bravo.md)', '- [Charlie](nested/charlie.md)'].join('\n'),
    );
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'my-project' },
      navigation: [
        { displayName: 'Alpha', filePath: 'alpha.md', children: [], isGroup: false },
        { displayName: 'Bravo', filePath: 'bravo.md', children: [], isGroup: false },
        { displayName: 'Charlie', filePath: 'nested/charlie.md', children: [], isGroup: false },
      ],
      raw: 'manifest',
    });

    const result = await service.create(rootDir);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/path/to/my-project/_nav.md',
      [
        '---',
        'title: my-project',
        '---',
        '',
        '- [Alpha](alpha.md)',
        '- [Bravo](bravo.md)',
        '- [Charlie](nested/charlie.md)',
      ].join('\n'),
    );
    expect(result).toEqual({
      metadata: { title: 'my-project' },
      navigation: [
        { displayName: 'Alpha', filePath: 'alpha.md', children: [], isGroup: false },
        { displayName: 'Bravo', filePath: 'bravo.md', children: [], isGroup: false },
        { displayName: 'Charlie', filePath: 'nested/charlie.md', children: [], isGroup: false },
      ],
      manifestPath: '/path/to/my-project/_nav.md',
    });
    expect(sessionService.setActivePackage).toHaveBeenCalledWith({
      sourcePath: '/path/to/my-project',
      extractedRoot: '/path/to/my-project',
      format: 'mpk',
      mode: 'directory',
      stale: false,
      manifestStatus: 'present',
    });
  });

  it('TC-4.1b: manifest frontmatter includes directory name as title', async () => {
    const rootDir = '/path/to/my-project';
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    setCreateStats(rootDir);
    vi.mocked(pkg.scaffoldManifest).mockResolvedValue('- [Guide](guide.md)');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'my-project' },
      navigation: [{ displayName: 'Guide', filePath: 'guide.md', children: [], isGroup: false }],
      raw: 'manifest',
    });

    await service.create(rootDir);

    expect(vi.mocked(fs.writeFile).mock.calls[0]?.[1]).toMatch(/^---\ntitle: my-project\n---/);
  });

  it('TC-4.1d: dotfiles excluded', async () => {
    const rootDir = '/path/to/my-project';
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    setCreateStats(rootDir);
    vi.mocked(pkg.scaffoldManifest).mockResolvedValue(
      [
        '- [Guide](guide.md)',
        '- [Hidden](.hidden.md)',
        '- [Secret](docs/.private/secret.md)',
        '- [Visible](docs/visible.md)',
      ].join('\n'),
    );
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'my-project' },
      navigation: [
        { displayName: 'Guide', filePath: 'guide.md', children: [], isGroup: false },
        { displayName: 'Visible', filePath: 'docs/visible.md', children: [], isGroup: false },
      ],
      raw: 'manifest',
    });

    await service.create(rootDir);

    const writtenContent = String(vi.mocked(fs.writeFile).mock.calls[0]?.[1] ?? '');
    expect(writtenContent).toContain('- [Guide](guide.md)');
    expect(writtenContent).toContain('- [Visible](docs/visible.md)');
    expect(writtenContent).not.toContain('.hidden.md');
    expect(writtenContent).not.toContain('docs/.private/secret.md');
    expect(pkg.parseManifest).toHaveBeenCalledWith(writtenContent);
  });

  it('TC-4.2a: existing manifest + overwrite=true', async () => {
    const rootDir = '/path/to/my-project';
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    setCreateStats(rootDir, true);
    vi.mocked(pkg.scaffoldManifest).mockResolvedValue('- [Guide](guide.md)');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'my-project' },
      navigation: [{ displayName: 'Guide', filePath: 'guide.md', children: [], isGroup: false }],
      raw: 'manifest',
    });

    const result = await service.create(rootDir, true);

    expect(pkg.scaffoldManifest).toHaveBeenCalledWith(rootDir);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(result.manifestPath).toBe('/path/to/my-project/_nav.md');
  });

  it('TC-4.2b: existing manifest + no overwrite', async () => {
    const rootDir = '/path/to/my-project';
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    setCreateStats(rootDir, true);

    await expect(service.create(rootDir)).rejects.toBeInstanceOf(ManifestExistsError);
    expect(pkg.scaffoldManifest).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();

    const app = await buildApp({
      sessionService: createFullSessionService() as never,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/package/create',
      payload: { rootDir },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'MANIFEST_EXISTS',
        message: 'Manifest already exists: /path/to/my-project/_nav.md',
      },
    });

    await app.close();
  });

  it('Non-TC: create route returns 400 INVALID_DIR_PATH for relative paths', async () => {
    const app = await buildApp({
      sessionService: createFullSessionService() as never,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/package/create',
      payload: { rootDir: 'relative/project' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_DIR_PATH',
        message: 'Path must be absolute',
      },
    });

    await app.close();
  });

  it('TC-4.3a: empty directory', async () => {
    const rootDir = '/path/to/empty-project';
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    setCreateStats(rootDir);
    vi.mocked(pkg.scaffoldManifest).mockResolvedValue('');
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'empty-project' },
      navigation: [],
      raw: 'manifest',
    });

    const result = await service.create(rootDir);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/path/to/empty-project/_nav.md',
      '---\ntitle: empty-project\n---\n',
    );
    expect(result).toEqual({
      metadata: { title: 'empty-project' },
      navigation: [],
      manifestPath: '/path/to/empty-project/_nav.md',
    });
  });

  it('Non-TC: nested directories', async () => {
    const rootDir = '/path/to/project';
    const sessionService = createSessionService();
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      sessionService as never,
    );

    setCreateStats(rootDir);
    vi.mocked(pkg.scaffoldManifest).mockResolvedValue(
      ['- [Intro](docs/getting-started/intro.md)', '- [API](reference/api.md)'].join('\n'),
    );
    vi.mocked(pkg.parseManifest).mockReturnValue({
      metadata: { title: 'project' },
      navigation: [
        {
          displayName: 'Intro',
          filePath: 'docs/getting-started/intro.md',
          children: [],
          isGroup: false,
        },
        { displayName: 'API', filePath: 'reference/api.md', children: [], isGroup: false },
      ],
      raw: 'manifest',
    });

    const result = await service.create(rootDir);

    expect(pkg.scaffoldManifest).toHaveBeenCalledWith(rootDir);
    expect(String(vi.mocked(fs.writeFile).mock.calls[0]?.[1] ?? '')).toContain(
      'docs/getting-started/intro.md',
    );
    expect(result.navigation[0]?.filePath).toBe('docs/getting-started/intro.md');
  });
});
