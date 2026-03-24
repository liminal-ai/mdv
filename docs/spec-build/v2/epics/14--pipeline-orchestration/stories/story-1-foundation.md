# Story 1: Foundation (Infrastructure)

---

### Summary
<!-- Jira: Summary field -->

Establish shared types, Zod schemas, pipeline phase constants, error codes, and test fixtures for Epic 14's pipeline orchestration capabilities.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working in a spec package with existing artifacts (a PRD, possibly partial epics or designs), ready to execute pipeline operations through the Steward rather than manually invoking Liminal Spec skills in separate terminal sessions.

**Objective:** Define the type-level contracts, pipeline phase constants, and test infrastructure that all subsequent stories build on. After this story, the extended schemas compile, new message types validate, phase constants are available, and test fixtures cover all downstream testing needs.

**Scope:**

In scope:
- `ChatTaskStatusMessageSchema` (Zod) with `taskId`, `status`, `phase`, `target`, `description`, optional `outputDir`, `elapsedMs`, `outputPaths`, `primaryOutputPath`, `error`, `autonomousRunId`, `sequenceInfo`
- `ChatTaskCancelMessageSchema` (Zod) with `taskId` (UUID)
- `ChatTaskSnapshotMessageSchema` (Zod) with `tasks` array and optional `autonomousRun`
- `ChatAutonomousRunMessageSchema` (Zod) with `runId`, `workspaceIdentity`, `status`, `phases`, optional `skippedPhases`, `currentPhaseIndex`, `completedPhases`, `failedPhase`, `error`
- `ChatAutonomousCancelMessageSchema` (Zod) with `runId` (UUID)
- `TaskInfoSchema` (Zod) with `taskId`, `phase`, `target`, `description`, `status`, `startedAt`, `elapsedMs`, `workspaceIdentity`, optional `outputDir`, `outputPaths`, `primaryOutputPath`, `autonomousRunId`
- `TaskSequenceInfoSchema` (Zod) with `current`, `total`, `phaseName`
- `AutonomousRunSnapshotSchema` (Zod) with `runId`, `status` (started/running), `phases`, `currentPhaseIndex`, `completedPhases`
- Extended `ChatClientMessageSchema` discriminated union with `chat:task-cancel` and `chat:autonomous-cancel`
- Extended `ChatServerMessageSchema` discriminated union with `chat:task-status`, `chat:task-snapshot`, `chat:autonomous-run`
- New error codes: `TASK_NOT_FOUND`, `TASK_LIMIT_REACHED`, `TASK_ALREADY_RUNNING`, `TASK_DISPATCH_FAILED`, `PREREQUISITE_MISSING`
- `TaskDispatchConfig` interface with `phase`, `target`, `description`, `inputPaths`, `outputDir`, `workspaceIdentity`, optional `instructions`, `autonomousRunId`, `immediate`, `sequenceInfo`
- `ManagedTask` interface with full lifecycle state
- `TaskInfo` inferred type from schema
- Pipeline phase constants: `PIPELINE_PHASES`, `PipelinePhase` type, `AUTONOMOUS_SEQUENCE`, `PHASE_PREREQUISITES`, `PHASE_INPUT_ARTIFACTS`, `PHASE_DISPLAY_NAMES`
- Extended `ScriptContext` interface with `dispatchTask`, `getRunningTasks`, `cancelTask`
- Test fixtures: `createTaskConfig`, `createTechDesignConfig`, `createTaskStatusMessage`, `createCompletedTaskStatus`, `createFailedTaskStatus`, `createTaskSnapshot`, `createTaskInfo`, `createAutonomousRunStarted`, `createAutonomousRunCompleted`, `MockChildProcess` (extended from Epic 10), input artifact samples, manifest fixtures

Out of scope:
- Service implementations (Stories 2–5)
- Route modifications (Stories 2–5)
- Client-side changes (Stories 2–5)

**Dependencies:**
- Epics 10, 11, 12, and 13 complete (existing `ChatServerMessageSchema`, `ChatClientMessageSchema`, `ChatErrorCodeSchema`, `ScriptContext`)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

Story 1 does not own ACs directly — it establishes infrastructure supporting all 26 ACs. The deliverables are validated through schema compilation, type checking, and fixture sanity tests.

**Deliverables:**

1. All five new Zod message schemas validate correctly against well-formed and malformed inputs
2. `TaskInfoSchema` validates task state objects with all required and optional fields
3. `TaskSequenceInfoSchema` and `AutonomousRunSnapshotSchema` validate nested structures
4. Extended `ChatClientMessageSchema` discriminated union includes `chat:task-cancel` and `chat:autonomous-cancel`
5. Extended `ChatServerMessageSchema` discriminated union includes `chat:task-status`, `chat:task-snapshot`, `chat:autonomous-run`
6. Extended `ChatErrorCodeSchema` includes all five new error codes
7. `PIPELINE_PHASES` contains `['epic', 'tech-design', 'stories', 'implementation']`
8. `AUTONOMOUS_SEQUENCE` contains `['epic', 'tech-design', 'stories']`
9. `PHASE_PREREQUISITES` maps each phase to its required predecessor phases
10. `PHASE_INPUT_ARTIFACTS` maps each phase to its input artifact types
11. `TaskDispatchConfig` includes `target` and `workspaceIdentity` fields for duplicate detection and workspace scoping
12. `ManagedTask` includes `stagingDir`, `deferredStartedEvent`, `activeCountDecremented`, `resultText`, `immediate` fields
13. All test fixtures produce valid schema-conforming objects
14. `MockChildProcess` extends EventEmitter with `emitStdout`, `emitStdoutRaw`, `endStdout`, `emitExit`, `emitError` helpers

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### Client → Server Message Schemas

```typescript
export const ChatTaskCancelMessageSchema = z.object({
  type: z.literal('chat:task-cancel'),
  taskId: z.string().uuid(),
});

export const ChatAutonomousCancelMessageSchema = z.object({
  type: z.literal('chat:autonomous-cancel'),
  runId: z.string().uuid(),
});
```

#### Server → Client Message Schemas

```typescript
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
  target: z.string(),
  description: z.string(),
  outputDir: z.string().optional(),
  elapsedMs: z.number().optional(),
  outputPaths: z.array(z.string()).optional(),
  primaryOutputPath: z.string().optional(),
  error: z.string().optional(),
  autonomousRunId: z.string().uuid().optional(),
  sequenceInfo: TaskSequenceInfoSchema.optional(),
});

export const TaskInfoSchema = z.object({
  taskId: z.string().uuid(),
  phase: z.string(),
  target: z.string(),
  description: z.string(),
  status: z.enum(['started', 'running', 'completed', 'failed', 'cancelled']),
  startedAt: z.string().datetime(),
  elapsedMs: z.number(),
  outputDir: z.string().optional(),
  outputPaths: z.array(z.string()).optional(),
  primaryOutputPath: z.string().optional(),
  autonomousRunId: z.string().uuid().optional(),
  workspaceIdentity: z.string(),
});

export const AutonomousRunSnapshotSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(['started', 'running']),
  phases: z.array(z.string()),
  currentPhaseIndex: z.number().int().min(0),
  completedPhases: z.array(z.string()),
});

export const ChatTaskSnapshotMessageSchema = z.object({
  type: z.literal('chat:task-snapshot'),
  tasks: z.array(TaskInfoSchema),
  autonomousRun: AutonomousRunSnapshotSchema.optional(),
});

export const ChatAutonomousRunMessageSchema = z.object({
  type: z.literal('chat:autonomous-run'),
  runId: z.string().uuid(),
  workspaceIdentity: z.string(),
  status: z.enum(['started', 'running', 'completed', 'failed', 'cancelled']),
  phases: z.array(z.string()),
  skippedPhases: z.array(z.string()).optional(),
  currentPhaseIndex: z.number().int().min(0).optional(),
  completedPhases: z.array(z.string()).optional(),
  failedPhase: z.string().optional(),
  error: z.string().optional(),
});
```

#### New Error Codes

```typescript
export const ChatErrorCodeSchema = z.enum([
  // Epics 10–13 codes unchanged...
  // Epic 14:
  'TASK_NOT_FOUND', 'TASK_LIMIT_REACHED', 'TASK_ALREADY_RUNNING',
  'TASK_DISPATCH_FAILED', 'PREREQUISITE_MISSING',
]);
```

#### Pipeline Phase Constants

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

#### TaskDispatchConfig and ManagedTask

```typescript
export interface TaskDispatchConfig {
  phase: PipelinePhase;
  target: string;
  description: string;
  inputPaths: string[];
  outputDir: string;
  workspaceIdentity: string;
  instructions?: string;
  autonomousRunId?: string;
  immediate?: boolean;
  sequenceInfo?: { current: number; total: number; phaseName: string };
}

export interface ManagedTask {
  taskId: string;
  config: TaskDispatchConfig;
  status: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
  process: ChildProcess | null;
  abortController: AbortController;
  startedAt: Date;
  completedAt: Date | null;
  heartbeatTimer: NodeJS.Timeout | null;
  outputPaths: string[];
  primaryOutputPath: string | null;
  error: string | null;
  stagingDir: string;
  deferredStartedEvent: ChatTaskStatusMessage | null;
  activeCountDecremented: boolean;
  resultText: string;
  immediate: boolean;
}
```

*See the tech design documents (`tech-design.md`, `tech-design-server.md`) for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All new Zod schemas added to `schemas/index.ts` and compile without errors
- [ ] `ChatClientMessageSchema` and `ChatServerMessageSchema` unions extended
- [ ] `ChatErrorCodeSchema` includes all five new error codes
- [ ] Pipeline phase constants defined and exported
- [ ] `TaskDispatchConfig`, `ManagedTask`, and `TaskInfo` types defined
- [ ] Extended `ScriptContext` interface compiles (methods declared, not implemented)
- [ ] All test fixtures in `tests/fixtures/tasks.ts`
- [ ] `MockChildProcess` extends EventEmitter with background task helpers
- [ ] `npm run red-verify` passes (format, lint, typecheck)
- [ ] 10 tests pass: 5 schema validation, 2 phase constant, 3 fixture sanity
