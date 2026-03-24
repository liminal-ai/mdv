import * as fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ManifestMetadata,
  NavigationNode,
  PackageCreateResponse,
  PackageExportResponse,
  PackageManifestResponse,
  PackageOpenResponse,
} from '../schemas/package.js';
import { extractPackage, MANIFEST_FILENAME, parseManifest } from '../../pkg/index.js';
import type { SessionService } from './session.service.js';
import type { TempDirManager } from './temp-dir.service.js';
import {
  ExtractionError,
  InvalidArchiveError,
  NotImplementedError,
  PackageNotFoundError,
} from '../utils/errors.js';

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

  async open(filePath: string): Promise<PackageOpenResponse> {
    try {
      await fs.stat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new PackageNotFoundError(filePath);
      }
      throw error;
    }

    const ext = path.extname(filePath).toLowerCase();
    const format = ext === '.mpkz' ? 'mpkz' : ext === '.mpk' ? 'mpk' : null;
    if (!format) {
      throw new InvalidArchiveError(filePath, `Unsupported package extension: ${ext || 'unknown'}`);
    }

    const tempDir = await this.tempDirManager.create();

    try {
      await extractPackage({ packagePath: filePath, outputDir: tempDir });
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      const message = error instanceof Error ? error.message : String(error);
      if (code === 'INVALID_ARCHIVE' || code === 'COMPRESSION_ERROR' || code === 'PATH_TRAVERSAL') {
        throw new InvalidArchiveError(filePath, message);
      }
      throw new ExtractionError(filePath, message);
    }

    let metadata: ManifestMetadata = {};
    let navigation: NavigationNode[] = [];
    let manifestStatus: ActivePackageState['manifestStatus'];
    let manifestError: string | undefined;

    try {
      const manifestPath = path.join(tempDir, MANIFEST_FILENAME);
      const content = await fs.readFile(manifestPath, 'utf-8');

      try {
        const parsed = parseManifest(content);
        metadata = parsed.metadata;
        navigation = parsed.navigation;
        manifestStatus = 'present';
      } catch (error) {
        manifestStatus = 'unreadable';
        manifestError = error instanceof Error ? error.message : String(error);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        manifestStatus = 'missing';
      } else {
        throw new ExtractionError(filePath, error instanceof Error ? error.message : String(error));
      }
    }

    this.state = {
      sourcePath: filePath,
      extractedRoot: tempDir,
      format,
      mode: 'extracted',
      manifestStatus,
      manifestError,
      stale: false,
      navigation,
      metadata,
    };
    await this.persistState();

    return {
      metadata,
      navigation,
      packageInfo: {
        sourcePath: filePath,
        extractedRoot: tempDir,
        format,
        manifestStatus,
        ...(manifestError ? { manifestError } : {}),
      },
    };
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

  private async persistState(): Promise<void> {
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
