import { vi } from 'vitest';

export function createMockBrowserWindow() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const webContents = {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
  };

  return {
    webContents,
    loadURL: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const current = listeners.get(event) ?? [];
      listeners.set(event, [...current, handler]);
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const current = listeners.get(event) ?? [];
      listeners.set(event, [...current, handler]);
    }),
    emit(event: string, ...args: unknown[]) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }
    },
  };
}

export function createMockIpcMain() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();

  return {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
      handlers.set(channel, handler);
    }),
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
    invoke(channel: string, ...args: unknown[]) {
      return handlers.get(channel)?.(...args);
    },
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
