const WINDOWS_DRIVE_PREFIX = /^[a-zA-Z]:\//;
const WINDOWS_DRIVE_ROOT = /^[a-zA-Z]:\/$/;

function normalizeSeparators(input: string): string {
  return input.replace(/\\/g, '/');
}

function normalizeRelativeSegments(input: string): string {
  const segments: string[] = [];

  for (const segment of normalizeSeparators(input).split('/')) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (segments.length > 0 && segments.at(-1) !== '..') {
        segments.pop();
      } else {
        segments.push(segment);
      }
      continue;
    }

    segments.push(segment);
  }

  return segments.join('/') || '.';
}

function toFileUrl(input: string): URL | null {
  const normalized = normalizeSeparators(input);

  if (normalized.startsWith('//')) {
    return new URL(`file:${normalized}`);
  }

  if (WINDOWS_DRIVE_PREFIX.test(normalized)) {
    return new URL(`file:///${normalized}`);
  }

  if (normalized.startsWith('/')) {
    return new URL(`file://${normalized}`);
  }

  return null;
}

function fromFileUrl(url: URL): string {
  const pathname = decodeURIComponent(url.pathname);

  if (url.host) {
    return `//${url.host}${pathname}`;
  }

  if (/^\/[a-zA-Z]:\//.test(pathname)) {
    return pathname.slice(1);
  }

  return pathname;
}

function trimDirectorySuffix(input: string): string {
  const normalized = normalizeFsPath(input);

  if (normalized === '/' || WINDOWS_DRIVE_ROOT.test(normalized)) {
    return normalized;
  }

  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function ensureDirectoryUrl(url: URL): URL {
  const directoryUrl = new URL(url.href);
  if (!directoryUrl.pathname.endsWith('/')) {
    directoryUrl.pathname = `${directoryUrl.pathname}/`;
  }
  return directoryUrl;
}

export function isAbsoluteFsPath(input: string): boolean {
  const normalized = normalizeSeparators(input);
  return normalized.startsWith('/') || WINDOWS_DRIVE_PREFIX.test(normalized);
}

export function normalizeFsPath(input: string): string {
  const fileUrl = toFileUrl(input);
  if (fileUrl) {
    return fromFileUrl(fileUrl);
  }

  return normalizeRelativeSegments(input);
}

export function dirnameFsPath(input: string): string {
  const normalized = normalizeFsPath(input);
  const fileUrl = toFileUrl(normalized);

  if (!fileUrl) {
    const segments = normalized.split('/');
    segments.pop();
    return segments.length > 0 ? segments.join('/') : '.';
  }

  return trimDirectorySuffix(fromFileUrl(new URL('.', fileUrl)));
}

export function resolveFsPath(
  basePath: string,
  targetPath: string,
  options?: { baseIsDirectory?: boolean },
): string {
  const normalizedTarget = normalizeFsPath(targetPath);
  if (isAbsoluteFsPath(normalizedTarget)) {
    return normalizedTarget;
  }

  const normalizedBase = normalizeFsPath(basePath);
  const baseUrl = toFileUrl(normalizedBase);

  if (!baseUrl) {
    const combinedBase = options?.baseIsDirectory ? normalizedBase : dirnameFsPath(normalizedBase);
    return normalizeRelativeSegments(`${combinedBase}/${normalizedTarget}`);
  }

  const resolutionBase = options?.baseIsDirectory ? ensureDirectoryUrl(baseUrl) : baseUrl;
  return fromFileUrl(new URL(normalizedTarget, resolutionBase));
}

export function isWithinFsRoot(root: string, targetPath: string): boolean {
  const normalizedRoot = trimDirectorySuffix(root);
  const normalizedTarget = trimDirectorySuffix(targetPath);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`);
}
