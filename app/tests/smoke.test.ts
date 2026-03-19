import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/server/app.js';

describe('smoke', () => {
  it('buildApp returns a Fastify instance', async () => {
    const app = await buildApp();
    expect(app).toBeDefined();
    expect(typeof app.inject).toBe('function');
    await app.close();
  });
});
