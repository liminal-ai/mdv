import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { ClientWsMessageSchema, ServerWsMessageSchema } from '../schemas/index.js';
import { WatchService } from '../services/watch.service.js';

const MARKDOWN_EXTENSIONS_RE = /\.(md|markdown)$/i;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

export async function wsRoutes(app: FastifyInstance) {
  const watchService = new WatchService();

  app.get('/ws', { websocket: true }, (socket, request) => {
    if (!isAllowedOrigin(request.headers.origin)) {
      socket.send(
        JSON.stringify(
          ServerWsMessageSchema.parse({
            type: 'error',
            message: 'WebSocket origin not allowed',
          }),
        ),
      );
      socket.close(1008, 'Origin not allowed');
      return;
    }

    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        const parsed = ClientWsMessageSchema.parse(message);

        switch (parsed.type) {
          case 'watch':
            if (!MARKDOWN_EXTENSIONS_RE.test(parsed.path)) {
              socket.send(
                JSON.stringify(
                  ServerWsMessageSchema.parse({
                    type: 'error',
                    message: 'Only markdown files can be watched',
                  }),
                ),
              );
              break;
            }
            watchService.watch(parsed.path, socket as WebSocket);
            break;
          case 'unwatch':
            watchService.unwatch(parsed.path, socket as WebSocket);
            break;
        }
      } catch {
        socket.send(
          JSON.stringify(
            ServerWsMessageSchema.parse({
              type: 'error',
              message: 'Invalid message format',
            }),
          ),
        );
      }
    });

    socket.on('close', () => {
      watchService.unwatchAll(socket as WebSocket);
    });
  });
}
