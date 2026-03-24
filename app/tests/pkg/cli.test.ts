import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import * as pkg from '../../src/pkg/index.js';
import { MANIFEST_FILENAME } from '../../src/pkg/types.js';
import { createFixtureWorkspace } from './fixtures/workspaces.js';

const execFileAsync = promisify(execFile);

const CLI_COMMAND = 'node';
const CLI_ARGS = ['--import', 'tsx', '../../src/pkg/cli.ts'];

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(
    cleanupTasks.splice(0).map(async (cleanup) => {
      await cleanup();
    }),
  );
});

async function runCli(...args: string[]): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(CLI_COMMAND, [...CLI_ARGS, ...args], {
      cwd: import.meta.dirname,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout: string; stderr: string; code: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.code ?? 1,
    };
  }
}

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  cleanupTasks.push(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

async function createWorkspace(
  config: Parameters<typeof createFixtureWorkspace>[0],
): Promise<Awaited<ReturnType<typeof createFixtureWorkspace>>['dir']> {
  const workspace = await createFixtureWorkspace(config);
  cleanupTasks.push(workspace.cleanup);
  return workspace.dir;
}

async function readWorkspaceFiles(rootDir: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const entries = await readdir(rootDir, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const relativePath = path.relative(rootDir, path.join(entry.parentPath, entry.name));
    files.set(relativePath, await readFile(path.join(rootDir, relativePath)));
  }

  return files;
}

describe('mdvpkg CLI', () => {
  it('TC-6.1a: help lists all 6 commands', async () => {
    const result = await runCli('--help');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('create');
    expect(result.stdout).toContain('extract');
    expect(result.stdout).toContain('info');
    expect(result.stdout).toContain('ls');
    expect(result.stdout).toContain('read');
    expect(result.stdout).toContain('manifest');
  });

  it('TC-6.2a: command-level help shows arguments', async () => {
    const result = await runCli('create', '--help');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('<sourceDir>');
    expect(result.stdout).toContain('-o, --output');
    expect(result.stdout).toContain('--compress');
  });

  it('TC-6.3a: successful operation exits 0', async () => {
    const sourceDir = await createWorkspace({
      files: {
        'guide.md': '# Guide',
      },
    });
    const outputDir = await createTempDir('mdv-cli-create-');
    const outputPath = path.join(outputDir, 'package.mpk');

    const result = await runCli('create', sourceDir, '-o', outputPath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Created ${outputPath}`);
  });

  it('TC-6.3b: failed operation exits non-zero', async () => {
    const result = await runCli('extract', '/nonexistent/path.mpk', '-o', '/tmp/out');

    expect(result.exitCode).not.toBe(0);
  });

  it('TC-6.4a: error message includes path', async () => {
    const result = await runCli('extract', '/nonexistent/path.mpk', '-o', '/tmp/out');

    expect(result.stderr).toContain('/nonexistent/path.mpk');
  });

  it('TC-6.4b: error message includes command name', async () => {
    const result = await runCli('extract', '/nonexistent/path.mpk', '-o', '/tmp/out');

    expect(result.stderr).toContain('extract:');
  });

  it('TC-6.4c: read rejects using both --file and --name together', async () => {
    const sourceDir = await createWorkspace({
      manifest: '- [Guide](guide.md)',
      files: {
        'guide.md': '# Guide',
      },
    });
    const packageDir = await createTempDir('mdv-cli-read-conflict-');
    const packagePath = path.join(packageDir, 'package.mpk');

    await pkg.createPackage({ sourceDir, outputPath: packagePath });

    const result = await runCli('read', packagePath, '--file', 'guide.md', '--name', 'Guide');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('read: provide --file or --name, not both');
  });

  it('info shows all manifest metadata fields and navigation tree', async () => {
    const sourceDir = await createWorkspace({
      manifest: `---
title: API Reference
version: 1.2.3
author: Docs Team
description: Comprehensive API package manifest
type: reference
status: published
---

- Guides
  - [Start Here](guides/start.md)
  - [Advanced](guides/advanced.md)
- Reference
  - [CLI](reference/cli.md)
`,
      files: {
        'guides/start.md': '# Start Here',
        'guides/advanced.md': '# Advanced',
        'reference/cli.md': '# CLI',
      },
    });
    const packageDir = await createTempDir('mdv-cli-info-');
    const packagePath = path.join(packageDir, 'package.mpk');

    await pkg.createPackage({ sourceDir, outputPath: packagePath });

    const result = await runCli('info', packagePath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      [
        'Title: API Reference',
        'Version: 1.2.3',
        'Author: Docs Team',
        'Description: Comprehensive API package manifest',
        'Type: reference',
        'Status: published',
        'Format: mpk',
        'Files: 4',
        'Navigation:',
        '- Guides',
        '  - Start Here (guides/start.md)',
        '  - Advanced (guides/advanced.md)',
        '- Reference',
        '  - CLI (reference/cli.md)',
        '',
      ].join('\n'),
    );
  });

  it('TC-7.1a: CLI create matches library create', async () => {
    const sourceDir = await createWorkspace({
      manifest: '- [Guide](docs/guide.md)\n- [API](reference/api.md)\n- [Logo](assets/logo.txt)\n',
      files: {
        'docs/guide.md': '# Guide\n\nHello from the CLI parity test.',
        'reference/api.md': '# API\n\nEndpoint details.',
        'assets/logo.txt': 'logo placeholder',
      },
    });
    const packageDir = await createTempDir('mdv-cli-parity-packages-');
    const cliPackagePath = path.join(packageDir, 'cli.mpk');
    const libraryPackagePath = path.join(packageDir, 'library.mpk');
    const cliOutputDir = await createTempDir('mdv-cli-parity-output-a-');
    const libraryOutputDir = await createTempDir('mdv-cli-parity-output-b-');

    const cliResult = await runCli('create', sourceDir, '-o', cliPackagePath);
    expect(cliResult.exitCode).toBe(0);

    await pkg.createPackage({ sourceDir, outputPath: libraryPackagePath });
    await Promise.all([
      pkg.extractPackage({ packagePath: cliPackagePath, outputDir: cliOutputDir }),
      pkg.extractPackage({ packagePath: libraryPackagePath, outputDir: libraryOutputDir }),
    ]);

    const [cliFiles, libraryFiles] = await Promise.all([
      readWorkspaceFiles(cliOutputDir),
      readWorkspaceFiles(libraryOutputDir),
    ]);

    expect(cliFiles.get(MANIFEST_FILENAME)?.toString('utf8')).toBe(
      libraryFiles.get(MANIFEST_FILENAME)?.toString('utf8'),
    );
    expect([...cliFiles.keys()].sort()).toEqual([...libraryFiles.keys()].sort());

    for (const [relativePath, content] of cliFiles) {
      expect(libraryFiles.get(relativePath)).toEqual(content);
    }
  });

  it('TC-7.1b: every command has library export', async () => {
    expect(typeof pkg.createPackage).toBe('function');
    expect(typeof pkg.extractPackage).toBe('function');
    expect(typeof pkg.inspectPackage).toBe('function');
    expect(typeof pkg.listPackage).toBe('function');
    expect(typeof pkg.getManifest).toBe('function');
    expect(typeof pkg.readDocument).toBe('function');
  });

  it('Non-TC: unknown command produces error', async () => {
    const result = await runCli('badcommand');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('unknown command');
  });

  it('Non-TC: --version outputs version', async () => {
    const result = await runCli('--version');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('0.1.0');
  });
});
