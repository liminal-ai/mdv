import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import chokidar from 'chokidar';

const mode = process.argv[2] === 'electron' ? 'electron' : 'web';
const processes = new Set();

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  processes.add(child);
  child.on('exit', () => {
    processes.delete(child);
  });
  return child;
}

async function waitForFile(path) {
  for (;;) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

const builders = [
  spawnProcess('npx', ['tsc', '-p', 'tsconfig.json', '--watch', '--preserveWatchOutput']),
  spawnProcess('node', ['esbuild.config.ts', '--watch']),
];

let electronProcess = null;
let electronRestartTimer = null;

function stopElectron() {
  if (!electronProcess || electronProcess.killed) {
    return;
  }

  electronProcess.kill('SIGTERM');
}

function startElectron() {
  stopElectron();
  electronProcess = spawnProcess('npx', ['electron', 'dist/electron/main.js']);
}

if (mode === 'electron') {
  builders.push(spawnProcess('node', ['scripts/build-electron.mjs', '--watch']));

  await Promise.all([
    waitForFile('dist/server/index.js'),
    waitForFile('dist/client/index.html'),
    waitForFile('dist/electron/main.js'),
    waitForFile('dist/electron/preload.cjs'),
  ]);

  startElectron();

  const watcher = chokidar.watch(
    [
      'dist/server/**/*.js',
      'dist/client/**/*',
      'dist/electron/main.js',
      'dist/electron/preload.cjs',
    ],
    { ignoreInitial: true },
  );

  watcher.on('all', () => {
    if (electronRestartTimer) {
      clearTimeout(electronRestartTimer);
    }

    electronRestartTimer = setTimeout(() => {
      startElectron();
    }, 250);
  });
} else {
  await waitForFile('dist/server/index.js');
  builders.push(spawnProcess('node', ['--watch', 'dist/server/index.js']));
}

const shutdown = () => {
  stopElectron();
  for (const child of [...processes]) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await new Promise(() => {});
