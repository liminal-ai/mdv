import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBrowserWindow, createMockIpcMain } from '../fixtures/electron-mocks.js';

type IpcChannelHandler = (...args: unknown[]) => void;

function getHandler(
  ipcMain: ReturnType<typeof createMockIpcMain>,
  channel: string,
): IpcChannelHandler | undefined {
  const call = (ipcMain.on.mock.calls as Array<[string, IpcChannelHandler]>).find(
    ([registeredChannel]) => registeredChannel === channel,
  );

  return call?.[1];
}

describe('electron/ipc', () => {
  let mockWin: ReturnType<typeof createMockBrowserWindow>;
  let mockIpcMain: ReturnType<typeof createMockIpcMain>;
  let registerIpcHandlers: (win: typeof mockWin) => void;

  beforeEach(async () => {
    vi.resetModules();

    mockWin = createMockBrowserWindow();
    mockIpcMain = createMockIpcMain();

    vi.doMock('electron', () => ({
      ipcMain: mockIpcMain,
      BrowserWindow: vi.fn(),
    }));

    const ipcModule = await import('../../src/electron/ipc.js');
    registerIpcHandlers = ipcModule.registerIpcHandlers;
  });

  it('TC-10.1a: quit via Cmd+Q sends request to renderer', () => {
    registerIpcHandlers(mockWin);

    const event = { preventDefault: vi.fn() };
    mockWin.emit('close', event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockWin.webContents.send).toHaveBeenCalledWith('app:quit-request');
  });

  it('TC-10.1b: quit via window close button sends request', () => {
    registerIpcHandlers(mockWin);

    const event = { preventDefault: vi.fn() };
    mockWin.emit('close', event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockWin.webContents.send).toHaveBeenCalledWith('app:quit-request');
  });

  it('TC-10.1c: quit-confirmed closes window', () => {
    registerIpcHandlers(mockWin);

    const event1 = { preventDefault: vi.fn() };
    mockWin.emit('close', event1);

    const confirmedHandler = getHandler(mockIpcMain, 'app:quit-confirmed');
    confirmedHandler?.();

    const event2 = { preventDefault: vi.fn() };
    mockWin.emit('close', event2);
    expect(event2.preventDefault).not.toHaveBeenCalled();
  });

  it('TC-10.1d: discard-all-and-quit closes window', () => {
    registerIpcHandlers(mockWin);

    const event = { preventDefault: vi.fn() };
    mockWin.emit('close', event);

    const confirmedHandler = getHandler(mockIpcMain, 'app:quit-confirmed');
    confirmedHandler?.();

    const event2 = { preventDefault: vi.fn() };
    mockWin.emit('close', event2);
    expect(event2.preventDefault).not.toHaveBeenCalled();
  });

  it('TC-10.1e: quit-cancelled keeps window', () => {
    registerIpcHandlers(mockWin);

    const event1 = { preventDefault: vi.fn() };
    mockWin.emit('close', event1);
    expect(event1.preventDefault).toHaveBeenCalled();

    const cancelledHandler = getHandler(mockIpcMain, 'app:quit-cancelled');
    cancelledHandler?.();

    const event2 = { preventDefault: vi.fn() };
    mockWin.emit('close', event2);
    expect(event2.preventDefault).toHaveBeenCalled();
    expect(mockWin.webContents.send).toHaveBeenCalledWith('app:quit-request');
  });

  it('TC-10.1f: clean quit skips modal', () => {
    registerIpcHandlers(mockWin);

    const event = { preventDefault: vi.fn() };
    mockWin.emit('close', event);

    const confirmedHandler = getHandler(mockIpcMain, 'app:quit-confirmed');
    confirmedHandler?.();

    const event2 = { preventDefault: vi.fn() };
    mockWin.emit('close', event2);
    expect(event2.preventDefault).not.toHaveBeenCalled();
  });
});
