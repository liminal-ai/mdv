import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/server/app.js';
import { emptySession } from '../../fixtures/session.js';
import { multipleTabs, singleTab } from '../../fixtures/tab-states.js';
import { createTempDir, removeTempDir } from '../../utils/tmp.js';

const SESSION_FILE = 'session.json';

function sessionFilePath(sessionDir: string): string {
  return path.join(sessionDir, SESSION_FILE);
}

async function readSessionFile(sessionDir: string) {
  const raw = await readFile(sessionFilePath(sessionDir), 'utf8');
  return JSON.parse(raw) as {
    defaultOpenMode: string;
    openTabs: string[];
    activeTab: string | null;
  };
}

async function writeSession(sessionDir: string, session: unknown): Promise<void> {
  await mkdir(sessionDir, { recursive: true });
  await writeFile(sessionFilePath(sessionDir), `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

describe('session routes epic 2', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => removeTempDir(dir)));
  });

  it('TC-6.3c: Default mode persists', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const updateResponse = await app.inject({
      method: 'PUT',
      url: '/api/session/default-mode',
      payload: { mode: 'render' },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().defaultOpenMode).toBe('render');

    await app.close();

    const persisted = await readSessionFile(sessionDir);
    expect(persisted.defaultOpenMode).toBe('render');

    const reloadedApp = await buildApp({ sessionDir });
    const sessionResponse = await reloadedApp.inject({ method: 'GET', url: '/api/session' });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json().session.defaultOpenMode).toBe('render');

    await reloadedApp.close();
  });

  it("Non-TC: Only 'render' accepted in Epic 2", async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/default-mode',
      payload: { mode: 'edit' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PATH',
        message: 'Invalid mode value',
      },
    });

    await app.close();
  });

  it('Non-TC: Tab list persists', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const openTabs = multipleTabs.map((tab) => tab.path);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/tabs',
      payload: { openTabs, activeTab: openTabs[0] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().openTabs).toEqual(openTabs);

    await app.close();

    const persisted = await readSessionFile(sessionDir);
    expect(persisted.openTabs).toEqual(openTabs);
  });

  it('Non-TC: Active tab persists', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const openTabs = multipleTabs.map((tab) => tab.path);
    const activeTab = singleTab.path;
    await writeSession(sessionDir, {
      ...emptySession,
      openTabs,
      activeTab: openTabs[0],
    });
    const app = await buildApp({ sessionDir });

    const updateResponse = await app.inject({
      method: 'PUT',
      url: '/api/session/tabs',
      payload: { openTabs: [activeTab, ...openTabs], activeTab },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().activeTab).toBe(activeTab);

    await app.close();

    const reloadedApp = await buildApp({ sessionDir });
    const sessionResponse = await reloadedApp.inject({ method: 'GET', url: '/api/session' });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json().session.activeTab).toBe(activeTab);

    await reloadedApp.close();
  });

  it('Non-TC: activeTab not in openTabs falls back to first tab', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/session/tabs',
      payload: {
        openTabs: ['/a/one.md', '/a/two.md'],
        activeTab: '/a/nonexistent.md',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().activeTab).toBe('/a/one.md');

    await app.close();
  });

  it('Non-TC: Default session has new fields', async () => {
    const sessionDir = await createTempDir();
    tempDirs.push(sessionDir);
    const app = await buildApp({ sessionDir });

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.statusCode).toBe(200);
    expect(response.json().session).toEqual(emptySession);

    await app.close();
  });
});
