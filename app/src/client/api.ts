import type {
  AppBootstrapResponse,
  FilePickerResponse,
  FileReadResponse,
  FileTreeResponse,
  SessionState,
} from '../shared/types.js';

type BrowseResponse = {
  path: string;
} | null;

type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

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
    return this.request(`/api/file?path=${encodeURIComponent(path)}`);
  }

  async pickFile(): Promise<FilePickerResponse> {
    return this.request('/api/file/pick', {
      method: 'POST',
    });
  }

  async copyToClipboard(text: string): Promise<void> {
    await this.request('/api/clipboard', {
      method: 'POST',
      body: { text },
    });
  }

  async updateTabs(openTabs: string[], activeTab: string | null): Promise<SessionState> {
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

  private async request<T>(
    input: string,
    init: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
    } = {},
  ): Promise<T> {
    const response = await this.fetchImpl(input, {
      method: init.method ?? 'GET',
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
    const payload = isJson ? ((await response.json()) as T | ErrorPayload) : null;

    if (!response.ok) {
      const errorPayload = payload as ErrorPayload | null;
      throw new ApiError(
        response.status,
        errorPayload?.error?.code ?? 'UNKNOWN_ERROR',
        errorPayload?.error?.message ?? response.statusText ?? 'Request failed',
      );
    }

    return payload as T;
  }
}
