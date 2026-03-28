import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockApp,
  createMockBrowserWindow,
  createMockIpcMain,
} from '../fixtures/electron-mocks.js';

type MockBrowserWindow = ReturnType<typeof createMockBrowserWindow>;

interface LoadMainOptions {
  gotLock?: boolean;
  port?: number;
  startServerError?: Error;
  argv?: string[];
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function loadMain({
  gotLock = true,
  port = 3000,
  startServerError,
  argv,
}: LoadMainOptions = {}) {
  vi.resetModules();

  const app = createMockApp();
  app.requestSingleInstanceLock.mockReturnValue(gotLock);

  const ipcMain = createMockIpcMain();
  const screen = {
    getAllDisplays: vi.fn().mockReturnValue([
      {
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ]),
  };
  const windowState = {
    x: 120,
    y: 80,
    width: 1420,
    height: 960,
    manage: vi.fn(),
  };
  const windowStateKeeper = vi.fn().mockReturnValue(windowState);
  const createdWindows: Array<{ instance: MockBrowserWindow; options: Record<string, unknown> }> =
    [];
  const BrowserWindow = vi.fn(function BrowserWindow(options: Record<string, unknown>) {
    const instance = createMockBrowserWindow();
    createdWindows.push({ instance, options });
    return instance;
  });

  Object.assign(BrowserWindow, {
    getAllWindows: vi.fn(() => createdWindows.map(({ instance }) => instance)),
  });

  const server = {
    close: vi.fn().mockResolvedValue(undefined),
    server: {
      address: vi.fn().mockReturnValue({ port }),
    },
  };

  const startServer = startServerError
    ? vi.fn().mockRejectedValue(startServerError)
    : vi.fn().mockResolvedValue(server);

  const originalArgv = process.argv;
  if (argv) {
    process.argv = argv;
  }

  vi.doMock('electron', () => ({
    app,
    BrowserWindow,
    ipcMain,
    screen,
  }));
  vi.doMock('node:module', () => ({
    createRequire: vi.fn(() =>
      vi.fn((id: string) => {
        if (id === 'electron-window-state') {
          return windowStateKeeper;
        }

        throw new Error(`Unexpected require: ${id}`);
      }),
    ),
  }));
  vi.doMock('../../src/server/index.js', () => ({
    startServer,
  }));

  try {
    await import('../../src/electron/main.js');
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (!gotLock || startServer.mock.calls.length > 0 || createdWindows.length > 0) {
        break;
      }

      await flushPromises();
    }
  } finally {
    process.argv = originalArgv;
  }

  return {
    app,
    createdWindows,
    startServer,
    server,
    ipcMain,
  };
}

describe('electron main process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-7.1a: Fastify starts in-process', async () => {
    const { startServer } = await loadMain({ port: 3000 });

    expect(startServer).toHaveBeenCalledWith({
      openUrl: expect.any(Function),
      preferredPort: 0,
    });

    const [options] = startServer.mock.calls[0] ?? [];
    await expect(options.openUrl('http://localhost:3000')).resolves.toBeUndefined();
  });

  it('TC-7.1b: dynamic port on conflict', async () => {
    const { createdWindows } = await loadMain({ port: 3456 });

    expect(createdWindows[0]?.instance.loadURL).toHaveBeenCalledWith(
      'http://localhost:3456/?electron=1',
    );
  });

  it('TC-7.1c: window hidden until renderer ready', async () => {
    const { createdWindows, ipcMain } = await loadMain();
    const createdWindow = createdWindows[0];

    expect(createdWindow?.options.show).toBe(false);

    // Window should NOT show on ready-to-show (HTML parsed but content not restored yet)
    createdWindow?.instance.emit('ready-to-show');
    expect(createdWindow?.instance.show).toHaveBeenCalledTimes(0);

    // Window shows when renderer signals bootstrap complete
    ipcMain.invoke('app:renderer-ready', { sender: createdWindow?.instance.webContents });
    expect(createdWindow?.instance.show).toHaveBeenCalledTimes(1);
  });

  it('TC-7.2a: single-instance lock', async () => {
    const { app, createdWindows } = await loadMain({ gotLock: false });

    expect(app.quit).toHaveBeenCalledTimes(1);
    expect(createdWindows).toHaveLength(0);
  });

  it('TC-7.2b: second instance routes file', async () => {
    const { app, createdWindows } = await loadMain();
    const createdWindow = createdWindows[0]?.instance;

    app.emit('second-instance', {}, ['md-viewer', '/tmp/notes.md']);

    expect(createdWindow?.focus).toHaveBeenCalledTimes(1);
    expect(createdWindow?.webContents.send).toHaveBeenCalledWith('app:open-file', {
      path: '/tmp/notes.md',
    });
  });

  it('routes an initial launch markdown path after renderer readiness', async () => {
    const { createdWindows, ipcMain } = await loadMain({
      argv: ['/Applications/mdv.app/Contents/MacOS/mdv', '-psn_0_12345', '/tmp/notes.md'],
    });
    const createdWindow = createdWindows[0]?.instance;

    const didFinishLoadHandler = (
      createdWindow?.webContents.on.mock.calls as Array<[string, (...args: unknown[]) => void]>
    ).find(([event]) => event === 'did-finish-load')?.[1];

    didFinishLoadHandler?.();
    ipcMain.invoke('app:renderer-ready', { sender: createdWindow?.webContents });

    expect(createdWindow?.webContents.send).toHaveBeenCalledWith('app:open-file', {
      path: '/tmp/notes.md',
    });
  });

  it('shuts down the Fastify server during will-quit', async () => {
    const { app, server } = await loadMain();
    const event = { preventDefault: vi.fn() };

    app.emit('will-quit', event);
    await flushPromises();

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(app.exit).toHaveBeenCalledWith(0);
  });

  it('TC-13.2a: server start failure shows error', async () => {
    const { createdWindows } = await loadMain({
      startServerError: new Error('boom'),
    });

    expect(createdWindows[0]?.instance.loadURL).toHaveBeenCalledWith(
      'data:text/html,<h1>Server failed to start</h1><p>Check the console for errors.</p>',
    );
  });
});
