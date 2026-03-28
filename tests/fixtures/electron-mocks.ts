import { vi } from 'vitest';

export function createMockBrowserWindow() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const webContents = {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    isLoading: vi.fn().mockReturnValue(false),
  };

  return {
    webContents,
    loadURL: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    focus: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    isMinimized: vi.fn().mockReturnValue(false),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const current = listeners.get(event) ?? [];
      listeners.set(event, [...current, handler]);
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const current = listeners.get(event) ?? [];
      listeners.set(event, [...current, handler]);
    }),
    restore: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }
    },
  };
}

export function createMockIpcMain() {
  const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();

  const addHandler = (channel: string, handler: (...args: unknown[]) => unknown) => {
    const list = handlers.get(channel) ?? [];
    list.push(handler);
    handlers.set(channel, list);
  };

  return {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
      addHandler(channel, handler);
    }),
    once: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
      addHandler(channel, handler);
    }),
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      addHandler(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
    invoke(channel: string, ...args: unknown[]) {
      const channelHandlers = handlers.get(channel) ?? [];
      let lastResult: unknown;

      for (const handler of channelHandlers) {
        lastResult = handler(...args);
      }

      return lastResult;
    },
  };
}

export function createMockIpcRenderer(ipcMain?: ReturnType<typeof createMockIpcMain>) {
  return {
    on: vi.fn(),
    send: vi.fn(),
    invoke: vi.fn(async (channel: string, ...args: unknown[]) => {
      if (!ipcMain) {
        return undefined;
      }

      return ipcMain.invoke(channel, ...args);
    }),
  };
}

export function createMockApp() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    whenReady: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const current = listeners.get(event) ?? [];
      listeners.set(event, [...current, handler]);
    }),
    quit: vi.fn(),
    exit: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    emit(event: string, ...args: unknown[]) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }
    },
  };
}

export function createMockMenu() {
  return {
    buildFromTemplate: vi.fn((template: unknown[]) => ({ template })),
    setApplicationMenu: vi.fn(),
  };
}

export function createMockDialog() {
  return {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  };
}

export function createMockContextBridge() {
  return {
    exposeInMainWorld: vi.fn(),
  };
}
