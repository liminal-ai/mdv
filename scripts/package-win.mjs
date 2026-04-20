import { execFile, spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const electronBuilderCli = require.resolve('electron-builder/cli.js');

const WINDOWS_ARCH_CODES = new Map([
  ['12', 'arm64'],
  ['9', 'x64'],
  ['0', 'ia32'],
]);

const RESVG_PACKAGE_BY_ARCH = {
  arm64: '@resvg/resvg-js-win32-arm64-msvc',
  x64: '@resvg/resvg-js-win32-x64-msvc',
};

const validArchitectures = new Set(['arm64', 'x64']);
const args = process.argv.slice(2);
const target = args[0] === 'dir' ? 'dir' : 'nsis';
const requestedArchs = await resolveRequestedArchitectures(args.slice(1));
const packagerEnv = createPackagerEnv();

for (const arch of requestedArchs) {
  await ensureResvgPackageForArch(arch);
  await run(process.execPath, [electronBuilderCli, '--win', target, `--${arch}`], {
    env: packagerEnv,
  });
}

async function resolveRequestedArchitectures(rawArgs) {
  if (rawArgs.includes('--all')) {
    return ['arm64', 'x64'];
  }

  if (rawArgs.includes('--arm64')) {
    return ['arm64'];
  }

  if (rawArgs.includes('--x64')) {
    return ['x64'];
  }

  return [await detectHostWindowsArch()];
}

async function ensureResvgPackageForArch(arch) {
  const packageName = RESVG_PACKAGE_BY_ARCH[arch];
  if (!packageName) {
    throw new Error(`Unsupported Windows packaging architecture: ${arch}`);
  }

  const packageDir = path.resolve('node_modules', ...packageName.split('/'));
  try {
    await access(path.join(packageDir, 'package.json'));
    return;
  } catch {
    // Install the missing target-specific binary package below.
  }

  const version = await resolveResvgBinaryVersion(packageName);
  const npmCliPath = resolveNpmCliPath();
  await run(process.execPath, [npmCliPath, 'install', '--no-save', '--force', `${packageName}@${version}`], {
    env: packagerEnv,
  });

  await access(path.join(packageDir, 'package.json'));
}

async function resolveResvgBinaryVersion(packageName) {
  const packageJsonPath = path.resolve('node_modules', '@resvg', 'resvg-js', 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const version = packageJson.optionalDependencies?.[packageName];

  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`Unable to resolve resvg binary version for ${packageName}`);
  }

  return version;
}

function resolveNpmCliPath() {
  return path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
}

function normalizeArchitecture(raw) {
  if (validArchitectures.has(raw)) {
    return raw;
  }

  if (raw === 'amd64') {
    return 'x64';
  }

  return null;
}

function createPackagerEnv() {
  const nodeDir = path.dirname(process.execPath);
  const existingPath = process.env.PATH ?? process.env.Path ?? '';
  const pathKey = process.platform === 'win32' && process.env.Path ? 'Path' : 'PATH';
  const mergedPath = prependPath(nodeDir, existingPath);

  return {
    ...process.env,
    [pathKey]: mergedPath,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_loglevel: 'error',
  };
}

function prependPath(entry, currentPath) {
  const segments = currentPath
    .split(path.delimiter)
    .filter((segment) => segment.length > 0 && segment.toLowerCase() !== entry.toLowerCase());

  return [entry, ...segments].join(path.delimiter);
}

async function run(command, runArgs, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, runArgs, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${runArgs.join(' ')} exited with code ${code ?? 1}`));
    });
  });
}

async function detectArchitectureFromPowerShell() {
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      '(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Architecture)',
    ]);
    const detected = WINDOWS_ARCH_CODES.get(stdout.trim());
    return detected && validArchitectures.has(detected) ? detected : null;
  } catch {
    return null;
  }
}

async function detectHostWindowsArch() {
  const detectedFromPowerShell = await detectArchitectureFromPowerShell();
  if (detectedFromPowerShell) {
    return detectedFromPowerShell;
  }

  const detectedFromProcess = normalizeArchitecture(process.arch);
  if (detectedFromProcess) {
    return detectedFromProcess;
  }

  throw new Error(`Unsupported Windows packaging architecture: ${process.arch}`);
}
