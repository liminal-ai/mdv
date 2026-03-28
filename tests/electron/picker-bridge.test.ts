import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockBrowserWindow,
  createMockContextBridge,
  createMockDialog,
  createMockIpcMain,
  createMockIpcRenderer,
} from '../fixtures/electron-mocks.js';

describe('electron picker bridge', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadPickerBridge() {
    const mockDialog = createMockDialog();
    const mockIpcMain = createMockIpcMain();
    const mockIpcRenderer = createMockIpcRenderer(mockIpcMain);
    const mockContextBridge = createMockContextBridge();
    const mockWindow = createMockBrowserWindow();

    vi.doMock('electron', () => ({
      dialog: mockDialog,
      ipcMain: mockIpcMain,
      ipcRenderer: mockIpcRenderer,
      contextBridge: mockContextBridge,
      BrowserWindow: vi.fn(),
    }));

    const { registerIpcHandlers } = await import('../../src/electron/ipc.js');
    registerIpcHandlers(mockWindow as never);

    await import('../../src/electron/preload.js');
    const bridge = mockContextBridge.exposeInMainWorld.mock.calls[0]?.[1];

    if (!bridge) {
      throw new Error('Electron bridge was not exposed');
    }

    return {
      bridge,
      mockDialog,
      mockIpcRenderer,
    };
  }

  it('routes markdown, folder, and package pickers through native dialogs', async () => {
    const { bridge, mockDialog, mockIpcRenderer } = await loadPickerBridge();

    mockDialog.showOpenDialog
      .mockResolvedValueOnce({ canceled: false, filePaths: ['/tmp/doc.md'] })
      .mockResolvedValueOnce({ canceled: false, filePaths: ['/tmp/folder'] })
      .mockResolvedValueOnce({ canceled: false, filePaths: ['/tmp/docs.mpk'] });

    await expect(bridge.pickMarkdownFile()).resolves.toEqual({ path: '/tmp/doc.md' });
    await expect(bridge.pickFolder()).resolves.toEqual({ path: '/tmp/folder' });
    await expect(bridge.pickPackage()).resolves.toEqual({ path: '/tmp/docs.mpk' });

    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('dialog:pick-markdown-file');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('dialog:pick-folder');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('dialog:pick-package');
    expect(mockDialog.showOpenDialog).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        title: 'Open Markdown File',
        properties: ['openFile'],
      }),
    );
    expect(mockDialog.showOpenDialog).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        title: 'Select Folder',
        properties: ['openDirectory'],
      }),
    );
    expect(mockDialog.showOpenDialog).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        title: 'Open Package',
        properties: ['openFile'],
      }),
    );
  });

  it('returns null when native pickers are cancelled', async () => {
    const { bridge, mockDialog } = await loadPickerBridge();

    mockDialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    mockDialog.showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });

    await expect(bridge.pickMarkdownFile()).resolves.toBeNull();
    await expect(
      bridge.saveDialog({
        defaultPath: '/tmp',
        defaultFilename: 'draft.md',
        prompt: 'Save',
      }),
    ).resolves.toBeNull();
  });

  it('passes save dialog defaults through to the native dialog', async () => {
    const { bridge, mockDialog, mockIpcRenderer } = await loadPickerBridge();

    mockDialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/story.md',
    });

    await expect(
      bridge.saveDialog({
        defaultPath: '/tmp',
        defaultFilename: 'story.md',
        prompt: 'Save',
      }),
    ).resolves.toEqual({ path: '/tmp/story.md' });

    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('dialog:save', {
      defaultPath: '/tmp',
      defaultFilename: 'story.md',
      prompt: 'Save',
    });
    expect(mockDialog.showSaveDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: 'Save',
        defaultPath: '/tmp/story.md',
      }),
    );
  });
});
