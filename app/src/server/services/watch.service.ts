import { type FSWatcher, watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { WebSocket } from 'ws';
import { ServerWsMessageSchema, type ServerWsMessage } from '../schemas/index.js';

export const WATCH_DEBOUNCE_MS = 300;
export const WATCH_RENAME_SETTLE_MS = 50;

export class WatchService {
  private readonly watchers = new Map<string, FSWatcher>();

  private readonly subscribers = new Map<string, Set<WebSocket>>();

  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

  private readonly deletedPaths = new Set<string>();

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

    void this.ensureWatcher(filePath);
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
    this.deletedPaths.delete(filePath);
    this.destroyWatcher(filePath);
  }

  unwatchAll(ws: WebSocket): void {
    for (const filePath of [...this.subscribers.keys()]) {
      this.unwatch(filePath, ws);
    }
  }

  private async ensureWatcher(filePath: string): Promise<void> {
    try {
      await stat(filePath);
    } catch {
      if (!this.deletedPaths.has(filePath)) {
        this.notifySubscribers(filePath, {
          type: 'error',
          message: `Unable to watch missing file: ${filePath}`,
        });
      }
      return;
    }

    if (!this.subscribers.has(filePath) || this.watchers.has(filePath)) {
      return;
    }

    this.createWatcher(filePath);

    if (this.deletedPaths.delete(filePath)) {
      this.notifySubscribers(filePath, {
        type: 'file-change',
        path: filePath,
        event: 'created',
      });
    }
  }

  private createWatcher(filePath: string): void {
    try {
      const watcher = watch(filePath, (eventType) => {
        if (eventType === 'rename') {
          void this.handleRename(filePath);
          return;
        }

        this.handleChange(filePath);
      });

      watcher.on('error', (error) => {
        this.notifySubscribers(filePath, {
          type: 'error',
          message: `Watch error on ${filePath}: ${error.message}`,
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

  private async handleRename(filePath: string): Promise<void> {
    this.destroyWatcher(filePath);

    await new Promise((resolve) => {
      setTimeout(resolve, WATCH_RENAME_SETTLE_MS);
    });

    if (!this.subscribers.has(filePath)) {
      return;
    }

    try {
      await stat(filePath);
    } catch {
      this.deletedPaths.add(filePath);
      this.notifySubscribers(filePath, {
        type: 'file-change',
        path: filePath,
        event: 'deleted',
      });
      return;
    }

    if (!this.subscribers.has(filePath)) {
      return;
    }

    this.createWatcher(filePath);
    this.handleChange(filePath);
  }

  private destroyWatcher(filePath: string): void {
    this.watchers.get(filePath)?.close();
    this.watchers.delete(filePath);

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
