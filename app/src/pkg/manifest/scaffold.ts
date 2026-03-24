import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { MANIFEST_FILENAME } from '../types.js';

function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function toDisplayName(relativePath: string): string {
  const baseName = path.basename(relativePath, '.md');
  const normalizedName = baseName.replace(/[-_]+/g, ' ').trim();

  if (normalizedName.length === 0) {
    return '';
  }

  return normalizedName
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

export async function scaffoldManifest(sourceDir: string): Promise<string> {
  const entries = await readdir(sourceDir, { recursive: true, withFileTypes: true });

  const markdownFiles = entries
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== MANIFEST_FILENAME,
    )
    .map((entry) => toPosixPath(path.relative(sourceDir, path.join(entry.parentPath, entry.name))))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

  return markdownFiles
    .map((relativePath) => `- [${toDisplayName(relativePath)}](${relativePath})`)
    .join('\n');
}

export default scaffoldManifest;
