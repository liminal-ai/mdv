# Test Plan: Pipeline Orchestration (Epic 14)

Companion to `tech-design.md`. This document provides complete TC→test mapping, mock strategy, fixtures, and chunk breakdown with test counts.

---

## Mock Strategy

### Mock Boundaries

Tests mock at external boundaries only. Internal modules are exercised through their entry points.

| Boundary | Mock? | Why |
|----------|-------|-----|
| `child_process.spawn` | Yes | External process — control CLI behavior for background tasks |
| `fs/promises` (readFile, writeFile, mkdir, mkdtemp, rm) | Yes | Staging dir lifecycle (mkdtemp, rm), reading CLI output from staging (readFile — temp dir, not workspace) |
| WebSocket connections (client) | Yes | Network boundary — use mock WebSocket |
| `localStorage` | Yes (jsdom provides) | Browser API |
| `crypto.randomUUID` | Controlled | Seeded for deterministic task/run IDs in tests |
| `setInterval` / `clearInterval` | Controlled via `vi.useFakeTimers()` | Timer control for heartbeat testing |
| Internal modules (TaskManager, PipelineDispatcher, etc.) | No | These are what we're testing |

### Server Test Pattern

Server tests use Fastify's `inject()` for HTTP and direct WebSocket connections. TaskManager tests mock `child_process.spawn` to control background CLI behavior. The `MockChildProcess` fixture from Epic 10 is reused and extended.

```typescript
// Server test setup pattern
import { buildApp } from '../../../src/server/app.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),    // Used for reading CLI output from staging dir (temp dir, not workspace)
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  mkdtemp: vi.fn(() => Promise.resolve('/tmp/mdv-task-test')),
  rm: vi.fn(),
}));

let app: FastifyInstance;
beforeEach(async () => {
  app = await buildApp();
  await app.ready();
});
afterEach(async () => {
  await app.close();
});
```

### Client Test Pattern

Client tests use jsdom. The chat panel creates DOM dynamically. Tests call `mountChatPanel()` or individual component mount functions and assert on resulting DOM.

```typescript
// Client test setup pattern
import { JSDOM } from 'jsdom';

let dom: JSDOM;
beforeEach(() => {
  dom = new JSDOM(`<div id="main"><div id="workspace"></div></div>`, {
    url: 'http://localhost:3000',
  });
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
});
```

---

## Test Fixtures

```typescript
// app/tests/fixtures/tasks.ts

import type {
  ChatTaskStatusMessage,
  ChatTaskSnapshotMessage,
  ChatAutonomousRunMessage,
  TaskInfo,
} from '../../src/server/schemas/index.js';
import type { TaskDispatchConfig } from '../../src/server/services/task-manager.js';

// --- Task Dispatch Configs ---

export function createTaskConfig(
  overrides?: Partial<TaskDispatchConfig>,
): TaskDispatchConfig {
  return {
    phase: 'epic',
    target: 'feature-2',
    description: 'Draft epic for Feature 2',
    inputPaths: ['prd.md'],
    outputDir: 'epics/feature-2/',
    workspaceIdentity: '/Users/dev/project',
    ...overrides,
  };
}

export function createTechDesignConfig(
  overrides?: Partial<TaskDispatchConfig>,
): TaskDispatchConfig {
  return {
    phase: 'tech-design',
    target: 'feature-2',
    description: 'Technical design for Feature 2',
    inputPaths: ['epics/feature-2/epic.md'],
    outputDir: 'epics/feature-2/',
    workspaceIdentity: '/Users/dev/project',
    ...overrides,
  };
}

// --- Task Status Messages ---

export function createTaskStatusMessage(
  overrides?: Partial<ChatTaskStatusMessage>,
): ChatTaskStatusMessage {
  return {
    type: 'chat:task-status',
    taskId: '00000000-0000-4000-a000-000000000001',
    status: 'started',
    phase: 'epic',
    target: 'feature-2',
    description: 'Draft epic for Feature 2',
    outputDir: 'epics/feature-2/',
    ...overrides,
  };
}

export function createCompletedTaskStatus(
  overrides?: Partial<ChatTaskStatusMessage>,
): ChatTaskStatusMessage {
  return {
    type: 'chat:task-status',
    taskId: '00000000-0000-4000-a000-000000000001',
    status: 'completed',
    phase: 'epic',
    target: 'feature-2',
    description: 'Draft epic for Feature 2',
    outputDir: 'epics/feature-2/',
    elapsedMs: 300_000,
    outputPaths: ['epics/feature-2/epic.md'],
    primaryOutputPath: 'epics/feature-2/epic.md',
    ...overrides,
  };
}

export function createFailedTaskStatus(
  overrides?: Partial<ChatTaskStatusMessage>,
): ChatTaskStatusMessage {
  return {
    type: 'chat:task-status',
    taskId: '00000000-0000-4000-a000-000000000001',
    status: 'failed',
    phase: 'epic',
    target: 'feature-2',
    description: 'Draft epic for Feature 2',
    elapsedMs: 60_000,
    error: 'CLI process exited with code 1',
    ...overrides,
  };
}

// --- Task Snapshot ---

export function createTaskSnapshot(
  tasks: TaskInfo[] = [],
  autonomousRun?: ChatTaskSnapshotMessage['autonomousRun'],
): ChatTaskSnapshotMessage {
  return {
    type: 'chat:task-snapshot',
    tasks,
    ...(autonomousRun ? { autonomousRun } : {}),
  };
}

export function createTaskInfo(
  overrides?: Partial<TaskInfo>,
): TaskInfo {
  return {
    taskId: '00000000-0000-4000-a000-000000000001',
    phase: 'epic',
    target: 'feature-2',
    description: 'Draft epic for Feature 2',
    status: 'running',
    startedAt: new Date().toISOString(),
    elapsedMs: 30_000,
    outputDir: 'epics/feature-2/',
    workspaceIdentity: '/Users/dev/project',
    ...overrides,
  };
}

// --- Autonomous Run Messages ---

export function createAutonomousRunStarted(
  overrides?: Partial<ChatAutonomousRunMessage>,
): ChatAutonomousRunMessage {
  return {
    type: 'chat:autonomous-run',
    runId: '00000000-0000-4000-a000-000000000100',
    workspaceIdentity: '/Users/dev/project',
    status: 'started',
    phases: ['epic', 'tech-design', 'stories'],
    currentPhaseIndex: 0,
    ...overrides,
  };
}

export function createAutonomousRunCompleted(
  overrides?: Partial<ChatAutonomousRunMessage>,
): ChatAutonomousRunMessage {
  return {
    type: 'chat:autonomous-run',
    runId: '00000000-0000-4000-a000-000000000100',
    workspaceIdentity: '/Users/dev/project',
    status: 'completed',
    phases: ['epic', 'tech-design', 'stories'],
    completedPhases: ['epic', 'tech-design', 'stories'],
    ...overrides,
  };
}

// --- Mock Child Process (extended from Epic 10) ---

import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';

export class MockChildProcess extends EventEmitter {
  readonly stdin = new Writable({
    write(_chunk, _encoding, callback) { callback(); },
  });
  readonly stdout = new Readable({ read() {} });
  readonly stderr = new Readable({ read() {} });
  readonly pid = 12345;
  killed = false;

  kill(signal?: string): boolean {
    this.killed = true;
    this.emit('exit', signal === 'SIGTERM' ? 0 : 1, signal ?? null);
    return true;
  }

  /** Simulate stdout data (newline-terminated) */
  emitStdout(data: string): void {
    this.stdout.push(data + '\n');
  }

  /** Simulate stdout data WITHOUT trailing newline (R4 edge case) */
  emitStdoutRaw(data: string): void {
    this.stdout.push(data);
  }

  /** Simulate stdout end event */
  endStdout(): void {
    this.stdout.push(null);
  }

  emitExit(code: number, signal: string | null = null): void {
    this.emit('exit', code, signal);
  }

  emitError(err: Error): void {
    this.emit('error', err);
  }

  /** Simulate successful completion after delay */
  completeAfter(ms: number): void {
    setTimeout(() => this.emitExit(0), ms);
  }
}

// --- Input Artifact Fixtures ---

export const SAMPLE_PRD = `# Product Requirements Document\n\n## Feature 2: Auth Flow\n\nDescription of the auth flow feature...`;

export const SAMPLE_EPIC = `# Epic: Auth Flow\n\n## User Profile\n\n**Primary User:** Developer\n\n## Flows & Requirements\n\n### 1. Authentication\n\n**AC-1.1:** User can authenticate...`;

export const SAMPLE_TECH_DESIGN = `# Technical Design: Auth Flow\n\n## Module Architecture\n\nsrc/auth/\n├── auth.service.ts\n└── auth.types.ts`;

// --- Manifest Fixtures ---

export const SAMPLE_MANIFEST = `---\ntitle: My Spec\ntype: spec\nspecPhase: prd\nspecStatus: draft\n---\n\n- [PRD](prd.md)\n`;

export const SAMPLE_MANIFEST_WITH_EPIC = `---\ntitle: My Spec\ntype: spec\nspecPhase: epic\nspecStatus: draft\n---\n\n- [PRD](prd.md)\n- [Epic](epics/feature-2/epic.md)\n`;
```

---

## TC → Test Mapping

### Chunk 0: Infrastructure

#### `tests/server/schemas/task-schemas.test.ts` (5 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| — | ChatTaskStatusMessage validates all status values | Create messages with each status | Schema parse succeeds |
| — | ChatTaskCancelMessage validates UUID taskId | Create with valid/invalid IDs | Parse succeeds/fails |
| — | ChatAutonomousRunMessage validates phase arrays | Create with various phase configs | Parse succeeds |
| — | ChatTaskSnapshotMessage validates task array | Create with TaskInfo entries | Parse succeeds |
| — | ChatAutonomousCancelMessage validates runId | Create with valid UUID | Parse succeeds |

#### `tests/server/services/pipeline-constants.test.ts` (2 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| — | Phase constants cover all supported phases | Check PIPELINE_PHASES | Contains epic, tech-design, stories, implementation |
| — | AUTONOMOUS_SEQUENCE contains standard phases | Check array | ['epic', 'tech-design', 'stories'] |

#### `tests/fixtures/task-fixtures.test.ts` (3 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| — | TaskDispatchConfig fixture creates valid config | createTaskConfig() | All required fields present |
| — | TaskInfo fixture creates valid info | createTaskInfo() | Validates against schema |
| — | MockChildProcess emits events correctly | Create mock, emitExit | Exit event fires with code |

**Chunk 0 Total: 10 tests (0 TC + 10 non-TC)**

---

### Chunk 1: Background Task Management

#### `tests/server/services/task-manager.test.ts` (20 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-1.4a | Started event emitted on dispatch | Dispatch task | onEvent receives started status with taskId, phase, description |
| TC-1.4b | Progress events with elapsed time | Dispatch task, advance fake timer by 15s | onEvent receives running status with elapsedMs |
| TC-1.4c | Completed event emitted on success | Dispatch task, mock process exits 0 | onEvent receives completed status (outputPaths enriched later by ResultsIntegrator via WS route) |
| TC-1.4d | Failed event with error description | Dispatch task, mock process exits 1 | onEvent receives failed with error string |
| TC-1.5a | Two tasks run concurrently | Dispatch two tasks with different phases | Both spawn calls made, both tracked in tasks Map |
| TC-1.5b | Concurrency limit enforced | Dispatch MAX_CONCURRENT_TASKS tasks, dispatch one more | Fourth dispatch throws TASK_LIMIT_REACHED |
| TC-1.5c | Independent lifecycle | Dispatch two tasks, complete one | Completed task status reported, other task continues |
| TC-1.3a | Cancel via task ID | Dispatch task, call cancel(taskId) | AbortController.abort() called, cancelled status emitted |
| TC-1.3c | Partial output preserved on cancel | Dispatch task, cancel | No file deletion calls made |
| TC-1.3d | Cancel non-existent task | Call cancel('nonexistent') | Throws TASK_NOT_FOUND |
| TC-5.1a | Failed task sends error | Mock process exits with code 1 | onEvent receives failed status with error |
| TC-5.1b | Failure does not crash server | Mock process exits with error | TaskManager continues operating, other methods work |
| TC-5.1c | Failure does not affect other tasks | Two tasks running, one fails | Other task continues, its status unchanged |
| TC-5.2a | Partial files remain on failure | Task writes file then fails | No cleanup of output files |
| — | Graceful shutdown kills all processes | Dispatch 2 tasks, call shutdown() | Both AbortControllers aborted |
| — | Heartbeat timer cleared on task end | Dispatch task, complete it | No more interval callbacks fire |
| — | AbortController signal propagates to spawn | Dispatch task | spawn() called with signal option from AbortController |
| — | Second cancel throws TASK_NOT_FOUND | Dispatch task, call cancel, call cancel again | First cancel succeeds, second throws TASK_NOT_FOUND (task already terminal) |
| — | Trailing stdout buffer flushed on end | Emit result JSON via emitStdoutRaw (no newline), endStdout, exit(0) | resultText contains the result text from the final un-newlined line |
| TC-5.4a | Duplicate task rejected | Dispatch epic for target "Feature A", dispatch again same phase+target | Second dispatch throws TASK_ALREADY_RUNNING |

#### `tests/server/routes/ws-chat-tasks.test.ts` (8 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-1.1a | Chat exchange during running task | Dispatch background task, send chat:send | Foreground responds normally, background task unaffected |
| TC-1.1b | Task status does not interrupt streaming | Stream foreground response, emit task status | Both messages arrive independently on WebSocket |
| TC-1.6a | Snapshot on initial connect | Two tasks exist, client connects | Receives chat:task-snapshot with both tasks |
| TC-1.6b | Snapshot on reconnect | Task running, disconnect, reconnect | Snapshot reflects current state |
| TC-1.6c | Snapshot on workspace switch | Tasks in workspace A, switch to B | Snapshot for B (may be empty) |
| TC-1.6d | Snapshot after server restart | No persisted tasks | Snapshot contains empty tasks array |
| TC-1.6e | Snapshot semantics are replace | Client has local state, receives snapshot | Local state replaced entirely |
| TC-5.3a | No task infrastructure when flag disabled | Build app with flag=false | No task-related handlers initialized |

#### `tests/client/steward/chat-state-tasks.test.ts` (4 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-1.2a | Running task shows status | updateTask with running status | tasks array contains task with running status |
| TC-1.2d | No indicators when no tasks | Initial state | tasks array is empty |
| — (TC-1.6e client) | replaceTaskSnapshot replaces all | Set tasks, call replaceTaskSnapshot with different tasks | tasks array matches snapshot exactly |
| TC-1.1c | Multiple exchanges during long task | updateTask with running, add chat messages | Both tasks and messages coexist in state |

#### `tests/client/steward/task-display.test.ts` (4 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-1.2b | Elapsed time updates | Update task with elapsedMs: 135000 | Display shows "2m 15s" |
| TC-1.2c | Completed task shows output | Update task with completed, primaryOutputPath | Output link visible in DOM |
| TC-5.3b | Task messages not processed when flag off | Flag disabled, no chat panel | No task-related DOM elements |
| TC-5.2b | Partial output not in manifest | Task failed | No manifest update triggered |

**Chunk 1 Total: 36 tests (31 TC + 5 non-TC)**

---

### Chunk 2: Pipeline Phase Dispatch

#### `tests/server/services/pipeline-dispatcher.test.ts` (14 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-2.1a | Epic drafting dispatch | Workspace with prd.md, dispatch epic | TaskManager.dispatch() called, started event emitted |
| TC-2.1b | Tech design dispatch | Workspace with epic.md, dispatch tech-design | TaskManager.dispatch() called |
| TC-2.1c | Stories dispatch | Workspace with epic + tech-design, dispatch stories | TaskManager.dispatch() called |
| TC-2.1d | Implementation dispatch | Workspace with stories, dispatch implementation | TaskManager.dispatch() called |
| TC-2.1e | Foreground available after dispatch | Dispatch task, send chat message | Foreground responds normally |
| TC-2.2a | Epic receives PRD content | Dispatch epic | CLI args contain PRD content in user message |
| TC-2.2b | Tech design receives epic | Dispatch tech-design | CLI args contain epic content |
| TC-2.2c | Stories receives epic + tech design | Dispatch stories | CLI args contain both |
| TC-2.2d | Implementation receives stories + tech design | Dispatch implementation | CLI args contain both |
| TC-2.3a | Tech design without epic → chat:error | No epic file, dispatch via script | Script result has errorCode PREREQUISITE_MISSING; chat:error with code PREREQUISITE_MISSING sent to client |
| TC-2.3b | Stories without tech design → chat:error | Epic exists but no tech-design | Script result has errorCode PREREQUISITE_MISSING sent to client |
| TC-2.3c | All prerequisites met | All files exist | Dispatch succeeds, no error |
| TC-2.3d | Implementation without stories → chat:error | No stories | chat:error with code PREREQUISITE_MISSING sent to client |
| — | Input artifact truncation for oversized files | Mock getFileContent returns truncated result | Truncation flag passed through to CLI args |

#### `tests/server/services/script-executor-tasks.test.ts` (4 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-1.3b | cancelTask via script | Execute cancelTask(taskId) script | TaskManager.cancel() called |
| TC-5.4b | Different phase allowed | Epic running for target A, dispatch tech-design for target B | Second dispatch succeeds |
| TC-5.4c | Same phase different feature | Epic for target A running, dispatch epic for target B | Second dispatch succeeds |
| — | Phase config covers all phases | Check buildSystemPrompt for each phase | Non-empty prompt returned for each |

#### `tests/client/steward/chat-panel-dispatch.test.ts` (2 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-2.4a | Agent response completes before task-status started | Dispatch via script during foreground message | chat:done arrives before chat:task-status started on WebSocket; a completed agent message (non-empty) exists |
| TC-2.4b | Output location in started event | Task dispatched | chat:task-status started includes outputDir field |

**Chunk 2 Total: 20 tests (18 TC + 2 non-TC)**

---

### Chunk 3: Results Integration and Approval

#### `tests/server/services/results-integrator.test.ts` (13 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-3.1a | Output files parsed from CLI manifest | Task completes, CLI result contains JSON manifest with 1 file | outputPaths populated from manifest, file read from stagingDir and written via addFile |
| TC-3.1b | File-created sent per output file | CLI manifest lists 3 files, mock readFile for each in staging | 3 fileCreated events emitted with taskId as messageId |
| TC-3.1c | Single-file output | CLI manifest lists 1 file | outputPaths has 1 entry, primaryOutputPath equals it |
| TC-3.2a | Manifest updated in package mode | Package mode, task completes | updateManifest called with new entry |
| TC-3.2b | Sidebar reflects update | Manifest updated | packageChanged event emitted |
| TC-3.2c | No manifest update in folder mode | Folder mode, task completes | updateManifest NOT called |
| TC-3.7a | Multi-file grouped in manifest | 3 output files | All 3 added to manifest, single packageChanged |
| TC-3.7b | Rerun no duplicate entries | File already in manifest | Existing entry preserved, no duplicate |
| TC-3.7c | Phase metadata advances | Epic task completes in spec package | specPhase updated to 'epic', specStatus to 'draft' |
| TC-3.7d | No advancement on failure | Task fails | specPhase unchanged |
| — | Manifest parsing handles missing JSON block | CLI result has no JSON manifest | Empty outputPaths, no errors |
| — | Manifest parsing handles malformed JSON | CLI result has invalid JSON block | Empty outputPaths, no errors |
| TC-2.4c | Reported output matches actual | Compare task-status outputDir with actual files | Files within reported directory |

#### `tests/server/services/approval-binding.test.ts` (6 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-3.4a | Follow-up with output as context | Task completed, user opens output, sends message | ProviderContext includes lastCompletedTask |
| TC-3.4b | Feedback doesn't affect running tasks | Send feedback while another task runs | Running task unaffected |
| TC-3.4c | Ambiguous feedback | Two completed tasks, no output open | ProviderContext includes lastCompletedTask (most recent) |
| — | lastCompletedTask persists across chat:clear | Complete task, clear conversation, send new message | ProviderContext still includes lastCompletedTask (workspace-scoped, not conversation-scoped) |
| TC-3.7e | specStatus advances to approved | Steward proceeds to next phase | updateManifest called with specStatus: approved |
| TC-3.7f | Re-dispatch resets specStatus | Re-dispatch same phase | updateManifest called with specStatus: draft |

#### `tests/server/services/follow-on-dispatch.test.ts` (4 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-3.5a | Follow-on uses preceding output | Epic completed, dispatch tech-design | Tech-design input includes epic output path |
| TC-3.5b | Follow-on produces new task | Dispatch follow-on | New taskId, independent lifecycle |
| TC-3.6a | Re-dispatch includes feedback | Dispatch with instructions | CLI args include feedback text |
| TC-3.6b | Re-dispatch produces new task | Re-dispatch same phase | New taskId, previous task status unchanged |

#### `tests/client/steward/task-display-completion.test.ts` (3 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-3.3a | Completion shows output location | updateTask with completed + primaryOutputPath | .chat-task-output-link visible with correct path |
| TC-3.3b | Output path is navigable | Click output link | onOpenFile callback invoked with path |
| TC-3.6c | Re-dispatch overwrites output | Two completed tasks for same phase | Second output replaces first |

**Chunk 3 Total: 26 tests (22 TC + 4 non-TC)**

---

### Chunk 4: Autonomous Pipeline Execution

#### `tests/server/services/autonomous-sequencer.test.ts` (14 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-4.1a | Run-started event | Start autonomous run | onRunEvent receives started with runId, phases |
| TC-4.1b | Skipped phases reported | Epic already exists | skippedPhases includes 'epic', phases starts with 'tech-design' |
| TC-4.2a | Automatic phase progression | First phase completes | Second phase dispatched without user input |
| TC-4.2b | Output feeds next phase | First phase completes with output | Second phase input includes first phase output |
| TC-4.2c | Correct phase ordering | Full run | Phases execute in order: epic → tech-design → stories |
| TC-4.3a | Task events carry sequence info | Task in autonomous run starts | chat:task-status has sequenceInfo with current, total, phaseName |
| TC-4.3b | Per-task completion reported | Phase completes | chat:task-status completed sent |
| TC-4.3c | Run completion event | All phases complete | chat:autonomous-run completed with completedPhases |
| TC-4.4a | Run cancel stops current task | Cancel run during phase | Current task cancelled via TaskManager |
| TC-4.4b | Run cancel prevents subsequent | Cancel after first phase | Second phase never dispatched |
| TC-4.4c | Completed phases preserved on cancel | Two phases done, cancel during third | First two output files remain on disk |
| TC-4.4d | Run cancellation event sent | Cancel run | chat:autonomous-run cancelled with completedPhases |
| TC-4.4e | Single task cancel stops run | Cancel task (not run) | Run status becomes failed, subsequent phases skipped |
| TC-4.5a | Failure halts sequence | Phase 2 fails | Phase 3 never dispatched |

#### `tests/server/services/autonomous-failure.test.ts` (5 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-4.5b | Failure reported with run event | Phase fails | chat:autonomous-run failed with failedPhase and error |
| TC-4.5c | Prior output preserved on failure | Two phases done, third fails | Output from first two phases on disk |
| — | Sequencer handles all phases skipped | All artifacts exist | Run completes immediately with empty phases |
| — | Concurrent autonomous runs rejected | Start run while one active | Error thrown |
| — | Autonomous-run events suppressed for non-matching workspace | Run in workspace A, socket on workspace B | No autonomous-run events relayed to socket |

#### `tests/client/steward/autonomous-display.test.ts` (4 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-4.3a (client) | Phase list with progress indicators | Run with 2 completed, 1 current | Two checkmarks, one dot, remaining circles |
| TC-4.4 (client) | Cancel button visible during run | Run active | Cancel Run button in DOM |
| TC-4.1b (client) | Skipped phases shown | Run with skippedPhases | "Skipped:" text visible |
| TC-4.5b (client) | Failed phase marked with X | Run failed at phase 2 | Phase 2 has X indicator, phase 3 pending |

**Chunk 4 Total: 23 tests (20 TC + 3 non-TC)**

---

## Test Count Reconciliation

### Per-File Totals

| Test File | Tests |
|-----------|-------|
| `tests/server/schemas/task-schemas.test.ts` | 5 |
| `tests/server/services/pipeline-constants.test.ts` | 2 |
| `tests/fixtures/task-fixtures.test.ts` | 3 |
| `tests/server/services/task-manager.test.ts` | 20 |
| `tests/server/routes/ws-chat-tasks.test.ts` | 8 |
| `tests/client/steward/chat-state-tasks.test.ts` | 4 |
| `tests/client/steward/task-display.test.ts` | 4 |
| `tests/server/services/pipeline-dispatcher.test.ts` | 14 |
| `tests/server/services/script-executor-tasks.test.ts` | 4 |
| `tests/client/steward/chat-panel-dispatch.test.ts` | 2 |
| `tests/server/services/results-integrator.test.ts` | 13 |
| `tests/server/services/approval-binding.test.ts` | 6 |
| `tests/server/services/follow-on-dispatch.test.ts` | 4 |
| `tests/client/steward/task-display-completion.test.ts` | 3 |
| `tests/server/services/autonomous-sequencer.test.ts` | 14 |
| `tests/server/services/autonomous-failure.test.ts` | 5 |
| `tests/client/steward/autonomous-display.test.ts` | 4 |
| **Total** | **115** |

### Per-Chunk Totals

| Chunk | TC Tests | Non-TC Tests | Chunk Total | Running Total |
|-------|----------|-------------|-------------|---------------|
| 0 | 0 | 10 | 10 | 10 |
| 1 | 31 | 5 | 36 | 46 |
| 2 | 18 | 2 | 20 | 66 |
| 3 | 22 | 4 | 26 | 92 |
| 4 | 20 | 3 | 23 | 115 |
| **Total** | **91** | **24** | **115** | |

### Cross-Check

- Per-file sum: 5+2+3+20+8+4+4+14+4+2+13+6+4+3+14+5+4 = **115** ✓
- Per-chunk sum: 10+36+20+26+23 = **115** ✓

---

## TC Traceability Summary

All 87 TCs from the epic are mapped. The following table shows coverage by flow:

| Flow | ACs | TCs | Tests | Coverage |
|------|-----|-----|-------|----------|
| 1. Background Task Mgmt | AC-1.1–AC-1.6 | TC-1.1a–TC-1.6e (23) | 36 across Chunks 0+1 | Complete + 5 non-TC |
| 2. Pipeline Phase Dispatch | AC-2.1–AC-2.4 | TC-2.1a–TC-2.4c (16) | 20 in Chunk 2 | Complete + 2 non-TC |
| 3. Results & Approval | AC-3.1–AC-3.7 | TC-3.1a–TC-3.7f (22) | 26 in Chunk 3 | Complete + 4 non-TC |
| 4. Autonomous Execution | AC-4.1–AC-4.5 | TC-4.1a–TC-4.5c (16) | 23 in Chunk 4 | Complete + 3 non-TC |
| 5. Error Handling | AC-5.1–AC-5.4 | TC-5.1a–TC-5.4c (10) | Distributed across Chunks 1–2 | Complete |

**TC count check:** 23 + 16 + 22 + 16 + 10 = 87 TCs. All 87 TCs from the epic are mapped to tests in the per-chunk tables above. The TC test count (91) exceeds the TC count because some TCs have tests in multiple chunks (e.g., client and server tests for the same TC).

---

## Manual Verification Checklist

After TDD Green, verify the full flow manually:

### Background Task Management

1. [ ] Set `FEATURE_SPEC_STEWARD=true`, start dev server
2. [ ] Open a spec package with a PRD
3. [ ] Send "draft the epic for Feature 2" in chat
4. [ ] Verify task status indicator appears (started, then running with elapsed time)
5. [ ] Send a normal chat message while task runs — verify foreground responds
6. [ ] Verify periodic status updates arrive (every ~15 seconds)
7. [ ] Wait for task completion — verify completed status with output link
8. [ ] Click output link — verify file opens in viewer
9. [ ] Verify sidebar updates with new navigation entry (package mode)

### Cancellation

10. [ ] Start a new task, then cancel it via the cancel button
11. [ ] Verify cancelled status appears
12. [ ] Verify partial output (if any) remains on disk

### Multiple Tasks

13. [ ] Start two tasks for different features simultaneously
14. [ ] Verify both show status indicators
15. [ ] Complete one — verify the other continues

### Autonomous Mode

16. [ ] Send "run the full spec pipeline for Feature 3"
17. [ ] Verify autonomous run display appears with phase list
18. [ ] Verify phases execute sequentially (epic → tech-design → stories)
19. [ ] Verify completed phases get checkmarks
20. [ ] Verify run completion event and all output files exist

### Autonomous Cancellation

21. [ ] Start an autonomous run, cancel during second phase
22. [ ] Verify first phase output preserved
23. [ ] Verify second phase cancelled, third phase skipped

### Error Scenarios

24. [ ] Request tech design without an epic — verify prerequisite error
25. [ ] Start MAX_CONCURRENT_TASKS tasks, try one more — verify limit error
26. [ ] Start duplicate task (same phase/feature) — verify rejection

### Feature Flag

27. [ ] Disable flag, restart — verify no task infrastructure, no indicators
28. [ ] Re-enable flag — verify task functionality returns

### Reconnect

29. [ ] Start a task, kill the WebSocket connection, reconnect
30. [ ] Verify task snapshot restores current state

---

## Gorilla Testing Scenarios

### New capabilities to test:

- **Background task isolation** — start a task and aggressively interact with the chat: send messages, cancel foreground responses, clear conversation, switch tabs. The background task should continue unaffected. No cross-contamination between foreground and background.
- **Concurrent tasks** — start multiple tasks targeting different features. Verify they complete independently. Cancel one while the other runs. Verify elapsed times are independent. Check that task status indicators don't overlap or corrupt each other.
- **Long-running task resilience** — start a task that runs for several minutes. During execution: resize the chat panel, switch themes, open/close tabs, navigate the sidebar. The task status should continue updating and complete normally.
- **Rapid cancel/dispatch cycles** — dispatch a task, immediately cancel, dispatch again. Repeat rapidly. Look for orphaned processes, stuck status indicators, or corrupted task state.
- **Autonomous mode interruption** — start an autonomous run, interact heavily during execution. Cancel mid-run. Verify completed phase output is preserved and the workspace is in a consistent state.
- **Output file review flow** — complete a pipeline task, click the output link, review the file, send approval feedback. Verify the feedback binds to the correct task (check ProviderContext). Request re-dispatch with changes — verify the re-dispatch uses the same output location.
- **Manifest integration** — complete tasks in a spec package. Verify the sidebar updates with new navigation entries. Verify specPhase advances correctly. Re-run a phase — verify no duplicate manifest entries.

### Adjacent features to recheck:

- **Foreground chat during tasks** — all existing chat functionality (send, cancel, clear, streaming markdown, context indicator) should work identically with background tasks running. No latency increase, no dropped tokens.
- **File editing during tasks** — edit documents through chat (Epic 12) while a background task runs. Verify dirty-tab handling works for both foreground Steward edits and background task output.
- **Package operations during tasks** — create package, export, modify manifest through chat (Epic 13) while a background task runs. Verify no conflicts.
- **Theme switching** — switch themes while task indicators are visible. Verify all task and autonomous display elements adopt the new theme correctly.
- **WebSocket reconnection** — disconnect and reconnect during a task. Verify snapshot restores state correctly. Verify subsequent task events continue arriving.

### Edge cases:

- **Server restart during task** — restart the server while a task is running. Verify the CLI process is killed (no orphans). On reconnect, verify empty task snapshot. Verify conversation history shows what happened before restart.
- **Autonomous run with all phases skipped** — start autonomous in a workspace where all artifacts already exist. Verify the run completes immediately with everything in skippedPhases.
- **Prerequisite validation edge cases** — try dispatching phases with missing, corrupted, or empty input artifacts. Verify clear error messages for each case.
- **Concurrent dispatch of same phase** — rapidly click to dispatch the same phase twice. Verify the second is rejected with TASK_ALREADY_RUNNING.
