import { contextBridge, ipcRenderer } from 'electron';

interface DocumentPayload {
  filePath: string;
  html: string;
  warnings: Array<{ code: string; message: string; location?: string }>;
}

const api = {
  openDialog(): Promise<{ ok: boolean; reason?: string }> {
    return ipcRenderer.invoke('document:open-dialog');
  },
  openPath(filePath: string): Promise<{ ok: boolean; reason?: string }> {
    return ipcRenderer.invoke('document:open-path', filePath);
  },
  reload(): Promise<{ ok: boolean; reason?: string }> {
    return ipcRenderer.invoke('document:reload');
  },
  getState(): Promise<DocumentPayload | null> {
    return ipcRenderer.invoke('document:get-state');
  },
  exportPdf(): Promise<{ ok: boolean; reason?: string; filePath?: string }> {
    return ipcRenderer.invoke('export:pdf');
  },
  exportDocx(): Promise<{
    ok: boolean;
    reason?: string;
    filePath?: string;
    warnings?: Array<{ code: string; message: string; location?: string }>;
  }> {
    return ipcRenderer.invoke('export:docx');
  },
  exportHtml(): Promise<{
    ok: boolean;
    reason?: string;
    filePath?: string;
    warnings?: Array<{ code: string; message: string; location?: string }>;
  }> {
    return ipcRenderer.invoke('export:html');
  },
  onDocumentUpdated(handler: (payload: DocumentPayload) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: DocumentPayload) => handler(payload);
    ipcRenderer.on('document:updated', wrapped);
    return () => ipcRenderer.removeListener('document:updated', wrapped);
  }
};

contextBridge.exposeInMainWorld('mdv', api);
