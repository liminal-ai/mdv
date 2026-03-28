import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { MANIFEST_FILENAME } from '../../../src/pkg/types.js';

export interface WorkspaceConfig {
  manifest?: string;
  files: Record<string, string>;
  binaryFiles?: Record<string, Buffer>;
}

export async function createFixtureWorkspace(config: WorkspaceConfig): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(path.join(tmpdir(), 'mdv-pkg-fixture-'));

  if (config.manifest !== undefined) {
    await writeFile(path.join(dir, MANIFEST_FILENAME), config.manifest, 'utf8');
  }

  for (const [relativePath, content] of Object.entries(config.files)) {
    const absolutePath = path.join(dir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }

  for (const [relativePath, content] of Object.entries(config.binaryFiles ?? {})) {
    const absolutePath = path.join(dir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }

  return {
    dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}
