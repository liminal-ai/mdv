import { watch as chokidarWatch, type FSWatcher } from 'chokidar';
import type { WebSocket } from 'ws';
import { ServerWsMessageSchema, type ServerWsMessage } from '../schemas/index.js';

export const WATCH_DEBOUNCE_MS = 300;

export class WatchService {
  private readonly watchers = new Map<string, FSWatcher>();

  private readonly subscribers = new Map<string, Set<WebSocket>>();

  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

  watch(filePath: string, ws: WebSocket): void {
    let subscribers = this.subscribers.get(filePath);
    if (!subscribers) {
      subscribers = new Set();
      this.subscribers.set(filePath, subscribers);
    }

    subscribers.add(ws);

    if (this.watchers.has(filePath)) {
      return;
    }

    this.createWatcher(filePath);
  }

  unwatch(filePath: string, ws: WebSocket): void {
    const subscribers = this.subscribers.get(filePath);
    if (!subscribers) {
      return;
    }

    subscribers.delete(ws);

    if (subscribers.size > 0) {
      return;
    }

    this.subscribers.delete(filePath);
    this.destroyWatcher(filePath);
  }

  unwatchAll(ws: WebSocket): void {
    for (const filePath of [...this.subscribers.keys()]) {
      this.unwatch(filePath, ws);
    }
  }

  private createWatcher(filePath: string): void {
    try {
      const watcher = chokidarWatch(filePath, {
        persistent: true,
        ignoreInitial: true,
      });

      watcher.on('change', () => {
        this.handleChange(filePath);
      });

      watcher.on('unlink', () => {
        this.notifySubscribers(filePath, {
          type: 'file-change',
          path: filePath,
          event: 'deleted',
        });
      });

      watcher.on('add', () => {
        this.notifySubscribers(filePath, {
          type: 'file-change',
          path: filePath,
          event: 'created',
        });
      });

      watcher.on('error', (error) => {
        const message = error instanceof Error ? error.message : 'Unknown watch error';
        this.notifySubscribers(filePath, {
          type: 'error',
          message: `Watch error on ${filePath}: ${message}`,
        });
      });

      this.watchers.set(filePath, watcher);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown watch error';
      this.notifySubscribers(filePath, {
        type: 'error',
        message: `Watch error on ${filePath}: ${message}`,
      });
    }
  }

  private handleChange(filePath: string): void {
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.notifySubscribers(filePath, {
        type: 'file-change',
        path: filePath,
        event: 'modified',
      });
    }, WATCH_DEBOUNCE_MS);

    this.debounceTimers.set(filePath, timer);
  }

  private destroyWatcher(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      void watcher.close();
      this.watchers.delete(filePath);
    }

    const timer = this.debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(filePath);
    }
  }

  private notifySubscribers(filePath: string, message: ServerWsMessage): void {
    const subscribers = this.subscribers.get(filePath);
    if (!subscribers?.size) {
      return;
    }

    const payload = JSON.stringify(ServerWsMessageSchema.parse(message));

    for (const subscriber of subscribers) {
      try {
        subscriber.send(payload);
      } catch {
        // Closed sockets are cleaned up by the route close handler.
      }
    }
  }
}
