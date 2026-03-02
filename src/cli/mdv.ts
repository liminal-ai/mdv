#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';

import { parseUserCliArgs } from '../core/cliArgs';

const parsed = parseUserCliArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}

const electronBinary = require('electron') as string;
const mainEntry = path.resolve(__dirname, '..', 'main', 'index.js');

const child = spawn(
  electronBinary,
  [
    mainEntry,
    '--cli-export',
    '--input',
    parsed.value.input,
    '--output',
    parsed.value.output,
    '--format',
    parsed.value.format
  ],
  {
    stdio: 'inherit'
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 3);
});
