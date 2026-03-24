# Technical Design — Server (Epic 14: Pipeline Orchestration)

Companion to `tech-design.md`. This document covers server-side implementation depth: TaskManager, PipelineDispatcher, AutonomousSequencer, ResultsIntegrator, WebSocket extensions, and schema additions.

---

## Chat Message Schemas

All new WebSocket messages are validated with Zod schemas, extending the existing pattern in `schemas/index.ts`. The schemas use `z.discriminatedUnion` on the `type` field, consistent with all prior epics.

### Client → Server Messages

```typescript
// Added to app/src/server/schemas/index.ts

// --- Epic 14: Task Management ---

export const ChatTaskCancelMessageSchema = z.object({
  type: z.literal('chat:task-cancel'),
  taskId: z.string().uuid(),
});

export const ChatAutonomousCancelMessageSchema = z.object({
  type: z.literal('chat:autonomous-cancel'),
  runId: z.string().uuid(),
});

// Updated ChatClientMessage union:
export const ChatClientMessageSchema = z.discriminatedUnion('type', [
  ChatSendMessageSchema,
  ChatCancelMessageSchema,
  ChatClearMessageSchema,
  ChatTaskCancelMessageSchema,         // NEW
  ChatAutonomousCancelMessageSchema,   // NEW
]);
```

### Server → Client Messages

```typescript
// --- Task Status ---

export const TaskSequenceInfoSchema = z.object({
  current: z.number().int().min(1),
  total: z.number().int().min(1),
  phaseName: z.string(),
});

export const ChatTaskStatusMessageSchema = z.object({
  type: z.literal('chat:task-status'),
  taskId: z.string().uuid(),
  status: z.enum(['started', 'running', 'completed', 'failed', 'cancelled']),
  phase: z.string(),
  target: z.string(),                  // Feature/artifact identity for this task
  description: z.string(),
  outputDir: z.string().optional(),
  elapsedMs: z.number().optional(),
  outputPaths: z.array(z.string()).optional(),
  primaryOutputPath: z.string().optional(),
  error: z.string().optional(),
  autonomousRunId: z.string().uuid().optional(),
  sequenceInfo: TaskSequenceInfoSchema.optional(),
});

// --- Task Snapshot ---

export const TaskInfoSchema = z.object({
  taskId: z.string().uuid(),
  phase: z.string(),
  target: z.string(),                  // Feature/artifact identity
  description: z.string(),
  status: z.enum(['started', 'running', 'completed', 'failed', 'cancelled']),
  startedAt: z.string().datetime(),
  elapsedMs: z.number(),
  outputDir: z.string().optional(),
  outputPaths: z.array(z.string()).optional(),
  primaryOutputPath: z.string().optional(),
  autonomousRunId: z.string().uuid().optional(),
  workspaceIdentity: z.string(),       // Canonical workspace identity
});

export const AutonomousRunSnapshotSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(['started', 'running']),
  phases: z.array(z.string()),
  currentPhaseIndex: z.number().int().min(0),
  completedPhases: z.array(z.string()),
});

export type AutonomousRunSnapshot = z.infer<typeof AutonomousRunSnapshotSchema>;

export const ChatTaskSnapshotMessageSchema = z.object({
  type: z.literal('chat:task-snapshot'),
  tasks: z.array(TaskInfoSchema),
  autonomousRun: AutonomousRunSnapshotSchema.optional(),
});

// --- Autonomous Run ---

export const ChatAutonomousRunMessageSchema = z.object({
  type: z.literal('chat:autonomous-run'),
  runId: z.string().uuid(),
  workspaceIdentity: z.string(),       // For workspace-scoped relay filtering (R5 fix)
  status: z.enum(['started', 'running', 'completed', 'failed', 'cancelled']),
  phases: z.array(z.string()),
  skippedPhases: z.array(z.string()).optional(),
  currentPhaseIndex: z.number().int().min(0).optional(),
  completedPhases: z.array(z.string()).optional(),
  failedPhase: z.string().optional(),
  error: z.string().optional(),
});

// Updated ChatServerMessage union:
export const ChatServerMessageSchema = z.discriminatedUnion('type', [
  ChatTokenMessageSchema,
  ChatDoneMessageSchema,
  ChatErrorMessageSchema,
  ChatStatusSchema,
  ChatFileCreatedMessageSchema,           // Epic 12
  ChatConversationLoadMessageSchema,      // Epic 12
  ChatContextMessageSchema,              // Epic 12
  ChatPackageChangedMessageSchema,        // Epic 13
  ChatTaskStatusMessageSchema,            // NEW
  ChatTaskSnapshotMessageSchema,          // NEW
  ChatAutonomousRunMessageSchema,         // NEW
]);

// Inferred types
export type ChatTaskCancelMessage = z.infer<typeof ChatTaskCancelMessageSchema>;
export type ChatAutonomousCancelMessage = z.infer<typeof ChatAutonomousCancelMessageSchema>;
export type ChatTaskStatusMessage = z.infer<typeof ChatTaskStatusMessageSchema>;
export type ChatTaskSnapshotMessage = z.infer<typeof ChatTaskSnapshotMessageSchema>;
export type ChatAutonomousRunMessage = z.infer<typeof ChatAutonomousRunMessageSchema>;
export type TaskInfo = z.infer<typeof TaskInfoSchema>;
```

### New Error Codes

```typescript
// Extended ChatErrorCodeSchema
export const ChatErrorCodeSchema = z.enum([
  // Epic 10:
  'INVALID_MESSAGE', 'PROVIDER_NOT_FOUND', 'PROVIDER_CRASHED',
  'PROVIDER_TIMEOUT', 'PROVIDER_BUSY', 'PROVIDER_AUTH_FAILED',
  'SCRIPT_ERROR', 'SCRIPT_TIMEOUT', 'CANCELLED',
  // Epic 12:
  'CONTEXT_READ_FAILED', 'EDIT_FAILED',
  // Epic 13:
  'FILE_NOT_FOUND', 'FILE_ALREADY_EXISTS', 'PATH_TRAVERSAL',
  'MANIFEST_NOT_FOUND', 'MANIFEST_PARSE_ERROR', 'PERMISSION_DENIED',
  'NOT_TEXT_FILE', 'READ_BUDGET_EXCEEDED',
  'PACKAGE_EXPORT_FAILED', 'PACKAGE_CREATE_FAILED',
  // Epic 14:
  'TASK_NOT_FOUND', 'TASK_LIMIT_REACHED', 'TASK_ALREADY_RUNNING',
  'TASK_DISPATCH_FAILED', 'PREREQUISITE_MISSING',
]);
```

### Pipeline Phase Constants

```typescript
export const PIPELINE_PHASES = ['epic', 'tech-design', 'stories', 'implementation'] as const;
export type PipelinePhase = typeof PIPELINE_PHASES[number];

export const AUTONOMOUS_SEQUENCE: PipelinePhase[] = ['epic', 'tech-design', 'stories'];

export const PHASE_PREREQUISITES: Record<PipelinePhase, PipelinePhase[]> = {
  'epic': [],
  'tech-design': ['epic'],
  'stories': ['epic', 'tech-design'],
  'implementation': ['stories'],
};

export const PHASE_INPUT_ARTIFACTS: Record<PipelinePhase, string[]> = {
  'epic': ['prd'],
  'tech-design': ['epic'],
  'stories': ['epic', 'tech-design'],
  'implementation': ['stories', 'tech-design'],
};

export const PHASE_DISPLAY_NAMES: Record<PipelinePhase, string> = {
  'epic': 'Epic Drafting',
  'tech-design': 'Technical Design',
  'stories': 'Story Generation',
  'implementation': 'Implementation',
};
```

### TaskDispatchConfig and ManagedTask Types

```typescript
export interface TaskDispatchConfig {
  phase: PipelinePhase;
  target: string;              // Feature/artifact identity (e.g., "Feature 2", "auth-flow")
  description: string;
  inputPaths: string[];
  outputDir: string;
  instructions?: string;
  autonomousRunId?: string;
  workspaceIdentity: string;   // Canonical workspace identity for scoping
  immediate?: boolean;         // When true, started event emits immediately (autonomous dispatch)
  sequenceInfo?: {             // Present when part of an autonomous run
    current: number;
    total: number;
    phaseName: string;
  };
}

export interface ManagedTask {
  taskId: string;
  config: TaskDispatchConfig;
  status: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
  process: ChildProcess | null;
  abortController: AbortController;
  startedAt: Date;
  completedAt: Date | null;          // Frozen timestamp for terminal elapsedMs
  heartbeatTimer: NodeJS.Timeout | null;
  outputPaths: string[];
  primaryOutputPath: string | null;
  error: string | null;
  stagingDir: string;                // Temp dir where CLI writes output (cwd for the CLI process)
  deferredStartedEvent: ChatTaskStatusMessage | null;  // Buffered for pre-start ordering
  activeCountDecremented: boolean;   // True once activeTaskCount has been decremented for this task
  resultText: string;                // Accumulated final assistant message text from CLI stdout
  immediate: boolean;                // When true, started event is emitted immediately (autonomous dispatch)
}
```

---

## TaskManager

The TaskManager manages background CLI processes: spawning, monitoring, progress reporting, cancellation, and state tracking. All task lifecycle events — including completion — flow through its single event bus.

### Architecture

```
ScriptExecutor ──→ PipelineDispatcher ──→ TaskManager ──→ CLI Process(es)
                                              │
                                         Event Bus ──→ All subscribers
                                         (started, running, completed,
                                          failed, cancelled)
                                              │
                                         ResultsIntegrator (on completed)
                                         WebSocket route (relay to client)
                                         AutonomousSequencer (phase progression)
```

The TaskManager is the **single source of truth** for task state transitions. All events — including `completed` — flow through its `onEvent` bus. No other component emits task lifecycle events. The WebSocket route subscribes to this bus and relays events to the client. The AutonomousSequencer subscribes to detect phase completion. The ResultsIntegrator subscribes to handle output file integration.

### Interface

```typescript
// app/src/server/services/task-manager.ts

import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const MAX_CONCURRENT_TASKS = 3;
const HEARTBEAT_INTERVAL_MS = 15_000;
const CANCEL_TIMEOUT_MS = 10_000;

type TaskEventHandler = (taskId: string, status: ChatTaskStatusMessage) => void;

export class TaskManager {
  private tasks = new Map<string, ManagedTask>();
  private activeTaskCount = 0;
  private eventHandlers = new Set<TaskEventHandler>();

  /**
   * Dispatch a new background task.
   *
   * Spawns a CLI process with the given configuration. Validates concurrency
   * limit and duplicate detection before spawning. The `started` event is
   * deferred — call `flushDeferredStarted(taskId)` after the foreground
   * agent response completes (chat:done) to enforce pre-start ordering (AC-2.4).
   *
   * Covers: AC-1.5 (concurrency), AC-5.4 (duplicate by phase+target)
   *
   * @returns The task ID
   * @throws Error with code TASK_LIMIT_REACHED, TASK_ALREADY_RUNNING, or TASK_DISPATCH_FAILED
   */
  async dispatch(config: TaskDispatchConfig, cliArgs: string[]): Promise<string> {
    // AC-1.5b: Concurrency limit
    if (this.activeTaskCount >= MAX_CONCURRENT_TASKS) {
      throw Object.assign(
        new Error(`Maximum concurrent tasks (${MAX_CONCURRENT_TASKS}) reached`),
        { code: 'TASK_LIMIT_REACHED' },
      );
    }

    // AC-5.4a: Duplicate detection by phase + target + workspace
    for (const [, task] of this.tasks) {
      if (task.status === 'started' || task.status === 'running') {
        if (
          task.config.phase === config.phase &&
          task.config.target === config.target &&
          task.config.workspaceIdentity === config.workspaceIdentity
        ) {
          throw Object.assign(
            new Error(`A task for ${config.phase} / ${config.target} is already running (${task.taskId})`),
            { code: 'TASK_ALREADY_RUNNING', existingTaskId: task.taskId },
          );
        }
      }
    }

    // Create temp staging directory BEFORE building CLI args — the CLI's cwd
    const stagingDir = await mkdtemp(join(tmpdir(), 'mdv-task-'));

    const taskId = randomUUID();
    const abortController = new AbortController();

    // Helper: build event fields shared across all emissions for this task
    const eventFields = () => ({
      phase: config.phase,
      target: config.target,
      description: config.description,
      outputDir: config.outputDir,
      ...(config.autonomousRunId ? { autonomousRunId: config.autonomousRunId } : {}),
      ...(config.sequenceInfo ? { sequenceInfo: config.sequenceInfo } : {}),
    });

    let proc: ChildProcess;
    try {
      proc = spawn('claude', cliArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: stagingDir,              // CLI writes output to its cwd (staging)
        env: { ...process.env },
        signal: abortController.signal,
      });
    } catch (err) {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
      throw Object.assign(
        new Error(`Failed to spawn CLI process: ${(err as Error).message}`),
        { code: 'TASK_DISPATCH_FAILED' },
      );
    }

    // Build the deferred started event (sent after foreground chat:done — AC-2.4)
    const startedEvent: ChatTaskStatusMessage = {
      type: 'chat:task-status', taskId, status: 'started', ...eventFields(),
    };

    const managedTask: ManagedTask = {
      taskId, config, status: 'started',
      process: proc, abortController,
      startedAt: new Date(), completedAt: null,
      heartbeatTimer: null,
      outputPaths: [], primaryOutputPath: null, error: null,
      stagingDir,
      deferredStartedEvent: config.immediate ? null : startedEvent,
      activeCountDecremented: false,
      resultText: '',
      immediate: config.immediate ?? false,
    };

    this.tasks.set(taskId, managedTask);
    this.activeTaskCount++;

    // If immediate (autonomous dispatch), emit started right away — no foreground
    // agent response to wait for (R3 Major 1 fix)
    if (managedTask.immediate) {
      this.emitEvent(taskId, startedEvent);
    }

    // Buffer CLI stdout — parse streaming JSON for the final assistant message text.
    // Uses the same stream-json format as Epic 10's foreground provider.
    // We accumulate text_delta content to build resultText, which the
    // ResultsIntegrator parses for the output file manifest (R3 Critical fix).
    let stdoutBuffer = '';
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          // Accumulate text from stream events (same parsing as Epic 10 StreamParser)
          if (event.type === 'stream_event') {
            const delta = event.event?.delta;
            if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
              managedTask.resultText += delta.text;
            }
          }
          // Also capture the final result text
          if (event.type === 'result' && typeof event.result === 'string') {
            managedTask.resultText = event.result;
          }
        } catch {
          // Skip malformed lines
        }
      }
    });

    // Start heartbeat timer (AC-1.4b)
    managedTask.heartbeatTimer = setInterval(() => {
      if (managedTask.status === 'started') managedTask.status = 'running';
      this.emitEvent(taskId, {
        type: 'chat:task-status', taskId, status: 'running',
        ...eventFields(),
        elapsedMs: Date.now() - managedTask.startedAt.getTime(),
      });
    }, HEARTBEAT_INTERVAL_MS);

    // Flush trailing stdout buffer on stream end (R4 Major 3 fix)
    // The last JSON line may not be newline-terminated.
    proc.stdout?.on('end', () => {
      if (stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(stdoutBuffer.trim());
          if (event.type === 'result' && typeof event.result === 'string') {
            managedTask.resultText = event.result;
          }
        } catch {
          // Skip malformed trailing content
        }
        stdoutBuffer = '';
      }
    });

    // Monitor process exit — activeTaskCount ONLY decrements here (R2 C1 fix)
    proc.on('exit', (code, _signal) => {
      this.clearHeartbeat(managedTask);
      managedTask.process = null;

      // Always decrement active count on actual exit (only once)
      if (!managedTask.activeCountDecremented) {
        this.activeTaskCount--;
        managedTask.activeCountDecremented = true;
      }

      // If cancel() already set terminal status + emitted event, nothing more to do
      if (managedTask.status === 'cancelled') return;

      // If already terminal from error handler, nothing more to do
      if (managedTask.status === 'failed' || managedTask.status === 'completed') return;

      if (code === 0) {
        managedTask.status = 'completed';
        managedTask.completedAt = new Date();

        // Emit completed through the event bus — single source of truth
        this.emitEvent(taskId, {
          type: 'chat:task-status', taskId, status: 'completed',
          ...eventFields(),
          elapsedMs: managedTask.completedAt.getTime() - managedTask.startedAt.getTime(),
          // outputPaths/primaryOutputPath populated by ResultsIntegrator
          // before the WS route relays this event to the client
        });
      } else {
        managedTask.status = 'failed';
        managedTask.completedAt = new Date();
        managedTask.error = `CLI process exited with code ${code}`;

        this.emitEvent(taskId, {
          type: 'chat:task-status', taskId, status: 'failed',
          ...eventFields(),
          elapsedMs: managedTask.completedAt.getTime() - managedTask.startedAt.getTime(),
          error: managedTask.error,
        });
      }
    });

    // Handle spawn errors
    proc.on('error', (err) => {
      this.clearHeartbeat(managedTask);
      if (managedTask.status === 'cancelled' || managedTask.status === 'failed') return;

      managedTask.status = 'failed';
      managedTask.completedAt = new Date();
      managedTask.error = err.message;
      managedTask.process = null;

      if (!managedTask.activeCountDecremented) {
        this.activeTaskCount--;
        managedTask.activeCountDecremented = true;
      }

      this.emitEvent(taskId, {
        type: 'chat:task-status', taskId, status: 'failed',
        ...eventFields(),
        elapsedMs: managedTask.completedAt.getTime() - managedTask.startedAt.getTime(),
        error: err.message,
      });
    });

    return taskId;
  }

  /**
   * Flush the deferred started event for a task.
   * Called by the WS route after the foreground agent response completes (chat:done).
   * Enforces AC-2.4 pre-start ordering: agent response before task-status started.
   */
  flushDeferredStarted(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.deferredStartedEvent) {
      this.emitEvent(taskId, task.deferredStartedEvent);
      task.deferredStartedEvent = null;
    }
  }

  /**
   * Cancel a running background task.
   *
   * Sets status to cancelled, aborts the controller, emits the cancelled event.
   * Does NOT decrement activeTaskCount — that happens in the exit handler when
   * the process actually terminates (R2 C1 fix). The process reference is kept
   * alive for the SIGKILL fallback.
   *
   * Covers: AC-1.3a, AC-1.3b (cancel via message/script)
   * @throws Error with TASK_NOT_FOUND if task doesn't exist,
   *         or if task is already in a terminal state (per epic contract)
   */
  cancel(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw Object.assign(new Error(`Task ${taskId} not found`), { code: 'TASK_NOT_FOUND' });
    }

    if (task.status !== 'started' && task.status !== 'running') {
      throw Object.assign(
        new Error(`Task ${taskId} is already ${task.status}`),
        { code: 'TASK_NOT_FOUND' },
      );
    }

    task.status = 'cancelled';
    task.completedAt = new Date();
    this.clearHeartbeat(task);
    // activeTaskCount NOT decremented here — deferred to exit handler (R2 C1 fix)

    // Abort the CLI process — keeps process reference alive for SIGKILL fallback
    task.abortController.abort();

    // SIGKILL fallback: if process doesn't exit within timeout, force kill
    const proc = task.process;  // Capture reference before exit event nulls it
    if (proc && !proc.killed) {
      const killTimer = setTimeout(() => {
        if (proc && !proc.killed) {
          proc.kill('SIGKILL');
        }
      }, CANCEL_TIMEOUT_MS);
      // Clean up timer when process actually exits
      proc.once('exit', () => clearTimeout(killTimer));
    }

    // AC-1.3c: Partial output preserved (files on disk are not deleted)

    this.emitEvent(taskId, {
      type: 'chat:task-status',
      taskId,
      status: 'cancelled',
      phase: task.config.phase,
      target: task.config.target,
      description: task.config.description,
      elapsedMs: task.completedAt.getTime() - task.startedAt.getTime(),
      ...(task.config.autonomousRunId ? { autonomousRunId: task.config.autonomousRunId } : {}),
    });
  }

  /**
   * Get all tasks for a specific workspace (active and recent) for snapshots.
   * Filters by workspaceIdentity. Orders by startedAt ascending.
   *
   * Covers: AC-1.6 (snapshot), getRunningTasks() script method
   */
  getAllTasks(workspaceIdentity: string): TaskInfo[] {
    return Array.from(this.tasks.values())
      .filter((t) => t.config.workspaceIdentity === workspaceIdentity)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .map((t) => this.toTaskInfo(t));
  }

  /**
   * Get a specific task by ID.
   */
  getTask(taskId: string): ManagedTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get the most recently completed task for a workspace.
   * Used for lastCompletedTask in ProviderContext.
   */
  getLastCompleted(workspaceIdentity: string): ManagedTask | undefined {
    let latest: ManagedTask | undefined;
    for (const task of this.tasks.values()) {
      if (
        task.config.workspaceIdentity === workspaceIdentity &&
        task.status === 'completed' &&
        task.completedAt
      ) {
        if (!latest || task.completedAt > latest.completedAt!) {
          latest = task;
        }
      }
    }
    return latest;
  }

  // --- Event subscription ---

  onEvent(handler: TaskEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Graceful shutdown — terminate all running tasks and wait for exit.
   *
   * For each active task: abort, then wait for the process to exit with
   * a hard SIGKILL fallback. No orphaned processes.
   *
   * Called from Fastify onClose hook.
   */
  async shutdown(): Promise<void> {
    const exitPromises: Promise<void>[] = [];

    for (const [, task] of this.tasks) {
      if (task.status === 'started' || task.status === 'running') {
        this.clearHeartbeat(task);
        task.abortController.abort();

        if (task.process) {
          const proc = task.process;
          exitPromises.push(
            new Promise<void>((resolve) => {
              const killTimer = setTimeout(() => {
                if (proc && !proc.killed) proc.kill('SIGKILL');
                resolve();
              }, 5_000);
              proc.once('exit', () => {
                clearTimeout(killTimer);
                resolve();
              });
            }),
          );
        }
      }
    }

    await Promise.all(exitPromises);
  }

  // --- Internal ---

  private toTaskInfo(t: ManagedTask): TaskInfo {
    // Freeze elapsedMs for terminal tasks at their completion time
    const elapsedMs = t.completedAt
      ? t.completedAt.getTime() - t.startedAt.getTime()
      : Date.now() - t.startedAt.getTime();

    return {
      taskId: t.taskId,
      phase: t.config.phase,
      target: t.config.target,
      description: t.config.description,
      status: t.status,
      startedAt: t.startedAt.toISOString(),
      elapsedMs,
      workspaceIdentity: t.config.workspaceIdentity,
      ...(t.config.outputDir ? { outputDir: t.config.outputDir } : {}),
      ...(t.outputPaths.length > 0 ? { outputPaths: t.outputPaths } : {}),
      ...(t.primaryOutputPath ? { primaryOutputPath: t.primaryOutputPath } : {}),
      ...(t.config.autonomousRunId ? { autonomousRunId: t.config.autonomousRunId } : {}),
    };
  }

  private emitEvent(taskId: string, status: ChatTaskStatusMessage): void {
    for (const handler of this.eventHandlers) handler(taskId, status);
  }

  private clearHeartbeat(task: ManagedTask): void {
    if (task.heartbeatTimer) {
      clearInterval(task.heartbeatTimer);
      task.heartbeatTimer = null;
    }
  }
}
```

### Key Design Decisions

**Single event bus for ALL lifecycle events (C2 fix):** The TaskManager emits `started`, `running`, `completed`, `failed`, and `cancelled` through one `onEvent` bus. The WebSocket route subscribes to this bus and relays. The AutonomousSequencer subscribes to detect completion. No ad-hoc event emission elsewhere. This fixes the sequencer stall: `waitForTaskCompletion()` now receives `completed` events.

**Process reference kept alive until exit (C1 fix):** `cancel()` captures the process reference in a local variable for the SIGKILL fallback timer. The `process` field on `ManagedTask` is only nulled in the `exit` event handler, not in `cancel()`. Active count decrements happen when the status transitions to terminal, with the `exit` handler guarded against double-decrement.

**Shutdown awaits each exit (C1 fix):** `shutdown()` collects a Promise per active task process. Each promise resolves when the process exits or after a 5-second SIGKILL fallback. `Promise.all()` ensures no orphans.

**Deferred started event (M7 fix):** `dispatch()` builds the `started` event but stores it on the task as `deferredStartedEvent`. The WS route calls `flushDeferredStarted(taskId)` after the foreground `chat:done` arrives, enforcing AC-2.4 pre-start ordering.

**Duplicate detection by phase + target (M8 fix):** `TaskDispatchConfig` includes a `target` field — the feature or artifact identity (e.g., "Feature 2", "auth-flow"). Duplicate = same `phase` + same `target` among active tasks. This is deterministic regardless of output directory.

**Workspace-scoped state (M5 fix):** `TaskDispatchConfig` includes `workspaceIdentity`. `getAllTasks()` filters by workspace. `getLastCompleted()` returns the most recent completion for a specific workspace.

**Frozen elapsedMs for terminal tasks:** `completedAt` is set when a task reaches any terminal state. `toTaskInfo()` uses `completedAt` for frozen elapsed time instead of recomputing from `Date.now()`.

**cancel() throws for terminal tasks:** Per the epic contract (`cancelTask(taskId)` "throws if the task is not found or already completed"), `cancel()` throws `TASK_NOT_FOUND` for tasks in terminal states.

**Staging directory per task (C3/C4 fix):** Each task gets a temp staging directory (`mkdtemp`). The CLI writes output there. After completion, the ResultsIntegrator moves files from staging to the workspace via Epic 13's `addFile()`/`editFile()`.

---

## PipelineDispatcher

The PipelineDispatcher resolves input artifacts, validates prerequisites, and constructs CLI invocations. It reads input artifacts through Epic 13's `getFileContent()` service method, honoring the file-access contract.

### Interface

```typescript
// app/src/server/services/pipeline-dispatcher.ts

import { TaskManager, type TaskDispatchConfig } from './task-manager.js';
import type { FileReadResult } from './file-operations.js'; // Epic 13's service

export interface FileReader {
  getFileContent(path: string): Promise<FileReadResult>;
}

export class PipelineDispatcher {
  constructor(
    private taskManager: TaskManager,
    private fileReader: FileReader,  // Epic 13's getFileContent service
    private workspaceRoot: string,
  ) {}

  /**
   * Dispatch a pipeline phase as a background task.
   *
   * Reads input artifacts via Epic 13's getFileContent() (C3 fix — honors
   * the file-access contract). Validates prerequisites. Constructs CLI args
   * that direct output to a staging directory.
   *
   * Covers: AC-2.1 (dispatch), AC-2.2 (input artifacts), AC-2.3 (prerequisites)
   *
   * @throws Error with PREREQUISITE_MISSING, TASK_LIMIT_REACHED, TASK_ALREADY_RUNNING, TASK_DISPATCH_FAILED
   */
  async dispatch(config: TaskDispatchConfig): Promise<string> {
    // AC-2.3: Validate prerequisites exist via getFileContent
    const inputContents = await this.readInputArtifacts(config.inputPaths);

    // Construct CLI arguments — CLI writes to the task's staging dir
    const cliArgs = this.buildCliArgs(config, inputContents);

    // Delegate to TaskManager
    return this.taskManager.dispatch(config, cliArgs);
  }

  /**
   * Read and validate input artifacts using Epic 13's getFileContent().
   *
   * Covers: AC-2.2 (input artifact context), AC-2.3 (prerequisite validation)
   */
  private async readInputArtifacts(
    paths: string[],
  ): Promise<Array<{ path: string; content: string; truncated: boolean }>> {
    const results: Array<{ path: string; content: string; truncated: boolean }> = [];

    for (const path of paths) {
      try {
        const result = await this.fileReader.getFileContent(path);
        results.push({ path, content: result.content, truncated: result.truncated });
      } catch (err) {
        throw Object.assign(
          new Error(`Prerequisite missing: ${path} not found`),
          { code: 'PREREQUISITE_MISSING', missingArtifact: path },
        );
      }
    }

    return results;
  }

  /**
   * Build CLI arguments for a pipeline phase invocation.
   *
   * The CLI's cwd is set to the task's staging directory by the TaskManager.
   * The CLI writes output files naturally to its cwd — no special instructions
   * needed for file writing. After completion, the ResultsIntegrator reads from
   * staging and moves files to the workspace via Epic 13's addFile()/editFile().
   */
  buildCliArgs(
    config: TaskDispatchConfig,
    inputs: Array<{ path: string; content: string; truncated: boolean }>,
  ): string[] {
    const systemPrompt = this.buildSystemPrompt(config.phase);
    const userMessage = this.buildUserMessage(config, inputs);

    return [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--bare',
      '--max-turns', '50',
      '--system-prompt', systemPrompt,
      userMessage,
    ];
  }

  /**
   * Build phase-specific system prompt.
   *
   * The CLI writes files to its working directory (the staging dir).
   * It must emit a structured output manifest listing every file it created.
   */
  private buildSystemPrompt(phase: string): string {
    const base = [
      `You are the Spec Steward executing a pipeline phase. Work autonomously to completion.`,
      `Do not ask the user for input.`,
      `Write all output files to the current directory.`,
      `IMPORTANT: When you are done, emit a final message listing every file you created,`,
      `formatted as a JSON code block with this exact structure:`,
      '```json',
      '{"outputFiles": ["file1.md", "subdir/file2.md"], "primaryFile": "file1.md"}',
      '```',
      `The paths must be relative to your working directory.`,
    ].join('\n');

    const phaseInstructions: Record<string, string> = {
      'epic': `${base}\n\nYou are drafting an epic using the Liminal Spec methodology. Use the /ls-epic skill approach: create a complete epic with User Profile, Flows & Requirements, Acceptance Criteria with Test Conditions, Data Contracts, Story Breakdown, and Validation Checklist.`,
      'tech-design': `${base}\n\nYou are creating a technical design using the Liminal Spec methodology. Use the /ls-tech-design skill approach: validate the epic, answer tech design questions, create architecture decisions, module breakdown, interface definitions, and test plan.`,
      'stories': `${base}\n\nYou are publishing stories from the epic and tech design. Use the /ls-publish-epic skill approach: create implementable stories with AC groupings, technical sections, and TC-to-test mappings.`,
      'implementation': `${base}\n\nYou are implementing stories from the published spec. Use the /ls-team-impl skill approach: implement story by story with TDD methodology.`,
    };

    return phaseInstructions[phase] ?? base;
  }

  /**
   * Build user message with input artifacts embedded.
   */
  private buildUserMessage(
    config: TaskDispatchConfig,
    inputs: Array<{ path: string; content: string; truncated: boolean }>,
  ): string {
    const artifactBlocks = inputs.map(
      ({ path, content, truncated }) =>
        `<input-artifact type="${this.inferArtifactType(path)}" path="${path}"${truncated ? ' truncated="true"' : ''}>\n${content}\n</input-artifact>`,
    ).join('\n\n');

    const instructions = config.instructions
      ? `\n\nAdditional instructions: ${config.instructions}`
      : '';

    return `<pipeline-task phase="${config.phase}" target="${config.target}">\n${artifactBlocks}\n\nExecute the ${PHASE_DISPLAY_NAMES[config.phase as PipelinePhase]} phase. Write all output files to the current directory.${instructions}\n</pipeline-task>`;
  }

  private inferArtifactType(path: string): string {
    const lower = path.toLowerCase();
    if (lower.includes('prd')) return 'prd';
    if (lower.includes('epic')) return 'epic';
    if (lower.includes('tech-design')) return 'tech-design';
    if (lower.includes('stories') || lower.includes('story')) return 'stories';
    return 'document';
  }
}
```

### Output Reporting: Explicit Manifest, Not Directory Scanning (C4 Fix)

The background CLI reports its output files explicitly. The system prompt instructs the CLI to emit a JSON code block at the end of its response listing every file it created:

```json
{"outputFiles": ["epic.md"], "primaryFile": "epic.md"}
```

The server parses this manifest from the CLI's result event text. This is precise — it reports exactly what the CLI created, not every file in a directory. Benefits:
- No false positives from pre-existing files (TC-3.7b rerun case)
- Works for implementation at project root (only reported files are task output)
- No directory snapshot/diff infrastructure needed

If the CLI doesn't emit the manifest (error, crash, format issue), the task still completes but with empty `outputPaths`. The failure mode is under-reporting, not over-reporting.

### File-Access Contract Alignment (C3 + R2 Fix)

Both read and write paths honor Epic 13's file-access contract:

**Reads:** The PipelineDispatcher reads input artifacts through an injected `FileReader` that wraps Epic 13's `getFileContent()`. No direct `fs.readFile` on workspace content.

**Writes:** The background CLI writes output files to its staging directory (its cwd, a temp dir outside the workspace). The server-side ResultsIntegrator then moves files from staging to the workspace via Epic 13's `addFile()`/`editFile()` service methods. The workspace is never written to directly by the CLI. The manifest is updated via `updateManifest()`. All workspace mutations flow through the curated service layer.

---

## ResultsIntegrator

The ResultsIntegrator handles successful task completion: parsing the output manifest, integrating files into the workspace via Epic 13's service methods, updating the manifest, and dispatching notifications.

### Interface

```typescript
// app/src/server/services/results-integrator.ts

import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface WorkspaceFileService {
  addFile(path: string, content: string): Promise<void>;
  editFile(path: string, content: string): Promise<void>;
  getPackageManifest(): Promise<PackageManifestInfo>;
  updateManifest(content: string): Promise<void>;
}

type FileCreatedHandler = (taskId: string, path: string) => void;
type PackageChangedHandler = (taskId: string) => void;

export class ResultsIntegrator {
  private fileCreatedHandlers = new Set<FileCreatedHandler>();
  private packageChangedHandlers = new Set<PackageChangedHandler>();

  constructor(
    private workspaceRoot: string,
    private fileService: WorkspaceFileService,  // Always provided — folder mode skips manifest ops but still writes files
    private isPackageMode: () => boolean,
  ) {}

  /**
   * Integrate results from a completed background task.
   *
   * 1. Parse output manifest from CLI result text
   * 2. Read files from staging, write to workspace via addFile/editFile
   * 3. Emit chat:file-created per file
   * 4. If package mode: update manifest, advance specPhase
   * 5. Emit chat:package-changed if manifest updated
   *
   * Returns the output paths and primary path for the task-status completed event.
   *
   * Covers: AC-3.1, AC-3.2, AC-3.7
   */
  async integrate(
    taskId: string,
    task: ManagedTask,
    cliResultText: string,
  ): Promise<{ outputPaths: string[]; primaryOutputPath: string }> {
    // C4 fix: Parse explicit output manifest from CLI result, not directory scan
    const manifest = this.parseOutputManifest(cliResultText);
    const outputPaths: string[] = [];
    let primaryOutputPath = '';

    // Read files from staging dir and write to workspace via Epic 13's service
    for (const filePath of manifest.outputFiles) {
      const stagingPath = join(task.stagingDir, filePath);
      const workspacePath = join(task.config.outputDir, filePath);

      try {
        const content = await readFile(stagingPath, 'utf-8');

        // Write to workspace via Epic 13's service — always, even in folder mode
        try {
          await this.fileService.addFile(workspacePath, content);
        } catch {
          // File may already exist (rerun) — use editFile
          await this.fileService.editFile(workspacePath, content);
        }

        const absolutePath = join(this.workspaceRoot, workspacePath);
        outputPaths.push(absolutePath);

        // AC-3.1b: Emit chat:file-created per output file
        for (const handler of this.fileCreatedHandlers) {
          handler(taskId, absolutePath);
        }
      } catch (err) {
        // File reported by CLI but not found in staging — skip
        continue;
      }
    }

    primaryOutputPath = manifest.primaryFile
      ? join(this.workspaceRoot, task.config.outputDir, manifest.primaryFile)
      : outputPaths[0] ?? '';

    // Store on task for later retrieval
    task.outputPaths = outputPaths;
    task.primaryOutputPath = primaryOutputPath;

    // AC-3.2: Update manifest in package mode only (TC-3.2c: no manifest in folder mode)
    if (this.isPackageMode()) {
      await this.updateManifestWithOutput(taskId, outputPaths, task.config.phase);
    }

    return { outputPaths, primaryOutputPath };
  }

  /**
   * Parse the output manifest from CLI result text.
   *
   * Looks for a JSON code block with {"outputFiles": [...], "primaryFile": "..."}
   */
  private parseOutputManifest(resultText: string): {
    outputFiles: string[];
    primaryFile: string | null;
  } {
    const jsonMatch = resultText.match(/```json\s*\n(\{[\s\S]*?"outputFiles"[\s\S]*?\})\s*\n```/);
    if (!jsonMatch) {
      return { outputFiles: [], primaryFile: null };
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        outputFiles: Array.isArray(parsed.outputFiles) ? parsed.outputFiles : [],
        primaryFile: typeof parsed.primaryFile === 'string' ? parsed.primaryFile : null,
      };
    } catch {
      return { outputFiles: [], primaryFile: null };
    }
  }

  /**
   * Update manifest with new navigation entries and advance phase metadata.
   *
   * Covers: AC-3.7a (multi-file grouping), AC-3.7b (rerun no duplicate),
   *         AC-3.7c (phase metadata advancement)
   */
  private async updateManifestWithOutput(
    taskId: string,
    outputPaths: string[],
    phase: string,
  ): Promise<void> {
    const manifest = await this.fileService!.getPackageManifest();
    let content = manifest.content;
    let modified = false;

    // Add navigation entries for new files (skip existing — TC-3.7b)
    const existingPaths = new Set(
      manifest.navigation.flatMap((n) => this.extractPaths(n)),
    );

    for (const filePath of outputPaths) {
      const relPath = relative(this.workspaceRoot, filePath);
      if (!existingPaths.has(relPath)) {
        const displayName = relPath.split('/').pop()?.replace('.md', '') ?? relPath;
        content = content.trimEnd() + `\n- [${displayName}](${relPath})\n`;
        modified = true;
      }
    }

    // AC-3.7c: Advance specPhase on successful completion
    content = this.advancePhaseMetadata(content, phase);
    modified = true;

    if (modified) {
      await this.fileService!.updateManifest(content);

      for (const handler of this.packageChangedHandlers) {
        handler(taskId);
      }
    }
  }

  /**
   * Advance specPhase and set specStatus to 'draft'.
   */
  private advancePhaseMetadata(content: string, phase: string): string {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    if (!match) return content;

    let frontmatter = match[1];

    if (frontmatter.includes('specPhase:')) {
      frontmatter = frontmatter.replace(/specPhase:\s*.*/, `specPhase: ${phase}`);
    } else {
      frontmatter += `\nspecPhase: ${phase}`;
    }

    if (frontmatter.includes('specStatus:')) {
      frontmatter = frontmatter.replace(/specStatus:\s*.*/, `specStatus: draft`);
    } else {
      frontmatter += `\nspecStatus: draft`;
    }

    return content.replace(frontmatterRegex, `---\n${frontmatter}\n---`);
  }

  private extractPaths(node: NavigationNode): string[] {
    const paths: string[] = [];
    if (node.path) paths.push(node.path);
    if (node.children) {
      for (const child of node.children) paths.push(...this.extractPaths(child));
    }
    return paths;
  }

  // --- Event subscription ---

  onFileCreated(handler: FileCreatedHandler): () => void {
    this.fileCreatedHandlers.add(handler);
    return () => this.fileCreatedHandlers.delete(handler);
  }

  onPackageChanged(handler: PackageChangedHandler): () => void {
    this.packageChangedHandlers.add(handler);
    return () => this.packageChangedHandlers.delete(handler);
  }
}
```

---

## Approval and specStatus Lifecycle (M6 Fix)

The epic defines three `specStatus` transitions that require server-side handlers:

| Transition | Trigger | Handler | AC |
|-----------|---------|---------|-----|
| `→ draft` | Task completes successfully | `ResultsIntegrator.advancePhaseMetadata()` | AC-3.7c |
| `draft → approved` | Developer approves, Steward proceeds | `ApprovalHandler.approvePhase()` | AC-3.7e |
| `→ draft` (reset) | Re-dispatch with feedback | `ApprovalHandler.resetForRedispatch()` | AC-3.7f |

```typescript
// app/src/server/services/approval-handler.ts

export class ApprovalHandler {
  constructor(
    private fileService: WorkspaceFileService,
    private isPackageMode: () => boolean,
  ) {}

  /**
   * Set specStatus to 'approved' before dispatching the follow-on phase.
   * Called when the Steward determines the developer approved the output.
   *
   * Covers: AC-3.7e
   */
  async approvePhase(): Promise<void> {
    if (!this.isPackageMode()) return;
    const manifest = await this.fileService.getPackageManifest();
    const updated = this.setSpecStatus(manifest.content, 'approved');
    await this.fileService.updateManifest(updated);
  }

  /**
   * Reset specStatus to 'draft' when re-dispatching a phase with feedback.
   *
   * Covers: AC-3.7f
   */
  async resetForRedispatch(): Promise<void> {
    if (!this.isPackageMode()) return;
    const manifest = await this.fileService.getPackageManifest();
    const updated = this.setSpecStatus(manifest.content, 'draft');
    await this.fileService.updateManifest(updated);
  }

  private setSpecStatus(content: string, status: string): string {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    if (!match) return content;

    let frontmatter = match[1];
    if (frontmatter.includes('specStatus:')) {
      frontmatter = frontmatter.replace(/specStatus:\s*.*/, `specStatus: ${status}`);
    } else {
      frontmatter += `\nspecStatus: ${status}`;
    }
    return content.replace(frontmatterRegex, `---\n${frontmatter}\n---`);
  }
}
```

The approval handler methods are called from the script execution context. The Steward (via the foreground CLI) determines when the developer approves output or requests re-dispatch. It then emits `<steward-script>` blocks calling these methods before dispatching the follow-on phase or re-dispatching the current one.

Added to the script context:

```typescript
// In createScriptContext():
approveCurrentPhase: async (): Promise<void> => {
  await approvalHandler.approvePhase();
},
resetPhaseForRedispatch: async (): Promise<void> => {
  await approvalHandler.resetForRedispatch();
},
```

---

## AutonomousSequencer

The AutonomousSequencer manages multi-phase autonomous runs. It subscribes to the TaskManager's event bus (which now emits `completed` events) to detect phase progression.

```typescript
// app/src/server/services/autonomous-sequencer.ts

import { randomUUID } from 'node:crypto';

export interface AutonomousRun {
  runId: string;
  workspaceIdentity: string;     // Scoped to workspace (R2 M5 fix)
  phases: PipelinePhase[];
  skippedPhases: PipelinePhase[];
  currentPhaseIndex: number;
  completedPhases: string[];
  failedPhase: string | null;
  cancelled: boolean;
  currentTaskId: string | null;
  status: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
}

type RunEventHandler = (run: ChatAutonomousRunMessage) => void;

export class AutonomousSequencer {
  private activeRun: AutonomousRun | null = null;
  private runEventHandlers = new Set<RunEventHandler>();

  constructor(
    private dispatcher: PipelineDispatcher,
    private taskManager: TaskManager,
  ) {}

  async start(
    existingArtifacts: string[],
    baseConfig: Omit<TaskDispatchConfig, 'phase' | 'autonomousRunId'>,
    resolveInputPaths: (phase: PipelinePhase) => string[],
    resolveOutputDir: (phase: PipelinePhase) => string,
  ): Promise<string> {
    if (this.activeRun) {
      throw new Error('An autonomous run is already active');
    }

    const runId = randomUUID();
    const phases: PipelinePhase[] = [];
    const skippedPhases: PipelinePhase[] = [];

    for (const phase of AUTONOMOUS_SEQUENCE) {
      if (existingArtifacts.includes(phase)) {
        skippedPhases.push(phase);
      } else {
        phases.push(phase);
      }
    }

    this.activeRun = {
      runId, workspaceIdentity: baseConfig.workspaceIdentity,
      phases, skippedPhases,
      currentPhaseIndex: 0, completedPhases: [],
      failedPhase: null, cancelled: false,
      currentTaskId: null, status: 'started',
    };

    this.emitRunEvent({
      type: 'chat:autonomous-run', runId,
      workspaceIdentity: baseConfig.workspaceIdentity,
      status: 'started',
      phases,
      ...(skippedPhases.length > 0 ? { skippedPhases } : {}),
      currentPhaseIndex: 0,
    });

    // Begin sequential execution in background
    this.executeSequence(baseConfig, resolveInputPaths, resolveOutputDir);

    return runId;
  }

  private async executeSequence(
    baseConfig: Omit<TaskDispatchConfig, 'phase' | 'autonomousRunId'>,
    resolveInputPaths: (phase: PipelinePhase) => string[],
    resolveOutputDir: (phase: PipelinePhase) => string,
  ): Promise<void> {
    const run = this.activeRun!;

    for (let i = 0; i < run.phases.length; i++) {
      if (run.cancelled) {
        run.status = 'cancelled';
        this.emitRunEvent({
          type: 'chat:autonomous-run', runId: run.runId,
          workspaceIdentity: run.workspaceIdentity,
          status: 'cancelled',
          phases: run.phases, completedPhases: run.completedPhases,
        });
        this.activeRun = null;
        return;
      }

      const phase = run.phases[i];
      run.currentPhaseIndex = i;
      run.status = 'running';

      try {
        const taskId = await this.dispatcher.dispatch({
          ...baseConfig, phase,
          inputPaths: resolveInputPaths(phase),
          outputDir: resolveOutputDir(phase),
          autonomousRunId: run.runId,
          description: `${PHASE_DISPLAY_NAMES[phase]} (autonomous)`,
          immediate: true,               // R3: emit started immediately (no foreground agent response)
          sequenceInfo: {                // R2: populate sequenceInfo for TC-4.3a
            current: i + 1,
            total: run.phases.length,
            phaseName: PHASE_DISPLAY_NAMES[phase],
          },
        });

        run.currentTaskId = taskId;

        // Wait for task completion — works because TaskManager emits completed (C2 fix)
        const result = await this.waitForTaskCompletion(taskId);

        if (result === 'completed') {
          run.completedPhases.push(phase);
          run.currentTaskId = null;
        } else {
          run.failedPhase = phase;
          run.status = 'failed';
          run.currentTaskId = null;

          this.emitRunEvent({
            type: 'chat:autonomous-run', runId: run.runId,
            workspaceIdentity: run.workspaceIdentity,
            status: 'failed',
            phases: run.phases, completedPhases: run.completedPhases,
            failedPhase: phase, error: `Phase ${phase} ${result}`,
          });
          this.activeRun = null;
          return;
        }
      } catch (err) {
        run.failedPhase = phase;
        run.status = 'failed';
        run.currentTaskId = null;

        this.emitRunEvent({
          type: 'chat:autonomous-run', runId: run.runId,
          workspaceIdentity: run.workspaceIdentity,
          status: 'failed',
          phases: run.phases, completedPhases: run.completedPhases,
          failedPhase: phase, error: (err as Error).message,
        });
        this.activeRun = null;
        return;
      }
    }

    run.status = 'completed';
    this.emitRunEvent({
      type: 'chat:autonomous-run', runId: run.runId,
      workspaceIdentity: run.workspaceIdentity,
      status: 'completed',
      phases: run.phases, completedPhases: run.completedPhases,
    });
    this.activeRun = null;
  }

  private waitForTaskCompletion(taskId: string): Promise<'completed' | 'failed' | 'cancelled'> {
    return new Promise((resolve) => {
      const unsub = this.taskManager.onEvent((id, status) => {
        if (id !== taskId) return;
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          unsub();
          resolve(status.status);
        }
      });
    });
  }

  cancelRun(runId: string): void {
    if (!this.activeRun || this.activeRun.runId !== runId) return;
    this.activeRun.cancelled = true;
    if (this.activeRun.currentTaskId) {
      this.taskManager.cancel(this.activeRun.currentTaskId);
    }
  }

  getActiveRunSnapshot(workspaceIdentity: string): AutonomousRunSnapshot | null {
    if (!this.activeRun) return null;
    if (this.activeRun.workspaceIdentity !== workspaceIdentity) return null;
    if (this.activeRun.status !== 'started' && this.activeRun.status !== 'running') return null;
    return {
      runId: this.activeRun.runId,
      status: this.activeRun.status,
      phases: this.activeRun.phases,
      currentPhaseIndex: this.activeRun.currentPhaseIndex,
      completedPhases: this.activeRun.completedPhases,
    };
  }

  onRunEvent(handler: RunEventHandler): () => void {
    this.runEventHandlers.add(handler);
    return () => this.runEventHandlers.delete(handler);
  }

  private emitRunEvent(event: ChatAutonomousRunMessage): void {
    for (const handler of this.runEventHandlers) handler(event);
  }
}
```

---

## Script Context Extensions

The ScriptExecutor gains task management methods and approval methods. Dispatch errors carry specific error codes via an extended `ScriptResult`.

```typescript
// Extended ScriptResult (Epic 10 base)
export interface ScriptResult {
  success: boolean;
  value?: unknown;
  error?: string;
  errorCode?: string;  // Specific error code from the method (M7 fix)
}

// In createScriptContext():
{
  // ... existing methods from Epics 10, 12, 13 ...

  // Epic 14 — task management:
  dispatchTask: async (config: TaskDispatchConfig): Promise<string> => {
    const taskId = await pipelineDispatcher.dispatch(config);
    pendingTaskIds.add(taskId);  // R2 M7 fix: track for deferred start flush
    return taskId;
  },

  getRunningTasks: async (): Promise<TaskInfo[]> => {
    return taskManager.getAllTasks(currentWorkspaceIdentity);
  },

  cancelTask: async (taskId: string): Promise<void> => {
    taskManager.cancel(taskId);
  },

  // Epic 14 — approval:
  approveCurrentPhase: async (): Promise<void> => {
    await approvalHandler.approvePhase();
  },

  resetPhaseForRedispatch: async (): Promise<void> => {
    await approvalHandler.resetForRedispatch();
  },
}
```

**Error code propagation (M7 fix):** When `dispatchTask()` throws with a `code` property (e.g., `PREREQUISITE_MISSING`), the ScriptExecutor catches it and sets `errorCode` on the `ScriptResult`. The ProviderManager's `executeScript()` method checks for `errorCode` and uses it as the `chat:error` code instead of generic `SCRIPT_ERROR`:

```typescript
// In ProviderManager.executeScript():
if (!result.success) {
  const code = result.errorCode ?? (result.error?.includes('timed out') ? 'SCRIPT_TIMEOUT' : 'SCRIPT_ERROR');
  this.emitError(messageId, code, result.error ?? 'Script execution failed');
}
```

This bridges the dispatch error to the WebSocket as a `chat:error` with the correct code (AC-2.3, AC-5.4).

---

## Provider Manager Extensions

The ProviderManager gains workspace-scoped `lastCompletedTask` tracking.

```typescript
// Added to provider-manager.ts

private lastCompletedTask: Map<string, {
  taskId: string;
  phase: string;
  primaryOutputPath: string;
}> = new Map();  // Keyed by workspaceIdentity

/**
 * Set the most recently completed task for a workspace.
 * Called when TaskManager reports completion.
 */
setLastCompletedTask(
  workspaceIdentity: string,
  task: { taskId: string; phase: string; primaryOutputPath: string },
): void {
  this.lastCompletedTask.set(workspaceIdentity, task);
}

/**
 * Get the most recently completed task for the current workspace.
 * Covers: AC-3.4a (feedback with task binding)
 */
getLastCompletedTask(workspaceIdentity: string): {
  taskId: string; phase: string; primaryOutputPath: string;
} | null {
  return this.lastCompletedTask.get(workspaceIdentity) ?? null;
}

// In clear():
clear(): void {
  // ... existing clear logic ...
  // lastCompletedTask is NOT cleared on chat:clear — it persists for the workspace
  // It is cleared when tasks are from a different workspace context
}
```

The context injection service includes `lastCompletedTask` when present:

```typescript
// In context-injection.ts buildProviderContext():
const lastCompleted = providerManager.getLastCompletedTask(workspaceIdentity);
const context: ProviderContext = {
  // ... existing fields ...
  ...(lastCompleted ? { lastCompletedTask: lastCompleted } : {}),
};
```

---

## WebSocket Route Extensions

The `/ws/chat` route subscribes to the TaskManager's event bus for ALL events. No ad-hoc event emission. Error transport and pre-start ordering are handled explicitly.

```typescript
// Extensions to routes/ws-chat.ts

// Create services (conditional on feature flag)
const taskManager = new TaskManager();
const pipelineDispatcher = new PipelineDispatcher(taskManager, fileReader, workspaceRoot);
const autonomousSequencer = new AutonomousSequencer(pipelineDispatcher, taskManager);
const resultsIntegrator = new ResultsIntegrator(workspaceRoot, fileService, isPackageMode);
const approvalHandler = new ApprovalHandler(fileService, isPackageMode);

// Shutdown hook
app.addHook('onClose', async () => {
  await taskManager.shutdown();
});

// Track deferred task IDs for pre-start ordering (M7 fix)
// Populated by script context's dispatchTask(), flushed after chat:done
const pendingTaskIds = new Set<string>();

// Track the socket's current workspace identity for live event filtering
let currentSocketWorkspace = resolveWorkspaceIdentity(session);

// Subscribe to TaskManager event bus — single subscription for ALL events (C2 fix)
// All live events are workspace-filtered (R4 Major 1 fix)
const unsubTaskEvent = taskManager.onEvent(async (taskId, status) => {
  // Filter: only relay events for tasks belonging to the current socket's workspace
  const task = taskManager.getTask(taskId);
  if (task && task.config.workspaceIdentity !== currentSocketWorkspace) return;
  if (status.status === 'completed') {
    // Run results integration BEFORE relaying the completed event
    const task = taskManager.getTask(taskId);
    if (task) {
      const { outputPaths, primaryOutputPath } = await resultsIntegrator.integrate(
        taskId, task, task.resultText,  // R3 Critical fix: accumulated CLI stdout
      );

      // Update lastCompletedTask (M5 fix: workspace-scoped)
      providerManager.setLastCompletedTask(task.config.workspaceIdentity, {
        taskId, phase: task.config.phase, primaryOutputPath,
      });

      // Enrich the completed event with output paths
      const enrichedStatus = {
        ...status,
        outputPaths,
        primaryOutputPath,
      };
      sendMessage(socket, enrichedStatus);
    }
  } else if (status.status === 'started') {
    // Started events from immediate tasks (autonomous) are relayed directly.
    // Deferred tasks (script-dispatched) have deferredStartedEvent=null here
    // because they were already emitted via this bus by flushDeferredStarted().
    // Both paths converge here — relay all started events that reach the bus.
    sendMessage(socket, status);
  } else {
    // running, failed, cancelled — relay directly
    sendMessage(socket, status);
  }
});

// Wire ResultsIntegrator notifications — workspace-filtered (R4 Major 1 fix)
resultsIntegrator.onFileCreated((taskId, path) => {
  const task = taskManager.getTask(taskId);
  if (task && task.config.workspaceIdentity !== currentSocketWorkspace) return;
  sendMessage(socket, { type: 'chat:file-created', path, messageId: taskId });
});

resultsIntegrator.onPackageChanged((taskId) => {
  const task = taskManager.getTask(taskId);
  if (task && task.config.workspaceIdentity !== currentSocketWorkspace) return;
  sendMessage(socket, { type: 'chat:package-changed', messageId: taskId, change: 'manifest-updated' });
});

// Wire AutonomousSequencer events — workspace-filtered via event's own identity (R5 fix)
autonomousSequencer.onRunEvent((event) => {
  if (event.workspaceIdentity !== currentSocketWorkspace) return;
  sendMessage(socket, event);
});

// Pre-start ordering: flush deferred started events after foreground chat:done
// The existing onDone handler in ws-chat.ts is extended:
providerManager.onDone((messageId, cancelled) => {
  sendMessage(socket, { type: 'chat:done', messageId, ...(cancelled ? { cancelled: true } : {}) });

  // Flush any tasks dispatched during this foreground message (AC-2.4)
  for (const taskId of pendingTaskIds) {
    taskManager.flushDeferredStarted(taskId);
  }
  pendingTaskIds.clear();
});

// Handle new client message types:
case 'chat:task-cancel':
  try {
    taskManager.cancel(msg.taskId);
  } catch (err) {
    sendMessage(socket, {
      type: 'chat:error',
      code: (err as any).code ?? 'TASK_NOT_FOUND',
      message: (err as Error).message,
    });
  }
  break;

case 'chat:autonomous-cancel':
  autonomousSequencer.cancelRun(msg.runId);
  break;

// Send task snapshot on connect (after conversation-load, AC-1.6a):
const wsIdentity = resolveWorkspaceIdentity(session);
sendTaskSnapshot(socket, wsIdentity);

// Send task snapshot on workspace switch (AC-1.6c — R3 Major 4 fix):
// The existing workspace:change handler (from Epic 1/10) is extended:
// When the workspace changes, send a new snapshot for the new workspace.
case 'workspace:change':
  const newIdentity = resolveWorkspaceIdentity(session);
  currentSocketWorkspace = newIdentity;  // Update filter target for live events
  sendTaskSnapshot(socket, newIdentity);
  break;

// Helper: build and send task snapshot
function sendTaskSnapshot(socket: WebSocket, identity: string): void {
  const snapshot: ChatTaskSnapshotMessage = {
    type: 'chat:task-snapshot',
    tasks: taskManager.getAllTasks(identity),
    ...(autonomousSequencer.getActiveRunSnapshot(identity)
      ? { autonomousRun: autonomousSequencer.getActiveRunSnapshot(identity)! }
      : {}),
  };
  sendMessage(socket, snapshot);
}
```

### Message Delivery Ordering

On WebSocket connect:
1. `chat:conversation-load` (Epic 12)
2. `chat:task-snapshot` (Epic 14)
3. Normal message flow

On workspace switch:
1. `chat:conversation-load` for new workspace (Epic 12)
2. `chat:task-snapshot` for new workspace (Epic 14, AC-1.6c)

On task completion (package mode):
1. `chat:file-created` — one per output file (viewer refresh)
2. `chat:package-changed` — if manifest updated (sidebar refresh)
3. `chat:task-status completed` — terminal (after results integration enriches it)

On foreground dispatch:
1. `chat:token` messages (agent explains what it will do)
2. `chat:done` (foreground response completes)
3. `chat:task-status started` (flushed from deferred)

---

## Error Handling Summary

| Error Condition | Detection | Error Code | Transport | Server State After |
|----------------|-----------|------------|-----------|-------------------|
| Concurrency limit | `activeTaskCount >= MAX` | `TASK_LIMIT_REACHED` | `chat:error` via script errorCode | Unchanged |
| Duplicate task (phase + target) | Map scan | `TASK_ALREADY_RUNNING` | `chat:error` via script errorCode | Unchanged |
| CLI spawn failure | `spawn()` error | `TASK_DISPATCH_FAILED` | `chat:error` via script errorCode | Task not added |
| Prerequisite missing | `getFileContent()` throws | `PREREQUISITE_MISSING` | `chat:error` via script errorCode | Task not dispatched |
| Task not found (cancel) | Map lookup | `TASK_NOT_FOUND` | `chat:error` direct | Unchanged |
| Cancel terminal task | Status check | `TASK_NOT_FOUND` | `chat:error` direct | Unchanged |
| Background CLI crash | Non-zero exit | — | `chat:task-status failed` | Task marked failed |
| AbortController cancel | `abort()` called | — | `chat:task-status cancelled` | Task marked cancelled |
| Server shutdown | `onClose` hook | — | — | All tasks terminated, awaited |
