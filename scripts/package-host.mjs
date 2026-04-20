import { spawn } from 'node:child_process';
import path from 'node:path';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 1}`));
    });

    child.on('error', reject);
  });
}

const npmCommand =
  process.platform === 'win32' ? path.join(path.dirname(process.execPath), 'npm.cmd') : 'npm';

if (process.platform === 'darwin') {
  await run(npmCommand, ['run', 'package:mac']);
} else if (process.platform === 'win32') {
  await run(npmCommand, ['run', 'package:win:dir']);
} else {
  throw new Error(`Host packaging is not configured for ${process.platform}.`);
}
