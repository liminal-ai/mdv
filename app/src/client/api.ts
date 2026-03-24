import type {
  AppBootstrapResponse,
  ExportWarning,
  FilePickerResponse,
  PersistedTab,
  FileReadResponse,
  PackageManifestResponse,
  PackageOpenResponse,
  FileSaveResponse,
  FileTreeResponse,
  RenderFromContentResponse,
  SessionState,
} from '../shared/types.js';

type BrowseResponse = {
  path: string;
} | null;

type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    timeout?: boolean;
  };
};

export class ApiError extends Error {
  public readonly timeout: boolean;

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    timeout = false,
  ) {
    super(message);
    this.name = 'ApiError';
    this.timeout = timeout;
  }
}

export class ApiClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch.bind(window)) {}

  async bootstrap(): Promise<AppBootstrapResponse> {
    return this.request('/api/session');
  }

  async setRoot(root: string): Promise<SessionState> {
    return this.request('/api/session/root', {
      method: 'PUT',
      body: { root },
    });
  }

  async addWorkspace(path: string): Promise<SessionState> {
    return this.request('/api/session/workspaces', {
      method: 'POST',
      body: { path },
    });
  }

  async removeWorkspace(path: string): Promise<SessionState> {
    return this.request('/api/session/workspaces', {
      method: 'DELETE',
      body: { path },
    });
  }

  async setTheme(theme: string): Promise<SessionState> {
    return this.request('/api/session/theme', {
      method: 'PUT',
      body: { theme },
    });
  }

  async setDefaultMode(mode: string): Promise<SessionState> {
    return this.request('/api/session/default-mode', {
      method: 'PUT',
      body: { mode },
    });
  }

  async updateSidebar(workspacesCollapsed: boolean): Promise<SessionState> {
    return this.request('/api/session/sidebar', {
      method: 'PUT',
      body: { workspacesCollapsed },
    });
  }

  async getTree(root: string): Promise<FileTreeResponse> {
    return this.request(`/api/tree?root=${encodeURIComponent(root)}`);
  }

  async browse(): Promise<BrowseResponse> {
    return this.request('/api/browse', {
      method: 'POST',
    });
  }

  async readFile(path: string): Promise<FileReadResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      return await this.request(`/api/file?path=${encodeURIComponent(path)}`, {
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(0, 'READ_TIMEOUT', 'File read timed out');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async openPackage(filePath: string): Promise<PackageOpenResponse> {
    return this.request('/api/package/open', {
      method: 'POST',
      body: { filePath },
    });
  }

  async getPackageManifest(): Promise<PackageManifestResponse> {
    return this.request('/api/package/manifest');
  }

  async render(request: {
    content: string;
    documentPath: string;
  }): Promise<RenderFromContentResponse> {
    return this.request('/api/render', {
      method: 'POST',
      body: request,
    });
  }

  async pickFile(): Promise<FilePickerResponse> {
    return this.request('/api/file/pick', {
      method: 'POST',
    });
  }

  async saveFile(request: {
    path: string;
    content: string;
    expectedModifiedAt?: string | null;
  }): Promise<FileSaveResponse> {
    return this.request('/api/file', {
      method: 'PUT',
      body: request,
    });
  }

  async saveDialog(request: {
    defaultPath: string;
    defaultFilename: string;
    prompt?: string;
  }): Promise<{ path: string } | null> {
    return this.request('/api/save-dialog', {
      method: 'POST',
      body: request,
    });
  }

  async openExternal(path: string): Promise<{ ok: true }> {
    return this.request('/api/open-external', {
      method: 'POST',
      body: { path },
    });
  }

  async copyToClipboard(text: string): Promise<void> {
    await this.request('/api/clipboard', {
      method: 'POST',
      body: { text },
    });
  }

  async updateTabs(openTabs: PersistedTab[], activeTab: string | null): Promise<SessionState> {
    return this.request('/api/session/tabs', {
      method: 'PUT',
      body: { openTabs, activeTab },
    });
  }

  async touchRecentFile(path: string): Promise<SessionState> {
    return this.request('/api/session/recent-files', {
      method: 'POST',
      body: { path },
    });
  }

  async removeRecentFile(path: string): Promise<SessionState> {
    return this.request('/api/session/recent-files', {
      method: 'DELETE',
      body: { path },
    });
  }

  async exportDocument(request: {
    path: string;
    format: string;
    savePath: string;
    theme: string;
  }): Promise<{
    status: string;
    outputPath: string;
    warnings: ExportWarning[];
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      return await this.request('/api/export', {
        method: 'POST',
        body: request,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(0, 'EXPORT_TIMEOUT', 'Export timed out after 120 seconds');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async exportSaveDialog(
    defaultPath: string,
    defaultFilename: string,
  ): Promise<{ path: string } | null> {
    return this.request('/api/save-dialog', {
      method: 'POST',
      body: {
        defaultPath,
        defaultFilename,
        prompt: 'Export document',
      },
    });
  }

  async reveal(filePath: string): Promise<{ ok: true }> {
    return this.request('/api/export/reveal', {
      method: 'POST',
      body: { path: filePath },
    });
  }

  async setLastExportDir(dir: string): Promise<SessionState> {
    return this.request('/api/session/last-export-dir', {
      method: 'PUT',
      body: { path: dir },
    });
  }

  private async request<T>(
    input: string,
    init: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const response = await this.fetchImpl(input, {
      method: init.method ?? 'GET',
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
    const payload = isJson ? ((await response.json()) as T | ErrorPayload) : null;

    if (!response.ok) {
      const errorPayload = payload as ErrorPayload | null;
      throw new ApiError(
        response.status,
        errorPayload?.error?.code ?? 'UNKNOWN_ERROR',
        errorPayload?.error?.message ?? response.statusText ?? 'Request failed',
        errorPayload?.error?.timeout ?? false,
      );
    }

    return payload as T;
  }
}
