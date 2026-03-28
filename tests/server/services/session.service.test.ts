import * as fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySession } from '../../fixtures/session.js';
import { createTempDir, removeTempDir } from '../../utils/tmp.js';

const SESSION_FILE = 'session.json';

async function writeSessionFile(sessionDir: string, session: unknown): Promise<void> {
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionDir, SESSION_FILE),
    `${JSON.stringify(session, null, 2)}\n`,
    'utf8',
  );
}

async function readSessionFile(sessionDir: string) {
  const raw = await fs.readFile(path.join(sessionDir, SESSION_FILE), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('SessionService real filesystem', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.resetModules();
    await Promise.all(tempDirs.splice(0).map((dir) => removeTempDir(dir)));
  });

  it('TC-8.3b: Recent file that no longer exists is quietly removed on load', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);

    const existingFile = path.join(sessionDir, 'exists.md');
    await fs.writeFile(existingFile, '# Exists\n', 'utf8');

    const missingFile = path.join(sessionDir, 'gone.md');

    await writeSessionFile(sessionDir, {
      workspaces: [],
      lastRoot: null,
      recentFiles: [
        { path: existingFile, openedAt: '2026-03-18T00:00:00.000Z' },
        { path: missingFile, openedAt: '2026-03-17T00:00:00.000Z' },
      ],
      theme: 'light-default',
      sidebarState: { workspacesCollapsed: false },
    });

    const { SessionService } = await import('../../../src/server/services/session.service.js');
    const service = new SessionService(sessionDir, fs);
    const session = await service.load();

    expect(session.recentFiles).toEqual([
      { path: existingFile, openedAt: '2026-03-18T00:00:00.000Z' },
    ]);

    const persisted = await readSessionFile(sessionDir);
    expect((persisted.recentFiles as Array<{ path: string }>).map((f) => f.path)).toEqual([
      existingFile,
    ]);
  });

  it('Non-TC: Recent files capped at 20', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const { SessionService } = await import('../../../src/server/services/session.service.js');
    const service = new SessionService(sessionDir, fs);

    for (let i = 0; i < 21; i++) {
      await service.touchRecentFile(`/tmp/file-${i}.md`);
    }

    const session = await service.load();

    expect(session.recentFiles).toHaveLength(20);
    expect(session.recentFiles[0].path).toBe('/tmp/file-20.md');
    expect(session.recentFiles.find((f) => f.path === '/tmp/file-0.md')).toBeUndefined();
  });

  it('Non-TC: Default session returned when no session.json exists', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const { SessionService } = await import('../../../src/server/services/session.service.js');
    const service = new SessionService(sessionDir, fs);

    const session = await service.load();

    expect(session).toEqual(emptySession);
  });
});

describe('SessionService fs mocks', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('node:fs/promises');
  });

  it('uses mocked node:fs/promises for atomic writes', async () => {
    vi.resetModules();

    const mkdir = vi.fn().mockResolvedValue(undefined);
    const readFile = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Missing session'), { code: 'ENOENT' }));
    const rename = vi.fn().mockResolvedValue(undefined);
    const stat = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Missing path'), { code: 'ENOENT' }));
    const writeFile = vi.fn().mockResolvedValue(undefined);

    vi.doMock('node:fs/promises', () => ({
      mkdir,
      readFile,
      rename,
      stat,
      writeFile,
    }));

    const { SessionService } = await import('../../../src/server/services/session.service.js');
    const service = new SessionService('/tmp/mdv-audit-session');

    await service.touchRecentFile('/tmp/example.md');

    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.stringContaining('/tmp/example.md'),
      'utf8',
    );
    expect(rename).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      '/tmp/mdv-audit-session/session.json',
    );
  });
});
