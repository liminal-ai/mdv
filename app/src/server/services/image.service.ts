import * as fs from 'node:fs/promises';
import path from 'node:path';
import { InvalidPathError, NotFileError, UnsupportedFormatError } from '../utils/errors.js';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

export interface ImageValidationResult {
  contentType: string;
}

export class ImageService {
  async validate(imagePath: string): Promise<ImageValidationResult> {
    if (!path.isAbsolute(imagePath)) {
      throw new InvalidPathError(imagePath);
    }

    const fileStat = await fs.stat(imagePath);
    if (!fileStat.isFile()) {
      throw new NotFileError(imagePath);
    }

    const extension = path.extname(imagePath).toLowerCase();
    const contentType = MIME_TYPES[extension];

    if (!contentType) {
      throw new UnsupportedFormatError(imagePath, extension);
    }

    return { contentType };
  }
}
