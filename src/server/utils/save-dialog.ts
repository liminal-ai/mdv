import { execFile } from 'node:child_process';

const SAVE_DIALOG_TIMEOUT_MS = 60_000;

export async function openSaveDialog(
  defaultDir: string,
  defaultName: string,
  prompt: string,
): Promise<string | null> {
  const script =
    'POSIX path of (choose file name ' +
    `with prompt ${JSON.stringify(prompt)} ` +
    `default name ${JSON.stringify(defaultName)} ` +
    `default location POSIX file ${JSON.stringify(defaultDir)})`;

  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: SAVE_DIALOG_TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        const code = String((error as NodeJS.ErrnoException & { code?: number | string }).code);
        if (code === '1') {
          resolve(null);
          return;
        }

        reject(error);
        return;
      }

      resolve(stdout.trim());
    });
  });
}
