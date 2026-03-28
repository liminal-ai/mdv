import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../src/client/api.js';

describe('ApiClient exportDocument', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('times out after 120 seconds', async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        }),
    );

    const api = new ApiClient(fetchImpl as typeof fetch);
    const requestPromise = api.exportDocument({
      path: '/Users/test/docs/readme.md',
      format: 'pdf',
      savePath: '/Users/test/exports/readme.pdf',
      theme: 'light-default',
    });
    const rejection = expect(requestPromise).rejects.toMatchObject({
      status: 0,
      code: 'EXPORT_TIMEOUT',
      message: 'Export timed out after 120 seconds',
    });

    await vi.advanceTimersByTimeAsync(120_000);
    await rejection;
  });
});
