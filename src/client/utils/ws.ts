import { ServerWsMessageSchema } from '../../shared/contracts/ws.js';
import type { ClientWsMessage, ServerWsMessage } from '../../shared/types.js';

type ServerMessageByType<T extends ServerWsMessage['type']> = Extract<ServerWsMessage, { type: T }>;

type WsClientEventMap = {
  open: { type: 'open' };
  close: { type: 'close' };
  'file-change': ServerMessageByType<'file-change'>;
  'tree-change': ServerMessageByType<'tree-change'>;
  error: ServerMessageByType<'error'>;
};

type WsClientEventType = keyof WsClientEventMap;
type WsClientHandler<T extends WsClientEventType> = (event: WsClientEventMap[T]) => void;

const WS_RECONNECT_DELAY_MS = 2_000;
const savePending = new Map<string, boolean>();

export function markSavePending(path: string): void {
  savePending.set(path, true);
}

export function clearSavePending(path: string): void {
  savePending.delete(path);
}

export function isSavePending(path: string): boolean {
  return savePending.has(path);
}

export class WsClient {
  private socket: WebSocket | null = null;

  private readonly handlers = new Map<WsClientEventType, Set<WsClientHandler<WsClientEventType>>>();

  private reconnectTimer: number | null = null;

  private shouldReconnect = true;

  connect(): void {
    this.shouldReconnect = true;

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws`);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }

      this.dispatch('open', { type: 'open' });
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return;
      }

      try {
        const parsed = JSON.parse(event.data);
        const result = ServerWsMessageSchema.safeParse(parsed);
        if (!result.success) {
          return;
        }

        const message = result.data;
        if (
          message.type === 'file-change' ||
          message.type === 'tree-change' ||
          message.type === 'error'
        ) {
          this.dispatch(message.type, message as WsClientEventMap[typeof message.type]);
        }
      } catch {
        // Ignore malformed server messages.
      }
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }

      this.dispatch('close', { type: 'close' });

      if (!this.shouldReconnect) {
        return;
      }

      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, WS_RECONNECT_DELAY_MS);
    };

    socket.onerror = () => {
      // Reconnect is handled by the close event.
    };
  }

  send(message: ClientWsMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  on<T extends WsClientEventType>(type: T, handler: WsClientHandler<T>): () => void {
    const handlers = this.handlers.get(type) ?? new Set();
    handlers.add(handler as WsClientHandler<WsClientEventType>);
    this.handlers.set(type, handlers);

    return () => {
      handlers.delete(handler as WsClientHandler<WsClientEventType>);
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  private dispatch<T extends WsClientEventType>(type: T, event: WsClientEventMap[T]): void {
    const handlers = this.handlers.get(type);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      (handler as WsClientHandler<T>)(event);
    }
  }
}
