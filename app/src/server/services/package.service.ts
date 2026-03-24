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
import {
  createPackage,
  extractPackage,
  MANIFEST_FILENAME,
  parseManifest,
  scaffoldManifest,
} from '../../pkg/index.js';
import type { SessionService } from './session.service.js';
import type { TempDirManager } from './temp-dir.service.js';
import {
  ExtractionError,
  InvalidArchiveError,
  InvalidPathError,
  ManifestNotFoundError,
  ManifestParseError,
  ManifestExistsError,
  NoActivePackageError,
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

function hasDotfileSegment(targetPath: string): boolean {
  return targetPath.split('/').some((segment) => segment.startsWith('.'));
}

function filterScaffoldContent(content: string): string {
  return content
    .split('\n')
    .filter((line) => {
      const match = line.match(/\]\(([^)]+)\)\s*$/);
      if (!match) {
        return line.trim().length > 0;
      }

      return !hasDotfileSegment(match[1] ?? '');
    })
    .join('\n');
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

    const previousTempDir = this.tempDirManager.getActive();
    const tempDir = await this.tempDirManager.create();

    try {
      await extractPackage({ packagePath: filePath, outputDir: tempDir });
    } catch (error) {
      // Extraction failed — cleanup new temp dir, restore previous state
      await this.tempDirManager.cleanupDir(tempDir);
      this.tempDirManager.setActive(previousTempDir);

      const code = (error as { code?: string } | undefined)?.code;
      const message = error instanceof Error ? error.message : String(error);
      if (code === 'INVALID_ARCHIVE' || code === 'COMPRESSION_ERROR' || code === 'PATH_TRAVERSAL') {
        throw new InvalidArchiveError(filePath, message);
      }
      throw new ExtractionError(filePath, message);
    }

    // Success — cleanup previous temp dir
    if (previousTempDir) {
      await this.tempDirManager.cleanupDir(previousTempDir);
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
    if (!this.state) {
      throw new NoActivePackageError();
    }

    const manifestPath = path.join(this.state.extractedRoot, MANIFEST_FILENAME);
    let content: string;

    try {
      content = await fs.readFile(manifestPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ManifestNotFoundError();
      }

      throw error;
    }

    try {
      const parsed = parseManifest(content);
      this.state.metadata = parsed.metadata;
      this.state.navigation = parsed.navigation;
      this.state.manifestStatus = 'present';
      this.state.manifestError = undefined;

      return {
        metadata: parsed.metadata,
        navigation: parsed.navigation,
        raw: content,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.manifestStatus = 'unreadable';
      this.state.manifestError = message;
      throw new ManifestParseError(message);
    }
  }

  async create(rootDir: string, overwrite = false): Promise<PackageCreateResponse> {
    const rootStats = await fs.stat(rootDir);
    if (!rootStats.isDirectory()) {
      const error = new InvalidPathError(rootDir);
      error.message = `Not a directory: ${rootDir}`;
      throw error;
    }

    const manifestPath = path.join(rootDir, MANIFEST_FILENAME);
    try {
      await fs.stat(manifestPath);
      if (!overwrite) {
        throw new ManifestExistsError(manifestPath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    const scaffoldedContent = filterScaffoldContent(await scaffoldManifest(rootDir));
    const manifestContent =
      scaffoldedContent.length > 0
        ? `---\ntitle: ${path.basename(rootDir)}\n---\n\n${scaffoldedContent}`
        : `---\ntitle: ${path.basename(rootDir)}\n---\n`;

    await fs.writeFile(manifestPath, manifestContent);

    const parsed = parseManifest(manifestContent);
    this.state = {
      sourcePath: rootDir,
      extractedRoot: rootDir,
      format: 'mpk',
      mode: 'directory',
      manifestStatus: 'present',
      stale: false,
      navigation: parsed.navigation,
      metadata: parsed.metadata,
    };
    await this.persistState();

    return {
      metadata: parsed.metadata,
      navigation: parsed.navigation,
      manifestPath,
    };
  }

  async export(
    outputPath: string,
    compress?: boolean,
    sourceDir?: string,
  ): Promise<PackageExportResponse> {
    const effectiveSourceDir = sourceDir ?? this.state?.extractedRoot;
    if (!effectiveSourceDir) {
      throw new NoActivePackageError();
    }

    const manifestPath = path.join(effectiveSourceDir, MANIFEST_FILENAME);
    let manifestExisted = true;

    try {
      await fs.stat(manifestPath);
    } catch {
      manifestExisted = false;
    }

    await createPackage({
      sourceDir: effectiveSourceDir,
      outputPath,
      compress,
    });

    if (!manifestExisted) {
      await fs.unlink(manifestPath);
    }

    const stats = await fs.stat(outputPath);
    const filePaths = await fs.readdir(effectiveSourceDir, {
      recursive: true,
      withFileTypes: true,
    });
    const fileCount = filePaths.filter((entry) => entry.isFile()).length;
    const format = path.extname(outputPath).toLowerCase() === '.mpkz' ? 'mpkz' : 'mpk';

    if (this.state && outputPath === this.state.sourcePath) {
      this.clearStale();
    }

    return {
      outputPath,
      format,
      fileCount,
      sizeBytes: stats.size,
    };
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
