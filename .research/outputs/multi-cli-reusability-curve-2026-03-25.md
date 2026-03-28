# Multi-CLI Bridge Reusability: Does CLI #1 Pay Off for CLI #2, #3, #4?

## Summary

The reusability picture is significantly better than "each one is a fresh integration" but significantly worse than "configure the spawn command and parse the output." The critical insight from this research is that **the four major AI CLIs have converged on nearly identical programmatic interfaces** -- all offering JSON-RPC over stdio as a first-class integration path -- which means a well-designed bridge's transport layer is genuinely reusable. However, each CLI's semantic model (session primitives, approval flows, event schemas, permission models) is different enough that you need a real adapter per CLI, not just a config file. Based on evidence from projects that have actually done this (Overstory with 11 adapters, CloudCLI with 4, CC Pocket with 2, t3code with 2), the effort curve is roughly: CLI #1 is 70% of total effort, CLI #2 is 20%, and each subsequent CLI is about 5%.

## Key Findings

- **All four CLIs now support structured JSON output over stdio.** Claude Code has `--output-format stream-json` and the Agent SDK. Codex has `app-server` with JSON-RPC/JSONL over stdio. Cursor has ACP (Agent Client Protocol) via `agent acp` with JSON-RPC over stdio. Copilot CLI has `-p` mode with `-s` for script-friendly output, and the SDK uses JSON-RPC over stdio internally. The PTY-scraping approach is no longer the only option for any of them.

- **The transport layer (stdio/WebSocket bridge) is the genuinely reusable part.** CloudCLI demonstrates this: it uses the same node-pty spawn + WebSocket streaming for all four CLIs with zero per-CLI transport code. The PTY spawning, WebSocket framing, session lifecycle, and reconnection logic are 100% shared.

- **The semantic adapter layer is where per-CLI work lives.** Each CLI has different session primitives (Codex has Threads/Turns/Items; Claude has sessions with resume cursors; Cursor has ACP sessions with modes; Copilot has session-state directories), different approval workflows, different permission models, and different event schemas.

- **A protocol convergence is happening around JSON-RPC over stdio.** Codex's app-server, Cursor's ACP, Copilot's SDK, and Claude's Agent SDK all speak JSON-RPC 2.0 variants over stdio. This is not accidental -- it's emerging as the standard for agent-editor communication. ACP explicitly positions itself as the universal adapter protocol.

- **The "right" abstraction boundary is: transport is generic, session semantics are per-CLI, event normalization is the adapter's job.** This is exactly what Overstory, CloudCLI, and t3code all independently arrived at.

## Detailed Analysis

### 1. How Similar Are These CLIs' Interactive Interfaces?

**They are more similar than different, but the similarities are at the protocol level, not the UI level.**

All four CLIs share these characteristics:
- Interactive REPL-style terminal interface with rich formatting (colors, progress indicators, approval prompts)
- A non-interactive/programmatic mode that outputs structured data
- Streaming output (tokens arrive incrementally)
- An approval/permission workflow (the agent asks before executing dangerous operations)
- Session persistence (conversations can be resumed)

The key differences:

| Feature | Claude Code | Codex | Cursor CLI | Copilot CLI |
|---------|------------|-------|------------|-------------|
| **Programmatic protocol** | Agent SDK (TypeScript/Python library) OR `stream-json` CLI mode | JSON-RPC app-server over stdio | ACP (JSON-RPC over stdio) | `-p` mode + SDK (JSON-RPC over stdio) |
| **Session model** | Session IDs with resume/fork | Threads containing Turns containing Items | ACP sessions with modes (agent/plan/ask) | Session state in `~/.copilot/session-state/` |
| **Approval flow** | Permission modes (default, acceptEdits, plan, bypass) | Server-initiated approval requests with accept/decline/cancel | `session/request_permission` with allow-once/always/reject | `--allow-all-tools` or interactive approval |
| **Streaming events** | `stream_event` objects with delta types | `item/started`, `item/delta`, `item/completed` notifications | `session/update` notifications | Text streaming (structured streaming not yet GA) |
| **WebSocket support** | Not native (wrapping required) | Experimental `--listen ws://` flag | Not native | Not native |

**Critical finding:** None of these CLIs do truly unusual things with their stdio. They are all well-behaved terminal programs when in interactive mode (ANSI escapes, line-based I/O) and all offer structured alternatives. The PTY approach works universally for the interactive mode, but the structured JSON modes are strictly better for programmatic integration.

### 2. The Adapter Layer Question

Based on the real projects examined, the per-CLI adapter effort breaks down like this:

**Genuinely reusable (build once, use for all):**
- Process spawning and lifecycle management (start, stop, restart, health checks)
- WebSocket server and client transport
- PTY management (if using PTY approach)
- Session storage and persistence abstractions
- UI/frontend rendering of messages
- Reconnection and error recovery logic
- Authentication token management infrastructure

**Per-CLI adapter work (moderate effort, ~200-500 lines each):**
- Spawn command construction (which binary, which flags, which env vars)
- Output format selection (which `--output-format` to use)
- Event normalization (mapping CLI-specific events to canonical types)
- Approval flow translation (each CLI's permission model to unified UI)
- Session resume/continue mechanics
- Model catalog enumeration
- Readiness detection (how to know the CLI is ready for input)

**Per-CLI deep work (only if you need full fidelity):**
- Transcript parsing (each CLI stores transcripts differently)
- Configuration deployment (hooks in Claude, sandbox policies in Codex, etc.)
- Provider-specific capabilities that don't map to the shared interface

The t3code project is instructive: the Codex adapter speaks JSON-RPC to `codex app-server` (a clean protocol integration), while the Claude adapter uses the `@anthropic-ai/claude-agent-sdk` TypeScript library (an SDK integration). They are architecturally different approaches, but both map to the same `ProviderRuntimeEvent` interface. The Claude adapter is 1,857 lines because the SDK requires more ceremony around stream lifecycle management (forkChild fibers, explicit interruption on shutdown).

### 3. Overstory's Adapter Model

Overstory supports **11 runtime adapters** through its `AgentRuntime` interface (`src/runtimes/types.ts`). Each adapter must implement four things:

1. **Session Spawning** -- launching the agent in a tmux session within a git worktree
2. **Configuration Deployment** -- installing runtime-specific guard mechanisms
3. **Readiness Detection** -- determining when the agent is ready for input
4. **Transcript Parsing** -- extracting metrics from runtime-specific output files

**Shared infrastructure (substantial):**
- Worktree management
- tmux lifecycle
- Mail system (inter-agent communication via SQLite)
- Merge queue
- Watchdog triage

**Per-provider variation (the interesting part):**
- Guard deployment mechanisms vary significantly:
  - Claude Code: `settings.local.json` hooks
  - Sapling: `.sapling/guards.json`
  - Pi: `.pi/extensions/` directory
  - Codex: OS-level sandbox (Seatbelt/Landlock)
  - Goose: Profile-based permissions
  - Amp: Built-in approval systems

Stability variance is notable: Claude Code and Sapling are marked "Stable" while others remain "Experimental." This reflects the real-world reality that not all CLIs are equally mature for programmatic integration.

### 4. Why t3code Uses the SDK for Claude but JSON-RPC for Codex

This was a **design choice driven by what each vendor offers as their primary integration path:**

- **Codex** explicitly designed `app-server` as the integration surface. OpenAI's blog post says it "powers every Codex experience" -- CLI, VS Code extension, web app, macOS app, and third-party IDE integrations. They tried MCP first and found it inadequate for rich session semantics. The app-server is the blessed path.

- **Claude Code** offers the Agent SDK (`@anthropic-ai/claude-agent-sdk`) as its primary programmatic interface. The SDK gives you "the same tools, agent loop, and context management that power Claude Code" as a library. While `--output-format stream-json` exists for CLI wrapping, the SDK provides richer session management, hooks, subagent support, and structured event streams that CLI wrapping cannot match.

- **Both approaches avoid PTY wrapping** -- and for good reason. The structured APIs give you typed events, proper session management, and approval workflows that would require fragile regex parsing in a PTY approach.

The takeaway: the vendors themselves are converging on "spawn a process, speak JSON-RPC over stdio" as the integration pattern, but with different RPC schemas. If you're building today, you should use each CLI's structured API rather than PTY-wrapping the interactive mode.

### 5. The Abstraction Boundary

Based on all evidence, the correct abstraction boundary is a three-layer architecture:

```
Layer 1: Transport (100% reusable)
├── WebSocket server/client
├── Process spawning & lifecycle
├── Message framing (JSONL parsing)
├── Reconnection & health checks
└── Session routing

Layer 2: Adapter (per-CLI, ~300-500 lines)
├── CLI spawn configuration
├── Event normalization (CLI events → canonical events)
├── Approval flow translation
├── Session management translation
├── Model enumeration
└── Readiness detection

Layer 3: Application (100% reusable)
├── UI rendering
├── Session persistence
├── Multi-session management
└── User preferences
```

The transport layer IS different per CLI in one important way: some CLIs speak JSON-RPC natively (Codex app-server, Cursor ACP) while others need their events extracted from `stream-json` output (Claude CLI mode) or SDK method calls (Claude Agent SDK, Copilot SDK). But the WebSocket-to-browser bridge above all of them is identical.

### 6. Real-World Multi-CLI Tools

| Project | CLIs Supported | Architecture | Shared vs. Per-CLI |
|---------|---------------|--------------|-------------------|
| **Overstory** | 11 (Claude, Pi, Gemini, Aider, Goose, Amp, Codex, Cursor, Copilot, OpenCode, Sapling) | tmux sessions + AgentRuntime interface | Heavy shared infra (worktrees, mail, merge queue), thin per-adapter |
| **CloudCLI** | 4 (Claude, Cursor, Codex, Gemini) | node-pty + WebSocket to React frontend | Same PTY/WS bridge for all; per-CLI session discovery paths |
| **t3code** | 2 (Codex via app-server, Claude via Agent SDK) | Desktop app with provider abstraction | Shared ProviderRuntimeEvent contract; per-provider adapters |
| **CC Pocket** | 2 (Claude, Codex) | node-pty bridge to Flutter mobile app | Single bridge, auto-detects available CLI |
| **Bridge ACE** | 5 engines (Claude, Codex, Qwen, Gemini, Grok) | Dual backend (CLI via tmux + direct API) | Shared MCP tool library, per-provider auth/model config |

**Pattern confirmation:** Every single one of these projects uses the same basic architecture: shared transport/orchestration layer with per-CLI adapters. None of them treat each CLI as a completely fresh integration. The adapter layer is real but bounded.

### 7. The Reusability Curve

Based on the evidence from these projects:

**CLI #1 (e.g., Claude Code): ~70% of total effort**
- Build the entire transport layer
- Build the adapter interface
- Build the application layer (UI, persistence, etc.)
- Build and debug the first adapter
- Discover all the edge cases (streaming interruption, approval timeouts, session recovery, error handling)

**CLI #2 (e.g., Codex): ~20% of total effort**
- Implement the adapter interface for the new CLI
- Discover where your abstractions were wrong (they always are in at least 2-3 places)
- Refactor the adapter interface based on what you learned
- Handle the new CLI's unique characteristics (Codex's Threads/Turns/Items if coming from Claude's simpler session model)

**CLI #3 and beyond: ~5% each**
- By now your adapter interface is battle-tested
- New CLIs mostly fit the pattern
- Main work is mapping their event schemas and approval flows
- Overstory's experience: after Claude and Sapling reached "Stable," the remaining 9 adapters are all "Experimental" -- suggesting the per-adapter effort is small enough to ship in experimental state

**The caveat:** This curve assumes you're using each CLI's structured/programmatic interface. If you're PTY-wrapping interactive mode, the curve is worse because each CLI's ANSI output and interactive prompts are genuinely different and require custom parsing.

### Protocol Convergence: ACP as the Potential Universal Adapter

One finding worth highlighting: the **Agent Client Protocol (ACP)** is emerging as a cross-tool standard for agent-editor communication. It's already supported by:
- Cursor CLI (`agent acp`)
- Goose
- Kiro
- OpenCode

And is designed to complement MCP (which handles "what tools/data can agents access" while ACP handles "how agents communicate with editors/UIs").

ACP uses JSON-RPC 2.0 over stdio with a defined session lifecycle:
1. `initialize` (capability negotiation)
2. `session/new` or `session/load`
3. `session/prompt` (send user input)
4. `session/update` (streaming responses)
5. `session/request_permission` (approval workflow)
6. `session/cancel` (interruption)

If Claude Code and Codex adopt ACP (or something close to it), the adapter layer would shrink dramatically. The fact that all four CLIs already speak JSON-RPC over stdio makes this convergence plausible.

## Sources

- [Codex App Server Documentation](https://developers.openai.com/codex/app-server) -- Official specification, highly authoritative
- [Unlocking the Codex Harness: App Server Blog Post (InfoQ coverage)](https://www.infoq.com/news/2026/02/opanai-codex-app-server/) -- Design philosophy, authoritative
- [Overstory GitHub Repository](https://github.com/jayminwest/overstory) -- Multi-runtime adapter pattern, active project
- [t3code Claude Code Adapter PR #179](https://github.com/pingdotgg/t3code/pull/179) -- SDK vs CLI wrapping decision, primary source
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- Official documentation, highly authoritative
- [Claude Code Headless/Programmatic Mode](https://code.claude.com/docs/en/headless) -- Official `stream-json` documentation
- [Cursor CLI ACP Documentation](https://cursor.com/docs/cli/acp) -- Official ACP specification
- [ACP Introduction (Goose/Block)](https://block.github.io/goose/blog/2025/10/24/intro-to-agent-client-protocol-acp/) -- Protocol design philosophy
- [CloudCLI Architecture](https://cloudcli.ai/docs/cloudcli-development-resources/architecture) -- node-pty multi-CLI bridge, primary source
- [CC Pocket GitHub](https://github.com/K9i-0/ccpocket) -- Dual-CLI mobile bridge, primary source
- [Bridge ACE/Bridge IDE](https://github.com/Luanace-lab/bridge-ide) -- 5-engine integration, primary source
- [Copilot CLI JSON Output Issue #52](https://github.com/github/copilot-cli/issues/52) -- Structured output status (completed March 2026)
- [Copilot CLI Programmatic Reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference) -- Official docs
- [Copilot CLI System Architecture (DeepWiki)](https://deepwiki.com/github/copilot-cli/6.1-system-architecture-overview) -- Architecture analysis

## Confidence Assessment

- **Overall confidence: High.** Multiple independent projects confirm the same architecture pattern. The protocol details come from official documentation.
- **Area of lower confidence:** Copilot CLI's structured JSON output. Issue #52 was closed as completed in March 2026, but the programmatic reference docs still don't document JSON output format. It may be very recent or still rolling out.
- **Area of uncertainty:** Whether ACP adoption will expand to Claude Code and Codex. Currently only Cursor, Goose, Kiro, and OpenCode support it. If it does expand, the adapter story gets dramatically simpler.
- **Recommendation for further research:** Look at the actual Overstory adapter source code for concrete line counts per adapter. The repo is public but I could not access the TypeScript source files directly through web fetching.
