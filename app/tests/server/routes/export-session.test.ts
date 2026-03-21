import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/server/app.js';
import { createTempDir, removeTempDir } from '../../utils/tmp.js';

const SESSION_FILE = 'session.json';

async function readSessionFile(sessionDir: string) {
  const raw = await readFile(path.join(sessionDir, SESSION_FILE), 'utf8');
  return JSON.parse(raw) as {
    lastExportDir: string | null;
  };
}

describe('export session routes', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => removeTempDir(dir)));
  });

  it('TC-1.4a: Last export dir is persisted', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    await mkdir(sessionDir, { recursive: true });
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/last-export-dir',
      payload: { path: '/Users/test/exports' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().lastExportDir).toBe('/Users/test/exports');
    expect((await readSessionFile(sessionDir)).lastExportDir).toBe('/Users/test/exports');

    await app.close();
  });

  it('Non-TC: Default session has null lastExportDir', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.statusCode).toBe(200);
    expect(response.json().session.lastExportDir).toBeNull();

    await app.close();
  });

  it('Non-TC: Relative paths are rejected', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/last-export-dir',
      payload: { path: 'relative/export-dir' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Path must be absolute',
      },
    });

    await app.close();
  });
});
