import { NotImplementedError } from '../utils/errors.js';

export class TempDirManager {
  private activeTempDir: string | null = null;

  async create(): Promise<string> {
    throw new NotImplementedError('TempDirManager.create');
  }

  async cleanup(): Promise<void> {
    throw new NotImplementedError('TempDirManager.cleanup');
  }

  getActive(): string | null {
    return this.activeTempDir;
  }

  setActive(dir: string): void {
    this.activeTempDir = dir;
  }

  async cleanupStale(): Promise<void> {
    throw new NotImplementedError('TempDirManager.cleanupStale');
  }
}
