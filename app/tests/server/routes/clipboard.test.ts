import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../src/server/app.js';

function makeMockProc(exitCode = 0) {
  const proc = new EventEmitter() as EventEmitter & { stdin: { write: any; end: any } };
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  setTimeout(() => proc.emit('close', exitCode), 0);
  return proc;
}

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    exec: vi.fn(() => makeMockProc(0)),
  };
});

describe('clipboard routes', () => {
  it('TC-4.4a: Copy path to clipboard', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/clipboard',
      payload: { text: '/Users/leemoore/code/project-atlas' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it('Non-TC: pbcopy failure returns 500', async () => {
    const { exec } = await import('node:child_process');
    const mockExec = vi.mocked(exec);
    mockExec.mockImplementationOnce((() => makeMockProc(1)) as any);

    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/clipboard',
      payload: { text: 'some text' },
    });

    expect(response.statusCode).toBe(500);

    await app.close();
  });

  it('Non-TC: Oversized text rejected', async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/clipboard',
      payload: { text: 'x'.repeat(100_001) },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });
});
