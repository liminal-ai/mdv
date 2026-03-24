import type {
  ManifestMetadata,
  NavigationNode,
  PackageCreateResponse,
  PackageExportResponse,
  PackageManifestResponse,
  PackageOpenResponse,
} from '../schemas/package.js';
import type { SessionService } from './session.service.js';
import type { TempDirManager } from './temp-dir.service.js';
import { NotImplementedError } from '../utils/errors.js';

interface ActivePackageState {
  sourcePath: string;
  extractedRoot: string;
  format: 'mpk' | 'mpkz';
  mode: 'extracted' | 'directory';
  manifestStatus: 'present' | 'missing' | 'unreadable';
  manifestError?: string;
  stale: boolean;
  navigation: NavigationNode[];
  metadata: ManifestMetadata;
}

export class PackageService {
  private state: ActivePackageState | null = null;

  constructor(
    private readonly tempDirManager: TempDirManager,
    private readonly sessionService: SessionService,
  ) {}

  async open(_filePath: string): Promise<PackageOpenResponse> {
    throw new NotImplementedError('PackageService.open');
  }

  async getManifest(): Promise<PackageManifestResponse> {
    throw new NotImplementedError('PackageService.getManifest');
  }

  async create(_rootDir: string, _overwrite?: boolean): Promise<PackageCreateResponse> {
    throw new NotImplementedError('PackageService.create');
  }

  async export(
    _outputPath: string,
    _compress?: boolean,
    _sourceDir?: string,
  ): Promise<PackageExportResponse> {
    throw new NotImplementedError('PackageService.export');
  }

  markStale(): void {
    if (this.state && this.state.mode === 'extracted') {
      this.state.stale = true;
      void this.persistState();
    }
  }

  clearStale(): void {
    if (this.state) {
      this.state.stale = false;
      void this.persistState();
    }
  }

  getState(): ActivePackageState | null {
    return this.state;
  }

  async close(): Promise<void> {
    if (this.state?.mode === 'extracted') {
      await this.tempDirManager.cleanup();
    }

    this.state = null;
    await this.persistState();
  }

  async restore(): Promise<void> {
    throw new NotImplementedError('PackageService.restore');
  }

  async persistState(): Promise<void> {
    await this.sessionService.setActivePackage(
      this.state
        ? {
            sourcePath: this.state.sourcePath,
            extractedRoot: this.state.extractedRoot,
            format: this.state.format,
            mode: this.state.mode,
            stale: this.state.stale,
            manifestStatus: this.state.manifestStatus,
          }
        : null,
    );
  }
}
