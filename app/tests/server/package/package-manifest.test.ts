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

vi.mock('../../../src/server/plugins/static.js', () => ({
  staticPlugin: async () => {},
}));

import * as pkg from '../../../src/pkg/index.js';
import { buildApp } from '../../../src/server/app.js';
import { PackageService } from '../../../src/server/services/package.service.js';
import { TempDirManager } from '../../../src/server/services/temp-dir.service.js';
import { ManifestParseError } from '../../../src/server/utils/errors.js';
import { emptySession } from '../../fixtures/session.js';

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

function createFullSessionService() {
  const state = { ...emptySession };
  return {
    load: vi.fn().mockResolvedValue({ ...state }),
    setRoot: vi.fn().mockResolvedValue(state),
    setActivePackage: vi.fn().mockResolvedValue(state),
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

function createTempDirManager(tempDir = '/tmp/mdv-pkg-manifest') {
  return {
    create: vi.fn().mockResolvedValue(tempDir),
    cleanup: vi.fn().mockResolvedValue(undefined),
    cleanupDir: vi.fn().mockResolvedValue(undefined),
    getActive: vi.fn().mockReturnValue(null),
    setActive: vi.fn(),
    cleanupStale: vi.fn().mockResolvedValue(undefined),
  };
}

function createNode(displayName: string, filePath: string) {
  return {
    displayName,
    filePath,
    children: [],
    isGroup: false,
  };
}

const initialManifest = [
  '---',
  'title: Sample Package',
  'version: 1.0',
  'author: Test Author',
  '---',
  '',
  '- [Getting Started](getting-started.md)',
  '- [API Reference](api-reference.md)',
  '- [FAQ](faq.md)',
].join('\n');

const initialParsed = {
  metadata: {
    title: 'Sample Package',
    version: '1.0',
    author: 'Test Author',
  },
  navigation: [
    createNode('Getting Started', 'getting-started.md'),
    createNode('API Reference', 'api-reference.md'),
    createNode('FAQ', 'faq.md'),
  ],
  raw: initialManifest,
};

async function openPackage(
  service: PackageService,
  options: {
    content?: string;
    parsed?: typeof initialParsed;
  } = {},
) {
  vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
  vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
  vi.mocked(fs.readFile).mockResolvedValueOnce(options.content ?? initialManifest);
  vi.mocked(pkg.parseManifest).mockReturnValueOnce(options.parsed ?? initialParsed);

  return service.open('/packages/sample.mpk');
}

describe('PackageService.getManifest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-6.1a: returns freshly parsed manifest metadata, navigation, and raw content', async () => {
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      createSessionService() as never,
    );

    await openPackage(service);

    vi.mocked(fs.readFile).mockResolvedValueOnce(initialManifest);
    vi.mocked(pkg.parseManifest).mockReturnValueOnce(initialParsed);

    const result = await service.getManifest();

    expect(fs.readFile).toHaveBeenLastCalledWith('/tmp/mdv-pkg-manifest/_nav.md', 'utf-8');
    expect(pkg.parseManifest).toHaveBeenLastCalledWith(initialManifest);
    expect(result).toEqual({
      metadata: initialParsed.metadata,
      navigation: initialParsed.navigation,
      raw: initialManifest,
    });
  });

  it('TC-6.2a: re-parses after adding an entry', async () => {
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      createSessionService() as never,
    );
    const updatedManifest = `${initialManifest}\n- [Troubleshooting](troubleshooting.md)`;
    const updatedParsed = {
      metadata: initialParsed.metadata,
      navigation: [
        ...initialParsed.navigation,
        createNode('Troubleshooting', 'troubleshooting.md'),
      ],
      raw: updatedManifest,
    };

    await openPackage(service);

    vi.mocked(fs.readFile).mockResolvedValueOnce(updatedManifest);
    vi.mocked(pkg.parseManifest).mockReturnValueOnce(updatedParsed);

    const result = await service.getManifest();

    expect(result.navigation).toHaveLength(4);
    expect(result.navigation[3]).toEqual(createNode('Troubleshooting', 'troubleshooting.md'));
    expect(service.getState()?.navigation).toEqual(updatedParsed.navigation);
  });

  it('TC-6.2b: re-parses after removing an entry', async () => {
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      createSessionService() as never,
    );
    const updatedManifest = [
      '---',
      'title: Sample Package',
      '---',
      '',
      '- [Getting Started](getting-started.md)',
      '- [FAQ](faq.md)',
    ].join('\n');
    const updatedParsed = {
      metadata: { title: 'Sample Package' },
      navigation: [
        createNode('Getting Started', 'getting-started.md'),
        createNode('FAQ', 'faq.md'),
      ],
      raw: updatedManifest,
    };

    await openPackage(service);

    vi.mocked(fs.readFile).mockResolvedValueOnce(updatedManifest);
    vi.mocked(pkg.parseManifest).mockReturnValueOnce(updatedParsed);

    const result = await service.getManifest();

    expect(result.navigation).toEqual(updatedParsed.navigation);
    expect(result.navigation).toHaveLength(2);
    expect(service.getState()?.navigation).toEqual(updatedParsed.navigation);
  });

  it('TC-6.3a: malformed YAML raises ManifestParseError and route returns 422', async () => {
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      createSessionService() as never,
    );
    const parseError = new Error('Unexpected end of YAML stream');

    await openPackage(service);

    vi.mocked(fs.readFile).mockResolvedValueOnce('title: [broken');
    vi.mocked(pkg.parseManifest).mockImplementationOnce(() => {
      throw parseError;
    });

    await expect(service.getManifest()).rejects.toEqual(
      new ManifestParseError('Unexpected end of YAML stream'),
    );

    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/mdv-pkg-manifest-route');
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(initialManifest)
      .mockResolvedValueOnce('title: [broken');
    vi.mocked(pkg.parseManifest)
      .mockReturnValueOnce(initialParsed)
      .mockImplementationOnce(() => {
        throw parseError;
      });

    const app = await buildApp({
      sessionService: createFullSessionService() as never,
      cliArg: '/packages/sample.mpk',
    });

    const response = await app.inject({ method: 'GET', url: '/api/package/manifest' });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'MANIFEST_PARSE_ERROR',
        message: 'Manifest could not be parsed: Unexpected end of YAML stream',
      },
    });

    await app.close();
  });

  it('TC-6.4a: returns an empty navigation array when the manifest has no entries', async () => {
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      createSessionService() as never,
    );
    const updatedManifest = ['---', 'title: Empty Package', '---'].join('\n');
    const updatedParsed = {
      metadata: { title: 'Empty Package' },
      navigation: [],
      raw: updatedManifest,
    };

    await openPackage(service);

    vi.mocked(fs.readFile).mockResolvedValueOnce(updatedManifest);
    vi.mocked(pkg.parseManifest).mockReturnValueOnce(updatedParsed);

    const result = await service.getManifest();

    expect(result.metadata).toEqual({ title: 'Empty Package' });
    expect(result.navigation).toEqual([]);
    expect(result.raw).toBe(updatedManifest);
  });

  it('Non-TC: preserves 3+ level nested navigation structures', async () => {
    const service = new PackageService(
      createTempDirManager() as unknown as TempDirManager,
      createSessionService() as never,
    );
    const updatedManifest = [
      '---',
      'title: Deep Package',
      '---',
      '',
      '- Guides',
      '  - Advanced',
      '    - [Runtime](guides/advanced/runtime.md)',
    ].join('\n');
    const updatedParsed = {
      metadata: { title: 'Deep Package' },
      navigation: [
        {
          displayName: 'Guides',
          children: [
            {
              displayName: 'Advanced',
              children: [createNode('Runtime', 'guides/advanced/runtime.md')],
              isGroup: true,
            },
          ],
          isGroup: true,
        },
      ],
      raw: updatedManifest,
    };

    await openPackage(service);

    vi.mocked(fs.readFile).mockResolvedValueOnce(updatedManifest);
    vi.mocked(pkg.parseManifest).mockReturnValueOnce(updatedParsed);

    const result = await service.getManifest();
    const deepNode = result.navigation[0]?.children[0]?.children[0];

    expect(result.navigation).toEqual(updatedParsed.navigation);
    expect(deepNode?.displayName).toBe('Runtime');
    expect(deepNode?.filePath).toBe('guides/advanced/runtime.md');
    expect(path.join('/tmp/mdv-pkg-manifest', deepNode?.filePath ?? '')).toBe(
      '/tmp/mdv-pkg-manifest/guides/advanced/runtime.md',
    );
  });
});
