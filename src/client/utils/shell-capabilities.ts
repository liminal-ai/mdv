import type { ApiClient } from '../api.js';
import type { ElectronBridge, ShellSaveDialogRequest } from './electron-bridge.js';

export interface ShellCapabilities {
  pickMarkdownFile: () => Promise<{ path: string } | null>;
  pickFolder: () => Promise<{ path: string } | null>;
  pickPackage: () => Promise<{ path: string } | null>;
  saveDialog: (request: ShellSaveDialogRequest) => Promise<{ path: string } | null>;
}

type ApiPickerSurface = Pick<ApiClient, 'pickFile' | 'browse' | 'pickPackage' | 'saveDialog'> & {
  exportSaveDialog?: (
    defaultPath: string,
    defaultFilename: string,
  ) => Promise<{ path: string } | null>;
};

export function createShellCapabilities(
  api: ApiPickerSurface,
  bridge: ElectronBridge | null,
): ShellCapabilities {
  if (bridge) {
    return {
      pickMarkdownFile: () => bridge.pickMarkdownFile(),
      pickFolder: () => bridge.pickFolder(),
      pickPackage: () => bridge.pickPackage(),
      saveDialog: (request) => bridge.saveDialog(request),
    };
  }

  return {
    pickMarkdownFile: () => api.pickFile(),
    pickFolder: async () => {
      const selection = await api.browse();
      return selection ? { path: selection.path } : null;
    },
    pickPackage: () => api.pickPackage(),
    saveDialog: (request) => {
      if (request.prompt === 'Export document' && api.exportSaveDialog) {
        return api.exportSaveDialog(request.defaultPath, request.defaultFilename);
      }

      return api.saveDialog(request);
    },
  };
}
