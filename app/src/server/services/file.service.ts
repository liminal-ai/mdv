import * as fs from 'node:fs/promises';
import path from 'node:path';
import {
  ConflictError,
  FileTooLargeError,
  InvalidPathError,
  NotFileError,
  NotMarkdownError,
  PathNotFoundError,
  ReadTimeoutError,
  isNotFoundError,
} from '../utils/errors.js';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface FileReadResult {
  path: string;
  canonicalPath: string;
  filename: string;
  content: string;
  modifiedAt: Date;
  size: number;
}

export interface FileWriteResult {
  path: string;
  modifiedAt: string;
  size: number;
}

export class FileService {
  async readFile(requestedPath: string): Promise<FileReadResult> {
    if (!path.isAbsolute(requestedPath)) {
      throw new InvalidPathError(requestedPath);
    }

    const ext = path.extname(requestedPath).toLowerCase();
    if (!MARKDOWN_EXTENSIONS.has(ext)) {
      throw new NotMarkdownError(requestedPath, ext);
    }

    const fileStat = await fs.stat(requestedPath);
    if (!fileStat.isFile()) {
      throw new NotFileError(requestedPath);
    }

    if (fileStat.size > MAX_FILE_SIZE) {
      throw new FileTooLargeError(requestedPath, fileStat.size, MAX_FILE_SIZE);
    }

    const canonicalPath = await fs.realpath(requestedPath);
    let content: string;

    try {
      content = await fs.readFile(requestedPath, {
        encoding: 'utf8',
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ReadTimeoutError(requestedPath);
      }

      throw error;
    }

    return {
      path: requestedPath,
      canonicalPath,
      filename: path.basename(requestedPath),
      content,
      modifiedAt: fileStat.mtime,
      size: fileStat.size,
    };
  }

  async writeFile(request: {
    path: string;
    content: string;
    expectedModifiedAt?: string | null;
  }): Promise<FileWriteResult> {
    const { path: requestedPath, content, expectedModifiedAt } = request;

    if (!path.isAbsolute(requestedPath)) {
      throw new InvalidPathError(requestedPath);
    }

    const ext = path.extname(requestedPath).toLowerCase();
    if (!MARKDOWN_EXTENSIONS.has(ext)) {
      throw new NotMarkdownError(requestedPath, ext);
    }

    const dir = path.dirname(requestedPath);
    try {
      const dirStat = await fs.stat(dir);
      if (!dirStat.isDirectory()) {
        throw new PathNotFoundError(dir);
      }
    } catch (error) {
      if (error instanceof PathNotFoundError) {
        throw error;
      }

      if (isNotFoundError(error)) {
        throw new PathNotFoundError(dir);
      }

      throw error;
    }

    if (expectedModifiedAt) {
      try {
        const fileStat = await fs.stat(requestedPath);
        const actualModifiedAt = fileStat.mtime.toISOString();
        if (actualModifiedAt !== expectedModifiedAt) {
          throw new ConflictError(requestedPath, expectedModifiedAt, actualModifiedAt);
        }
      } catch (error) {
        if (error instanceof ConflictError) {
          throw error;
        }

        if (isNotFoundError(error)) {
          throw new ConflictError(requestedPath, expectedModifiedAt, 'file deleted');
        }

        throw error;
      }
    }

    const tempPath = path.join(dir, `.${path.basename(requestedPath)}.${Date.now()}.tmp`);

    try {
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, requestedPath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup failures after a write error.
      }

      throw error;
    }

    const fileStat = await fs.stat(requestedPath);
    return {
      path: requestedPath,
      modifiedAt: fileStat.mtime.toISOString(),
      size: fileStat.size,
    };
  }
}
