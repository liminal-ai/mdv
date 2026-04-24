import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('chokidar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('chokidar')>();
  return {
    ...actual,
    watch: vi.fn(),
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    watch: vi.fn(),
  };
});

import { watch as chokidarWatch } from 'chokidar';
import { watch as nativeWatch } from 'node:fs';
import { buildApp } from '../../../src/server/app.js';
import { WATCH_DEBOUNCE_MS, WatchService } from '../../../src/server/services/watch.service.js';

const FILE_A = '/tmp/watch-a.md';
const FILE_B = '/tmp/watch-b.md';

class MockChokidarWatcher extends EventEmitter {
  readonly close = vi.fn().mockResolvedValue(undefined);
}

class MockNativeWatcher extends EventEmitter {
  readonly close = vi.fn();
}

function createSocketDouble() {
  return {
    send: vi.fn(),
  };
}

function parseSentMessages(socket: ReturnType<typeof createSocketDouble>) {
  return socket.send.mock.calls.map(([payload]) => JSON.parse(payload as string));
}

async function waitForTick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function nextSocketMessage(socket: {
  once: (event: 'message', listener: (message: Buffer) => void) => void;
}) {
  return new Promise<Record<string, unknown>>((resolve) => {
    socket.once('message', (message) => {
      resolve(JSON.parse(message.toString()));
    });
  });
}

async function nextSocketClose(socket: {
  once: (event: 'close', listener: (code: number, reason: Buffer) => void) => void;
}) {
  return new Promise<{ code: number; reason: string }>((resolve) => {
    socket.once('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });
}

describe('websocket routes and watch service', () => {
  const watchersByPath = new Map<string, MockChokidarWatcher[]>();
  const nativeWatchersByPath = new Map<
    string,
    {
      watcher: MockNativeWatcher;
      listener: (eventType: string, filename: string | Buffer | null | undefined) => void;
      options: unknown;
    }
  >();

  beforeEach(() => {
    vi.clearAllMocks();
    watchersByPath.clear();
    nativeWatchersByPath.clear();
    vi.mocked(chokidarWatch).mockImplementation(((filePath) => {
      const watcher = new MockChokidarWatcher();
      const watchedPath = Array.isArray(filePath) ? filePath[0] : filePath;
      const watchers = watchersByPath.get(watchedPath) ?? [];
      watchers.push(watcher);
      watchersByPath.set(watchedPath, watchers);
      return watcher as never;
    }) as typeof chokidarWatch);
    vi.mocked(nativeWatch).mockImplementation(((
      filePath: string | Buffer | URL,
      optionsOrListener?:
        | {
            persistent?: boolean;
            recursive?: boolean;
            encoding?: BufferEncoding;
          }
        | ((eventType: string, filename: string | Buffer | null) => void),
      maybeListener?: (eventType: string, filename: string | Buffer | null) => void,
    ) => {
      const watcher = new MockNativeWatcher();
      const watchedPath = filePath.toString();
      const listener =
        typeof optionsOrListener === 'function' ? optionsOrListener : (maybeListener ?? (() => {}));
      const options = typeof optionsOrListener === 'function' ? undefined : optionsOrListener;
      nativeWatchersByPath.set(watchedPath, { watcher, listener, options });
      return watcher as never;
    }) as typeof nativeWatch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('TC-7.1a: Watch established on subscribe', async () => {
    const app = await buildApp();
    await app.ready();
    const socket = await app.injectWS('/ws');

    socket.send(JSON.stringify({ type: 'watch', path: FILE_A }));
    await waitForTick();

    expect(chokidarWatch).toHaveBeenCalledWith(FILE_A, {
      persistent: true,
      ignoreInitial: true,
    });

    socket.close();
    await app.close();
  });

  it('TC-7.1b: Watch released on unsubscribe', async () => {
    const app = await buildApp();
    await app.ready();
    const socket = await app.injectWS('/ws');

    socket.send(JSON.stringify({ type: 'watch', path: FILE_A }));
    await waitForTick();
    socket.send(JSON.stringify({ type: 'unwatch', path: FILE_A }));
    await waitForTick();

    expect(watchersByPath.get(FILE_A)?.[0]?.close).toHaveBeenCalledTimes(1);

    socket.close();
    await app.close();
  });

  it('TC-7.2a: File change emits a modified notification', async () => {
    vi.useFakeTimers();
    const service = new WatchService();
    const socket = createSocketDouble();

    service.watch(FILE_A, socket as never);
    await vi.runAllTimersAsync();

    watchersByPath.get(FILE_A)?.[0]?.emit('change');
    await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);

    expect(parseSentMessages(socket)).toEqual([
      {
        type: 'file-change',
        path: FILE_A,
        event: 'modified',
      },
    ]);
  });

  it('TC-7.2b: Rapid changes are debounced into a single notification', async () => {
    vi.useFakeTimers();
    const service = new WatchService();
    const socket = createSocketDouble();

    service.watch(FILE_A, socket as never);
    await vi.runAllTimersAsync();

    const watcher = watchersByPath.get(FILE_A)?.[0];
    for (let index = 0; index < 5; index += 1) {
      watcher?.emit('change');
      await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS - 1);
    }

    expect(socket.send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(parseSentMessages(socket)).toEqual([
      {
        type: 'file-change',
        path: FILE_A,
        event: 'modified',
      },
    ]);
  });

  it('TC-7.3a: Rename with a missing file sends a deleted notification', () => {
    const service = new WatchService();
    const socket = createSocketDouble();

    service.watch(FILE_A, socket as never);

    watchersByPath.get(FILE_A)?.[0]?.emit('unlink');

    expect(parseSentMessages(socket)).toEqual([
      {
        type: 'file-change',
        path: FILE_A,
        event: 'deleted',
      },
    ]);
  });

  it('TC-7.3b: Re-watching a restored file sends a created notification', () => {
    const service = new WatchService();
    const socket = createSocketDouble();

    service.watch(FILE_A, socket as never);

    const watcher = watchersByPath.get(FILE_A)?.[0];
    watcher?.emit('unlink');
    watcher?.emit('add');

    expect(parseSentMessages(socket)).toEqual([
      {
        type: 'file-change',
        path: FILE_A,
        event: 'deleted',
      },
      {
        type: 'file-change',
        path: FILE_A,
        event: 'created',
      },
    ]);
    expect(chokidarWatch).toHaveBeenCalledTimes(1);
  });

  it('TC-7.4a: Twenty simultaneous watched files each create a watcher', async () => {
    const service = new WatchService();

    for (let index = 0; index < 20; index += 1) {
      service.watch(`/tmp/file-${index}.md`, createSocketDouble() as never);
    }

    await waitForTick();

    expect(chokidarWatch).toHaveBeenCalledTimes(20);
  });

  it('Non-TC: Root watchers use native recursive fs.watch on darwin', () => {
    const service = new WatchService('darwin');
    const socket = createSocketDouble();

    service.watchRoot('/tmp/workspace', socket as never);

    expect(nativeWatch).toHaveBeenCalledWith(
      '/tmp/workspace',
      { persistent: true, recursive: true },
      expect.any(Function),
    );
    expect(chokidarWatch).not.toHaveBeenCalled();
  });

  it('Non-TC: Native root watch emits a debounced tree-change on rename', async () => {
    vi.useFakeTimers();
    const service = new WatchService('darwin');
    const socket = createSocketDouble();
    const root = '/tmp/workspace';

    service.watchRoot(root, socket as never);
    nativeWatchersByPath.get(root)?.listener('rename', 'docs/new-note.md');
    await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);

    expect(parseSentMessages(socket)).toEqual([{ type: 'tree-change', root }]);
  });

  it('Non-TC: Native root watch ignores changes under hidden and ignored subtrees', async () => {
    vi.useFakeTimers();
    const service = new WatchService('darwin');
    const socket = createSocketDouble();
    const root = '/tmp/workspace';

    service.watchRoot(root, socket as never);
    nativeWatchersByPath.get(root)?.listener('rename', 'node_modules/pkg/readme.md');
    nativeWatchersByPath.get(root)?.listener('rename', '.git/index.lock');
    await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);

    expect(socket.send).not.toHaveBeenCalled();
  });

  it('Non-TC: Invalid WebSocket messages receive an error response', async () => {
    const app = await buildApp();
    await app.ready();
    const socket = await app.injectWS('/ws');
    const messagePromise = nextSocketMessage(socket);

    socket.send('not-json');

    await expect(messagePromise).resolves.toEqual({
      type: 'error',
      message: 'Invalid message format',
    });

    socket.close();
    await app.close();
  });

  it('Non-TC: rejects websocket connections from non-localhost origins', async () => {
    const app = await buildApp();
    await app.ready();
    let socketClosePromise: Promise<{ code: number; reason: string }> | null = null;
    let socketMessagePromise: Promise<Record<string, unknown>> | null = null;

    await app.injectWS(
      '/ws',
      {
        headers: {
          origin: 'http://evil.example.com',
        },
      },
      {
        onInit(socket) {
          socketMessagePromise = nextSocketMessage(socket);
          socketClosePromise = nextSocketClose(socket);
        },
      },
    );

    await expect(socketMessagePromise).resolves.toEqual({
      type: 'error',
      message: 'WebSocket origin not allowed',
    });
    await expect(socketClosePromise).resolves.toEqual({
      code: 1008,
      reason: 'Origin not allowed',
    });

    await app.close();
  });

  it('Non-TC: allows websocket connections from localhost origins', async () => {
    const app = await buildApp();
    await app.ready();
    const socket = await app.injectWS('/ws', {
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    socket.send(JSON.stringify({ type: 'watch', path: FILE_A }));
    await waitForTick();

    expect(chokidarWatch).toHaveBeenCalledWith(FILE_A, {
      persistent: true,
      ignoreInitial: true,
    });

    socket.close();
    await app.close();
  });

  it('Non-TC: Closing a connection cleans up every watcher owned by that socket', async () => {
    const service = new WatchService();
    const socket = createSocketDouble();

    service.watch(FILE_A, socket as never);
    service.watch(FILE_B, socket as never);
    await waitForTick();

    service.unwatchAll(socket as never);

    expect(watchersByPath.get(FILE_A)?.[0]?.close).toHaveBeenCalledTimes(1);
    expect(watchersByPath.get(FILE_B)?.[0]?.close).toHaveBeenCalledTimes(1);
  });

  it('Non-TC: Atomic save re-establishes the watcher and emits a modified notification', async () => {
    vi.useFakeTimers();
    const service = new WatchService();
    const socket = createSocketDouble();

    service.watch(FILE_A, socket as never);
    await vi.runAllTimersAsync();

    watchersByPath.get(FILE_A)?.[0]?.emit('change');
    await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);

    expect(chokidarWatch).toHaveBeenCalledTimes(1);
    expect(parseSentMessages(socket)).toEqual([
      {
        type: 'file-change',
        path: FILE_A,
        event: 'modified',
      },
    ]);
  });

  it('Non-TC: File recreation via chokidar add event keeps the watcher alive', () => {
    const service = new WatchService();
    const socket = createSocketDouble();

    service.watch(FILE_A, socket as never);

    const watcher = watchersByPath.get(FILE_A)?.[0];
    watcher?.emit('unlink');
    watcher?.emit('add');

    expect(parseSentMessages(socket)).toEqual([
      {
        type: 'file-change',
        path: FILE_A,
        event: 'deleted',
      },
      {
        type: 'file-change',
        path: FILE_A,
        event: 'created',
      },
    ]);
    expect(watcher?.close).not.toHaveBeenCalled();
    expect(chokidarWatch).toHaveBeenCalledTimes(1);
  });
});
