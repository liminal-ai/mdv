# Programmatic Control of AI Agent CLIs — Research Report

**Date**: 2026-03-25
**Scope**: Claude Code CLI, GitHub Copilot CLI, Cursor CLI, OpenAI Codex CLI, multi-provider patterns, ACP

---

## Summary

All four major AI coding CLIs now support non-interactive/programmatic modes, but they vary significantly in maturity and architecture. **Claude Code** has the most developed programmatic story: a `-p` flag for one-shot use, `--output-format stream-json` for NDJSON streaming, `--input-format stream-json` for bidirectional stdin control (undocumented but functional), and a full Agent SDK (TypeScript + Python) with session management, subagents, hooks, and MCP integration. **GitHub Copilot CLI** has a proper SDK (`@github/copilot-sdk`) using JSON-RPC 2.0 over stdio, available in Node.js, Python, Go, and .NET, though it remains in Technical Preview and recently had a breaking protocol migration from `--headless --stdio` to `--acp --stdio`. **Cursor** has a headless mode with `-p`, stream-json output, and a Background Agent API, but its programmatic surface is thinner. **Codex CLI** has `codex exec` for scripted runs with `--json` output, three approval modes, and MCP support, but no documented bidirectional streaming protocol.

The emerging pattern is: each CLI exposes a non-interactive print mode, most support NDJSON streaming, and the real programmatic control comes from wrapping the CLI as a subprocess (spawning it, feeding stdin, parsing stdout). Multi-provider orchestration is nascent -- a few open-source projects exist (overstory, all-agents-mcp) but none are production-grade. The protocol landscape (ACP, A2A, MCP) is fragmented and still settling.

---

## 1. Claude Code CLI

### Modes and Flags

| Flag | Purpose |
|------|---------|
| `-p` / `--print` | Non-interactive mode. Runs prompt and exits. |
| `--bare` | Skips auto-discovery of hooks, skills, plugins, MCP servers, auto memory, CLAUDE.md. Skips OAuth/keychain. Recommended for scripted use. Will become default for `-p` in a future release. |
| `--output-format text\|json\|stream-json` | Controls response format. `text` = plain text (default), `json` = structured JSON with session_id/metadata, `stream-json` = NDJSON for real-time streaming. |
| `--input-format stream-json` | Accepts NDJSON messages on stdin for bidirectional programmatic control. **Undocumented beyond CLI flags table.** |
| `--verbose` | Includes internal events in stream output. |
| `--include-partial-messages` | Streams tokens as they are generated (use with stream-json). |
| `--json-schema` | Constrains output to a JSON Schema (use with `--output-format json`). |
| `--allowedTools` | Pre-approves tools to avoid permission prompts (e.g., `"Read,Edit,Bash"`). |
| `--append-system-prompt` | Adds instructions while keeping default behavior. |
| `--system-prompt` | Fully replaces the default system prompt. |
| `--continue` | Continues most recent conversation. |
| `--resume <session-id>` | Continues a specific conversation by session ID. |
| `--mcp-config` | Loads MCP server configuration (in bare mode). |
| `--settings` | Loads settings file or JSON (in bare mode). |
| `--agents` | Loads custom agent definitions as JSON. |

### What is `--output-format stream-json`?

NDJSON (newline-delimited JSON). Each line is a JSON object representing an event. Event types include:

- `system` events (subtypes: `init`, `api_retry`)
- `assistant` events (text content, tool use)
- `stream_event` events (with `delta` containing `text_delta` for token-level streaming)
- `result` events (final output)

Example for filtering text deltas:
```bash
claude -p "Write a poem" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

### What is `--input-format stream-json`?

This is the **only CLI mechanism for bidirectional programmatic communication** with Claude Code. It is effectively undocumented -- GitHub issue #24594 requesting documentation was closed as "not planned." The format has been reverse-engineered from third-party projects.

**Reverse-engineered message format (NDJSON on stdin):**

User message:
```json
{"type": "user", "message": {"role": "user", "content": "..."}, "parent_tool_use_id": null, "session_id": "..."}
```

Permission response:
```json
{"type": "control_response", ...}
```

**Initialization flow (on stdout):**
1. CLI emits `system/init` with `session_id`, `tools`, `mcp_servers`, `model`, `permissionMode`, etc.
2. Permission requests arrive as `control_request` with subtype `can_use_tool`.
3. You respond on stdin with `control_response` (allow/deny).

### Can you run a long-lived interactive session programmatically?

**Via CLI**: Yes, using `--input-format stream-json --output-format stream-json`. The process stays alive and accepts messages on stdin. But this is undocumented and fragile.

**Via Agent SDK (recommended)**: The TypeScript SDK provides proper session management:

- **V1 API**: `query()` returns an async generator. For multi-turn, pass an `AsyncIterable<SDKUserMessage>` as the prompt. Resume sessions with `{ resume: sessionId }`.
- **V2 API (preview, unstable)**: `createSession()` returns an `SDKSession` with `send()` and `stream()` methods. Much cleaner for multi-turn. `resumeSession(sessionId)` for persistence across process restarts.

```typescript
// V2 preview -- cleanest multi-turn API
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

await using session = unstable_v2_createSession({ model: "claude-opus-4-6" });

await session.send("Hello!");
for await (const msg of session.stream()) {
  // process messages
}

await session.send("Follow up");
for await (const msg of session.stream()) {
  // process messages
}
```

### MCP Integration

Claude Code supports MCP servers via:
- `.mcp.json` in project root (auto-discovered unless `--bare`)
- `--mcp-config` flag (explicit, works with `--bare`)
- SDK: `mcpServers` option in `query()` / `createSession()`
- In-process MCP servers via `createSdkMcpServer()` with `tool()` helper

MCP servers can be stdio (local subprocess) or SSE (remote). The SDK can also create in-process MCP tools using Zod schemas.

### Agent SDK Summary

| Feature | V1 (stable) | V2 (preview, unstable) |
|---------|-------------|----------------------|
| Package | `@anthropic-ai/claude-agent-sdk` | Same package |
| Multi-turn | AsyncIterable prompt + generator | `send()` / `stream()` |
| Session resume | `{ resume: sessionId }` | `resumeSession(sessionId)` |
| Session fork | Supported | Not yet |
| Hooks | PreToolUse, PostToolUse, Stop, etc. | Same |
| Subagents | Via `agents` option + Agent tool | Same |
| MCP | `mcpServers` option | Same |
| Python | `claude_agent_sdk.query()` | Not mentioned for Python |
| Current versions | TS: v0.2.71, Python: v0.1.48 | -- |

---

## 2. GitHub Copilot CLI

### Overview

GA as of February 2026. Copilot CLI (`copilot`) is a terminal-based coding agent.

### Programmatic Modes

| Flag | Purpose |
|------|---------|
| `-p PROMPT` | Non-interactive mode. Runs prompt and exits. |
| `-s` | Suppress output for cleaner script integration. |
| `--allow-tool` | Pre-approve specific tools. |
| `--allow-url` | Pre-approve URL access. |

### SDK (Technical Preview)

The real programmatic story is the **Copilot SDK** (`@github/copilot-sdk`), available in Node.js, Python, Go, .NET, and Java.

**Architecture:**
```
Your App -> SDK Client -> JSON-RPC 2.0 -> Copilot CLI (server mode)
```

**Transport:** stdio (default) or TCP. The SDK manages the CLI process lifecycle automatically.

**Protocol:** JSON-RPC 2.0 over NDJSON. Handles:
- Initialization
- Session creation
- Prompting
- Streaming responses
- Cancellation
- Permission management

**Recent breaking change (Feb 2026):** Copilot CLI removed `--headless --stdio` flags and replaced them with `--acp --stdio`. The SDK v0.1.23+ mitigates this by passing `--no-auto-update` to prevent runtime version drift.

**Key detail:** The Copilot CLI binary is a thin launcher that downloads newer versions to `~/.copilot/pkg/universal/` and delegates execution at runtime. Without `--no-auto-update`, applications experience unexpected version drift.

**Custom slash commands:** SDK clients can register custom slash commands when starting or joining a session (as of v1.0.10, March 2026).

### Current limitations
- SDK is Technical Preview, not production-ready
- Protocol recently broke downstream integrations
- The ACP protocol used internally is NDJSON JSON-RPC but specifics are not fully documented publicly

---

## 3. Cursor CLI

### Overview

Cursor has a CLI (`cursor-cli` or the `cursor` command) with headless mode.

### Programmatic Modes

| Flag | Purpose |
|------|---------|
| `-p` / `--print` | Headless/non-interactive mode |
| `--force` / `--yolo` | Skip file modification confirmations |
| `--output-format text\|json\|stream-json` | Response format control |
| `--stream-partial-output` | Incremental streaming of text deltas |

**Authentication:** `CURSOR_API_KEY` environment variable.

**Stream-json events** include: system initialization, assistant text with incremental deltas, tool calls (read/write) with start/completion states, final result with duration metrics.

### Background Agents

Cursor's distinctive feature is **Background Agents** -- cloud-based agents that run asynchronously:
- Push tasks to cloud agents
- Monitor at cursor.com/agents
- Results available on web/mobile
- Free plan: headless CLI only; paid plans: Background Agent API

### Automations (Beta)

**Cursor Automations** allow defining agents that trigger on schedules or external events:
- Cloud sandbox execution
- MCP server integration
- Memory across runs
- No human presence required

### Programmatic SDK

Cursor offers SDKs in Python, TypeScript, and CLI for custom automation, CI/CD pipelines, and batch processing. Details are sparse compared to Claude Code or Copilot.

### CLI commands (Jan 2026)

- `--list-models` to list and switch models
- `/rules` to create/edit rules from CLI
- `/mcp enable` and `/mcp disable` for MCP management

### Current limitations
- Thinner programmatic API surface than Claude Code
- No documented bidirectional stdin protocol
- Background Agents require paid plans
- Less mature SDK documentation

---

## 4. OpenAI Codex CLI

### Overview

Terminal-first coding agent with interactive TUI and non-interactive execution.

### Modes

| Mode | Description |
|------|-------------|
| `codex` | Interactive TUI (default) |
| `codex exec` / `codex e` | Non-interactive scripted execution |
| `codex app` | macOS desktop application |
| `codex resume` | Resume previous sessions |

### Automation Flags

| Flag | Purpose |
|------|---------|
| `--full-auto` | Sets `--ask-for-approval on-request` + `--sandbox workspace-write` |
| `--ask-for-approval untrusted\|on-request\|never` | Controls approval behavior |
| `--yolo` / `--dangerously-bypass-approvals-and-sandbox` | No approvals, no sandbox |
| `--json` | Machine-readable JSON progress output (with `exec`) |
| `--output-last-message` | Capture final natural-language summary |
| `--ephemeral` | Don't persist session files |
| `-i <file>` | Attach image/screenshot input |

### Sandbox modes
- **Auto** (default): Read, edit, run within working directory
- **Read-only**: Browse files only
- **Full Access**: Work across machine with network access

### MCP Support

Codex supports MCP servers configured in config files. STDIO and HTTP server types supported. Servers launch automatically, exposing tools alongside built-ins.

### Codex as MCP Server

Codex can itself run as an MCP server, enabling orchestration via the OpenAI Agents SDK.

### Current limitations
- No documented bidirectional streaming protocol like Claude Code's `--input-format stream-json`
- `codex exec` is fire-and-forget -- no mid-session interaction
- `--json` provides progress events but is not as granular as Claude's stream-json

---

## 5. Common Patterns and Multi-Provider Projects

### Emerging Patterns

1. **Non-interactive print mode**: All four CLIs support `-p` or equivalent. This is the minimum viable programmatic interface.

2. **NDJSON streaming**: Claude Code (`stream-json`), Cursor (`stream-json`), Codex (`--json` with exec) all emit newline-delimited JSON. Copilot uses JSON-RPC over NDJSON.

3. **Subprocess wrapping**: The most common integration pattern is spawning the CLI as a child process, feeding stdin, parsing stdout. This is how the Copilot SDK works, how claude-flow works, and how all-agents-mcp worked.

4. **Session persistence**: All CLIs support resuming conversations via session IDs. This enables multi-turn workflows across process boundaries.

5. **MCP as the universal tool protocol**: All four CLIs support MCP for tool integration. MCP is the closest thing to a universal standard in this space.

### Multi-Provider Projects

#### overstory (github.com/jayminwest/overstory)
- **Most mature multi-CLI orchestrator found**
- 1,278 commits, 37+ CLI commands
- Pluggable `AgentRuntime` interface with adapters for 11 runtimes: Claude Code (stable), Sapling (stable), Pi/Copilot/Cursor/Codex/Gemini/Aider/Goose/Amp/OpenCode (experimental)
- Architecture: Orchestrator -> Coordinator -> Supervisor -> Workers (Scout/Builder/Reviewer/Merger)
- Each agent runs in isolated git worktree via tmux
- SQLite-backed mail system for inter-agent messaging
- FIFO merge queue with 4-tier conflict resolution
- Tiered watchdog (mechanical daemon + AI triage + monitor agent)
- Guard mechanisms vary by runtime (settings.json hooks for Claude, OS sandbox for Codex, etc.)

#### all-agents-mcp (github.com/Dokkabei97/all-agents-mcp) -- ARCHIVED
- MCP server that orchestrated Claude Code, Codex, Gemini CLI, Copilot CLI
- Invoked each agent's CLI binary as subprocess
- 14 MCP tools for querying, verification, cross-agent comparison
- Recursive call prevention (excludes calling agent)
- **Archived March 2026** -- developer moved to Skills-based integration, noting "direct CLI invocation + Skills-based integration has become the more practical and mainstream approach"

#### ai-code-interface.el (github.com/tninja/ai-code-interface.el)
- Unified Emacs interface for Codex, Copilot CLI, Claude Code, Gemini CLI, Opencode
- Thin wrapper approach

#### claude-flow (github.com/ruvnet/ruflo)
- Multi-agent orchestration specifically for Claude Code
- Stream-JSON chaining: piping output of one `claude -p` process to another via `--input-format stream-json` / `--output-format stream-json`
- 64 specialized agents, pair programming mode, truth verification
- **Caveat**: API examples have not been independently verified against a stable release. Treat documented capabilities as intent, not proven.

#### GitHub Agent HQ
- Official GitHub platform: run Claude, Codex, and Copilot agents in one place
- Unified governance, shared context, shared memory
- Available in VS Code and github.com
- Claude and Codex available for Copilot Business & Pro users (Feb 2026)

#### VS Code Multi-Agent
- VS Code positioning itself as "home for multi-agent development"
- Third-party agents can register via ACP
- Cursor joined the ACP registry and is available in JetBrains IDE (March 2026)

### Protocol Landscape

| Protocol | Purpose | Status |
|----------|---------|--------|
| **MCP** (Model Context Protocol) | Agent-to-tool communication | De facto standard. All four CLIs support it. |
| **ACP** (Agent Client Protocol) | Editor-to-agent communication | See section 6 below. |
| **A2A** (Agent-to-Agent Protocol) | Agent-to-agent communication | Google-originated, Linux Foundation. 150+ org supporters. ACP team merging into A2A. |
| **JSON-RPC 2.0** | Low-level RPC | Used by Copilot SDK and ACP internally. |

---

## 6. ACP (Agent Client Protocol)

### What It Is

ACP is a protocol for communication between code editors/IDEs and coding agents. It mirrors the Language Server Protocol (LSP) pattern: standardize how editors talk to agents so any agent works with any editor.

- **Transport**: JSON-RPC over stdio (local) or HTTP/WebSocket (remote, WIP)
- **Text format**: Markdown
- **Positioning**: "The LSP of AI agents"

### Current Status

- ACP is used by VS Code/GitHub for third-party agent integration
- Copilot CLI migrated from `--headless --stdio` to `--acp --stdio` (Feb 2026)
- Cursor joined the ACP registry (March 2026, also available in JetBrains IDE)
- **ACP team is winding down active development** and merging into Google's A2A protocol under the Linux Foundation

### Known Limitations

1. **Incomplete tooling and SDK support** -- Testing utilities, logging frameworks, and language-specific integrations are still maturing.
2. **Lack of widespread standardization** -- Teams implement with deviations. Many still build custom communication layers.
3. **Authentication complexity** -- Open auth schemes supported but practical cross-org security (multi-tenant auth, fine-grained ACL) is a work in progress.
4. **Protocol efficiency** -- REST-based, not optimal for all communication patterns despite streaming support.
5. **Remote agents not ready** -- "Full support for remote agents is a work in progress."
6. **Merging into A2A** -- The protocol's future is uncertain as it consolidates into A2A, which may change the API surface.
7. **Breaking changes** -- The Copilot `--headless --stdio` to `--acp --stdio` migration broke downstream integrations without deprecation notice.

### Why to be cautious

ACP is a moving target. It recently caused a breaking change in the Copilot SDK ecosystem, it is actively merging into a different protocol (A2A), and its remote agent story is incomplete. Building on it directly carries protocol instability risk.

---

## Sources

### Claude Code
- [Run Claude Code programmatically (headless docs)](https://code.claude.com/docs/en/headless) -- Official docs, highly authoritative
- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- Official Anthropic docs
- [TypeScript SDK reference](https://platform.claude.com/docs/en/agent-sdk/typescript) -- Official API reference
- [TypeScript V2 preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview) -- Official, unstable preview
- [Python SDK reference](https://platform.claude.com/docs/en/agent-sdk/python) -- Official API reference
- [Issue #24594: --input-format stream-json undocumented](https://github.com/anthropics/claude-code/issues/24594) -- Closed as not planned
- [Issue #733: Streaming output in --verbose --print](https://github.com/anthropics/claude-code/issues/733) -- GitHub issue

### GitHub Copilot CLI
- [Copilot CLI repository](https://github.com/github/copilot-cli) -- Official GitHub repo
- [Copilot CLI GA announcement](https://github.blog/changelog/2026-02-25-github-copilot-cli-is-now-generally-available/) -- Feb 2026
- [Copilot SDK repository](https://github.com/github/copilot-sdk) -- Official, Technical Preview
- [@github/copilot-sdk on npm](https://www.npmjs.com/package/@github/copilot-sdk) -- Official package
- [Issue #1606: --headless --stdio removal](https://github.com/github/copilot-cli/issues/1606) -- Breaking change documentation
- [Copilot SDK on DeepWiki](https://deepwiki.com/github/copilot-sdk) -- Third-party analysis

### Cursor
- [Using Headless CLI (Cursor Docs)](https://cursor.com/docs/cli/headless) -- Official docs
- [Cursor Beta Features 2026](https://markaicode.com/cursor-beta-features-2026/) -- Blog, Feb 2026
- [Cursor 2.4 Updates](https://theagencyjournal.com/cursors-fresh-2-4-drop-agents-level-up-and-cli-gets-smarter/) -- Blog, Feb 2026
- [Cursor Joined ACP Registry](https://blog.jetbrains.com/ai/2026/03/cursor-joined-the-acp-registry-and-is-now-live-in-your-jetbrains-ide/) -- JetBrains blog, March 2026

### OpenAI Codex CLI
- [Codex CLI command line options](https://developers.openai.com/codex/cli/reference) -- Official docs
- [Codex CLI features](https://developers.openai.com/codex/cli/features) -- Official docs
- [Codex CLI overview](https://developers.openai.com/codex/cli) -- Official docs
- [Codex changelog](https://developers.openai.com/codex/changelog) -- Official

### Multi-Provider Projects
- [overstory](https://github.com/jayminwest/overstory) -- Multi-runtime orchestration, most mature found
- [all-agents-mcp](https://github.com/Dokkabei97/all-agents-mcp) -- Archived March 2026
- [ai-code-interface.el](https://github.com/tninja/ai-code-interface.el) -- Emacs unified interface
- [claude-flow](https://github.com/ruvnet/ruflo) -- Claude-specific orchestration, unverified claims
- [GitHub Agent HQ announcement](https://github.blog/news-insights/company-news/pick-your-agent-use-claude-and-codex-on-agent-hq/) -- Official GitHub
- [VS Code multi-agent development](https://code.visualstudio.com/blogs/2026/02/05/multi-agent-development) -- Official VS Code blog

### ACP / Protocols
- [Agent Client Protocol](https://agentclientprotocol.com/) -- Official site
- [Top AI Agent Protocols 2026](https://getstream.io/blog/ai-agent-protocols/) -- Overview article
- [JetBrains ACP documentation](https://www.jetbrains.com/help/ai-assistant/acp.html) -- Official JetBrains docs

---

## Confidence Assessment

**Overall confidence: HIGH** for Claude Code details (official docs + reverse-engineered internals well documented). **MEDIUM-HIGH** for Copilot and Codex (official docs exist but SDK is preview). **MEDIUM** for Cursor (thinner public documentation). **MEDIUM** for multi-provider patterns (projects exist but maturity varies widely).

**Areas of uncertainty:**
- Claude Code `--input-format stream-json` exact message schema -- reverse-engineered, not officially documented, may change
- Copilot SDK stability post-ACP migration -- protocol just changed, may change again
- Cursor SDK details -- less public documentation than competitors
- claude-flow claims -- not independently verified

**Key risk:**
- ACP is merging into A2A. Any integration built on ACP directly may need rework.
- The `--input-format stream-json` on Claude Code is undocumented and the documentation request was closed as "not planned" -- this suggests Anthropic wants people to use the Agent SDK instead.
- Copilot's thin-launcher auto-update pattern can cause version drift in production without `--no-auto-update`.
