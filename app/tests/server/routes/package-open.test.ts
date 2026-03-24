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
import { emptySession } from '../../fixtures/session.js';

function makeFileStat(): Stats {
  return { isFile: () => true } as Stats;
}

function createSessionService() {
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

const validManifest = '---\ntitle: Test\n---\n\n- [Intro](intro.md)';
const validParsed = {
  metadata: { title: 'Test' },
  navigation: [{ displayName: 'Intro', filePath: 'intro.md', children: [], isGroup: false }],
  raw: validManifest,
};

describe('POST /api/package/open — route-level inject tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns 200 with package info on success', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/mdv-pkg-open-ok');
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.readFile).mockResolvedValueOnce(validManifest);
    vi.mocked(pkg.extractPackage).mockResolvedValue(undefined);
    vi.mocked(pkg.parseManifest).mockReturnValueOnce(validParsed);

    const app = await buildApp({ sessionService: createSessionService() as never });
    const response = await app.inject({
      method: 'POST',
      url: '/api/package/open',
      payload: { filePath: '/packages/sample.mpk' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.packageInfo.sourcePath).toBe('/packages/sample.mpk');
    expect(body.packageInfo.format).toBe('mpk');
    expect(body.packageInfo.manifestStatus).toBe('present');
    expect(body.navigation).toHaveLength(1);

    await app.close();
  });

  it('returns 400 for invalid archive', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/mdv-pkg-open-bad');
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(pkg.extractPackage).mockRejectedValue(
      Object.assign(new Error('bad zip'), { code: 'INVALID_ARCHIVE' }),
    );

    const app = await buildApp({ sessionService: createSessionService() as never });
    const response = await app.inject({
      method: 'POST',
      url: '/api/package/open',
      payload: { filePath: '/packages/corrupt.mpk' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_ARCHIVE');

    await app.close();
  });

  it('returns 404 when file does not exist', async () => {
    vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/mdv-pkg-open-404');
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);

    const app = await buildApp({ sessionService: createSessionService() as never });
    const response = await app.inject({
      method: 'POST',
      url: '/api/package/open',
      payload: { filePath: '/packages/missing.mpk' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('FILE_NOT_FOUND');

    await app.close();
  });

  it('returns 500 for extraction failure', async () => {
    vi.mocked(fs.stat).mockResolvedValue(makeFileStat());
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/mdv-pkg-open-500');
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(pkg.extractPackage).mockRejectedValue(new Error('disk full'));

    const app = await buildApp({ sessionService: createSessionService() as never });
    const response = await app.inject({
      method: 'POST',
      url: '/api/package/open',
      payload: { filePath: '/packages/bigfile.mpk' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('EXTRACTION_ERROR');

    await app.close();
  });
});
