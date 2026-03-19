import type { ApiClient } from '../api.js';

export async function copyTextToClipboard(
  text: string,
  api: Pick<ApiClient, 'copyToClipboard'>,
): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back to the server endpoint when browser clipboard access is unavailable.
  }

  await api.copyToClipboard(text);
}
