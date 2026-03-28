import { describe, expect, it, vi } from 'vitest';
import { createShellCapabilities } from '../../../src/client/utils/shell-capabilities.js';

describe('client shell capabilities', () => {
  it('uses the Electron bridge when available', async () => {
    const api = {
      pickFile: vi.fn(),
      browse: vi.fn(),
      pickPackage: vi.fn(),
      saveDialog: vi.fn(),
      exportSaveDialog: vi.fn(),
    };
    const bridge = {
      isElectron: true,
      onMenuAction: vi.fn(),
      onOpenFile: vi.fn(),
      onQuitRequest: vi.fn(),
      confirmQuit: vi.fn(),
      cancelQuit: vi.fn(),
      sendRendererReady: vi.fn(),
      sendMenuState: vi.fn(),
      pickMarkdownFile: vi.fn().mockResolvedValue({ path: '/tmp/from-electron.md' }),
      pickFolder: vi.fn().mockResolvedValue({ path: '/tmp/folder' }),
      pickPackage: vi.fn().mockResolvedValue({ path: '/tmp/pkg.mpk' }),
      saveDialog: vi.fn().mockResolvedValue({ path: '/tmp/save.md' }),
    };

    const shell = createShellCapabilities(api as never, bridge);

    await expect(shell.pickMarkdownFile()).resolves.toEqual({ path: '/tmp/from-electron.md' });
    await expect(shell.pickFolder()).resolves.toEqual({ path: '/tmp/folder' });
    await expect(shell.pickPackage()).resolves.toEqual({ path: '/tmp/pkg.mpk' });
    await expect(
      shell.saveDialog({
        defaultPath: '/tmp',
        defaultFilename: 'save.md',
        prompt: 'Save',
      }),
    ).resolves.toEqual({ path: '/tmp/save.md' });

    expect(api.pickFile).not.toHaveBeenCalled();
    expect(api.browse).not.toHaveBeenCalled();
    expect(api.pickPackage).not.toHaveBeenCalled();
    expect(api.saveDialog).not.toHaveBeenCalled();
  });

  it('falls back to API-backed pickers in browser mode', async () => {
    const api = {
      pickFile: vi.fn().mockResolvedValue({ path: '/tmp/from-api.md' }),
      browse: vi.fn().mockResolvedValue({ path: '/tmp/folder' }),
      pickPackage: vi.fn().mockResolvedValue({ path: '/tmp/pkg.mpk' }),
      saveDialog: vi.fn().mockResolvedValue({ path: '/tmp/save.md' }),
      exportSaveDialog: vi.fn().mockResolvedValue({ path: '/tmp/export.pdf' }),
    };

    const shell = createShellCapabilities(api as never, null);

    await expect(shell.pickMarkdownFile()).resolves.toEqual({ path: '/tmp/from-api.md' });
    await expect(shell.pickFolder()).resolves.toEqual({ path: '/tmp/folder' });
    await expect(shell.pickPackage()).resolves.toEqual({ path: '/tmp/pkg.mpk' });
    await expect(
      shell.saveDialog({
        defaultPath: '/tmp',
        defaultFilename: 'save.md',
        prompt: 'Save',
      }),
    ).resolves.toEqual({ path: '/tmp/save.md' });
    await expect(
      shell.saveDialog({
        defaultPath: '/tmp',
        defaultFilename: 'export.pdf',
        prompt: 'Export document',
      }),
    ).resolves.toEqual({ path: '/tmp/export.pdf' });

    expect(api.saveDialog).toHaveBeenCalledWith({
      defaultPath: '/tmp',
      defaultFilename: 'save.md',
      prompt: 'Save',
    });
    expect(api.exportSaveDialog).toHaveBeenCalledWith('/tmp', 'export.pdf');
  });
});
