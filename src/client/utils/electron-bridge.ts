import type { MenuState } from '../../shared/contracts/electron.js';

export interface ShellSaveDialogRequest {
  defaultPath: string;
  defaultFilename: string;
  prompt?: string;
}

export interface ElectronBridge {
  isElectron: boolean;
  onMenuAction: (callback: (action: string, args?: unknown) => void) => void;
  onOpenFile: (callback: (path: string) => void) => void;
  onQuitRequest: (callback: () => void) => void;
  confirmQuit: () => void;
  cancelQuit: () => void;
  sendRendererReady: () => void;
  sendMenuState: (state: MenuState) => void;
  pickMarkdownFile: () => Promise<{ path: string } | null>;
  pickFolder: () => Promise<{ path: string } | null>;
  pickPackage: () => Promise<{ path: string } | null>;
  saveDialog: (request: ShellSaveDialogRequest) => Promise<{ path: string } | null>;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}

export function isElectron(): boolean {
  return window.electron?.isElectron === true;
}

export function getElectronBridge(): ElectronBridge | null {
  return window.electron ?? null;
}
