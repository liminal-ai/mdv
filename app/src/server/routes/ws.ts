import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { ClientWsMessageSchema, ServerWsMessageSchema } from '../schemas/index.js';
import { WatchService } from '../services/watch.service.js';

export async function wsRoutes(app: FastifyInstance) {
  const watchService = new WatchService();

  app.get('/ws', { websocket: true }, (socket) => {
    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        const parsed = ClientWsMessageSchema.parse(message);

        switch (parsed.type) {
          case 'watch':
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
