// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WsClient } from '../../../src/client/utils/ws.js';
import { basicFileResponse } from '../../fixtures/file-responses.js';
import { emptySession } from '../../fixtures/session.js';

const availableThemes = [
  { id: 'light-default', label: 'Light Default', variant: 'light' as const },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' as const },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' as const },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' as const },
];

class MockWebSocket {
  static readonly CONNECTING = 0;

  static readonly OPEN = 1;

  static readonly CLOSING = 2;

  static readonly CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readonly sent: string[] = [];

  readyState = MockWebSocket.CONNECTING;

  onopen: (() => void) | null = null;

  onmessage: ((event: { data: string }) => void) | null = null;

  onclose: (() => void) | null = null;

  onerror: (() => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: unknown): void {
    this.onmessage?.({
      data: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function renderApp(sessionOverrides: Partial<typeof emptySession> = {}) {
  const session = {
    ...emptySession,
    ...sessionOverrides,
  };

  const api = {
    bootstrap: vi.fn().mockResolvedValue({
      session,
      availableThemes,
    }),
    setRoot: vi.fn(),
    addWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
    setTheme: vi.fn().mockResolvedValue(session),
    setDefaultMode: vi.fn().mockResolvedValue(session),
    updateSidebar: vi.fn().mockResolvedValue(session),
    getTree: vi.fn().mockResolvedValue({ root: '/root', tree: [] }),
    browse: vi.fn().mockResolvedValue(null),
    pickFile: vi.fn().mockResolvedValue(null),
    readFile: vi.fn().mockImplementation(async (path: string) => ({
      ...basicFileResponse,
      path,
      canonicalPath: path,
      filename: path.split('/').filter(Boolean).at(-1) ?? path,
      html: `<h1>${path}</h1>`,
    })),
    openExternal: vi.fn().mockResolvedValue({ ok: true }),
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
    updateTabs: vi
      .fn()
      .mockImplementation(async (openTabs: string[], activeTab: string | null) => ({
        ...session,
        openTabs,
        activeTab,
      })),
    touchRecentFile: vi.fn().mockResolvedValue(session),
    removeRecentFile: vi.fn().mockResolvedValue(session),
  };

  document.body.innerHTML = `
    <div id="app">
      <header id="menu-bar"></header>
      <div id="main">
        <aside id="sidebar"></aside>
        <div id="workspace">
          <div id="tab-strip"></div>
          <div id="content-area"></div>
        </div>
      </div>
    </div>
  `;

  window.__MDV_DISABLE_AUTO_BOOTSTRAP__ = true;
  const { bootstrapApp } = await import('../../../src/client/app.js');
  await bootstrapApp(api as Parameters<typeof bootstrapApp>[0], new WsClient());
  await flushPromises();

  return api;
}

describe('websocket client integration', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    MockWebSocket.reset();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    MockWebSocket.reset();
    document.body.innerHTML = '';
    delete window.__MDV_DISABLE_AUTO_BOOTSTRAP__;
  });

  it('TC-7.2a: File change messages trigger a content refresh', async () => {
    const api = await renderApp({
      openTabs: ['/docs/live.md'],
      activeTab: '/docs/live.md',
    });
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    await flushPromises();

    api.readFile.mockResolvedValueOnce({
      ...basicFileResponse,
      path: '/docs/live.md',
      canonicalPath: '/docs/live.md',
      filename: 'live.md',
      html: '<h1>Updated</h1>',
    });

    socket.receive({
      type: 'file-change',
      path: '/docs/live.md',
      event: 'modified',
    });
    await flushPromises();

    expect(api.readFile).toHaveBeenCalledTimes(2);
    expect(api.readFile).toHaveBeenLastCalledWith('/docs/live.md');
    expect(document.querySelector('.markdown-body')?.innerHTML).toContain('Updated');
  });

  it('TC-7.2c: Auto-reload preserves the active tab scroll position approximately', async () => {
    const api = await renderApp({
      openTabs: ['/docs/live.md'],
      activeTab: '/docs/live.md',
    });
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    await flushPromises();

    const body = document.querySelector<HTMLElement>('.content-area__body')!;
    body.scrollTop = 400;

    api.readFile.mockResolvedValueOnce({
      ...basicFileResponse,
      path: '/docs/live.md',
      canonicalPath: '/docs/live.md',
      filename: 'live.md',
      html: '<h1>Longer</h1>',
    });

    socket.receive({
      type: 'file-change',
      path: '/docs/live.md',
      event: 'modified',
    });
    await flushPromises();

    expect(document.querySelector<HTMLElement>('.content-area__body')?.scrollTop).toBe(400);
  });

  it('TC-9.3a: Connection close shows a reconnecting error notification', async () => {
    const api = await renderApp({
      openTabs: ['/docs/live.md'],
      activeTab: '/docs/live.md',
    });
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    await flushPromises();

    socket.close();
    await flushPromises();

    expect(api.readFile).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain(
      'Live reload disconnected. Reconnecting in 2 seconds.',
    );
  });

  it('Non-TC: A closed connection reconnects after 2 seconds', async () => {
    await renderApp({
      openTabs: ['/docs/live.md'],
      activeTab: '/docs/live.md',
    });
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    await flushPromises();

    vi.useFakeTimers();
    socket.close();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1]?.url).toBe(`ws://${window.location.host}/ws`);
  });

  it('Non-TC: Reconnect re-sends watch messages for every open tab', async () => {
    await renderApp({
      openTabs: ['/docs/one.md', '/docs/two.md'],
      activeTab: '/docs/two.md',
    });
    const initialSocket = MockWebSocket.instances[0]!;
    initialSocket.open();
    await flushPromises();

    vi.useFakeTimers();
    initialSocket.close();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_000);

    const reconnectSocket = MockWebSocket.instances[1]!;
    reconnectSocket.open();
    await Promise.resolve();
    await Promise.resolve();

    expect(reconnectSocket.sent.map((payload) => JSON.parse(payload))).toEqual([
      { type: 'watch', path: '/docs/one.md' },
      { type: 'watch', path: '/docs/two.md' },
    ]);
  });
});
