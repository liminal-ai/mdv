import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockBrowserWindow } from '../fixtures/electron-mocks.js';

type MockBrowserWindow = ReturnType<typeof createMockBrowserWindow>;

interface LoadWindowOptions {
  displays?: Array<{ bounds: { x: number; y: number; width: number; height: number } }>;
  stateOverrides?: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

async function loadWindow({ displays, stateOverrides }: LoadWindowOptions = {}) {
  vi.resetModules();

  const screen = {
    getAllDisplays: vi.fn().mockReturnValue(
      displays ?? [
        {
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        },
      ],
    ),
  };
  const state = {
    x: 100,
    y: 100,
    width: 1420,
    height: 960,
    manage: vi.fn(),
    ...stateOverrides,
  };
  const windowStateKeeper = vi.fn().mockReturnValue(state);
  const createdWindows: Array<{ instance: MockBrowserWindow; options: Record<string, unknown> }> =
    [];
  const BrowserWindow = vi.fn(function BrowserWindow(options: Record<string, unknown>) {
    const instance = createMockBrowserWindow();
    createdWindows.push({ instance, options });
    return instance;
  });

  vi.doMock('electron', () => ({
    BrowserWindow,
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

  const { createMainWindow } = await import('../../src/electron/window.js');

  return {
    createMainWindow,
    createdWindows,
    state,
  };
}

describe('electron window creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-7.3a: window state persisted', async () => {
    const { createMainWindow, createdWindows, state } = await loadWindow();

    createMainWindow('http://localhost:3000');

    expect(state.manage).toHaveBeenCalledWith(createdWindows[0]?.instance);
  });

  it('uses the CommonJS preload bundle path', async () => {
    const { createMainWindow, createdWindows } = await loadWindow();

    createMainWindow('http://localhost:3000');

    expect(String(createdWindows[0]?.options.webPreferences?.preload)).toContain('preload.cjs');
  });

  it('TC-7.3b: off-screen window resets position', async () => {
    const { createMainWindow, createdWindows } = await loadWindow({
      stateOverrides: { x: 5000, y: 5000 },
      displays: [
        {
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        },
      ],
    });

    createMainWindow('http://localhost:3000');

    expect(createdWindows[0]?.options.x).toBeUndefined();
    expect(createdWindows[0]?.options.y).toBeUndefined();
  });
});
