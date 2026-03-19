import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../src/server/app.js';
import { BrowseService } from '../../../src/server/services/browse.service.js';

describe('browse routes', () => {
  it('TC-4.2a: Folder picker returns selected path', async () => {
    const browseService = new BrowseService(
      vi.fn().mockResolvedValue({ stdout: '/Users/leemoore/code/md-viewer\n', stderr: '' }),
    );
    const app = await buildApp({ browseService });

    const response = await app.inject({ method: 'POST', url: '/api/browse' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ path: '/Users/leemoore/code/md-viewer' });

    await app.close();
  });

  it('TC-4.2b: Folder picker cancelled returns null', async () => {
    const browseService = new BrowseService(
      vi.fn().mockRejectedValue(Object.assign(new Error('User canceled'), { code: 1 })),
    );

    await expect(browseService.openFolderPicker()).resolves.toBeNull();
  });

  it('Non-TC: osascript error is handled as a 500', async () => {
    const app = await buildApp({
      browseService: {
        openFolderPicker: vi.fn().mockRejectedValue(new Error('osascript failed')),
      } as BrowseService,
    });

    const response = await app.inject({ method: 'POST', url: '/api/browse' });

    expect(response.statusCode).toBe(500);

    await app.close();
  });

  it('Non-TC: Trailing slash is normalized', async () => {
    const runner = vi
      .fn()
      .mockResolvedValue({ stdout: '/Users/leemoore/Documents/projects/\n', stderr: '' });
    const browseService = new BrowseService(runner);

    await expect(browseService.openFolderPicker()).resolves.toBe(
      '/Users/leemoore/Documents/projects',
    );
    expect(runner).toHaveBeenCalledWith(
      'osascript',
      ['-e', 'POSIX path of (choose folder with prompt "Select Folder")'],
      { timeout: 60_000 },
    );
  });
});
