import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const outputRoot = 'out/electron';
const asarCliPath = path.resolve('node_modules/@electron/asar/bin/asar.js');

async function resolveAsarPath() {
  const candidates = [
    `${outputRoot}/mac-arm64/mdv.app/Contents/Resources/app.asar`,
    `${outputRoot}/mac/mdv.app/Contents/Resources/app.asar`,
    `${outputRoot}/win-unpacked/resources/app.asar`,
    `${outputRoot}/win-arm64-unpacked/resources/app.asar`,
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep searching.
    }
  }

  throw new Error(`No packaged app.asar found under ${outputRoot}`);
}

const forbiddenPatterns = [
  /^\/dist\/electron\/mac/,
  /^\/dist\/electron\/builder-debug\.yml$/,
  /^\/out\//,
  /^\/dist\/playwright-report\//,
  /^\/dist\/test-results\//,
];

const asarPath = await resolveAsarPath();
const { stdout } = await execFileAsync(process.execPath, [asarCliPath, 'list', asarPath]);
const entries = stdout
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const forbiddenEntries = entries.filter((entry) =>
  forbiddenPatterns.some((pattern) => pattern.test(entry)),
);

if (forbiddenEntries.length > 0) {
  throw new Error(
    `Packaged app contains forbidden entries:\n${forbiddenEntries.slice(0, 20).join('\n')}`,
  );
}

console.log(`Electron package smoke check passed for ${asarPath}`);
