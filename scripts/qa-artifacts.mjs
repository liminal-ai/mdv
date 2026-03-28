#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const command = args[0] ?? 'clean';
const options = parseOptions(args.slice(1));
const defaultPrefix = options.prefix ?? 'mdv-exploratory-qa';

if (command === 'prepare') {
  await prepareRun(options, defaultPrefix);
} else if (command === 'clean') {
  await cleanArtifacts(options, defaultPrefix);
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Usage: node scripts/qa-artifacts.mjs <prepare|clean> [options]');
  process.exitCode = 1;
}

function parseOptions(raw) {
  const parsed = { roots: [] };

  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (token === '--all') {
      parsed.all = true;
    } else if (token === '--dry-run') {
      parsed.dryRun = true;
    } else if (token === '--days') {
      parsed.days = Number(raw[i + 1]);
      i += 1;
    } else if (token === '--prefix') {
      parsed.prefix = raw[i + 1];
      i += 1;
    } else if (token === '--base') {
      parsed.base = raw[i + 1];
      i += 1;
    } else if (token === '--run-id') {
      parsed.runId = raw[i + 1];
      i += 1;
    } else if (token === '--root') {
      parsed.roots.push(raw[i + 1]);
      i += 1;
    }
  }

  return parsed;
}

async function prepareRun(options, prefix) {
  const baseRoot = options.base ?? process.env.TMPDIR ?? os.tmpdir();
  const runId = options.runId ?? timestampId();
  const runRoot = path.resolve(baseRoot, prefix, runId);

  if (!options.dryRun) {
    await fs.mkdir(path.join(runRoot, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(runRoot, 'videos'), { recursive: true });
  }

  console.log(runRoot);
}

async function cleanArtifacts(options, prefix) {
  const now = Date.now();
  const days = Number.isFinite(options.days) ? options.days : 7;
  const maxAgeMs = days * 24 * 60 * 60 * 1000;
  const defaultRoots = [
    path.resolve(process.cwd(), 'qa-output'),
    path.resolve(process.env.TMPDIR ?? os.tmpdir(), prefix),
  ];
  const roots = options.roots.length > 0 ? options.roots.map((r) => path.resolve(r)) : defaultRoots;

  let removed = 0;

  for (const root of roots) {
    const entries = await safeReadDir(root);
    if (!entries) {
      continue;
    }

    for (const entry of entries) {
      const target = path.join(root, entry.name);
      if (!entry.isDirectory()) {
        continue;
      }

      const stats = await safeStat(target);
      if (!stats) {
        continue;
      }

      const isExpired = now - stats.mtimeMs > maxAgeMs;
      if (!options.all && !isExpired) {
        continue;
      }

      if (options.dryRun) {
        console.log(`[dry-run] remove ${target}`);
      } else {
        await fs.rm(target, { recursive: true, force: true });
        console.log(`removed ${target}`);
      }
      removed += 1;
    }
  }

  console.log(`done: ${removed} director${removed === 1 ? 'y' : 'ies'} removed`);
}

function timestampId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    '-',
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
  ].join('');
}

async function safeReadDir(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

async function safeStat(target) {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}
