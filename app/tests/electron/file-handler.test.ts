import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBrowserWindow, createMockIpcMain } from '../fixtures/electron-mocks.js';

type SetupFileHandler = typeof import('../../src/electron/file-handler.js').setupFileHandler;

function getDidFinishLoadHandler(win: ReturnType<typeof createMockBrowserWindow>) {
  const didFinishLoadCall = (
    win.webContents.on.mock.calls as Array<[string, (...args: unknown[]) => void]>
  ).find(([event]) => event === 'did-finish-load');

  return didFinishLoadCall?.[1];
}

describe('electron/file-handler', () => {
  let setupFileHandler: SetupFileHandler;
  let mockIpcMain: ReturnType<typeof createMockIpcMain>;

  beforeEach(async () => {
    vi.resetModules();
    mockIpcMain = createMockIpcMain();

    vi.doMock('electron', () => ({
      BrowserWindow: vi.fn(),
      ipcMain: mockIpcMain,
    }));

    ({ setupFileHandler } = await import('../../src/electron/file-handler.js'));
  });

  it('TC-9.2a: file queued before window ready -> sent after renderer-ready', () => {
    const win = createMockBrowserWindow();
    const getPendingFilePath = vi.fn().mockReturnValue('/tmp/test.md');
    const clearPendingFilePath = vi.fn();

    setupFileHandler(win, getPendingFilePath, clearPendingFilePath);

    const didFinishLoadHandler = getDidFinishLoadHandler(win);
    didFinishLoadHandler?.();

    expect(win.webContents.send).not.toHaveBeenCalled();

    mockIpcMain.invoke('app:renderer-ready', { sender: win.webContents });

    expect(win.webContents.send).toHaveBeenCalledWith('app:open-file', {
      path: '/tmp/test.md',
    });
    expect(clearPendingFilePath).toHaveBeenCalledTimes(1);
  });

  it('does not flush the pending file before did-finish-load', () => {
    const win = createMockBrowserWindow();
    const getPendingFilePath = vi.fn().mockReturnValue('/tmp/test.md');
    const clearPendingFilePath = vi.fn();

    setupFileHandler(win, getPendingFilePath, clearPendingFilePath);

    mockIpcMain.invoke('app:renderer-ready', { sender: win.webContents });

    expect(win.webContents.send).not.toHaveBeenCalled();
    expect(clearPendingFilePath).not.toHaveBeenCalled();
  });

  it('TC-9.2b: file opens in running app (after load) -> no pending IPC flush', () => {
    const win = createMockBrowserWindow();
    const getPendingFilePath = vi.fn().mockReturnValue(null);
    const clearPendingFilePath = vi.fn();

    setupFileHandler(win, getPendingFilePath, clearPendingFilePath);

    const didFinishLoadHandler = getDidFinishLoadHandler(win);
    didFinishLoadHandler?.();
    mockIpcMain.invoke('app:renderer-ready', { sender: win.webContents });

    expect(win.webContents.send).not.toHaveBeenCalled();
    expect(clearPendingFilePath).not.toHaveBeenCalled();
  });

  it('TC-9.2c: dock drag opens file -> same handler as 9.2b', () => {
    const win = createMockBrowserWindow();
    const getPendingFilePath = vi.fn().mockReturnValue(null);
    const clearPendingFilePath = vi.fn();

    setupFileHandler(win, getPendingFilePath, clearPendingFilePath);

    const didFinishLoadHandler = getDidFinishLoadHandler(win);
    didFinishLoadHandler?.();
    mockIpcMain.invoke('app:renderer-ready', { sender: win.webContents });

    expect(win.webContents.send).not.toHaveBeenCalled();
    expect(clearPendingFilePath).not.toHaveBeenCalled();
  });

  it('TC-9.2d: already-open file activates tab -> IPC sent after renderer-ready', () => {
    const win = createMockBrowserWindow();
    const getPendingFilePath = vi.fn().mockReturnValue('/tmp/already-open.md');
    const clearPendingFilePath = vi.fn();

    setupFileHandler(win, getPendingFilePath, clearPendingFilePath);

    const didFinishLoadHandler = getDidFinishLoadHandler(win);
    didFinishLoadHandler?.();
    mockIpcMain.invoke('app:renderer-ready', { sender: win.webContents });

    expect(win.webContents.send).toHaveBeenCalledWith('app:open-file', {
      path: '/tmp/already-open.md',
    });
    expect(clearPendingFilePath).toHaveBeenCalledTimes(1);
  });

  it('TC-9.2e: file open during tab restore -> restore runs first, then open-file', () => {
    const win = createMockBrowserWindow();
    const getPendingFilePath = vi.fn().mockReturnValue('/tmp/restore.md');
    const clearPendingFilePath = vi.fn();
    const eventOrder: string[] = [];

    setupFileHandler(win, getPendingFilePath, clearPendingFilePath);
    win.webContents.on('did-finish-load', () => {
      eventOrder.push('did-finish-load');
    });

    expect(win.webContents.send).not.toHaveBeenCalled();

    const didFinishLoadHandlers = (
      win.webContents.on.mock.calls as Array<[string, (...args: unknown[]) => void]>
    )
      .filter(([event]) => event === 'did-finish-load')
      .map(([, handler]) => handler);

    eventOrder.push('event-fired');
    didFinishLoadHandlers[0]?.();
    didFinishLoadHandlers[1]?.();
    mockIpcMain.invoke('app:renderer-ready', { sender: win.webContents });

    expect(win.webContents.send).toHaveBeenCalledWith('app:open-file', {
      path: '/tmp/restore.md',
    });
    expect(eventOrder).toEqual(['event-fired', 'did-finish-load']);
  });

  it('registers the renderer-ready listener only once', () => {
    setupFileHandler(createMockBrowserWindow(), vi.fn(), vi.fn());
    setupFileHandler(createMockBrowserWindow(), vi.fn(), vi.fn());

    const rendererReadyRegistrations = (
      mockIpcMain.on.mock.calls as Array<[string, unknown]>
    ).filter(([channel]) => channel === 'app:renderer-ready');

    expect(rendererReadyRegistrations).toHaveLength(1);
  });
});
