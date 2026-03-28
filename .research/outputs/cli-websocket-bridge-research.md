# Wrapping CLI Tools Behind WebSocket Servers: State of the Art

**Date**: 2026-03-25
**Focus**: AI agent CLIs (Claude Code, Copilot CLI, Codex CLI) and general CLI-to-WebSocket bridging

---

## Summary

There are three distinct tiers of solutions in this space, and they solve fundamentally different problems:

**Tier 1 -- Raw terminal relay** (ttyd, GoTTY, node-pty+xterm.js): These give you a PTY in a browser over WebSocket. They relay raw terminal bytes bidirectionally. No structure, no message framing, no control flow beyond terminal escape sequences. This is a solved problem with mature implementations in C (ttyd, 11.3k stars) and Go (GoTTY). These are not what you want for structured agent communication.

**Tier 2 -- Process-to-WebSocket bridges** (websocketd, websockify, kkrpc): These turn stdin/stdout into WebSocket messages with some framing. websocketd (17.6k stars, Go, unmaintained since 2021) is the canonical example but uses newline-delimited messages with no structured protocol. kkrpc (TypeScript) is the most interesting modern alternative -- it supports JSON-RPC over stdio, HTTP, and WebSocket with full bidirectional RPC, type safety, and multiple transport adapters. websockify bridges WebSocket to raw TCP, not CLI processes.

**Tier 3 -- Agent SDKs that bypass the CLI entirely**: Both Claude Code and OpenAI Codex now offer SDKs (TypeScript and Python) that give you the same agent loop and tools as the CLI but as a library you embed directly. This is the officially supported path for programmatic control and eliminates the need for a WebSocket bridge entirely -- you'd build your WebSocket server around the SDK, not around a CLI process. The Claude Agent SDK streams structured JSON events (message_start, content_block_delta, tool_use, etc.) via an async iterator.

The practical answer for your use case is likely: use the Claude Agent SDK (TypeScript) as the backend engine, expose it over WebSocket from your Fastify server, and skip the PTY/stdio wrapping layer entirely. For cases where you genuinely need to wrap a CLI process (e.g., third-party tools without SDKs), a custom bridge using node-pty with JSON message framing over WebSocket is the pattern, since no off-the-shelf tool does structured CLI-to-WebSocket bridging well.

---

## Key Findings

- **Claude Code has a full Agent SDK** (TypeScript and Python) that gives you programmatic streaming control without wrapping the CLI. The `query()` function returns an async iterator of typed events (StreamEvent, AssistantMessage, ResultMessage). No PTY needed.
- **The CLI's `--output-format stream-json`** outputs NDJSON events to stdout, which could be piped through a bridge, but the SDK is the intended integration path.
- **OpenAI Codex CLI** has `codex exec` headless mode with JSONL event output, and an SDK proposal (Issue #2772) for TypeScript/Python programmatic control similar to Claude's.
- **websocketd is effectively dead** -- last release 2021, no active maintenance, 54 open issues. The pattern it established (newline-delimited stdio-to-WebSocket) lives on but the tool itself is abandoned.
- **ttyd is the best-maintained PTY-to-WebSocket bridge** (C, 11.3k stars, last release March 2024) but it's a terminal emulator relay, not a structured message bridge.
- **AgentDock** wraps Claude Code via tmux sessions with WebSocket streaming (Bun + Hono + xterm.js), polling tmux output at ~200ms intervals rather than using node-pty directly.
- **Agentrove** wraps Claude Code via the Agent SDK in Docker containers with a FastAPI + React stack.
- **No production-ready structured CLI-to-WebSocket bridge exists** that adds JSON-RPC framing, session management, reconnection, and flow control over an arbitrary CLI process.

---

## Detailed Analysis

### 1. Claude Code Programmatic Control

Claude Code offers three levels of programmatic access, from least to most structured:

**CLI with `-p` flag (headless mode)**
```bash
claude -p "Fix the bug" --output-format stream-json --verbose --include-partial-messages
```
Outputs NDJSON to stdout. Each line is a JSON event with types like `stream_event`, `assistant`, `result`, `system/api_retry`. Session continuation via `--resume <session_id>`. This could be piped through a bridge but you'd be parsing CLI output rather than using a proper API.

**CLI output formats:**
- `text` -- plain text (default)
- `json` -- single JSON object with result, session_id, cost, duration
- `stream-json` -- NDJSON for real-time streaming, event types include `content_block_delta` with `text_delta`

**Agent SDK (TypeScript/Python) -- recommended path**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    includePartialMessages: true
  }
})) {
  // message.type is one of: "stream_event", "assistant", "result", "system"
  if (message.type === "stream_event") {
    // Raw Claude API streaming events (content_block_delta, etc.)
  }
}
```

Key SDK capabilities:
- Async iterator returns typed messages (StreamEvent, AssistantMessage, ResultMessage, SystemMessage)
- Session management with `resume: sessionId`
- Hooks (PreToolUse, PostToolUse, Stop, etc.) for intercepting agent behavior
- Subagent spawning with `parent_tool_use_id` tracking
- MCP server integration
- Structured output via JSON Schema
- `--bare` mode for stripped-down startup (no hooks, skills, MCP auto-discovery)
- TS package at v0.2.71 on npm, Python at v0.1.48 on PyPI (as of March 2026)

**Limitation**: Streaming is incompatible with extended thinking (when `maxThinkingTokens` is explicitly set). Structured output only appears in final `ResultMessage.structured_output`, not as streaming deltas.

**Remote Control (February 2026 research preview)**: Control Claude Code sessions remotely via claude.ai/code web interface or mobile apps. This is Anthropic's own answer to "Claude Code in a browser" but it's a managed service, not self-hosted.

### 2. OpenAI Codex CLI

Codex CLI has `codex exec` for headless/non-interactive execution:
- Outputs events as JSONL to stdout via `EventProcessorWithJsonOutput`
- Can be orchestrated as an MCP server
- A proposal (GitHub Issue #2772) exists for a Codex SDK matching Claude's pattern
- Authentication for headless: `OPENAI_API_KEY` environment variable

### 3. GitHub Copilot CLI

Copilot CLI reached GA in February 2026. It's a full agentic coding environment in the terminal. Ships with GitHub's MCP server and supports custom MCP servers. No documented headless/SDK mode for programmatic wrapping -- it's designed as an interactive terminal tool.

### 4. PTY-Based WebSocket Bridges

**ttyd** (C, 11.3k stars, MIT)
- The state of the art for raw terminal-over-web
- Built on libwebsockets + libuv, frontend uses xterm.js
- Features: SSL/TLS, basic auth, HTTP header auth, configurable client limits, ping intervals, CJK/IME support, file transfer (ZMODEM/trzsz), Sixel image rendering
- Session management: `--once` (single client), `--max-clients N`, `--exit-no-conn`
- Terminal resize: handled through standard TTY SIGWINCH mechanism
- Last release: v1.7.7 (March 2024)
- Cross-platform: macOS, Linux, FreeBSD, Windows

**GoTTY** (Go, archived/unmaintained)
- Original inspiration for ttyd
- ttyd is its C port with many improvements
- Two maintained forks: yudai/gotty (original) and sorenisanerd/gotty (maintained fork)

**websockify** (Python, 4.4k stars, LGPL-3.0)
- WebSocket-to-TCP bridge (not CLI wrapping)
- Actively maintained (v0.13.0, February 2025)
- Used by noVNC for VNC-over-browser
- Supports SSL, token-based routing, session recording

**node-pty + xterm.js + WebSocket** (TypeScript/Node.js)
- The standard DIY pattern in the Node.js ecosystem
- node-pty (Microsoft, 3k+ stars): fork pseudoterminals in Node.js
- Typical architecture: node-pty spawns process, Socket.io/ws relays data to xterm.js in browser
- Session management: TerminalManager class pattern with Map<sessionId, ptyProcess>
- Flow control: `handleFlowControl` option with pause/resume messages
- Multiple users: spawn new shell per WebSocket connection
- **Not structured** -- raw terminal byte relay, no JSON framing

### 5. The websocketd Pattern and Alternatives

**websocketd** (Go, 17.6k stars, unmaintained)
- Last release: v0.4.1 (January 2021), last commit June 2023
- Pattern: forks process per WebSocket connection, newline = message boundary
- Limitations: line-buffered only, no binary messages, no session persistence, no reconnection, forks per connection (no multiplexing)
- CGI-like environment variables for request metadata

**Modern alternatives to the websocketd pattern:**

**kkrpc** (TypeScript, 156 stars)
- Most relevant modern alternative for structured CLI bridging
- JSON-RPC protocol over multiple transports: stdio, HTTP, WebSocket, postMessage, Chrome extensions
- Bidirectional RPC with full TypeScript type inference
- IoInterface abstraction for transport-agnostic code
- Uses superjson for rich type serialization (Date, Map, Set, BigInt)
- Middleware/interceptor chains
- Not CLI-wrapping specifically, but provides the RPC layer you'd build on top of

**rpc-websockets** (TypeScript, npm, v9.3.5)
- JSON-RPC 2.0 over WebSocket for Node.js
- Client and server implementations
- Actively maintained

**MCP (Model Context Protocol)**
- Anthropic's open standard (November 2024)
- Uses JSON-RPC 2.0 with tool/resource primitives
- Supports stdio and WebSocket transports natively
- Yonaka's WebSocket MCP Bridge: Go proxy bridging MCP stdio transport to WebSocket
- This is the closest thing to a standardized structured CLI-to-WebSocket bridge in the AI agent space

### 6. Real-World Projects Wrapping AI CLIs

**AgentDock** (TypeScript/Bun, open source)
- Web dashboard for parallel AI coding agents (Claude Code, Cursor)
- Architecture: Bun + Hono backend, React + Vite + xterm.js frontend
- Uses tmux as process management layer (not node-pty)
- WebSocket streams terminal output by polling `tmux capture-pane` at ~200ms
- Input forwarded via `tmux send-keys`
- Session state: ephemeral, tmux-managed, config in `~/.config/agentdock/`
- Bun chosen for fast startup (<100ms), built-in TypeScript, native WebSocket

**Agentrove** (Python + TypeScript, Apache 2.0, 248 stars)
- Self-hosted web UI for Claude Code
- Backend: FastAPI + SQLAlchemy + PostgreSQL/Redis
- Frontend: React 19 + Vite + TailwindCSS
- Uses claude-agent-sdk to drive Claude Code (not CLI wrapping)
- Docker container isolation per workspace
- Multi-provider bridge (OpenRouter, GitHub Copilot, etc.)
- v0.1.19, under active development

**claude-flow / ruflo** (TypeScript)
- Stream-JSON chaining: pipes multiple `claude -p` processes via NDJSON
- Supports merge/join, conditional routing, fan-out/fan-in
- Workflow orchestration across multiple agents
- Real-time monitoring via hooks

**Agent Flow** (TypeScript)
- Real-time visualization of Claude Code agent orchestration
- Hooks-based event forwarding to web UI

### 7. Language Considerations for Building a Bridge

**Go**
- Pros: Single binary deployment, excellent concurrency (goroutines), creack/pty for PTY, gorilla/websocket for WebSocket, ttyd and websocketd both chose Go (websocketd) or C (ttyd) for good reasons
- Cons: Less natural for JSON manipulation than TypeScript, no async/await pattern
- Best libraries: `creack/pty` (PTY), `gorilla/websocket` (WebSocket), `nhooyr.io/websocket` (modern alternative)
- Performance: Go WebSocket benchmarks show worse raw throughput than Rust or C++ but better developer velocity

**Rust**
- Pros: Fastest WebSocket implementations (wtx, tokio-tungstenite), `portable-pty` crate from wezterm for cross-platform PTY, excellent for high-concurrency scenarios
- Cons: Higher development time, more complex async story, overkill for a bridge that's I/O-bound on the wrapped process
- Best libraries: `portable-pty` (PTY, cross-platform including Windows ConPTY), `tokio-tungstenite` or `axum` (WebSocket)

**TypeScript/Node.js**
- Pros: Same language as your Fastify server, `node-pty` (Microsoft-maintained) for PTY, `ws` for WebSocket, rich JSON-RPC ecosystem, Agent SDK is TypeScript-native
- Cons: node-pty has native compilation dependency (node-gyp), single-threaded event loop (fine for I/O-bound work but CPU-bound parsing could block), GC pauses
- Best libraries: `node-pty` (PTY), `ws` (WebSocket), `@anthropic-ai/claude-agent-sdk` (Claude Code)
- **This is the pragmatic choice** if you're already running Fastify/Node.js

**Python**
- Pros: Agent SDK available, `pty` module built-in, websockify is Python
- Cons: GIL for CPU-bound work, slower than alternatives, less natural for your stack

**Recommendation**: For your Fastify-based architecture, TypeScript/Node.js is the clear choice. You avoid cross-language complexity, get native Agent SDK integration, and node-pty handles the PTY work if you ever need raw terminal wrapping. The Claude Agent SDK returns structured events directly -- no parsing needed. The performance-critical path (LLM inference) is on Anthropic's servers, not in your bridge.

---

## Architecture Recommendation for MD Viewer

Based on this research, the cleanest architecture for wrapping Claude Code behind a WebSocket server:

```
Browser (WebSocket client)
    |
    v
Fastify server (WebSocket via @fastify/websocket)
    |
    v
Claude Agent SDK (TypeScript)
    query() -> async iterator of typed events
    |
    v
Anthropic API (HTTPS)
```

- No PTY, no CLI subprocess, no stdio parsing
- Agent SDK handles the agent loop, tool execution, streaming
- Your Fastify server translates SDK events to WebSocket messages
- Session management via SDK's `resume: sessionId`
- Reconnection: client reconnects WebSocket, resumes SDK session
- Structured messages: SDK events are already typed JSON objects

For wrapping non-SDK CLIs (future tools that only have CLIs):

```
Browser (WebSocket client)
    |
    v
Fastify server (WebSocket)
    |
    v
Bridge layer (node-pty + JSON message framing)
    |
    v
CLI process (PTY)
```

- node-pty spawns process in a pseudoterminal
- Bridge layer adds JSON envelope: `{type, sessionId, data, timestamp}`
- Handles resize (SIGWINCH), flow control, reconnection
- Session manager maps WebSocket connections to PTY processes

---

## Sources

### Claude Code / Agent SDK
- [Claude Code Headless Mode Docs](https://code.claude.com/docs/en/headless) -- Official documentation, highly authoritative
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- Official SDK documentation
- [Agent SDK Streaming](https://platform.claude.com/docs/en/agent-sdk/streaming-output) -- Streaming event types and message flow
- [Claude Agent SDK TypeScript (GitHub)](https://github.com/anthropics/claude-agent-sdk-typescript) -- Official repo
- [SFEIR Institute Claude Code Headless Guide](https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/) -- Third-party tutorial, well-structured

### OpenAI Codex CLI
- [Codex CLI Official Docs](https://developers.openai.com/codex/cli) -- Official documentation
- [Codex SDK Proposal (Issue #2772)](https://github.com/openai/codex/issues/2772) -- Feature request for SDK
- [Codex Headless Execution (DeepWiki)](https://deepwiki.com/openai/codex/4.2-headless-execution-mode-(codex-exec)) -- Third-party documentation

### GitHub Copilot CLI
- [Copilot CLI GA Announcement](https://github.blog/changelog/2026-02-25-github-copilot-cli-is-now-generally-available/) -- Official blog
- [Copilot CLI Repo](https://github.com/github/copilot-cli) -- Official repo

### PTY-to-WebSocket Bridges
- [ttyd (GitHub)](https://github.com/tsl0922/ttyd) -- 11.3k stars, C, actively maintained, MIT
- [GoTTY (GitHub)](https://github.com/yudai/gotty) -- Original, Go, archived
- [websockify (GitHub)](https://github.com/novnc/websockify) -- 4.4k stars, Python, actively maintained
- [node-pty (GitHub)](https://github.com/microsoft/node-pty) -- Microsoft, Node.js PTY

### websocketd and Alternatives
- [websocketd (GitHub)](https://github.com/joewalnes/websocketd) -- 17.6k stars, Go, unmaintained since 2021
- [kkrpc (GitHub)](https://github.com/kunkunsh/kkrpc) -- Multi-transport RPC including stdio+WebSocket, TypeScript
- [rpc-websockets (npm)](https://www.npmjs.com/package/rpc-websockets) -- JSON-RPC 2.0 over WebSocket

### Real-World Projects Wrapping AI CLIs
- [AgentDock (GitHub)](https://github.com/vishalnarkhede/agentdock) -- Web dashboard for parallel AI agents via tmux+WebSocket
- [Agentrove (GitHub)](https://github.com/Mng-dev-ai/claudex) -- Self-hosted Claude Code web UI via Agent SDK
- [claude-flow / ruflo (GitHub)](https://github.com/ruvnet/ruflo) -- Stream-JSON chaining for multi-agent orchestration
- [Agent Flow (GitHub)](https://github.com/patoles/agent-flow) -- Real-time Claude Code agent visualization

### Language/Library References
- [creack/pty (Go)](https://github.com/creack/pty) -- Go PTY library
- [portable-pty (Rust)](https://lib.rs/crates/portable-pty) -- Cross-platform PTY from wezterm
- [cmdr-pty (Go)](https://github.com/updroidinc/cmdr-pty) -- Go WebSocket PTY wrapper
- [WebSocket Performance Comparison](https://matttomasetti.medium.com/websocket-performance-comparison-10dc89367055) -- Cross-language benchmarks

### MCP (Model Context Protocol)
- [Yonaka WebSocket MCP Bridge](https://www.pulsemcp.com/servers/yonaka-websocket-mcp-bridge) -- Go proxy, stdio-to-WebSocket for MCP
- [agentchattr (GitHub)](https://github.com/bcurts/agentchattr) -- WebSocket+MCP multi-agent chat

---

## Confidence Assessment

- **Overall confidence**: **High** -- the landscape is well-mapped and the key players are documented
- **Claude Agent SDK as the primary path**: **High confidence** -- official, well-documented, actively maintained, purpose-built for this exact use case
- **websocketd being dead**: **High confidence** -- no commits since 2023, no releases since 2021
- **No existing structured CLI-to-WebSocket bridge**: **High confidence** -- searched extensively, nothing purpose-built exists
- **Language recommendation (TypeScript)**: **High confidence** for your stack -- pragmatic match with Fastify + Agent SDK
- **Area of uncertainty**: How the Agent SDK handles long-running sessions, memory limits, and cost at scale -- would need hands-on testing
- **Area of uncertainty**: Whether Copilot CLI or Codex CLI will ship proper SDKs -- proposals exist but timelines unclear
