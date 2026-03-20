export function isMarkdownPath(filePath: string): boolean {
  return /\.(md|markdown)$/i.test(filePath.trim());
}

export function firstMarkdownPathFromDropFiles(
  files: ArrayLike<{ path?: string }> | undefined | null
): string | null {
  if (!files || files.length === 0) {
    return null;
  }

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const candidate = file?.path?.trim();
    if (!candidate) {
      continue;
    }

    if (isMarkdownPath(candidate)) {
      return candidate;
    }
  }

  return null;
}
