export function readCachedTheme(): string | null {
  try {
    return localStorage.getItem('mdv-theme');
  } catch {
    return null;
  }
}

export function applyTheme(themeId: string, options: { persist?: boolean } = {}): void {
  document.documentElement.dataset.theme = themeId;

  if (options.persist !== false) {
    try {
      localStorage.setItem('mdv-theme', themeId);
    } catch {
      // Ignore storage failures in privacy-restricted environments.
    }
  }
}
