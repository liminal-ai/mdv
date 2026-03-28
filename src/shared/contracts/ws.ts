import { z } from 'zod/v4';
import { AbsolutePathSchema, FileChangeEventTypeSchema } from './core.js';

export const FileChangeEventSchema = z.object({
  path: AbsolutePathSchema,
  event: FileChangeEventTypeSchema,
});

export const ClientWsMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('watch'), path: AbsolutePathSchema }),
  z.object({ type: z.literal('unwatch'), path: AbsolutePathSchema }),
  z.object({ type: z.literal('watch-root'), path: AbsolutePathSchema }),
  z.object({ type: z.literal('unwatch-root') }),
]);

export const ServerWsMessageSchema = z.discriminatedUnion('type', [
  FileChangeEventSchema.extend({
    type: z.literal('file-change'),
  }),
  z.object({
    type: z.literal('tree-change'),
    root: AbsolutePathSchema,
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
]);

export type FileChangeEvent = z.infer<typeof FileChangeEventSchema>;
export type ClientWsMessage = z.infer<typeof ClientWsMessageSchema>;
export type ServerWsMessage = z.infer<typeof ServerWsMessageSchema>;
