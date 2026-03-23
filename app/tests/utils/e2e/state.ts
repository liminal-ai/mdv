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

export const STATE_PATH = join(tmpdir(), '.md-viewer-e2e-state.json');

export function writeE2EState(state: E2EState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

export function readE2EState(): E2EState {
  return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as E2EState;
}

export function removeE2EState(): void {
  try {
    unlinkSync(STATE_PATH);
  } catch {
    // Ignore missing state file during cleanup.
  }
}
