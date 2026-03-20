import { EventEmitter } from 'node:events';
import type { Stats } from 'node:fs';
import { watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    watch: vi.fn(),
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: vi.fn(),
  };
});

import { buildApp } from '../../../src/server/app.js';
import {
  WATCH_DEBOUNCE_MS,
  WATCH_RENAME_SETTLE_MS,
  WatchService,
} from '../../../src/server/services/watch.service.js';

const FILE_A = '/tmp/watch-a.md';
const FILE_B = '/tmp/watch-b.md';

class MockFsWatcher extends EventEmitter {
  readonly close = vi.fn();

  constructor(
    private readonly callback: (
      eventType: 'change' | 'rename',
      filename?: string | Buffer | null,
    ) => void,
  ) {
    super();
  }

  emitFsEvent(eventType: 'change' | 'rename'): void {
    this.callback(eventType, null);
  }
}

function makeFileStat(): Stats {
  return {
    isFile: () => true,
  } as Stats;
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

describe('websocket routes and watch service', () => {
  const watchersByPath = new Map<string, MockFsWatcher[]>();

  beforeEach(() => {
    vi.clearAllMocks();
    watchersByPath.clear();
    vi.mocked(stat).mockResolvedValue(makeFileStat());
    vi.mocked(watch).mockImplementation(((
      filePath: string,
      callback: Parameters<typeof watch>[1],
    ) => {
      const watcher = new MockFsWatcher(callback);
      const watchers = watchersByPath.get(filePath) ?? [];
      watchers.push(watcher);
      watchersByPath.set(filePath, watchers);
      return watcher as never;
    }) as typeof watch);
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

    expect(watch).toHaveBeenCalledWith(FILE_A, expect.any(Function));

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

    watchersByPath.get(FILE_A)?.[0]?.emitFsEvent('change');
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
      watcher?.emitFsEvent('change');
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

  it('TC-7.3a: Rename with a missing file sends a deleted notification', async () => {
    vi.useFakeTimers();
    const service = new WatchService();
    const socket = createSocketDouble();

    service.watch(FILE_A, socket as never);
    await vi.runAllTimersAsync();
    vi.mocked(stat).mockRejectedValueOnce(Object.assign(new Error('Missing'), { code: 'ENOENT' }));

    watchersByPath.get(FILE_A)?.[0]?.emitFsEvent('rename');
    await vi.advanceTimersByTimeAsync(WATCH_RENAME_SETTLE_MS);
    await vi.runAllTimersAsync();

    expect(parseSentMessages(socket)).toEqual([
      {
        type: 'file-change',
        path: FILE_A,
        event: 'deleted',
      },
    ]);
  });

  it('TC-7.3b: Re-watching a restored file sends a created notification', async () => {
    vi.useFakeTimers();
    const service = new WatchService();
    const socket = createSocketDouble();

    service.watch(FILE_A, socket as never);
    await vi.runAllTimersAsync();
    vi.mocked(stat).mockRejectedValueOnce(Object.assign(new Error('Missing'), { code: 'ENOENT' }));

    watchersByPath.get(FILE_A)?.[0]?.emitFsEvent('rename');
    await vi.advanceTimersByTimeAsync(WATCH_RENAME_SETTLE_MS);
    await vi.runAllTimersAsync();

    vi.mocked(stat).mockResolvedValueOnce(makeFileStat());
    service.watch(FILE_A, socket as never);
    await vi.runAllTimersAsync();

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
    expect(watch).toHaveBeenCalledTimes(2);
  });

  it('TC-7.4a: Twenty simultaneous watched files each create a watcher', async () => {
    const service = new WatchService();

    for (let index = 0; index < 20; index += 1) {
      service.watch(`/tmp/file-${index}.md`, createSocketDouble() as never);
    }

    await waitForTick();

    expect(watch).toHaveBeenCalledTimes(20);
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

    watchersByPath.get(FILE_A)?.[0]?.emitFsEvent('rename');
    await vi.advanceTimersByTimeAsync(WATCH_RENAME_SETTLE_MS + WATCH_DEBOUNCE_MS);

    expect(watch).toHaveBeenCalledTimes(2);
    expect(watchersByPath.get(FILE_A)?.[0]?.close).toHaveBeenCalledTimes(1);
    expect(parseSentMessages(socket)).toEqual([
      {
        type: 'file-change',
        path: FILE_A,
        event: 'modified',
      },
    ]);
  });
});
