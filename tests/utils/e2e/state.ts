import { randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface E2EState {
  baseURL: string;
  port: number;
  fixtureDir: string;
  sessionDir: string;
  exportDir: string;
  files: {
    kitchenSink: string;
    invalidMermaid: string;
    simple: string;
    nested: string;
  };
}

const STATE_PATH_ENV = 'MDV_E2E_STATE_PATH';

function createDefaultStatePath(): string {
  return join(tmpdir(), `.md-viewer-e2e-state-${process.pid}-${randomUUID()}.json`);
}

export function setE2EStatePath(statePath = createDefaultStatePath()): string {
  process.env[STATE_PATH_ENV] = statePath;
  return statePath;
}

export function getE2EStatePath(): string {
  return process.env[STATE_PATH_ENV] ?? setE2EStatePath();
}

export function writeE2EState(state: E2EState): void {
  writeFileSync(getE2EStatePath(), JSON.stringify(state, null, 2), 'utf8');
}

export function readE2EState(): E2EState {
  return JSON.parse(readFileSync(getE2EStatePath(), 'utf8')) as E2EState;
}

export function removeE2EState(): void {
  const statePath = process.env[STATE_PATH_ENV];

  if (!statePath) {
    return;
  }

  try {
    unlinkSync(statePath);
  } catch {
    // Ignore missing state file during cleanup.
  }
}
