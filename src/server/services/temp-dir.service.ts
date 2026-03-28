import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TEMP_PREFIX = 'mdv-pkg-';

export class TempDirManager {
  private activeTempDir: string | null = null;

  async create(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    this.activeTempDir = tempDir;
    return tempDir;
  }

  async cleanupDir(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${dir}:`, error);
    }
  }

  async cleanup(): Promise<void> {
    if (!this.activeTempDir) {
      return;
    }

    const dir = this.activeTempDir;
    this.activeTempDir = null;

    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${dir}:`, error);
    }
  }

  getActive(): string | null {
    return this.activeTempDir;
  }

  setActive(dir: string | null): void {
    this.activeTempDir = dir;
  }

  async cleanupStale(): Promise<void> {
    const tmpDir = os.tmpdir();

    try {
      const entries = await fs.readdir(tmpDir);
      await Promise.all(
        entries
          .filter((entry) => entry.startsWith(TEMP_PREFIX))
          .map(async (entry) => {
            const dir = path.join(tmpDir, entry);
            if (dir === this.activeTempDir) {
              return;
            }

            try {
              await fs.rm(dir, { recursive: true, force: true });
            } catch (error) {
              console.warn(`Failed to cleanup stale temp directory ${dir}:`, error);
            }
          }),
      );
    } catch (error) {
      console.warn('Failed to enumerate stale temp directories:', error);
    }
  }
}
