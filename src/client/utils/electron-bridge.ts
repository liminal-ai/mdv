interface ElectronBridge {
  isElectron: boolean;
  onMenuAction: (callback: (action: string, args?: unknown) => void) => void;
  onOpenFile: (callback: (path: string) => void) => void;
  onQuitRequest: (callback: () => void) => void;
  confirmQuit: () => void;
  cancelQuit: () => void;
  sendRendererReady: () => void;
  sendMenuState: (state: MenuState) => void;
}

export interface MenuState {
  hasDocument: boolean;
  hasDirtyTab: boolean;
  activeTabDirty: boolean;
  activeTheme: string;
  activeMode: 'render' | 'edit';
  defaultMode: 'render' | 'edit';
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
