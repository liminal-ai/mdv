import * as fs from 'node:fs/promises';
import path from 'node:path';
import {
  FileTooLargeError,
  InvalidPathError,
  NotFileError,
  NotMarkdownError,
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
    const content = await fs.readFile(requestedPath, 'utf8');

    return {
      path: requestedPath,
      canonicalPath,
      filename: path.basename(requestedPath),
      content,
      modifiedAt: fileStat.mtime,
      size: fileStat.size,
    };
  }
}
