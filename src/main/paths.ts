import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function rendererHtmlPath(): string {
  return path.join(__dirname, '..', 'renderer', 'index.html');
}

export function preloadPath(): string {
  return path.join(__dirname, '..', 'preload', 'index.js');
}

export function baseHrefFromDir(dir: string): string {
  return `${pathToFileURL(dir).toString().replace(/\/$/, '')}/`;
}
