import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const FOLDER_PICKER_SCRIPT = 'POSIX path of (choose folder with prompt "Select Folder")';
const BROWSE_TIMEOUT_MS = 60_000;

type ExecFileResult = {
  stdout: string;
  stderr: string;
};

type ExecFileRunner = (
  file: string,
  args: string[],
  options: {
    timeout: number;
  },
) => Promise<ExecFileResult>;

function normalizePickerPath(rawPath: string): string {
  const trimmed = rawPath.trim();

  if (trimmed === '/') {
    return trimmed;
  }

  return trimmed.replace(/\/+$/, '');
}

export class BrowseService {
  constructor(private readonly runner: ExecFileRunner = execFileAsync) {}

  async openFolderPicker(): Promise<string | null> {
    try {
      const { stdout } = await this.runner('osascript', ['-e', FOLDER_PICKER_SCRIPT], {
        timeout: BROWSE_TIMEOUT_MS,
      });

      return normalizePickerPath(stdout);
    } catch (error) {
      if ((error as { code?: number } | undefined)?.code === 1) {
        return null;
      }

      throw error;
    }
  }
}
