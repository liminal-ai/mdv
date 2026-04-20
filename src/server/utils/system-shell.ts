import { execFile } from 'node:child_process';
import path from 'node:path';

export interface ShellCommandSpec {
  command: string;
  args: string[];
}

function execFileAsync(command: string, args: string[], timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function getOpenPathCommand(
  targetPath: string,
  platform = process.platform,
): ShellCommandSpec {
  switch (platform) {
    case 'darwin':
      return { command: 'open', args: [targetPath] };
    case 'win32':
      return { command: 'explorer.exe', args: [path.win32.normalize(targetPath)] };
    default:
      return { command: 'xdg-open', args: [targetPath] };
  }
}

export function getRevealPathCommand(
  targetPath: string,
  platform = process.platform,
): ShellCommandSpec {
  switch (platform) {
    case 'darwin':
      return { command: 'open', args: ['-R', targetPath] };
    case 'win32':
      return {
        command: 'explorer.exe',
        args: [`/select,${path.win32.normalize(targetPath)}`],
      };
    default:
      return { command: 'xdg-open', args: [path.dirname(targetPath)] };
  }
}

export async function openPathInShell(targetPath: string, timeout = 15_000): Promise<void> {
  const { command, args } = getOpenPathCommand(targetPath);
  await execFileAsync(command, args, timeout);
}

export async function revealPathInShell(targetPath: string, timeout = 15_000): Promise<void> {
  const { command, args } = getRevealPathCommand(targetPath);
  await execFileAsync(command, args, timeout);
}
