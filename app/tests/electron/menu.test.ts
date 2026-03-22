import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockBrowserWindow,
  createMockIpcMain,
  createMockMenu,
} from '../fixtures/electron-mocks.js';

interface MenuEntry {
  label?: string;
  submenu?: MenuEntry[];
  role?: string;
  enabled?: boolean;
  checked?: boolean;
  click?: () => void;
}

interface MenuStatePayload {
  hasDocument: boolean;
  hasDirtyTab: boolean;
  activeTabDirty: boolean;
  activeTheme: string;
  activeMode: string;
  defaultMode: string;
}

type MenuStateHandler = (event: unknown, state: MenuStatePayload) => void;

function getTemplate(mockMenu: ReturnType<typeof createMockMenu>): MenuEntry[] {
  return (mockMenu.buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[]) ?? [];
}

function getStateHandler(
  mockIpcMain: ReturnType<typeof createMockIpcMain>,
): MenuStateHandler | undefined {
  const call = (mockIpcMain.on.mock.calls as Array<[string, MenuStateHandler]>).find(
    ([channel]) => channel === 'menu:state-update',
  );

  return call?.[1];
}

describe('electron/menu', () => {
  let mockApp: { name: string };
  let mockMenu: ReturnType<typeof createMockMenu>;
  let mockIpcMain: ReturnType<typeof createMockIpcMain>;
  let mockWin: ReturnType<typeof createMockBrowserWindow>;
  let buildMenu: (win: typeof mockWin) => void;

  beforeEach(async () => {
    vi.resetModules();

    mockApp = { name: 'MD Viewer' };
    mockMenu = createMockMenu();
    mockIpcMain = createMockIpcMain();
    mockWin = createMockBrowserWindow();

    vi.doMock('electron', () => ({
      app: mockApp,
      Menu: mockMenu,
      BrowserWindow: vi.fn(),
      ipcMain: mockIpcMain,
    }));

    const menuModule = await import('../../src/electron/menu.js');
    buildMenu = menuModule.buildMenu;
  });

  it('TC-8.1a: File menu has correct items', () => {
    buildMenu(mockWin);

    expect(mockMenu.buildFromTemplate).toHaveBeenCalled();
    const template = getTemplate(mockMenu);
    const fileMenu = template.find((item) => item.label === 'File');
    expect(fileMenu).toBeDefined();

    const labels = (fileMenu?.submenu ?? []).filter((item) => item.label).map((item) => item.label);
    expect(labels).toContain('Open File');
    expect(labels).toContain('Open Folder');
    expect(labels).toContain('Save');
    expect(labels).toContain('Save As…');
    expect(labels).toContain('Close Tab');
  });

  it('TC-8.1b: Export menu disabled without document', () => {
    buildMenu(mockWin);

    const template = getTemplate(mockMenu);
    const exportMenu = template.find((item) => item.label === 'Export');
    expect(exportMenu).toBeDefined();

    for (const item of exportMenu?.submenu ?? []) {
      expect(item.enabled).toBe(false);
    }
  });

  it('TC-8.1c: View menu has theme submenu', () => {
    buildMenu(mockWin);

    const template = getTemplate(mockMenu);
    const viewMenu = template.find((item) => item.label === 'View');
    expect(viewMenu).toBeDefined();

    const themeSubItem = viewMenu?.submenu?.find((item) => item.label === 'Theme');
    expect(themeSubItem).toBeDefined();
    expect(themeSubItem?.submenu).toHaveLength(4);

    const themeLabels = themeSubItem?.submenu?.map((theme) => theme.label) ?? [];
    expect(themeLabels).toContain('Light Default');
    expect(themeLabels).toContain('Light Warm');
    expect(themeLabels).toContain('Dark Default');
    expect(themeLabels).toContain('Dark Cool');
  });

  it('TC-8.1d: App menu has standard items', () => {
    buildMenu(mockWin);

    const template = getTemplate(mockMenu);
    const appMenu = template.find((item) => item.label === mockApp.name);
    expect(appMenu).toBeDefined();

    const roles = appMenu?.submenu?.filter((item) => item.role).map((item) => item.role) ?? [];
    expect(roles).toContain('about');
    expect(roles).toContain('hide');
    expect(roles).toContain('quit');
  });

  it('TC-8.1e: menu action sends IPC', () => {
    buildMenu(mockWin);

    const template = getTemplate(mockMenu);
    const fileMenu = template.find((item) => item.label === 'File');
    const openFile = fileMenu?.submenu?.find((item) => item.label === 'Open File');

    openFile?.click?.();
    expect(mockWin.webContents.send).toHaveBeenCalledWith('menu:action', 'open-file');
  });

  it('TC-8.2a: Export disabled synced from state', () => {
    buildMenu(mockWin);

    const stateHandler = getStateHandler(mockIpcMain);
    expect(stateHandler).toBeDefined();

    stateHandler?.(
      {},
      {
        hasDocument: false,
        hasDirtyTab: false,
        activeTabDirty: false,
        activeTheme: 'light-default',
        activeMode: 'render',
        defaultMode: 'render',
      },
    );

    const lastTemplate = getTemplate(mockMenu);
    const exportMenu = lastTemplate.find((item) => item.label === 'Export');
    for (const item of exportMenu?.submenu ?? []) {
      expect(item.enabled).toBe(false);
    }
  });

  it('TC-8.2b: Save reflects dirty state', () => {
    buildMenu(mockWin);

    const stateHandler = getStateHandler(mockIpcMain);
    stateHandler?.(
      {},
      {
        hasDocument: true,
        hasDirtyTab: false,
        activeTabDirty: false,
        activeTheme: 'light-default',
        activeMode: 'render',
        defaultMode: 'render',
      },
    );

    const lastTemplate = getTemplate(mockMenu);
    const fileMenu = lastTemplate.find((item) => item.label === 'File');
    const save = fileMenu?.submenu?.find((item) => item.label === 'Save');
    expect(save?.enabled).toBe(false);
  });

  it('TC-8.2c: Save enabled when dirty', () => {
    buildMenu(mockWin);

    const stateHandler = getStateHandler(mockIpcMain);
    stateHandler?.(
      {},
      {
        hasDocument: true,
        hasDirtyTab: true,
        activeTabDirty: true,
        activeTheme: 'light-default',
        activeMode: 'render',
        defaultMode: 'render',
      },
    );

    const lastTemplate = getTemplate(mockMenu);
    const fileMenu = lastTemplate.find((item) => item.label === 'File');
    const save = fileMenu?.submenu?.find((item) => item.label === 'Save');
    expect(save?.enabled).toBe(true);
  });

  it('TC-8.2d: theme checkmark', () => {
    buildMenu(mockWin);

    const stateHandler = getStateHandler(mockIpcMain);
    stateHandler?.(
      {},
      {
        hasDocument: true,
        hasDirtyTab: false,
        activeTabDirty: false,
        activeTheme: 'dark-cool',
        activeMode: 'render',
        defaultMode: 'render',
      },
    );

    const lastTemplate = getTemplate(mockMenu);
    const viewMenu = lastTemplate.find((item) => item.label === 'View');
    const themeItem = viewMenu?.submenu?.find((item) => item.label === 'Theme');
    const darkCool = themeItem?.submenu?.find((theme) => theme.label === 'Dark Cool');
    const lightDefault = themeItem?.submenu?.find((theme) => theme.label === 'Light Default');

    expect(darkCool?.checked).toBe(true);
    expect(lightDefault?.checked).toBe(false);
  });

  it('shows the current render mode with a checkmark', () => {
    buildMenu(mockWin);

    const stateHandler = getStateHandler(mockIpcMain);
    stateHandler?.(
      {},
      {
        hasDocument: true,
        hasDirtyTab: false,
        activeTabDirty: false,
        activeTheme: 'light-default',
        activeMode: 'edit',
        defaultMode: 'render',
      },
    );

    const lastTemplate = getTemplate(mockMenu);
    const viewMenu = lastTemplate.find((item) => item.label === 'View');
    const renderModeItem = viewMenu?.submenu?.find((item) => item.label === 'Render Mode');

    expect(renderModeItem?.checked).toBe(false);
  });

  it('registers the menu state listener only once across rebuilds', () => {
    buildMenu(mockWin);
    buildMenu(createMockBrowserWindow());

    const menuStateRegistrations = (mockIpcMain.on.mock.calls as Array<[string, unknown]>).filter(
      ([channel]) => channel === 'menu:state-update',
    );

    expect(menuStateRegistrations).toHaveLength(1);
  });
});
