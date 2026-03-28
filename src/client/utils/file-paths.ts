export function fileName(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  return parts.at(-1) ?? filePath;
}

export function directoryName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash > 0 ? filePath.slice(0, lastSlash) : '/';
}

export function exportBaseName(filePath: string): string {
  const name = fileName(filePath);
  return name.replace(/\.(md|markdown)$/i, '');
}
