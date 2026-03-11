import type { MdvBridge } from '../core/ipc';

declare global {
  interface Window {
    mdv: MdvBridge;
  }
}

export function getBridge(): MdvBridge {
  return window.mdv;
}
